import assert from "node:assert/strict";
import test from "node:test";

import { normalizeApiErrorPayload, sanitizePublicPayload } from "./api-policy.js";

test("public payloads remove provider and CLI internals while preserving useful state", () => {
  const raw = "HTTP 502 from /home/service: vendor-secret-detail";
  const sanitized = sanitizePublicPayload({
    ok: true,
    providerError: raw,
    command: ["provider-cli", "--secret"],
    providerPayload: { internal: true },
    status: {
      providerError: raw,
      events: [{ id: "model-error", detail: `Failure: ${raw}` }]
    },
    files: [{ relativePath: "STATUS.json" }]
  });
  assert.equal(sanitized.providerError, "Model provider request failed.");
  assert.equal(sanitized.status.providerError, "Model provider request failed.");
  assert.equal(sanitized.status.events[0].detail, "Model provider request failed.");
  assert.deepEqual(sanitized.files, [{ relativePath: "STATUS.json" }]);
  assert.equal("command" in sanitized, false);
  assert.equal("providerPayload" in sanitized, false);
  assert.equal(JSON.stringify(sanitized).includes("vendor-secret-detail"), false);
});

test("API errors have a stable minimal contract", () => {
  assert.deepEqual(normalizeApiErrorPayload(429, {
    detail: "/internal/path",
    retryAfter: 12
  }), {
    ok: false,
    code: "RATE_LIMITED",
    error: "The request was rejected.",
    retryAfter: 12
  });
  assert.deepEqual(normalizeApiErrorPayload(500, { error: "Public failure", code: "FAILED" }), {
    ok: false,
    code: "FAILED",
    error: "Public failure"
  });
});
