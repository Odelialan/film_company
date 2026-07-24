import assert from "node:assert/strict";
import test from "node:test";

import { assetRequestHash, normalizeAssetIdempotencyKey, recoverInterruptedAssetJob } from "./asset-job-policy.js";

test("asset idempotency keys and request hashes are stable", () => {
  assert.equal(normalizeAssetIdempotencyKey("asset:project-1:abc"), "asset:project-1:abc");
  assert.throws(() => normalizeAssetIdempotencyKey("spaces are unsafe"), /Idempotency-Key/);
  const request = { projectId: "p1", action: "generate-image", type: "image", prompt: "frame" };
  assert.equal(assetRequestHash(request), assetRequestHash({ ...request }));
  assert.notEqual(assetRequestHash(request), assetRequestHash({ ...request, prompt: "changed" }));
});

test("running asset jobs return to the durable queue after restart", () => {
  const running = { jobId: "asset-job-1", status: "running", progress: { phase: "submitted", submitId: "remote-1" } };
  const recovered = recoverInterruptedAssetJob(running, "2026-07-19T00:00:00.000Z");
  assert.equal(recovered.status, "queued");
  assert.equal(recovered.recoveryCount, 1);
  assert.equal(recovered.progress.submitId, "remote-1");
  assert.equal(recoverInterruptedAssetJob({ ...running, status: "done" }, "later").status, "done");
});
