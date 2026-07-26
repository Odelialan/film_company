import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

const DATABASE_VERSION = 2;

function json(value, fallback = null) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

function isoNow() {
  return new Date().toISOString();
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function parseEncryptionKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64");
  return decoded.length === 32 ? decoded : null;
}

function loadEncryptionKey(userDataRoot) {
  const configured = parseEncryptionKey(process.env.FILM_CREDENTIAL_ENCRYPTION_KEY);
  if (configured) return configured;
  if (process.env.FILM_CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error("FILM_CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes.");
  }
  const configuredKeyPath = String(process.env.FILM_CREDENTIAL_ENCRYPTION_KEY_FILE || "").trim();
  if (configuredKeyPath) {
    const keyPath = path.resolve(configuredKeyPath);
    const stat = fs.lstatSync(keyPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("FILM_CREDENTIAL_ENCRYPTION_KEY_FILE must reference a regular private file.");
    }
    const key = parseEncryptionKey(fs.readFileSync(keyPath, "utf8"));
    if (!key) throw new Error("FILM_CREDENTIAL_ENCRYPTION_KEY_FILE must contain exactly 32 encoded bytes.");
    fs.chmodSync(keyPath, 0o600);
    return key;
  }
  const secretsDirectory = path.join(userDataRoot, "_secrets");
  const keyPath = path.join(secretsDirectory, "credential.key");
  ensurePrivateDirectory(secretsDirectory);
  if (fs.existsSync(keyPath)) {
    const key = parseEncryptionKey(fs.readFileSync(keyPath, "utf8"));
    if (!key) throw new Error("The local credential encryption key is invalid.");
    fs.chmodSync(keyPath, 0o600);
    return key;
  }
  const key = randomBytes(32);
  fs.writeFileSync(keyPath, key.toString("hex"), { mode: 0o600, flag: "wx" });
  fs.chmodSync(keyPath, 0o600);
  return key;
}

