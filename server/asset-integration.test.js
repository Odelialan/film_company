import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assetRequestHash } from "./asset-job-policy.js";
import { derivePasswordRecord } from "./auth-policy.js";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  return typeof address === "object" && address ? address.port : 0;
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

async function createProject(projectsRoot, projectId, userId) {
  const projectPath = path.join(projectsRoot, projectId);
  await mkdir(path.join(projectPath, "09_assets", "raw"), { recursive: true });
  await writeFile(path.join(projectPath, "_project_meta.json"), `${JSON.stringify({ ownerUserId: userId, projectId })}\n`);
  return projectPath;
}

test("Dreamina boundary enforces success, output, timeout, concurrency, and symlink cleanup", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "film-asset-test-"));
  const projectsRoot = path.join(tempRoot, "projects");
  const userDataRoot = path.join(tempRoot, "user-data");
  const storePath = path.join(tempRoot, "users.json");
  const fakeDreaminaPath = path.join(tempRoot, "fake-dreamina.mjs");
  const outsideImagePath = path.join(tempRoot, "outside.png");
  const userId = "user-asset-review";
  const email = "asset-review@example.test";
  const password = "correct horse battery staple";
  const projectOne = "2026-07-19T01-00-00-000Z-asset-one";
  const projectTwo = "2026-07-19T01-00-01-000Z-asset-two";
  const projectOnePath = await createProject(projectsRoot, projectOne, userId);
  await createProject(projectsRoot, projectTwo, userId);
  await mkdir(userDataRoot, { recursive: true });
  await writeFile(outsideImagePath, Buffer.from("89504e470d0a1a0a", "hex"));
  const passwordRecord = await derivePasswordRecord(password);
  await writeFile(storePath, `${JSON.stringify({
    users: [{ id: userId, email, passwordSalt: passwordRecord.salt, passwordHash: passwordRecord.hash }],
    sessions: []
  })}\n`, { mode: 0o600 });
  const resumedJobId = "asset-job-resume-after-restart";
  const resumedRequest = {
    projectId: projectOne,
    action: "generate-image",
    type: "image",
    relativePath: "",
    secondRelativePath: "",
    prompt: "resume"
  };
  const resumedJobPath = path.join(userDataRoot, userId, "asset-jobs", `${resumedJobId}.json`);
  await mkdir(path.dirname(resumedJobPath), { recursive: true });
  await writeFile(resumedJobPath, `${JSON.stringify({
    version: 1,
    jobId: resumedJobId,
    ownerUserId: userId,
    idempotencyKey: "resume-after-restart",
    requestHash: assetRequestHash(resumedRequest),
    request: resumedRequest,
    status: "running",
    progress: {
      phase: "submitted",
      percent: 25,
      submitId: "resume",
      versionId: "resume-version",
      versionNumber: 1,
      requestedType: "image"
    },
    createdAt: "2026-07-19T01:00:00.000Z",
    updatedAt: "2026-07-19T01:00:01.000Z",
    startedAt: "2026-07-19T01:00:01.000Z",
    recoveryCount: 0,
    cancelRequested: false,
    result: null,
    error: null
  }, null, 2)}\n`);
  await writeFile(fakeDreaminaPath, `#!/usr/bin/env node
import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
const [command, ...args] = process.argv.slice(2);
const value = (prefix) => args.find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
if (command === "query_result") {
  const submitId = value("--submit_id=");
  const downloadDir = value("--download_dir=");
  await mkdir(downloadDir, { recursive: true });
  if (submitId === "symlink") {
    await symlink(process.env.FAKE_OUTSIDE_IMAGE, path.join(downloadDir, "escaped.png"));
  } else {
    await writeFile(path.join(downloadDir, "result.png"), Buffer.from("89504e470d0a1a0a", "hex"));
  }
  console.log(JSON.stringify({ status: "success", submit_id: submitId }));
} else {
  const prompt = value("--prompt=");
  if (prompt === "overflow") process.stdout.write("x".repeat(4096));
  else if (prompt === "timeout") await new Promise((resolve) => setTimeout(resolve, 10000));
  else if (prompt === "resume") { console.error("resume must query the persisted submit id"); process.exitCode = 7; }
  else {
    if (prompt === "slow") await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(JSON.stringify({ status: "submitted", submit_id: prompt === "symlink" ? "symlink" : prompt || "normal" }));
  }
}
`);
  await chmod(fakeDreaminaPath, 0o755);

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
      FILM_MAX_DREAMINA_OUTPUT_BYTES: "512",
      FILM_DREAMINA_SUBMIT_TIMEOUT_MS: "500",
      FILM_DREAMINA_QUERY_TIMEOUT_MS: "1000",
      FILM_MAX_CONCURRENT_ASSET_TASKS: "2",
      FILM_MAX_CONCURRENT_ASSET_TASKS_PER_ACCOUNT: "1",
      DREAMINA_POLL_SECONDS: "1",
      DREAMINA_BIN: fakeDreaminaPath,
      FAKE_OUTSIDE_IMAGE: outsideImagePath,
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child, () => logs);
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    assert.equal(login.status, 200, await login.text());
    const cookie = (login.headers.get("set-cookie") || "").split(";", 1)[0];
    const createAsset = (projectId, prompt, options = {}) => fetch(`${baseUrl}/api/film/projects/${projectId}/assets/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: JSON.stringify({ action: "generate-image", type: "image", prompt, background: Boolean(options.background) })
    });
    const waitForAssetJob = async (jobId, expected = "done") => {
      let payload = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const response = await fetch(`${baseUrl}/api/film/asset-jobs/${jobId}`, { headers: { Cookie: cookie } });
        const responseText = await response.text();
        assert.equal(response.status, 200, responseText);
        payload = JSON.parse(responseText);
        if (payload.status === expected || ["done", "error", "cancelled"].includes(payload.status)) return payload;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Asset job ${jobId} did not reach ${expected}: ${JSON.stringify(payload)}`);
    };

    const resumed = await waitForAssetJob(resumedJobId);
    assert.equal(resumed.status, "done", JSON.stringify(resumed));
    assert.equal(resumed.recoveryCount, 1);
    assert.equal(resumed.result.submitId, "resume");

    const background = await createAsset(projectOne, "background", { background: true, idempotencyKey: "same-background-request" });
    const backgroundText = await background.text();
    assert.equal(background.status, 202, backgroundText);
    const backgroundPayload = JSON.parse(backgroundText);
    const duplicate = await createAsset(projectOne, "background", { background: true, idempotencyKey: "same-background-request" });
    const duplicatePayload = await duplicate.json();
    assert.equal(duplicate.status, 202, JSON.stringify(duplicatePayload));
    assert.equal(duplicatePayload.jobId, backgroundPayload.jobId);
    const conflict = await createAsset(projectOne, "different", { background: true, idempotencyKey: "same-background-request" });
    assert.equal(conflict.status, 409, await conflict.text());
    assert.equal((await waitForAssetJob(backgroundPayload.jobId)).status, "done");

    const cancellable = await createAsset(projectOne, "timeout", { background: true, idempotencyKey: "cancel-running-request" });
    const cancellablePayload = await cancellable.json();
    assert.equal(cancellable.status, 202, JSON.stringify(cancellablePayload));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await waitForAssetJob(cancellablePayload.jobId, "running");
      if (status.status === "running") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const cancelled = await fetch(`${baseUrl}/api/film/asset-jobs/${cancellablePayload.jobId}`, {
      method: "DELETE",
      headers: { Cookie: cookie }
    });
    assert.equal(cancelled.status, 200, await cancelled.text());
    assert.equal((await waitForAssetJob(cancellablePayload.jobId, "cancelled")).status, "cancelled");

    const success = await createAsset(projectOne, "normal");
    const successPayload = await success.json();
    assert.equal(success.status, 201, JSON.stringify(successPayload));
    assert.equal(successPayload.asset.status, "success");
    assert.ok((await readFile(path.join(projectOnePath, successPayload.asset.relativePath))).length > 0);

    const overflow = await createAsset(projectOne, "overflow");
    assert.equal(overflow.status, 502, await overflow.text());

    const timeout = await createAsset(projectOne, "timeout");
    assert.equal(timeout.status, 504, await timeout.text());

    const slowRequest = createAsset(projectOne, "slow");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const concurrent = await createAsset(projectTwo, "normal");
    assert.equal(concurrent.status, 429, await concurrent.text());
    assert.equal((await slowRequest).status, 201);

    const symlink = await createAsset(projectOne, "symlink");
    assert.equal(symlink.status, 504, await symlink.text());
    const rawEntries = await readdir(path.join(projectOnePath, "09_assets", "raw"));
    assert.equal(rawEntries.some((entry) => entry.startsWith("dreamina-")), false);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit").catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});
