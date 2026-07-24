import assert from "node:assert/strict";
import test from "node:test";

import { recoverInterruptedJob } from "./job-policy.js";

test("restart recovery converts queued and running jobs into explicit errors", () => {
  for (const status of ["queued", "running"]) {
    const recovered = recoverInterruptedJob({
      jobId: `job-${status}`,
      status,
      requestedProjectId: "project-1",
      parentRunId: null
    }, "2026-07-17T00:00:00.000Z");
    assert.equal(recovered.status, "error");
    assert.equal(recovered.errorPayload.status, 503);
    assert.equal(recovered.endedAt, "2026-07-17T00:00:00.000Z");
  }
});

test("restart recovery leaves terminal jobs unchanged", () => {
  const job = { jobId: "job-done", status: "done", result: { runId: "run-1" } };
  assert.equal(recoverInterruptedJob(job, "later"), job);
});
