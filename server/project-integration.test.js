import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { derivePasswordRecord } from "./auth-policy.js";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(baseUrl, child, output) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited early.\n${output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Test server did not become ready.\n${output()}`);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeRun(projectPath, { runId, entries }) {
  const runPath = path.join(projectPath, "_runs", runId);
  await mkdir(runPath, { recursive: true });
  await writeFile(path.join(runPath, "ROUTE.json"), `${JSON.stringify({
    runId,
    projectId: path.basename(projectPath),
    prompt: "review approval",
    selectedAgents: [...new Set(entries.map((entry) => entry.agentId))],
    reasons: [],
    mode: "test",
    stepBudget: entries.length
  })}\n`);
  for (const entry of entries) {
    const draftPath = path.join(runPath, entry.draftRelativePath);
    await mkdir(path.dirname(draftPath), { recursive: true });
    await writeFile(draftPath, entry.draftContent);
  }
  await writeFile(path.join(runPath, "DRAFT_MANIFEST.json"), `${JSON.stringify({
    runId,
    projectId: path.basename(projectPath),
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: entries.map(({ draftContent: _draftContent, ...entry }) => ({ ...entry, status: "pending", kind: "file", mode: "replace" }))
  }, null, 2)}\n`);
}

test("project edits and approvals reject stale data, roll back partial publication, and fail closed on corrupt ownership", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "film-project-test-"));
  const projectsRoot = path.join(tempRoot, "projects");
  const userDataRoot = path.join(tempRoot, "user-data");
  const storePath = path.join(tempRoot, "users.json");
  const projectId = "2026-07-19T00-00-00-000Z-review-project";
  const projectPath = path.join(projectsRoot, projectId);
  const userId = "user-project-review";
  const email = "project-review@example.test";
  const password = "correct horse battery staple";
  const passwordRecord = await derivePasswordRecord(password);
  await mkdir(path.join(projectPath, "00_admin"), { recursive: true });
  await mkdir(path.join(projectPath, "03_script"), { recursive: true });
  await mkdir(userDataRoot, { recursive: true });
  await writeFile(path.join(projectPath, "_project_meta.json"), `${JSON.stringify({ ownerUserId: userId, projectId })}\n`);
  await writeFile(path.join(projectPath, "USER.md"), "user-before");
  await writeFile(path.join(projectPath, "00_admin", "PROJECT_BRIEF.md"), "brief-before");
  await writeFile(path.join(projectPath, "00_admin", "PROJECT_STATUS.md"), "status-before");
  await writeFile(path.join(projectPath, "03_script", "SCRIPT_V1.md"), "script-before");

  const crashRollbackRunId = "2026-07-19T00-00-10-000Z-crash-rollback";
  const crashRollbackEntry = {
    id: "director-crash-rollback",
    agentId: "director",
    agentName: "总导演",
    targetPath: "USER.md",
    draftRelativePath: "DRAFTS/director/01.md",
    draftContent: "user-partially-published",
    baseExists: true,
    baseHash: hash("user-before")
  };
  await writeRun(projectPath, { runId: crashRollbackRunId, entries: [crashRollbackEntry] });
  const crashRollbackRunPath = path.join(projectPath, "_runs", crashRollbackRunId);
  const crashBackupRelativePath = "APPROVAL_ROLLBACK/crash-rollback/001.bak";
  await mkdir(path.dirname(path.join(crashRollbackRunPath, crashBackupRelativePath)), { recursive: true });
  await writeFile(path.join(crashRollbackRunPath, crashBackupRelativePath), "user-before");
  await writeFile(path.join(projectPath, "USER.md"), "user-partially-published");
  await writeFile(path.join(crashRollbackRunPath, "APPROVAL_JOURNAL.json"), `${JSON.stringify({
    version: 1,
    journalId: "crash-rollback",
    projectId,
    runId: crashRollbackRunId,
    decision: "approved",
    decidedAt: "2026-07-19T00:00:10.000Z",
    userId,
    status: "publishing",
    entries: [{
      entryId: crashRollbackEntry.id,
      agentId: crashRollbackEntry.agentId,
      targetPath: "USER.md",
      baseExists: true,
      baseHash: hash("user-before"),
      baseMode: 0o600,
      backupRelativePath: crashBackupRelativePath,
      state: "pending",
      publishedHash: null
    }],
    publishedFiles: []
  }, null, 2)}\n`);

  const crashCommitRunId = "2026-07-19T00-00-20-000Z-crash-commit";
  const crashCommitContent = "script-published-before-crash";
  const crashCommitEntry = {
    id: "screenwriter-crash-commit",
    agentId: "screenwriter",
    agentName: "编剧",
    targetPath: "03_script/SCRIPT_V1.md",
    draftRelativePath: "DRAFTS/screenwriter/01.md",
    draftContent: crashCommitContent,
    baseExists: true,
    baseHash: hash("script-before")
  };
  await writeRun(projectPath, { runId: crashCommitRunId, entries: [crashCommitEntry] });
  const crashCommitRunPath = path.join(projectPath, "_runs", crashCommitRunId);
  await writeFile(path.join(projectPath, "03_script", "SCRIPT_V1.md"), crashCommitContent);
  await writeFile(path.join(crashCommitRunPath, "APPROVAL_JOURNAL.json"), `${JSON.stringify({
    version: 1,
    journalId: "crash-commit",
    projectId,
    runId: crashCommitRunId,
    decision: "approved",
    decidedAt: "2026-07-19T00:00:20.000Z",
    userId,
    status: "published",
    entries: [{
      entryId: crashCommitEntry.id,
      agentId: crashCommitEntry.agentId,
      targetPath: crashCommitEntry.targetPath,
      baseExists: true,
      baseHash: hash("script-before"),
      baseMode: 0o600,
      backupRelativePath: null,
      state: "applied",
      publishedHash: hash(crashCommitContent)
    }],
    publishedFiles: [{ entryId: crashCommitEntry.id, agentId: crashCommitEntry.agentId, targetPath: crashCommitEntry.targetPath }]
  }, null, 2)}\n`);

  const crashUserRollbackRunId = "2026-07-19T00-00-30-000Z-crash-user-rollback";
  const crashUserRollbackEntry = {
    id: "director-crash-user-rollback",
    agentId: "director",
    agentName: "总导演",
    targetPath: "00_admin/PROJECT_STATUS.md",
    draftRelativePath: "DRAFTS/director/01.md",
    draftContent: "status-published",
    baseExists: true,
    baseHash: hash("status-before")
  };
  await writeRun(projectPath, { runId: crashUserRollbackRunId, entries: [crashUserRollbackEntry] });
  const crashUserRollbackRunPath = path.join(projectPath, "_runs", crashUserRollbackRunId);
  const crashUserRollbackManifestPath = path.join(crashUserRollbackRunPath, "DRAFT_MANIFEST.json");
  const crashUserRollbackManifest = JSON.parse(await readFile(crashUserRollbackManifestPath, "utf8"));
  crashUserRollbackManifest.status = "approved";
  crashUserRollbackManifest.entries[0].status = "approved";
  crashUserRollbackManifest.entries[0].decidedAt = "2026-07-19T00:00:30.000Z";
  await writeFile(crashUserRollbackManifestPath, `${JSON.stringify(crashUserRollbackManifest, null, 2)}\n`);
  const crashUserRollbackBackup = "APPROVAL_ROLLBACK/source-journal/001.bak";
  await mkdir(path.dirname(path.join(crashUserRollbackRunPath, crashUserRollbackBackup)), { recursive: true });
  await writeFile(path.join(crashUserRollbackRunPath, crashUserRollbackBackup), "status-before");
  await writeFile(path.join(projectPath, "00_admin", "PROJECT_STATUS.md"), "status-published");
  await writeFile(path.join(crashUserRollbackRunPath, "APPROVAL_ROLLBACK_REQUEST.json"), `${JSON.stringify({
    version: 1,
    rollbackId: "crash-user-rollback",
    projectId,
    runId: crashUserRollbackRunId,
    sourceJournalId: "source-journal",
    userId,
    entryIds: [crashUserRollbackEntry.id],
    entries: [{
      entryId: crashUserRollbackEntry.id,
      agentId: crashUserRollbackEntry.agentId,
      targetPath: crashUserRollbackEntry.targetPath,
      baseExists: true,
      baseHash: hash("status-before"),
      baseMode: 0o600,
      backupRelativePath: crashUserRollbackBackup,
      state: "pending",
      publishedHash: hash("status-published")
    }],
    status: "rolling_back",
    createdAt: "2026-07-19T00:00:31.000Z",
    updatedAt: "2026-07-19T00:00:31.000Z",
    history: []
  }, null, 2)}\n`);
  await writeFile(storePath, `${JSON.stringify({
    users: [{ id: userId, email, passwordSalt: passwordRecord.salt, passwordHash: passwordRecord.hash }],
    sessions: []
  })}\n`, { mode: 0o600 });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = "";
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_ORIGIN: baseUrl,
      FILM_AUTH_STORE_PATH: storePath,
      FILM_USER_DATA_ROOT: userDataRoot,
      FILM_PROJECTS_ROOT: projectsRoot,
      FILM_TEST_MODE: "1",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child, () => logs);
    assert.equal(await readFile(path.join(projectPath, "USER.md"), "utf8"), "user-before");
    assert.equal(JSON.parse(await readFile(path.join(crashRollbackRunPath, "APPROVAL_JOURNAL.json"), "utf8")).status, "rolled_back");
    assert.equal(JSON.parse(await readFile(path.join(crashCommitRunPath, "APPROVAL_JOURNAL.json"), "utf8")).status, "committed");
    assert.equal(JSON.parse(await readFile(path.join(crashCommitRunPath, "DRAFT_MANIFEST.json"), "utf8")).status, "approved");
    assert.equal(await readFile(path.join(projectPath, "00_admin", "PROJECT_STATUS.md"), "utf8"), "status-before");
    assert.equal(JSON.parse(await readFile(path.join(crashUserRollbackRunPath, "APPROVAL_ROLLBACK_REQUEST.json"), "utf8")).status, "committed");
    assert.equal(JSON.parse(await readFile(crashUserRollbackManifestPath, "utf8")).entries[0].status, "rolled_back");
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    assert.equal(login.status, 200, await login.text());
    const cookie = (login.headers.get("set-cookie") || "").split(";", 1)[0];
    const renamed = await fetch(`${baseUrl}/api/film/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "稳定身份测试项目" })
    });
    const renamedPayload = await renamed.json();
    assert.equal(renamed.status, 200);
    assert.equal(renamedPayload.projectId, projectId);
    assert.equal(renamedPayload.project.title, "稳定身份测试项目");
    await access(projectPath);
    const fileUrl = `${baseUrl}/api/film/projects/${encodeURIComponent(projectId)}/files/03_script/SCRIPT_V1.md`;
    const opened = await fetch(fileUrl, { headers: { Cookie: cookie } });
    const openedPayload = await opened.json();
    assert.equal(opened.status, 200);
    const reservedRead = await fetch(
      `${baseUrl}/api/film/projects/${encodeURIComponent(projectId)}/files/_runs/${encodeURIComponent(crashCommitRunId)}/STATUS.json`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(reservedRead.status, 400, await reservedRead.clone().text());
    const reservedPayload = await reservedRead.json();
    assert.equal("detail" in reservedPayload, false);
    const staleEdit = await fetch(fileUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie, "If-Match": "stale" },
      body: JSON.stringify({ content: "must-not-save" })
    });
    assert.equal(staleEdit.status, 409);
    const safeEdit = await fetch(fileUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie, "If-Match": openedPayload.file.contentHash },
      body: JSON.stringify({ content: "script-safely-edited" })
    });
    assert.equal(safeEdit.status, 200, await safeEdit.text());

    const conflictRunId = "2026-07-19T00-01-00-000Z-conflict";
    await writeRun(projectPath, {
      runId: conflictRunId,
      entries: [{
        id: "screenwriter-1",
        agentId: "screenwriter",
        agentName: "编剧",
        targetPath: "03_script/SCRIPT_V1.md",
        draftRelativePath: "DRAFTS/screenwriter/01.md",
        draftContent: "draft-script",
        baseExists: true,
        baseHash: hash("script-safely-edited")
      }]
    });
    await writeFile(path.join(projectPath, "03_script", "SCRIPT_V1.md"), "changed-after-draft");
    const conflictApproval = await fetch(`${baseUrl}/api/film/runs/${conflictRunId}/approve`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(conflictApproval.status, 409, await conflictApproval.text());
    assert.equal(await readFile(path.join(projectPath, "03_script", "SCRIPT_V1.md"), "utf8"), "changed-after-draft");

    const rollbackRunId = "2026-07-19T00-02-00-000Z-rollback";
    await writeRun(projectPath, {
      runId: rollbackRunId,
      entries: [
        {
          id: "director-1",
          agentId: "director",
          agentName: "总导演",
          targetPath: "USER.md",
          draftRelativePath: "DRAFTS/director/01.md",
          draftContent: "user-after",
          baseExists: true,
          baseHash: hash("user-before")
        },
        {
          id: "director-2",
          agentId: "director",
          agentName: "总导演",
          targetPath: "00_admin/PROJECT_BRIEF.md",
          draftRelativePath: "DRAFTS/director/02.md",
          draftContent: "brief-after",
          baseExists: true,
          baseHash: hash("brief-before")
        }
      ]
    });
    await chmod(path.join(projectPath, "00_admin"), 0o555);
    const rollbackApproval = await fetch(`${baseUrl}/api/film/runs/${rollbackRunId}/approve`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(rollbackApproval.status, 500, await rollbackApproval.text());
    assert.equal(await readFile(path.join(projectPath, "USER.md"), "utf8"), "user-before");
    await chmod(path.join(projectPath, "00_admin"), 0o755);

    const partialRunId = "2026-07-19T00-03-00-000Z-partial";
    const partialUserContent = "# User partial\n\napproved only";
    await writeRun(projectPath, {
      runId: partialRunId,
      entries: [
        {
          id: "director-partial-approve",
          agentId: "director",
          agentName: "总导演",
          targetPath: "USER.md",
          draftRelativePath: "DRAFTS/director/01.md",
          draftContent: partialUserContent,
          baseExists: true,
          baseHash: hash("user-before")
        },
        {
          id: "director-partial-reject",
          agentId: "director",
          agentName: "总导演",
          targetPath: "00_admin/PROJECT_BRIEF.md",
          draftRelativePath: "DRAFTS/director/02.md",
          draftContent: "# Rejected brief",
          baseExists: true,
          baseHash: hash("brief-before")
        }
      ]
    });
    const partialApprove = await fetch(`${baseUrl}/api/film/runs/${partialRunId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: ["director-partial-approve"] })
    });
    assert.equal(partialApprove.status, 200, await partialApprove.clone().text());
    const partialApprovePayload = await partialApprove.json();
    assert.equal(partialApprovePayload.run.approval.required, true);
    assert.equal(partialApprovePayload.run.approval.entries.find((entry) => entry.id === "director-partial-approve").status, "approved");
    assert.equal(partialApprovePayload.run.approval.entries.find((entry) => entry.id === "director-partial-reject").status, "pending");
    assert.equal(await readFile(path.join(projectPath, "USER.md"), "utf8"), `${partialUserContent}\n`);
    assert.equal(await readFile(path.join(projectPath, "00_admin", "PROJECT_BRIEF.md"), "utf8"), "brief-before");

    const partialReject = await fetch(`${baseUrl}/api/film/runs/${partialRunId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: ["director-partial-reject"] })
    });
    assert.equal(partialReject.status, 200, await partialReject.clone().text());
    const partialRejectPayload = await partialReject.json();
    assert.equal(partialRejectPayload.run.approval.required, false);
    assert.equal(partialRejectPayload.run.approval.status, "mixed");
    assert.equal(await readFile(path.join(projectPath, "00_admin", "PROJECT_BRIEF.md"), "utf8"), "brief-before");
    const partialJournal = JSON.parse(await readFile(path.join(projectPath, "_runs", partialRunId, "APPROVAL_JOURNAL.json"), "utf8"));
    assert.equal(partialJournal.status, "committed");
    assert.equal(partialJournal.history.length, 1);
    assert.equal(partialJournal.history[0].decision, "approved");

    const safeRollback = await fetch(`${baseUrl}/api/film/runs/${partialRunId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        journalId: partialJournal.history[0].journalId,
        entryIds: ["director-partial-approve"]
      })
    });
    assert.equal(safeRollback.status, 200, await safeRollback.clone().text());
    const safeRollbackPayload = await safeRollback.json();
    assert.equal(await readFile(path.join(projectPath, "USER.md"), "utf8"), "user-before");
    assert.equal(safeRollbackPayload.run.approval.status, "rejected");
    assert.equal(safeRollbackPayload.run.approval.entries.find((entry) => entry.id === "director-partial-approve").status, "rolled_back");
    assert.equal(safeRollbackPayload.run.approval.rollback.status, "committed");

    const rollbackConflictRunId = "2026-07-19T00-04-00-000Z-rollback-conflict";
    await writeRun(projectPath, {
      runId: rollbackConflictRunId,
      entries: [{
        id: "director-rollback-conflict",
        agentId: "director",
        agentName: "总导演",
        targetPath: "USER.md",
        draftRelativePath: "DRAFTS/director/01.md",
        draftContent: "# Published before manual edit",
        baseExists: true,
        baseHash: hash("user-before")
      }]
    });
    const conflictPublish = await fetch(`${baseUrl}/api/film/runs/${rollbackConflictRunId}/approve`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(conflictPublish.status, 200, await conflictPublish.text());
    await writeFile(path.join(projectPath, "USER.md"), "manual-change-after-publication");
    const conflictRollback = await fetch(`${baseUrl}/api/film/runs/${rollbackConflictRunId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: ["director-rollback-conflict"] })
    });
    assert.equal(conflictRollback.status, 409, await conflictRollback.text());
    assert.equal(await readFile(path.join(projectPath, "USER.md"), "utf8"), "manual-change-after-publication");

    await writeFile(path.join(projectPath, "_project_meta.json"), "{broken");
    const corruptOwner = await fetch(`${baseUrl}/api/film/projects/${encodeURIComponent(projectId)}/documents`, {
      headers: { Cookie: cookie }
    });
    assert.equal(corruptOwner.status, 200, await corruptOwner.text());
  } finally {
    await chmod(path.join(projectPath, "00_admin"), 0o755).catch(() => {});
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit").catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});
