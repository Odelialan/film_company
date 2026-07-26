import assert from "node:assert/strict";
import test from "node:test";

import { generateRegistrationCode, validateTurnstileResult } from "./registration-policy.js";

test("Turnstile validation fails closed for success, hostname, action, expiry, and future mismatches", () => {
  const now = Date.parse("2026-07-24T08:00:00.000Z");
  const valid = {
    success: true,
    hostname: "film.example.test",
    action: "register",
    challenge_ts: "2026-07-24T07:59:00.000Z"
  };
  const options = { hostname: "film.example.test", action: "register", now };
  assert.equal(validateTurnstileResult(valid, options), true);
  assert.equal(validateTurnstileResult({ ...valid, success: false }, options), false);
  assert.equal(validateTurnstileResult({ ...valid, hostname: "attacker.example.test" }, options), false);
  assert.equal(validateTurnstileResult({ ...valid, action: "login" }, options), false);
  assert.equal(validateTurnstileResult({ ...valid, challenge_ts: "2026-07-24T07:54:59.000Z" }, options), false);
  assert.equal(validateTurnstileResult({ ...valid, challenge_ts: "2026-07-24T08:00:01.000Z" }, options), false);
  assert.equal(validateTurnstileResult({}, options), false);
});

test("registration codes always contain exactly eight digits", () => {
  assert.equal(generateRegistrationCode(() => 0), "10000000");
  assert.equal(generateRegistrationCode(() => 0.999999), "99999910");
  assert.match(generateRegistrationCode(), /^\d{8}$/);
});
