import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowedMediaAssetPath,
  assertWebEditableProjectPath,
  normalizeRelativeProjectPath,
  normalizeTrustedModelBaseUrl
} from "./security-policy.js";

test("trusted model URLs reject dangerous URL forms", () => {
  assert.equal(normalizeTrustedModelBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
  for (const value of [
    "file:///etc/passwd",
    "https://user:pass@example.com/v1",
    "https://example.com/v1?target=internal",
    "not-a-url"
  ]) {
    assert.throws(() => normalizeTrustedModelBaseUrl(value));
  }
});

test("project path normalization rejects traversal", () => {
  assert.equal(normalizeRelativeProjectPath("03_script/SCRIPT_V1.md"), "03_script/SCRIPT_V1.md");
  assert.equal(normalizeRelativeProjectPath("../server/users.json"), "");
  assert.equal(normalizeRelativeProjectPath("03_script/../../server/users.json"), "");
});

test("web edits cannot touch metadata, run state, or active content", () => {
  assert.equal(assertWebEditableProjectPath("03_script/SCRIPT_V1.md"), "03_script/SCRIPT_V1.md");
  assert.equal(assertWebEditableProjectPath("04_storyboard/SHOTLIST.csv"), "04_storyboard/SHOTLIST.csv");
  for (const value of ["_project_meta.json", "_runs/run/STATUS.json", "exploit.html", ".hidden.md"]) {
    assert.throws(() => assertWebEditableProjectPath(value));
  }
});

test("asset policy rejects HTML and SVG while allowing passive media", () => {
  assert.equal(assertAllowedMediaAssetPath("07_keyframes/KEYFRAMES/frame.png"), "07_keyframes/KEYFRAMES/frame.png");
  assert.equal(assertAllowedMediaAssetPath("09_assets/processed/shot.mp4"), "09_assets/processed/shot.mp4");
  assert.throws(() => assertAllowedMediaAssetPath("exploit.html"));
  assert.throws(() => assertAllowedMediaAssetPath("active.svg"));
});
