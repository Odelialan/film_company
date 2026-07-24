import assert from "node:assert/strict";
import test from "node:test";

import { agentInputDocuments, allocateDocumentContext, fingerprintContextDocuments, formatAgentContextSections } from "./context-policy.js";

test("each downstream agent starts with its actual upstream truth sources", () => {
  assert.deepEqual(agentInputDocuments.storyboard.slice(0, 2), ["03_script/SCRIPT_V1.md", "03_script/BEAT_SHEET.md"]);
  assert.equal(agentInputDocuments.keyframe[0], "04_storyboard/STORYBOARD_MASTER.md");
  assert.equal(agentInputDocuments.cinematographer[0], "07_keyframes/SEEDREAM_KEYFRAMES.md");
});

test("agent context reserves explicit space for memory after workspace rules", () => {
  const context = formatAgentContextSections({
    soul: "s".repeat(3000),
    rules: "r".repeat(3000),
    tools: "tool rules",
    memory: "MEMORY_SENTINEL",
    recentMemory: "RECENT_SENTINEL"
  });
  assert.match(context, /MEMORY_SENTINEL/);
  assert.match(context, /RECENT_SENTINEL/);
});

test("document allocation keeps every selected dependency while prioritizing earlier inputs", () => {
  const records = ["script", "beats", "characters", "visual"].map((relativePath) => ({
    relativePath,
    content: relativePath.repeat(1000)
  }));
  const allocated = allocateDocumentContext(records, { totalBudget: 4000, perDocumentLimit: 2000 });
  assert.deepEqual(allocated.map((item) => item.relativePath), records.map((item) => item.relativePath));
  assert.ok(allocated[0].content.length >= allocated.at(-1).content.length);
});

test("context fingerprints identify the exact allocated content without copying it", () => {
  const [fingerprint] = fingerprintContextDocuments([{ relativePath: "SCRIPT.md", content: "exact excerpt" }]);
  assert.equal(fingerprint.relativePath, "SCRIPT.md");
  assert.equal(fingerprint.contentChars, 13);
  assert.match(fingerprint.contentHash, /^[a-f0-9]{64}$/);
  assert.notEqual(
    fingerprint.contentHash,
    fingerprintContextDocuments([{ relativePath: "SCRIPT.md", content: "changed excerpt" }])[0].contentHash
  );
  assert.equal("content" in fingerprint, false);
});
