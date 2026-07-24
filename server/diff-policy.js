import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function buildStructuredLineDiff(before, after, { maxInputLines = 350, maxOutputLines = 900 } = {}) {
  const beforeText = String(before || "");
  const afterText = String(after || "");
  const beforeLines = beforeText.split(/\r?\n/);
  const afterLines = afterText.split(/\r?\n/);
  const left = beforeLines.slice(0, maxInputLines);
  const right = afterLines.slice(0, maxInputLines);
  const width = right.length + 1;
  const table = new Uint16Array((left.length + 1) * width);
  for (let oldIndex = left.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = right.length - 1; newIndex >= 0; newIndex -= 1) {
      const offset = oldIndex * width + newIndex;
      table[offset] = left[oldIndex] === right[newIndex]
        ? table[(oldIndex + 1) * width + newIndex + 1] + 1
        : Math.max(table[(oldIndex + 1) * width + newIndex], table[oldIndex * width + newIndex + 1]);
    }
  }
  const lines = [];
  let oldIndex = 0;
  let newIndex = 0;
  let added = 0;
  let removed = 0;
  while ((oldIndex < left.length || newIndex < right.length) && lines.length < maxOutputLines) {
    if (oldIndex < left.length && newIndex < right.length && left[oldIndex] === right[newIndex]) {
      lines.push({ type: "context", text: left[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
    } else if (newIndex < right.length && (
      oldIndex >= left.length
      || table[oldIndex * width + newIndex + 1] >= table[(oldIndex + 1) * width + newIndex]
    )) {
      lines.push({ type: "add", text: right[newIndex], oldLine: null, newLine: newIndex + 1 });
      added += 1;
      newIndex += 1;
    } else {
      lines.push({ type: "remove", text: left[oldIndex], oldLine: oldIndex + 1, newLine: null });
      removed += 1;
      oldIndex += 1;
    }
  }
  const truncated = beforeLines.length > left.length
    || afterLines.length > right.length
    || oldIndex < left.length
    || newIndex < right.length;
  return {
    beforeHash: sha256(beforeText),
    afterHash: sha256(afterText),
    beforeLineCount: beforeLines.length,
    afterLineCount: afterLines.length,
    added,
    removed,
    truncated,
    lines
  };
}