function encryptSecret(key, plaintext) {
  const value = String(plaintext || "");
  if (!value) return "";
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptSecret(key, payload) {
  const value = String(payload || "");
  if (!value) return "";
  const [version, nonceValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !nonceValue || !tagValue || !ciphertextValue) {
    throw new Error("Encrypted credential has an invalid format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonceValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function directorySize(root) {
  let total = 0;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      const stat = fs.lstatSync(entryPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are forbidden in runtime storage: ${entryPath}`);
      }
      if (stat.isDirectory()) pending.push(entryPath);
      else if (stat.isFile()) total += stat.size;
    }
  }
  return total;
}

function assertMigratableModelUrl(value) {
  const url = new URL(String(value || ""));
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname.toLowerCase());
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    || url.username || url.password || url.search || url.hash) {
    throw new Error("Legacy model profile contains an unsafe base URL.");
  }
}

export class FilmDatabase {
  constructor({
    databasePath,
    userDataRoot,
    projectsRoot,
    usersPath,
    modelConfigPath,
    defaultOwnerEmail = ""
  }) {
    this.databasePath = databasePath;
    this.userDataRoot = userDataRoot;
    this.projectsRoot = projectsRoot;
    this.usersPath = usersPath;
    this.modelConfigPath = modelConfigPath;
    this.defaultOwnerEmail = String(defaultOwnerEmail || "").trim().toLowerCase();
    ensurePrivateDirectory(path.dirname(databasePath));
    this.encryptionKey = loadEncryptionKey(userDataRoot);
    this.db = new Database(databasePath);
    fs.chmodSync(databasePath, 0o600);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("temp_store = MEMORY");
    this.migrateSchema();
    this.migrateLegacyData();
  }

  close() {
    this.db.close();
  }

  migrateSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const current = Number(this.db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get().version);
    if (current > DATABASE_VERSION) throw new Error(`Database version ${current} is newer than this server supports.`);
    if (current < 1) {
      this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
            status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'disabled_pending_review')),
            email_verified INTEGER NOT NULL CHECK (email_verified IN (0, 1)),
            created_at TEXT NOT NULL,
            password_updated_at TEXT
          );
          CREATE TABLE sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
          );
          CREATE INDEX sessions_user_id_idx ON sessions(user_id);
          CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

          CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            storage_path TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            storage_bytes INTEGER NOT NULL DEFAULT 0 CHECK (storage_bytes >= 0)
          );
          CREATE INDEX projects_owner_idx ON projects(owner_user_id, updated_at DESC);

          CREATE TABLE run_index (
            run_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            parent_run_id TEXT,
            status TEXT NOT NULL DEFAULT 'unknown',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX run_index_project_idx ON run_index(project_id, created_at DESC);

          CREATE TABLE model_profiles (
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            reasoning_effort TEXT NOT NULL,
            base_url TEXT NOT NULL,
            wire_api TEXT NOT NULL,
            auth_scheme TEXT NOT NULL,
            encrypted_api_key TEXT NOT NULL DEFAULT '',
            disable_response_storage INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (owner_user_id, profile_id)
          );
          CREATE TABLE account_settings (
            owner_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            active_model_profile_id TEXT,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE jobs (
            job_id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            kind TEXT NOT NULL CHECK (kind IN ('film', 'asset')),
            status TEXT NOT NULL,
            idempotency_key TEXT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            terminal_at TEXT
          );
          CREATE UNIQUE INDEX jobs_idempotency_idx
            ON jobs(owner_user_id, kind, idempotency_key)
            WHERE idempotency_key IS NOT NULL;
          CREATE INDEX jobs_owner_idx ON jobs(owner_user_id, kind, updated_at DESC);

          CREATE TABLE rate_limits (
            bucket_key TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            reset_at INTEGER NOT NULL
          );
          CREATE INDEX rate_limits_expiry_idx ON rate_limits(reset_at);

          CREATE TABLE daily_usage (
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            usage_day TEXT NOT NULL,
            kind TEXT NOT NULL,
            used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
            reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
            PRIMARY KEY (owner_user_id, usage_day, kind)
          );
          CREATE TABLE usage_reservations (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            usage_day TEXT NOT NULL,
            kind TEXT NOT NULL,
            units INTEGER NOT NULL CHECK (units > 0),
            status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE registration_challenges (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL COLLATE NOCASE,
            code_hmac TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            resend_after TEXT NOT NULL,
            consumed_at TEXT
          );
          CREATE INDEX registration_email_idx ON registration_challenges(email, created_at DESC);
          CREATE TABLE used_turnstile_tokens (
            token_hash TEXT PRIMARY KEY,
            used_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
          );

          CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            details_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
          );
          CREATE INDEX audit_created_idx ON audit_logs(created_at);

          CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);
        this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, isoNow());
      })();
    }
    if (current < 2) {
      this.db.transaction(() => {
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS run_index_parent_idx ON run_index(parent_run_id);
          CREATE TABLE storage_reservations (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
            reserved_bytes INTEGER NOT NULL CHECK (reserved_bytes > 0),
            status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX storage_reservations_owner_idx
            ON storage_reservations(owner_user_id, status);
          CREATE INDEX storage_reservations_project_idx
            ON storage_reservations(project_id, status);
        `);
        this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(2, isoNow());
      })();
    }
  }

  migrateLegacyData() {
    const done = this.db.prepare("SELECT value FROM metadata WHERE key = 'legacy_migration_complete'").get();
    if (done) return;
    const usersRecord = this.readLegacyUsers();
    const configuredOwner = usersRecord.users.find((user) => String(user.email || "").toLowerCase() === this.defaultOwnerEmail);
    const inferredOwnerId = configuredOwner ? "" : this.inferLegacyDefaultOwnerId();
    const owner = configuredOwner || usersRecord.users.find((user) => user.id === inferredOwnerId) || null;
    this.preflightLegacyProjects(owner?.id || "");
    this.db.transaction(() => {
      const insertUser = this.db.prepare(`
        INSERT INTO users(id, email, password_salt, password_hash, role, status, email_verified, created_at, password_updated_at)
        VALUES (@id, @email, @passwordSalt, @passwordHash, @role, @status, @emailVerified, @createdAt, @passwordUpdatedAt)
      `);
      for (const user of usersRecord.users) {
        const isOwner = user.id === owner?.id
          || (process.env.FILM_TEST_MODE === "1" && !this.defaultOwnerEmail);
        insertUser.run({
          id: user.id,
          email: String(user.email).toLowerCase(),
          passwordSalt: user.passwordSalt,
          passwordHash: user.passwordHash,
          role: isOwner ? "admin" : "user",
          status: isOwner ? "active" : "disabled_pending_review",
          emailVerified: isOwner ? 1 : 0,
          createdAt: user.createdAt || isoNow(),
          passwordUpdatedAt: user.passwordUpdatedAt || null
        });
      }
      this.importLegacyProjects(owner?.id || "");
      this.importLegacyModelProfiles(usersRecord.users);
      this.importLegacyJobs(usersRecord.users);
      this.db.prepare("INSERT INTO metadata(key, value) VALUES ('legacy_migration_complete', ?)").run(isoNow());
      this.audit(null, "migration.legacy.completed", "database", this.databasePath, {
        users: usersRecord.users.length,
        projects: this.db.prepare("SELECT COUNT(*) AS count FROM projects").get().count,
        runs: this.db.prepare("SELECT COUNT(*) AS count FROM run_index").get().count
      });
    })();
    this.db.pragma("wal_checkpoint(TRUNCATE)");
    for (const suffix of ["", "-wal", "-shm"]) {
      const target = `${this.databasePath}${suffix}`;
      if (fs.existsSync(target)) fs.chmodSync(target, 0o600);
    }
  }

  inferLegacyDefaultOwnerId() {
    if (!fs.existsSync(this.projectsRoot)) return "";
    const counts = new Map();
    for (const entry of fs.readdirSync(this.projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const metaPath = path.join(this.projectsRoot, entry.name, "_project_meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const ownerUserId = String(json(fs.readFileSync(metaPath, "utf8"))?.ownerUserId || "");
      if (ownerUserId) counts.set(ownerUserId, (counts.get(ownerUserId) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
  }

  readLegacyUsers() {
    if (!fs.existsSync(this.usersPath)) return { users: [], sessions: [] };
    const record = json(fs.readFileSync(this.usersPath, "utf8"));
    if (!record || !Array.isArray(record.users) || !Array.isArray(record.sessions)) {
      throw new Error("Legacy authentication store is invalid; migration aborted.");
    }
    const ids = new Set();
    const emails = new Set();
    for (const user of record.users) {
      const email = String(user?.email || "").trim().toLowerCase();
      if (!user?.id || !email || !user.passwordSalt || !/^[a-f0-9]{128}$/i.test(String(user.passwordHash || ""))) {
        throw new Error("Legacy authentication store contains an invalid user; migration aborted.");
      }
      if (ids.has(user.id) || emails.has(email)) throw new Error("Legacy authentication store contains duplicates; migration aborted.");
      ids.add(user.id);
      emails.add(email);
    }
    return record;
  }

  preflightLegacyProjects(defaultOwnerUserId) {
    if (!fs.existsSync(this.projectsRoot)) return;
    for (const entry of fs.readdirSync(this.projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const projectPath = path.join(this.projectsRoot, entry.name);
      const metaPath = path.join(projectPath, "_project_meta.json");
      if (fs.existsSync(metaPath)) {
        const meta = json(fs.readFileSync(metaPath, "utf8"));
        if (!meta || !String(meta.ownerUserId || "").trim()) {
          throw new Error(`Project metadata is invalid for ${entry.name}; migration aborted.`);
        }
      } else if (!defaultOwnerUserId) {
        throw new Error(`Project ${entry.name} has no owner and no default owner is configured.`);
      }
      directorySize(projectPath);
    }
  }

  importLegacyProjects(defaultOwnerUserId) {
    if (!fs.existsSync(this.projectsRoot)) return;
    const insertProject = this.db.prepare(`
      INSERT INTO projects(id, owner_user_id, storage_path, display_name, created_at, updated_at, storage_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRun = this.db.prepare(`
      INSERT OR REPLACE INTO run_index(run_id, project_id, storage_path, parent_run_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of fs.readdirSync(this.projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const projectPath = path.join(this.projectsRoot, entry.name);
      const meta = json(fs.existsSync(path.join(projectPath, "_project_meta.json"))
        ? fs.readFileSync(path.join(projectPath, "_project_meta.json"), "utf8")
        : "") || {};
      const ownerUserId = String(meta.ownerUserId || defaultOwnerUserId);
      const ownerExists = this.db.prepare("SELECT 1 FROM users WHERE id = ?").get(ownerUserId);
      if (!ownerExists) throw new Error(`Project ${entry.name} references an unknown owner.`);
      const stat = fs.statSync(projectPath);
      const displayName = String(meta.displayName || entry.name.replace(/^\d{4}-\d{2}-\d{2}T[^-]+-[a-z0-9]+-/, "") || entry.name);
      insertProject.run(
        entry.name,
        ownerUserId,
        entry.name,
        displayName,
        meta.createdAt || stat.birthtime.toISOString(),
        meta.updatedAt || stat.mtime.toISOString(),
        directorySize(projectPath)
      );
      const runsPath = path.join(projectPath, "_runs");
      if (!fs.existsSync(runsPath)) continue;
      for (const runEntry of fs.readdirSync(runsPath, { withFileTypes: true })) {
        if (!runEntry.isDirectory()) continue;
        const runPath = path.join(runsPath, runEntry.name);
        const route = json(fs.existsSync(path.join(runPath, "ROUTE.json")) ? fs.readFileSync(path.join(runPath, "ROUTE.json"), "utf8") : "") || {};
        const status = json(fs.existsSync(path.join(runPath, "STATUS.json")) ? fs.readFileSync(path.join(runPath, "STATUS.json"), "utf8") : "") || {};
        const runStat = fs.statSync(runPath);
        insertRun.run(
          runEntry.name,
          entry.name,
          path.relative(this.projectsRoot, runPath),
          route.parentRunId || status.parentRunId || null,
          status.status || "unknown",
          status.createdAt || route.createdAt || runStat.birthtime.toISOString(),
          status.updatedAt || runStat.mtime.toISOString()
        );
      }
    }
  }

  importLegacyModelProfiles(users) {
    for (const user of users) {
      const configPath = path.join(this.userDataRoot, user.id, "model-config.json");
      if (!fs.existsSync(configPath)) continue;
      const settings = json(fs.readFileSync(configPath, "utf8"));
      if (!settings || !Array.isArray(settings.profiles)) throw new Error(`Model profile store is invalid for ${user.id}.`);
      for (const profile of settings.profiles) assertMigratableModelUrl(profile?.baseUrl);
      this.replaceModelSettings(user.id, settings);
    }
  }

  importLegacyJobs(users) {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO jobs(job_id, owner_user_id, project_id, kind, status, idempotency_key, payload_json, created_at, updated_at, terminal_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of users) {
      for (const [directoryName, kind] of [["jobs", "film"], ["asset-jobs", "asset"]]) {
        const directory = path.join(this.userDataRoot, user.id, directoryName);
        if (!fs.existsSync(directory)) continue;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
          const record = json(fs.readFileSync(path.join(directory, entry.name), "utf8"));
          if (!record?.jobId || record.ownerUserId !== user.id) throw new Error(`Job record is invalid: ${entry.name}`);
          const terminalAt = ["done", "error", "cancelled", "interrupted"].includes(record.status)
            ? record.endedAt || record.updatedAt || isoNow()
            : null;
          insert.run(
            record.jobId,
            user.id,
            record.requestedProjectId || record.request?.projectId || null,
            kind,
            record.status || "unknown",
            record.idempotencyKey || null,
            JSON.stringify(record),
            record.createdAt || isoNow(),
            record.updatedAt || isoNow(),
            terminalAt
          );
        }
      }
    }
  }

  readAuthRecord() {
    const users = this.db.prepare("SELECT * FROM users ORDER BY created_at").all().map((row) => ({
      id: row.id,
      email: row.email,
      passwordSalt: row.password_salt,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      emailVerified: Boolean(row.email_verified),
      disabled: row.status !== "active",
      createdAt: row.created_at,
      passwordUpdatedAt: row.password_updated_at || undefined
    }));
    const sessions = this.db.prepare("SELECT token_hash, user_id, created_at, expires_at FROM sessions").all().map((row) => ({
      tokenHash: row.token_hash,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
    return { users, sessions };
  }

  replaceAuthRecord(record) {
    this.db.transaction(() => {
      const ids = new Set(record.users.map((user) => user.id));
      const upsert = this.db.prepare(`
        INSERT INTO users(id, email, password_salt, password_hash, role, status, email_verified, created_at, password_updated_at)
        VALUES (@id, @email, @passwordSalt, @passwordHash, @role, @status, @emailVerified, @createdAt, @passwordUpdatedAt)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          password_salt = excluded.password_salt,
          password_hash = excluded.password_hash,
          role = excluded.role,
          status = excluded.status,
          email_verified = excluded.email_verified,
          password_updated_at = excluded.password_updated_at
      `);
      for (const user of record.users) {
        upsert.run({
          id: user.id,
          email: String(user.email).toLowerCase(),
          passwordSalt: user.passwordSalt,
          passwordHash: user.passwordHash,
          role: user.role === "admin" ? "admin" : "user",
          status: ["active", "disabled", "disabled_pending_review"].includes(user.status)
            ? user.status
            : user.disabled ? "disabled" : "active",
          emailVerified: user.emailVerified === false ? 0 : 1,
          createdAt: user.createdAt || isoNow(),
          passwordUpdatedAt: user.passwordUpdatedAt || null
        });
      }
      if (ids.size) {
        const placeholders = [...ids].map(() => "?").join(",");
        this.db.prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`).run(...ids);
      }
      this.db.prepare("DELETE FROM sessions").run();
      const insertSession = this.db.prepare("INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)");
      for (const session of record.sessions) {
        insertSession.run(session.tokenHash, session.userId, session.createdAt, session.expiresAt);
      }
    })();
  }

  getUserByEmail(email) {
    return this.readAuthRecord().users.find((user) => user.email === String(email || "").toLowerCase()) || null;
  }

  updateUser(userId, patch, actorUserId = null, action = "user.updated") {
    const current = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!current) return null;
    const next = {
      role: patch.role ?? current.role,
      status: patch.status ?? current.status,
      emailVerified: patch.emailVerified === undefined ? current.email_verified : patch.emailVerified ? 1 : 0,
      passwordSalt: patch.passwordSalt ?? current.password_salt,
      passwordHash: patch.passwordHash ?? current.password_hash,
      passwordUpdatedAt: patch.passwordUpdatedAt ?? current.password_updated_at
    };
    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE users SET role = ?, status = ?, email_verified = ?, password_salt = ?, password_hash = ?, password_updated_at = ?
        WHERE id = ?
      `).run(next.role, next.status, next.emailVerified, next.passwordSalt, next.passwordHash, next.passwordUpdatedAt, userId);
      if (patch.revokeSessions) this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
      this.audit(actorUserId, action, "user", userId, { ...patch, passwordSalt: undefined, passwordHash: undefined });
    })();
    return this.readAuthRecord().users.find((user) => user.id === userId) || null;
  }

  readModelSettings(ownerUserId) {
    const rows = this.db.prepare("SELECT * FROM model_profiles WHERE owner_user_id = ? ORDER BY created_at, profile_id").all(ownerUserId);
    if (!rows.length) return null;
    const setting = this.db.prepare("SELECT active_model_profile_id FROM account_settings WHERE owner_user_id = ?").get(ownerUserId);
    const profiles = rows.map((row) => ({
      id: row.profile_id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      reasoningEffort: row.reasoning_effort,
      baseUrl: row.base_url,
      wireApi: row.wire_api,
      authScheme: row.auth_scheme,
      apiKey: decryptSecret(this.encryptionKey, row.encrypted_api_key),
      disableResponseStorage: Boolean(row.disable_response_storage)
    }));
    const activeProfileId = profiles.some((profile) => profile.id === setting?.active_model_profile_id)
      ? setting.active_model_profile_id
      : profiles[0].id;
    return { activeProfileId, profiles };
  }

  replaceModelSettings(ownerUserId, settings) {
    const now = isoNow();
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM model_profiles WHERE owner_user_id = ?").run(ownerUserId);
      const insert = this.db.prepare(`
        INSERT INTO model_profiles(
          owner_user_id, profile_id, name, provider, model, reasoning_effort, base_url,
          wire_api, auth_scheme, encrypted_api_key, disable_response_storage, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const profile of settings.profiles || []) {
        insert.run(
          ownerUserId,
          profile.id,
          profile.name,
          profile.provider,
          profile.model,
          profile.reasoningEffort,
          profile.baseUrl,
          profile.wireApi,
          profile.authScheme,
          encryptSecret(this.encryptionKey, profile.apiKey),
          profile.disableResponseStorage ? 1 : 0,
          now,
          now
        );
      }
      this.db.prepare(`
        INSERT INTO account_settings(owner_user_id, active_model_profile_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(owner_user_id) DO UPDATE SET
          active_model_profile_id = excluded.active_model_profile_id,
          updated_at = excluded.updated_at
      `).run(ownerUserId, settings.activeProfileId || null, now);
    })();
  }

  listProjects(ownerUserId) {
    return this.db.prepare("SELECT * FROM projects WHERE owner_user_id = ? ORDER BY updated_at DESC").all(ownerUserId);
  }

  getProject(projectId) {
    return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) || null;
  }

  createProject({ id, ownerUserId, storagePath, displayName, createdAt = isoNow(), storageBytes = 0 }) {
    this.db.prepare(`
      INSERT INTO projects(id, owner_user_id, storage_path, display_name, created_at, updated_at, storage_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, ownerUserId, storagePath, displayName, createdAt, createdAt, storageBytes);
    return this.getProject(id);
  }

  createProjectWithQuota({
    id,
    ownerUserId,
    storagePath,
    displayName,
    createdAt = isoNow(),
    storageBytes = 0,
    projectLimit,
    accountStorageLimit
  }) {
    return this.db.transaction(() => {
      const usage = this.db.prepare(`
        SELECT COUNT(*) AS project_count, COALESCE(SUM(storage_bytes), 0) AS storage_bytes
        FROM projects WHERE owner_user_id = ?
      `).get(ownerUserId);
      const reservedBytes = this.db.prepare(`
        SELECT COALESCE(SUM(reserved_bytes), 0) AS reserved_bytes
        FROM storage_reservations WHERE owner_user_id = ? AND status = 'reserved'
      `).get(ownerUserId).reserved_bytes;
      if (usage.project_count >= projectLimit) {
        const error = new Error("Project quota exceeded.");
        error.status = 429;
        error.code = "QUOTA_EXCEEDED";
        throw error;
      }
      if (usage.storage_bytes + reservedBytes + storageBytes > accountStorageLimit) {
        const error = new Error("Account storage quota exceeded.");
        error.status = 413;
        error.code = "STORAGE_QUOTA_EXCEEDED";
        throw error;
      }
      this.db.prepare(`
        INSERT INTO projects(id, owner_user_id, storage_path, display_name, created_at, updated_at, storage_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, ownerUserId, storagePath, displayName, createdAt, createdAt, storageBytes);
      return this.getProject(id);
    })();
  }

  deleteProject(projectId) {
    return this.db.prepare("DELETE FROM projects WHERE id = ?").run(projectId).changes > 0;
  }

  updateProject(projectId, patch = {}) {
    const current = this.getProject(projectId);
    if (!current) return null;
    this.db.prepare("UPDATE projects SET display_name = ?, storage_bytes = ?, updated_at = ? WHERE id = ?").run(
      patch.displayName ?? current.display_name,
      patch.storageBytes ?? current.storage_bytes,
      isoNow(),
      projectId
    );
    return this.getProject(projectId);
  }

  indexRun({ runId, projectId, storagePath, parentRunId = null, status = "unknown", createdAt = isoNow(), updatedAt = isoNow() }) {
    this.db.prepare(`
      INSERT INTO run_index(run_id, project_id, storage_path, parent_run_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        project_id = excluded.project_id,
        storage_path = excluded.storage_path,
        parent_run_id = excluded.parent_run_id,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(runId, projectId, storagePath, parentRunId, status, createdAt, updatedAt);
  }

  findRun(runId) {
    return this.db.prepare("SELECT * FROM run_index WHERE run_id = ?").get(runId) || null;
  }

  listRuns({ ownerUserId, projectId = "", limit = 20, offset = 0 }) {
    const params = [ownerUserId];
    let where = "p.owner_user_id = ?";
    if (projectId) {
      where += " AND r.project_id = ?";
      params.push(projectId);
    }
    params.push(Math.min(100, Math.max(1, Number(limit) || 20)), Math.max(0, Number(offset) || 0));
    return this.db.prepare(`
      SELECT r.*, (
        SELECT COUNT(*) FROM run_index child WHERE child.parent_run_id = r.run_id
      ) AS child_run_count
      FROM run_index r
      JOIN projects p ON p.id = r.project_id
      WHERE ${where}
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `).all(...params);
  }

  saveJob(kind, job) {
    const terminalAt = ["done", "error", "cancelled", "interrupted"].includes(job.status)
      ? job.endedAt || job.updatedAt || isoNow()
      : null;
    this.db.prepare(`
      INSERT INTO jobs(job_id, owner_user_id, project_id, kind, status, idempotency_key, payload_json, created_at, updated_at, terminal_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        status = excluded.status,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at,
        terminal_at = excluded.terminal_at
    `).run(
      job.jobId,
      job.ownerUserId,
      job.requestedProjectId || job.request?.projectId || null,
      kind,
      job.status,
      job.idempotencyKey || null,
      JSON.stringify(job),
      job.createdAt || isoNow(),
      job.updatedAt || isoNow(),
      terminalAt
    );
  }

  getJob(kind, jobId, ownerUserId = "") {
    const row = ownerUserId
      ? this.db.prepare("SELECT payload_json FROM jobs WHERE kind = ? AND job_id = ? AND owner_user_id = ?").get(kind, jobId, ownerUserId)
      : this.db.prepare("SELECT payload_json FROM jobs WHERE kind = ? AND job_id = ?").get(kind, jobId);
    return row ? json(row.payload_json) : null;
  }

  findJobByIdempotency(kind, ownerUserId, idempotencyKey) {
    if (!idempotencyKey) return null;
    const row = this.db.prepare(`
      SELECT payload_json FROM jobs WHERE kind = ? AND owner_user_id = ? AND idempotency_key = ?
    `).get(kind, ownerUserId, idempotencyKey);
    return row ? json(row.payload_json) : null;
  }

  listJobs(kind, ownerUserId, projectId = "", limit = 50) {
    const rows = projectId
      ? this.db.prepare("SELECT payload_json FROM jobs WHERE kind = ? AND owner_user_id = ? AND project_id = ? ORDER BY updated_at DESC LIMIT ?")
        .all(kind, ownerUserId, projectId, limit)
      : this.db.prepare("SELECT payload_json FROM jobs WHERE kind = ? AND owner_user_id = ? ORDER BY updated_at DESC LIMIT ?")
        .all(kind, ownerUserId, limit);
    return rows.map((row) => json(row.payload_json)).filter(Boolean);
  }

  listAllJobs(kind) {
    return this.db.prepare("SELECT payload_json FROM jobs WHERE kind = ? ORDER BY updated_at").all(kind)
      .map((row) => json(row.payload_json))
      .filter(Boolean);
  }

  consumeRateLimit(bucketKey, windowMs, max, now = Date.now()) {
    return this.db.transaction(() => {
      const current = this.db.prepare("SELECT count, reset_at FROM rate_limits WHERE bucket_key = ?").get(bucketKey);
      const resetAt = !current || current.reset_at <= now ? now + windowMs : current.reset_at;
      const count = !current || current.reset_at <= now ? 1 : current.count + 1;
      this.db.prepare(`
        INSERT INTO rate_limits(bucket_key, count, reset_at) VALUES (?, ?, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at
      `).run(bucketKey, count, resetAt);
      return { count, resetAt, allowed: count <= max };
    })();
  }

  reserveDailyUsage(ownerUserId, kind, units, limit) {
    return this.db.transaction(() => {
      const usageDay = dayKey();
      this.db.prepare(`
        INSERT OR IGNORE INTO daily_usage(owner_user_id, usage_day, kind, used_count, reserved_count)
        VALUES (?, ?, ?, 0, 0)
      `).run(ownerUserId, usageDay, kind);
      const usage = this.db.prepare(`
        SELECT used_count, reserved_count FROM daily_usage WHERE owner_user_id = ? AND usage_day = ? AND kind = ?
      `).get(ownerUserId, usageDay, kind);
      if (usage.used_count + usage.reserved_count + units > limit) {
        const error = new Error("Daily quota exceeded.");
        error.status = 429;
        error.code = "QUOTA_EXCEEDED";
        throw error;
      }
      const id = randomUUID();
      const now = isoNow();
      this.db.prepare(`
        UPDATE daily_usage SET reserved_count = reserved_count + ?
        WHERE owner_user_id = ? AND usage_day = ? AND kind = ?
      `).run(units, ownerUserId, usageDay, kind);
      this.db.prepare(`
        INSERT INTO usage_reservations(id, owner_user_id, usage_day, kind, units, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?)
      `).run(id, ownerUserId, usageDay, kind, units, now, now);
      return { id, usageDay, kind, units };
    })();
  }

  reserveStorage({
    ownerUserId,
    bytes,
    accountLimit,
    projectId = null,
    projectLimit = null
  }) {
    const requestedBytes = Math.floor(Number(bytes));
    if (!ownerUserId || !Number.isSafeInteger(requestedBytes) || requestedBytes <= 0) {
      throw new Error("Storage reservation is invalid.");
    }
    return this.db.transaction(() => {
      const account = this.db.prepare(`
        SELECT COALESCE(SUM(storage_bytes), 0) AS storage_bytes
        FROM projects WHERE owner_user_id = ?
      `).get(ownerUserId);
      const accountReserved = this.db.prepare(`
        SELECT COALESCE(SUM(reserved_bytes), 0) AS reserved_bytes
        FROM storage_reservations WHERE owner_user_id = ? AND status = 'reserved'
      `).get(ownerUserId).reserved_bytes;
      if (account.storage_bytes + accountReserved + requestedBytes > accountLimit) {
        const error = new Error("Account storage quota exceeded.");
        error.status = 413;
        error.code = "STORAGE_QUOTA_EXCEEDED";
        throw error;
      }
      if (projectId) {
        const project = this.db.prepare(`
          SELECT owner_user_id, storage_bytes FROM projects WHERE id = ?
        `).get(projectId);
        if (!project || project.owner_user_id !== ownerUserId) {
          const error = new Error("Project ownership is unavailable.");
          error.status = 403;
          error.code = "PROJECT_ACCESS_DENIED";
          throw error;
        }
        const projectReserved = this.db.prepare(`
          SELECT COALESCE(SUM(reserved_bytes), 0) AS reserved_bytes
          FROM storage_reservations WHERE project_id = ? AND status = 'reserved'
        `).get(projectId).reserved_bytes;
        if (projectLimit !== null && project.storage_bytes + projectReserved + requestedBytes > projectLimit) {
          const error = new Error("Project storage quota exceeded.");
          error.status = 413;
          error.code = "STORAGE_QUOTA_EXCEEDED";
          throw error;
        }
      }
      const id = randomUUID();
      const now = isoNow();
      this.db.prepare(`
        INSERT INTO storage_reservations(
          id, owner_user_id, project_id, reserved_bytes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'reserved', ?, ?)
      `).run(id, ownerUserId, projectId, requestedBytes, now, now);
      return { id, ownerUserId, projectId, bytes: requestedBytes };
    })();
  }

  finishStorageReservation(id, success) {
    const nextStatus = success ? "settled" : "released";
    return this.db.prepare(`
      UPDATE storage_reservations SET status = ?, updated_at = ?
      WHERE id = ? AND status = 'reserved'
    `).run(nextStatus, isoNow(), id).changes > 0;
  }

  finishUsageReservation(id, success) {
    return this.db.transaction(() => {
      const reservation = this.db.prepare("SELECT * FROM usage_reservations WHERE id = ?").get(id);
      if (!reservation || reservation.status !== "reserved") return false;
      this.db.prepare(`
        UPDATE daily_usage
        SET reserved_count = MAX(0, reserved_count - ?),
            used_count = used_count + ?
        WHERE owner_user_id = ? AND usage_day = ? AND kind = ?
      `).run(
        reservation.units,
        success ? reservation.units : 0,
        reservation.owner_user_id,
        reservation.usage_day,
        reservation.kind
      );
      this.db.prepare("UPDATE usage_reservations SET status = ?, updated_at = ? WHERE id = ?")
        .run(success ? "settled" : "released", isoNow(), id);
      return true;
    })();
  }

  usage(ownerUserId) {
    const today = dayKey();
    const counters = Object.fromEntries(this.db.prepare(`
      SELECT kind, used_count, reserved_count FROM daily_usage WHERE owner_user_id = ? AND usage_day = ?
    `).all(ownerUserId, today).map((row) => [row.kind, {
      used: row.used_count,
      reserved: row.reserved_count
    }]));
    const projects = this.db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(storage_bytes), 0) AS storage_bytes FROM projects WHERE owner_user_id = ?
    `).get(ownerUserId);
    const storageReservedBytes = this.db.prepare(`
      SELECT COALESCE(SUM(reserved_bytes), 0) AS reserved_bytes
      FROM storage_reservations WHERE owner_user_id = ? AND status = 'reserved'
    `).get(ownerUserId).reserved_bytes;
    return {
      day: today,
      projectCount: projects.count,
      storageBytes: projects.storage_bytes,
      storageReservedBytes,
      counters
    };
  }

  createRegistrationChallenge({ email, codeHmac, ttlMs = 600_000, resendMs = 60_000 }) {
    const now = Date.now();
    const latest = this.db.prepare(`
      SELECT resend_after FROM registration_challenges WHERE email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1
    `).get(email);
    if (latest && new Date(latest.resend_after).getTime() > now) {
      const error = new Error("Please wait before requesting another verification code.");
      error.status = 429;
      error.code = "VERIFICATION_RESEND_WAIT";
      error.retryAfter = Math.ceil((new Date(latest.resend_after).getTime() - now) / 1000);
      throw error;
    }
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO registration_challenges(id, email, code_hmac, attempts, created_at, expires_at, resend_after)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(
      id,
      email,
      codeHmac,
      new Date(now).toISOString(),
      new Date(now + ttlMs).toISOString(),
      new Date(now + resendMs).toISOString()
    );
    return id;
  }

  verificationCodeHmac(email, code) {
    return createHmac("sha256", this.encryptionKey)
      .update(`${String(email).toLowerCase()}\0${String(code)}`)
      .digest("hex");
  }

  consumeRegistrationChallenge(email, candidateHmac) {
    return this.db.transaction(() => {
      const challenge = this.db.prepare(`
        SELECT * FROM registration_challenges
        WHERE email = ? AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(email);
      if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5) return false;
      const expected = Buffer.from(challenge.code_hmac, "hex");
      const candidate = Buffer.from(candidateHmac, "hex");
      const matched = expected.length === candidate.length && timingSafeEqual(expected, candidate);
      if (!matched) {
        this.db.prepare("UPDATE registration_challenges SET attempts = attempts + 1 WHERE id = ?").run(challenge.id);
        return false;
      }
      this.db.prepare("UPDATE registration_challenges SET consumed_at = ? WHERE id = ?").run(isoNow(), challenge.id);
      return true;
    })();
  }

  markTurnstileTokenUsed(tokenHash) {
    try {
      const now = Date.now();
      this.db.prepare("DELETE FROM used_turnstile_tokens WHERE expires_at <= ?").run(new Date(now).toISOString());
      this.db.prepare("INSERT INTO used_turnstile_tokens(token_hash, used_at, expires_at) VALUES (?, ?, ?)")
        .run(tokenHash, new Date(now).toISOString(), new Date(now + 300_000).toISOString());
      return true;
    } catch (error) {
      if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) return false;
      throw error;
    }
  }

  audit(actorUserId, action, targetType = null, targetId = null, details = {}) {
    this.db.prepare(`
      INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(actorUserId || null, action, targetType, targetId, JSON.stringify(details || {}), isoNow());
  }

  cleanup() {
    const now = Date.now();
    const results = this.db.transaction(() => {
      const staleReservations = this.db.prepare(`
        SELECT * FROM usage_reservations WHERE status = 'reserved' AND created_at < ?
      `).all(new Date(now - 60 * 60_000).toISOString());
      for (const reservation of staleReservations) {
        this.db.prepare(`
          UPDATE daily_usage SET reserved_count = MAX(0, reserved_count - ?)
          WHERE owner_user_id = ? AND usage_day = ? AND kind = ?
        `).run(
          reservation.units,
          reservation.owner_user_id,
          reservation.usage_day,
          reservation.kind
        );
      }
      if (staleReservations.length) {
        this.db.prepare(`
          UPDATE usage_reservations SET status = 'released', updated_at = ?
          WHERE status = 'reserved' AND created_at < ?
        `).run(isoNow(), new Date(now - 60 * 60_000).toISOString());
      }
      const pending = this.db.prepare("DELETE FROM registration_challenges WHERE created_at < ?")
        .run(new Date(now - 60 * 60_000).toISOString()).changes;
      const storageReservations = this.db.prepare(`
        UPDATE storage_reservations SET status = 'released', updated_at = ?
        WHERE status = 'reserved' AND created_at < ?
      `).run(isoNow(), new Date(now - 60 * 60_000).toISOString()).changes;
      const storageReservationHistory = this.db.prepare(`
        DELETE FROM storage_reservations WHERE status != 'reserved' AND updated_at < ?
      `).run(new Date(now - 24 * 60 * 60_000).toISOString()).changes;
      const jobs = this.db.prepare("DELETE FROM jobs WHERE terminal_at IS NOT NULL AND terminal_at < ?")
        .run(new Date(now - 30 * 24 * 60 * 60_000).toISOString()).changes;
      const audits = this.db.prepare("DELETE FROM audit_logs WHERE created_at < ?")
        .run(new Date(now - 180 * 24 * 60 * 60_000).toISOString()).changes;
      const rateLimits = this.db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now).changes;
      return {
        pending,
        jobs,
        audits,
        rateLimits,
        staleReservations: staleReservations.length,
        storageReservations,
        storageReservationHistory
      };
    })();
    if (Object.values(results).some(Boolean)) this.audit(null, "cleanup.completed", "database", null, results);
    return results;
  }
}
