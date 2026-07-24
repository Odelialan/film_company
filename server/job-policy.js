export function recoverInterruptedJob(job, endedAt) {
  if (!job || (job.status !== "queued" && job.status !== "running")) return job;
  const error = "Server restarted before this background job completed.";
  return {
    ...job,
    status: "error",
    error,
    errorPayload: {
      ok: false,
      error: "Film task interrupted by server restart.",
      detail: error,
      status: 503,
      projectId: job.requestedProjectId || null,
      parentRunId: job.parentRunId || null
    },
    endedAt,
    updatedAt: endedAt
  };
}
