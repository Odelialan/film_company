const validDecisions = new Set(["approved", "rejected"]);

export function summarizeApproval(manifest) {
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  return {
    required: entries.some((entry) => entry?.status === "pending"),
    status: manifest?.status || "not_required",
    pendingCount: entries.filter((entry) => entry?.status === "pending").length,
    totalCount: entries.length
  };
}

export function deriveDraftManifestStatus(entries = []) {
  if (entries.some((entry) => entry?.status === "pending")) return "pending";
  const statuses = new Set(entries.map((entry) => (
    entry?.status === "rolled_back" ? "rejected" : entry?.status
  )).filter(Boolean));
  if (statuses.size === 1 && statuses.has("approved")) return "approved";
  if (statuses.size === 1 && statuses.has("rejected")) return "rejected";
  return statuses.size ? "mixed" : "not_required";
}

export function transitionDraftManifest(manifest, { decision, decidedAt, userId, entryIds = null }) {
  if (!validDecisions.has(decision)) throw new Error(`Unsupported draft decision: ${decision}`);
  if (!manifest || !summarizeApproval(manifest).required) {
    const error = new Error("This run has no pending drafts to decide.");
    error.status = 409;
    throw error;
  }
  const requestedIds = entryIds == null
    ? manifest.entries.filter((entry) => entry.status === "pending").map((entry) => entry.id)
    : [...new Set(entryIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!requestedIds.length) {
    const error = new Error("Select at least one pending draft.");
    error.status = 400;
    throw error;
  }
  const pendingIds = new Set(manifest.entries.filter((entry) => entry.status === "pending").map((entry) => entry.id));
  if (requestedIds.some((id) => !pendingIds.has(id))) {
    const error = new Error("One or more selected drafts are no longer pending.");
    error.status = 409;
    error.code = "DRAFT_SELECTION_CONFLICT";
    throw error;
  }
  const selectedIds = new Set(requestedIds);
  const entries = manifest.entries.map((entry) => selectedIds.has(entry.id) ? {
    ...entry,
    status: decision,
    decidedAt,
    decidedByUserId: userId
  } : entry);
  const status = deriveDraftManifestStatus(entries);
  return {
    ...manifest,
    status,
    updatedAt: decidedAt,
    lastDecisionAt: decidedAt,
    ...(status === "pending" ? {} : { decidedAt, decidedByUserId: userId }),
    entries
  };
}

export function assertDraftBaseline(entry, snapshot) {
  if (!("baseExists" in (entry || {})) || !("baseHash" in (entry || {}))) {
    const error = new Error(`Draft predates conflict-safe approval and must be regenerated: ${entry?.id || "unknown"}`);
    error.status = 409;
    throw error;
  }
  if (Boolean(snapshot?.exists) !== Boolean(entry.baseExists) || (snapshot?.hash ?? null) !== (entry.baseHash ?? null)) {
    const error = new Error(`Project document changed after this draft was created: ${entry.targetPath}`);
    error.status = 409;
    error.code = "DRAFT_BASE_CONFLICT";
    throw error;
  }
  return true;
}

export function approvalJournalRecoveryAction(journal) {
  if (!journal || journal.version !== 1 || !journal.projectId || !journal.runId || !Array.isArray(journal.entries)) {
    const error = new Error("Approval publication journal is invalid.");
    error.code = "APPROVAL_JOURNAL_INVALID";
    throw error;
  }
  if (["preparing", "publishing"].includes(journal.status)) return "rollback";
  if (["published", "committing"].includes(journal.status)) return "commit";
  if (["committed", "rolled_back"].includes(journal.status)) return "none";
  const error = new Error(`Approval publication journal has an unsupported status: ${journal.status || "missing"}`);
  error.code = "APPROVAL_JOURNAL_INVALID";
  throw error;
}
