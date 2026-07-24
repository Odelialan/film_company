import assert from "node:assert/strict";
import test from "node:test";

import { approvalJournalRecoveryAction, assertDraftBaseline, deriveDraftManifestStatus, summarizeApproval, transitionDraftManifest } from "./approval-policy.js";

function pendingManifest() {
  return {
    runId: "run-1",
    status: "pending",
    entries: [
      { id: "a", status: "pending", targetPath: "03_script/SCRIPT_V1.md" },
      { id: "b", status: "approved", targetPath: "03_script/BEAT_SHEET.md" }
    ]
  };
}

test("approval summary only requires a decision while pending entries exist", () => {
  assert.deepEqual(summarizeApproval(pendingManifest()), {
    required: true,
    status: "pending",
    pendingCount: 1,
    totalCount: 2
  });
  assert.equal(summarizeApproval(null).required, false);
});

test("draft manifest transitions once and preserves previously decided entries", () => {
  const next = transitionDraftManifest(pendingManifest(), {
    decision: "approved",
    decidedAt: "2026-07-17T00:00:00.000Z",
    userId: "owner-1"
  });
  assert.equal(next.status, "approved");
  assert.equal(next.entries[0].status, "approved");
  assert.equal(next.entries[1].status, "approved");
  assert.equal(next.decidedByUserId, "owner-1");
  assert.throws(() => transitionDraftManifest(next, {
    decision: "rejected",
    decidedAt: "2026-07-17T00:01:00.000Z",
    userId: "owner-1"
  }), /no pending drafts/);
});

test("draft manifest supports partial decisions and derives a mixed terminal state", () => {
  const manifest = {
    runId: "run-partial",
    status: "pending",
    entries: [
      { id: "a", status: "pending" },
      { id: "b", status: "pending" }
    ]
  };
  const partial = transitionDraftManifest(manifest, {
    decision: "approved",
    entryIds: ["a"],
    decidedAt: "2026-07-24T00:00:00.000Z",
    userId: "owner-1"
  });
  assert.equal(partial.status, "pending");
  assert.equal(partial.entries[0].status, "approved");
  assert.equal(partial.entries[1].status, "pending");
  const final = transitionDraftManifest(partial, {
    decision: "rejected",
    entryIds: ["b"],
    decidedAt: "2026-07-24T00:01:00.000Z",
    userId: "owner-1"
  });
  assert.equal(final.status, "mixed");
  assert.equal(deriveDraftManifestStatus(final.entries), "mixed");
  assert.throws(() => transitionDraftManifest(partial, {
    decision: "approved",
    entryIds: ["a"],
    decidedAt: "later",
    userId: "owner-1"
  }), (error) => error?.code === "DRAFT_SELECTION_CONFLICT");
});

test("draft manifest rejects unsupported decisions", () => {
  assert.throws(() => transitionDraftManifest(pendingManifest(), {
    decision: "publish_anyway",
    decidedAt: "2026-07-17T00:00:00.000Z",
    userId: "owner-1"
  }), /Unsupported draft decision/);
});

test("approval rejects stale or legacy drafts before publishing", () => {
  const entry = {
    id: "draft-1",
    targetPath: "03_script/SCRIPT_V1.md",
    baseExists: true,
    baseHash: "hash-before"
  };
  assert.equal(assertDraftBaseline(entry, { exists: true, hash: "hash-before" }), true);
  assert.throws(
    () => assertDraftBaseline(entry, { exists: true, hash: "hash-after" }),
    (error) => error?.status === 409 && error?.code === "DRAFT_BASE_CONFLICT"
  );
  assert.throws(
    () => assertDraftBaseline({ id: "legacy", targetPath: entry.targetPath }, { exists: true, hash: "hash-before" }),
    /must be regenerated/
  );
});

test("approval journal chooses deterministic crash recovery actions", () => {
  const base = { version: 1, projectId: "project-1", runId: "run-1", entries: [] };
  assert.equal(approvalJournalRecoveryAction({ ...base, status: "publishing" }), "rollback");
  assert.equal(approvalJournalRecoveryAction({ ...base, status: "published" }), "commit");
  assert.equal(approvalJournalRecoveryAction({ ...base, status: "committed" }), "none");
  assert.throws(
    () => approvalJournalRecoveryAction({ ...base, status: "unknown" }),
    (error) => error?.code === "APPROVAL_JOURNAL_INVALID"
  );
});
