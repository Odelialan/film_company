import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthStoreError,
  derivePasswordRecord,
  normalizeUsersRecord,
  parseUsersRecord,
  verifyPasswordRecord
} from "./auth-policy.js";

test("legacy scrypt password records remain verifiable after async migration", async () => {
  const record = await derivePasswordRecord("correct horse battery staple", "00112233445566778899aabbccddeeff");
  const user = { passwordSalt: record.salt, passwordHash: record.hash };
  assert.equal(await verifyPasswordRecord("correct horse battery staple", user), true);
  assert.equal(await verifyPasswordRecord("wrong password", user), false);
});

test("authentication store rejects corruption instead of returning an empty account list", () => {
  assert.throws(() => parseUsersRecord("{broken"), AuthStoreError);
  assert.throws(() => normalizeUsersRecord({ users: [], sessions: "invalid" }), AuthStoreError);
  assert.throws(() => normalizeUsersRecord({
    users: [{ id: "user-1", email: "a@example.com", passwordSalt: "salt", passwordHash: "invalid" }],
    sessions: []
  }), AuthStoreError);
});

test("authentication store drops invalid sessions without locking out valid users", async () => {
  const password = await derivePasswordRecord("a sufficiently long password");
  const record = normalizeUsersRecord({
    users: [{ id: "user-1", email: "A@Example.com", passwordSalt: password.salt, passwordHash: password.hash }],
    sessions: [
      { tokenHash: "0".repeat(64), userId: "user-1", expiresAt: "2030-01-01T00:00:00.000Z" },
      { tokenHash: "bad", userId: "user-1", expiresAt: "2030-01-01T00:00:00.000Z" }
    ]
  });
  assert.equal(record.users[0].email, "a@example.com");
  assert.equal(record.sessions.length, 1);
});
