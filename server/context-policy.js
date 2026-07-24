export const agentInputDocuments = Object.freeze({
  director: ["USER.md", "00_admin/PROJECT_BRIEF.md", "00_admin/PROJECT_STATUS.md", "01_story/STORY_OUTLINE.md", "03_script/SCRIPT_V1.md"],
  story_novelist: ["00_admin/PROJECT_BRIEF.md", "USER.md", "05_visual/VISUAL_STYLE_GUIDE.md", "00_admin/PROJECT_STATUS.md"],
  screenwriter: ["01_story/STORY_OUTLINE.md", "01_story/WORLD_SETTING.md", "00_admin/PROJECT_BRIEF.md", "USER.md", "05_visual/VISUAL_STYLE_GUIDE.md"],
  casting: ["03_script/SCRIPT_V1.md", "03_script/BEAT_SHEET.md", "01_story/STORY_OUTLINE.md", "05_visual/VISUAL_STYLE_GUIDE.md", "00_admin/PROJECT_BRIEF.md"],
  storyboard: ["03_script/SCRIPT_V1.md", "03_script/BEAT_SHEET.md", "02_characters/CHARACTER_BIBLE.md", "02_characters/CASTING_NOTES.md", "05_visual/VISUAL_STYLE_GUIDE.md", "00_admin/PROJECT_BRIEF.md"],
  scene: ["04_storyboard/STORYBOARD_MASTER.md", "04_storyboard/SHOTLIST.csv", "05_visual/VISUAL_STYLE_GUIDE.md", "02_characters/CHARACTER_BIBLE.md", "00_admin/PROJECT_BRIEF.md"],
  art_designer: ["USER.md", "00_admin/PROJECT_BRIEF.md", "01_story/STORY_OUTLINE.md", "01_story/WORLD_SETTING.md"],
  keyframe: ["04_storyboard/STORYBOARD_MASTER.md", "04_storyboard/SHOTLIST.csv", "06_scene/SCENE_BIBLE.md", "06_scene/LIGHTING_GUIDE.md", "02_characters/CHARACTER_BIBLE.md", "05_visual/VISUAL_STYLE_GUIDE.md", "00_admin/PROJECT_BRIEF.md"],
  cinematographer: ["07_keyframes/SEEDREAM_KEYFRAMES.md", "07_keyframes/KEYFRAME_PLAN.md", "04_storyboard/SHOTLIST.csv", "04_storyboard/STORYBOARD_MASTER.md", "06_scene/SCENE_BIBLE.md", "06_scene/LIGHTING_GUIDE.md", "05_visual/VISUAL_STYLE_GUIDE.md", "00_admin/PROJECT_BRIEF.md"]
});

function truncate(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max))}\n\n[...truncated ${text.length - max} chars]`;
}

export function formatAgentContextSections(sections = {}, limits = {}) {
  const entries = [
    ["SOUL", sections.soul, limits.soul || 900],
    ["AGENTS", sections.rules, limits.rules || 1400],
    ["TOOLS", sections.tools, limits.tools || 700],
    ["MEMORY", sections.memory, limits.memory || 900],
    ["RECENT_MEMORY", sections.recentMemory, limits.recentMemory || 1200]
  ];
  return entries
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value, max]) => `${label}:\n${truncate(value, max)}`)
    .join("\n\n");
}

export function allocateDocumentContext(records, { totalBudget = 18_000, perDocumentLimit = 6_000 } = {}) {
  const available = records.filter((record) => String(record?.content || "").trim());
  if (!available.length || totalBudget <= 0) return [];
  const minimumShare = Math.max(1, Math.floor(totalBudget / Math.max(1, available.length * 2)));
  let remaining = totalBudget;
  const allocations = available.map((record) => {
    if (remaining <= 0) return { ...record, content: "" };
    const limit = Math.min(minimumShare, remaining, perDocumentLimit);
    const content = truncate(record.content, limit);
    remaining = Math.max(0, remaining - Math.min(String(record.content).trim().length, limit));
    return { ...record, content };
  });
  for (let index = 0; index < allocations.length && remaining > 0; index += 1) {
    const record = allocations[index];
    const original = String(available[index].content || "").trim();
    const currentLength = Math.min(original.length, minimumShare, perDocumentLimit);
    const expandedLength = Math.min(perDocumentLimit, original.length, currentLength + remaining);
    record.content = truncate(original, expandedLength);
    remaining -= Math.max(0, expandedLength - currentLength);
  }
  return allocations.filter((record) => record.content);
}

export function fingerprintContextDocuments(records = []) {
  return records.map((record) => {
    const content = String(record?.content || "");
    return {
      relativePath: String(record?.relativePath || ""),
      contentChars: content.length,
      contentHash: createHash("sha256").update(content).digest("hex")
    };
  });
}
import { createHash } from "node:crypto";
