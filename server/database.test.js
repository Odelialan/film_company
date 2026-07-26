import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { derivePasswordRecord } from "./auth-policy.js";
import { FilmDatabase } from "./database.js";

test("SQLite migration revokes sessions, encrypts BYOK credentials, and enforces atomic quotas", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "film-database-test-"));
  const userDataRoot = path.join(root, "user-data");
  const projectsRoot = path.join(root, "projects");
  const usersPath = path.join(root, "users.json");
  const modelConfigPath = path.join(root, "model-config.json");
  const databasePath = path.join(userDataRoot, "film-studio.sqlite");
  const userId = "user-database-owner";
  const email = "database-owner@example.test";
  const password = await derivePasswordRecord("correct horse battery staple");
  await mkdir(path.join(userDataRoot, userId), { recursive: true });
  await mkdir(projectsRoot, { recursive: true });
  await writeFile(usersPath, `${JSON.stringify({
    users: [{
      id: userId,
      email,
      passwordSalt: password.salt,
      passwordHash: password.hash,
      createdAt: "2026-07-24T00:00:00.000Z"
    }],
    sessions: [{
      tokenHash: "a".repeat(64),
      userId,
      createdAt: "2026-07-24T00:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z"
    }]
  })}\n`, { mode: 0o600 });
  await writeFile(path.join(userDataRoot, userId, "model-config.json"), `${JSON.stringify({
    activeProfileId: "byok",
    profiles: [{
      id: "byok",
      name: "BYOK",
      provider: "custom",
      model: "test-model",
      reasoningEffort: "high",
      baseUrl: "https://models.example.test/v1",
      wireApi: "responses",
      authScheme: "bearer",
      apiKey: "plaintext-key-must-not-appear",
      disableResponseStorage: true
    }]
  })}\n`, { mode: 0o600 });

  const database = new FilmDatabase({
    databasePath,
    userDataRoot,
    projectsRoot,
    usersPath,
    modelConfigPath,
    defaultOwnerEmail: email
  });
  try {
    assert.equal(database.db.pragma("journal_mode", { simple: true }), "wal");
    assert.equal(database.db.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(database.db.pragma("synchronous", { simple: true }), 2);
    assert.equal(database.db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get().version, 2);
    const auth = database.readAuthRecord();
    assert.equal(auth.users[0].role, "admin");
    assert.equal(auth.users[0].emailVerified, true);
    assert.equal(auth.sessions.length, 0);
    assert.equal(database.readModelSettings(userId).profiles[0].apiKey, "plaintext-key-must-not-appear");
    assert.doesNotMatch(await readFile(databasePath, "utf8"), /plaintext-key-must-not-appear/);

    const reservation = database.reserveDailyUsage(userId, "film_run", 1, 1);
    assert.throws(() => database.reserveDailyUsage(userId, "film_run", 1, 1), (error) => error.code === "QUOTA_EXCEEDED");
    assert.equal(database.finishUsageReservation(reservation.id, false), true);
    const second = database.reserveDailyUsage(userId, "film_run", 1, 1);
    assert.equal(database.finishUsageReservation(second.id, true), true);
    assert.throws(() => database.reserveDailyUsage(userId, "film_run", 1, 1), (error) => error.code === "QUOTA_EXCEEDED");

    const codeHmac = database.verificationCodeHmac("new@example.test", "12345678");
    database.createRegistrationChallenge({ email: "new@example.test", codeHmac });
    assert.equal(database.consumeRegistrationChallenge("new@example.test", database.verificationCodeHmac("new@example.test", "00000000")), false);
    assert.equal(database.consumeRegistrationChallenge("new@example.test", codeHmac), true);
    assert.equal(database.consumeRegistrationChallenge("new@example.test", codeHmac), false);
    assert.equal(database.markTurnstileTokenUsed("token-hash"), true);
    assert.equal(database.markTurnstileTokenUsed("token-hash"), false);
    assert.equal(database.consumeRateLimit("login:test", 60_000, 1, 1_000).allowed, true);
    assert.equal(database.consumeRateLimit("login:test", 60_000, 1, 1_001).allowed, false);

    database.createProjectWithQuota({
      id: "project-atomic-one",
      ownerUserId: userId,
      storagePath: "project-atomic-one",
      displayName: "Atomic project",
      storageBytes: 10,
      projectLimit: 1,
      accountStorageLimit: 1_000
    });
    assert.throws(() => database.createProjectWithQuota({
      id: "project-atomic-two",
      ownerUserId: userId,
      storagePath: "project-atomic-two",
      displayName: "Over quota",
      projectLimit: 1,
      accountStorageLimit: 1_000
    }), (error) => error.code === "QUOTA_EXCEEDED");
    const storageReservation = database.reserveStorage({
      ownerUserId: userId,
      projectId: "project-atomic-one",
      bytes: 80,
      accountLimit: 100,
      projectLimit: 100
    });
    assert.equal(database.usage(userId).storageReservedBytes, 80);
    assert.throws(() => database.reserveStorage({
      ownerUserId: userId,
      projectId: "project-atomic-one",
      bytes: 11,
      accountLimit: 100,
      projectLimit: 100
    }), (error) => error.code === "STORAGE_QUOTA_EXCEEDED");
    assert.equal(database.finishStorageReservation(storageReservation.id, false), true);
    assert.equal(database.usage(userId).storageReservedBytes, 0);

    const job = {
      jobId: "job-idempotency-one",
      ownerUserId: userId,
      requestedProjectId: null,
      idempotencyKey: "same-request",
      requestHash: "hash-one",
      status: "done",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:01.000Z",
      endedAt: "2026-07-24T00:00:01.000Z"
    };
    database.saveJob("film", job);
    assert.equal(database.findJobByIdempotency("film", userId, "same-request").jobId, job.jobId);
    assert.throws(() => database.saveJob("film", { ...job, jobId: "job-idempotency-two" }));
  } finally {
    database.close();
    assert.equal((await stat(databasePath)).mode & 0o777, 0o600);
    await rm(root, { recursive: true, force: true });
  }
});
