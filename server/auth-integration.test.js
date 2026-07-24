import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not become ready.\n${output()}`);
}

test("login creates a durable cookie session, logout revokes it, and corrupt auth storage returns 503", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "film-auth-test-"));
  const storePath = path.join(tempRoot, "users.json");
  const userDataPath = path.join(tempRoot, "user-data");
  const email = "auth-smoke@example.test";
  const password = "correct horse battery staple";
  const passwordRecord = await derivePasswordRecord(password);
  await mkdir(userDataPath, { recursive: true });
  await writeFile(storePath, `${JSON.stringify({
    users: [{
      id: "user-auth-smoke",
      email,
      passwordSalt: passwordRecord.salt,
      passwordHash: passwordRecord.hash,
      createdAt: "2026-07-18T00:00:00.000Z"
    }],
    sessions: []
  }, null, 2)}\n`, { mode: 0o600 });

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
      FILM_USER_DATA_ROOT: userDataPath,
      FILM_TEST_MODE: "1",
      FILM_ALLOW_REGISTRATION: "1",
      OPENAI_API_KEY: "server-global-test-key",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child, () => logs);
    const shortRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "short-password@example.test",
        password: "abc12",
        repeatPassword: "abc12",
        questionId: "first_creation",
        recoveryAnswer: "test answer"
      })
    });
    assert.equal(shortRegistration.status, 400);
    const registeredEmail = "new-account@example.test";
    const registeredPassword = "abc123-secure";
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: registeredEmail,
        password: registeredPassword,
        repeatPassword: registeredPassword,
        questionId: "first_creation",
        recoveryAnswer: "my first little film"
      })
    });
    assert.equal(registration.status, 201, await registration.text());
    const registeredChallenge = await fetch(`${baseUrl}/api/auth/recovery/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail })
    });
    assert.equal(registeredChallenge.status, 200);
    assert.equal((await registeredChallenge.json()).questionId, "first_creation");
    const missingChallenge = await fetch(`${baseUrl}/api/auth/recovery/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-registered@example.test" })
    });
    const missingChallengePayload = await missingChallenge.json();
    assert.equal(missingChallenge.status, 200);
    assert.equal(missingChallengePayload.available, true);
    assert.equal(typeof missingChallengePayload.question, "string");

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    assert.equal(login.status, 200, await login.text());
    const setCookie = login.headers.get("set-cookie") || "";
    assert.match(setCookie, /film_studio_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = setCookie.split(";", 1)[0];

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, email);
    await access(path.join(userDataPath, "_auth", "users.backup.json"));

    const corruptModelConfigPath = path.join(userDataPath, "user-auth-smoke", "model-config.json");
    await mkdir(path.dirname(corruptModelConfigPath), { recursive: true });
    await writeFile(corruptModelConfigPath, "{broken", { mode: 0o600 });
    const corruptModelConfig = await fetch(`${baseUrl}/api/config/models`, { headers: { Cookie: cookie } });
    assert.equal(corruptModelConfig.status, 503);
    assert.equal((await corruptModelConfig.json()).code, "MODEL_CONFIG_INVALID");
    await rm(corruptModelConfigPath, { force: true });

    const shortPasswordChange = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: password, nextPassword: "abc12", repeatPassword: "abc12" })
    });
    assert.equal(shortPasswordChange.status, 400);
    const nextPassword = "def456-secure";
    const passwordChange = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: password, nextPassword, repeatPassword: nextPassword })
    });
    assert.equal(passwordChange.status, 200, await passwordChange.text());
    const rotatedCookie = (passwordChange.headers.get("set-cookie") || "").split(";", 1)[0];
    assert.match(rotatedCookie, /film_studio_session=/);
    const oldSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(oldSession.status, 401);
    const rotatedSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: rotatedCookie } });
    assert.equal(rotatedSession.status, 200);

    const recoveryAnswer = "blue dolphin recovery phrase";
    const recoverySetup = await fetch(`${baseUrl}/api/auth/recovery/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: rotatedCookie },
      body: JSON.stringify({ currentPassword: nextPassword, questionId: "recovery_phrase", answer: recoveryAnswer })
    });
    assert.equal(recoverySetup.status, 200, await recoverySetup.text());
    const challenge = await fetch(`${baseUrl}/api/auth/recovery/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const challengePayload = await challenge.json();
    assert.equal(challenge.status, 200);
    assert.equal(challengePayload.available, true);
    assert.equal(challengePayload.questionId, "recovery_phrase");

    const recoveryPassword = "ghi789-secure";
    const wrongRecovery = await fetch(`${baseUrl}/api/auth/recovery/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, answer: "wrong recovery answer", nextPassword: recoveryPassword, repeatPassword: recoveryPassword })
    });
    assert.equal(wrongRecovery.status, 401);
    const recoveryReset = await fetch(`${baseUrl}/api/auth/recovery/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, answer: recoveryAnswer, nextPassword: recoveryPassword, repeatPassword: recoveryPassword })
    });
    assert.equal(recoveryReset.status, 200, await recoveryReset.text());
    const revokedByRecovery = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: rotatedCookie } });
    assert.equal(revokedByRecovery.status, 401);

    const recoveredLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: recoveryPassword })
    });
    assert.equal(recoveredLogin.status, 200, await recoveredLogin.text());
    const recoveredCookie = (recoveredLogin.headers.get("set-cookie") || "").split(";", 1)[0];
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: recoveredCookie } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/i);
    const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: recoveredCookie } });
    assert.equal(afterLogout.status, 401);

    await writeFile(storePath, "{broken", { mode: 0o600 });
    const unavailable = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: recoveredCookie } });
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, "AUTH_STORE_UNAVAILABLE");
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit").catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("untrusted forwarded addresses cannot bypass the IP login limiter", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "film-rate-limit-test-"));
  const storePath = path.join(tempRoot, "users.json");
  const userDataPath = path.join(tempRoot, "user-data");
  await mkdir(userDataPath, { recursive: true });
  await writeFile(storePath, `${JSON.stringify({ users: [], sessions: [] })}\n`, { mode: 0o600 });
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
      FILM_USER_DATA_ROOT: userDataPath,
      FILM_TEST_MODE: "1",
      FILM_TRUST_PROXY: "10.0.0.0/8",
      FILM_AUTH_IP_RATE_LIMIT_PER_15_MIN: "3",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child, () => logs);
    const statuses = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": `198.51.100.${index + 1}`
        },
        body: JSON.stringify({ email: `missing-${index}@example.test`, password: "guess" })
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 429]);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit").catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});
