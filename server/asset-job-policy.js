import { createHash } from "node:crypto";

export function normalizeAssetIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    const error = new Error("Idempotency-Key must be 1-128 URL-safe characters.");
    error.status = 400;
    error.code = "INVALID_IDEMPOTENCY_KEY";
    throw error;
  }
  return key;
}

export function assetRequestHash(request) {
  const canonical = JSON.stringify({
    projectId: String(request?.projectId || ""),
    action: String(request?.action || ""),
    type: String(request?.type || ""),
    relativePath: String(request?.relativePath || ""),
    secondRelativePath: String(request?.secondRelativePath || ""),
    prompt: String(request?.prompt || "")
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function recoverInterruptedAssetJob(job, recoveredAt) {
  if (!job || job.status !== "running") return job;
  return {
    ...job,
    status: "queued",
    recoveredAt,
    updatedAt: recoveredAt,
    availableAt: recoveredAt,
    recoveryCount: Number(job.recoveryCount || 0) + 1,
    error: null
  };
}
