import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const passwordHashPattern = /^[a-f0-9]{128}$/i;
const sessionHashPattern = /^[a-f0-9]{64}$/i;

export class AuthStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthStoreError";
    this.code = "AUTH_STORE_INVALID";
    this.status = 503;
  }
}

export function normalizeUsersRecord(record) {
  if (!record || typeof record !== "object" || !Array.isArray(record.users) || !Array.isArray(record.sessions)) {
    throw new AuthStoreError("Authentication store has an invalid root structure.");
  }
  const userIds = new Set();
  const emails = new Set();
  const users = record.users.map((user, index) => {
    const id = String(user?.id || "").trim();
    const email = String(user?.email || "").trim().toLowerCase();
    const passwordSalt = String(user?.passwordSalt || "");
    const passwordHash = String(user?.passwordHash || "");
    if (!id || !email || !passwordSalt || !passwordHashPattern.test(passwordHash)) {
      throw new AuthStoreError(`Authentication store contains an invalid user at index ${index}.`);
    }
    if (userIds.has(id) || emails.has(email)) {
      throw new AuthStoreError("Authentication store contains duplicate user identifiers or emails.");
    }
    userIds.add(id);
    emails.add(email);
    return { ...user, id, email, passwordSalt, passwordHash };
  });
  const sessions = record.sessions.filter((session) => {
    const expiresAt = new Date(session?.expiresAt || 0).getTime();
    return sessionHashPattern.test(String(session?.tokenHash || ""))
      && userIds.has(String(session?.userId || ""))
      && Number.isFinite(expiresAt);
  });
  return { users, sessions };
}

export function parseUsersRecord(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || ""));
  } catch {
    throw new AuthStoreError("Authentication store is not valid JSON.");
  }
  return normalizeUsersRecord(parsed);
}

export async function derivePasswordRecord(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scryptAsync(String(password || ""), salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

export async function verifyPasswordRecord(password, user) {
  const salt = String(user?.passwordSalt || "");
  const passwordHash = String(user?.passwordHash || "");
  if (!salt || !passwordHashPattern.test(passwordHash)) return false;
  const candidate = Buffer.from((await derivePasswordRecord(password, salt)).hash, "hex");
  const stored = Buffer.from(passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
