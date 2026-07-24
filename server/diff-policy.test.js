import assert from "node:assert/strict";
import test from "node:test";

import { buildStructuredLineDiff } from "./diff-policy.js";

test("structured line diff preserves line numbers and change types", () => {
  const diff = buildStructuredLineDiff("a\nold\nsame", "a\nnew\nsame");
  assert.deepEqual(diff.lines.map((line) => line.type), ["context", "add", "remove", "context"]);
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.equal(diff.lines[1].newLine, 2);
  assert.equal(diff.lines[2].oldLine, 2);
  assert.match(diff.beforeHash, /^[a-f0-9]{64}$/);
});

test("structured line diff explicitly reports bounded output", () => {
  const diff = buildStructuredLineDiff(
    Array.from({ length: 20 }, (_, index) => `old-${index}`).join("\n"),
    Array.from({ length: 20 }, (_, index) => `new-${index}`).join("\n"),
    { maxInputLines: 5, maxOutputLines: 6 }
  );
  assert.equal(diff.truncated, true);
  assert.ok(diff.lines.length <= 6);
  assert.equal(diff.beforeLineCount, 20);
});
