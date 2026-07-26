import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { derivePasswordRecord } from "../server/auth-policy.js";
import { FilmDatabase } from "../server/database.js";

let child: ChildProcess;
let root = "";
let baseUrl = "";
const email = "browser-user@example.test";
const password = "browser-user-secure-password";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  return typeof address === "object" && address ? address.port : 0;
}

test.beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "film-e2e-"));
  const userDataRoot = path.join(root, "user-data");
  const projectsRoot = path.join(root, "projects");
  const usersPath = path.join(root, "users.json");
  const modelConfigPath = path.join(root, "model-config.json");
  await mkdir(userDataRoot, { recursive: true });
  await mkdir(projectsRoot, { recursive: true });
  const [adminPassword, userPassword] = await Promise.all([
    derivePasswordRecord("browser-admin-secure-password"),
    derivePasswordRecord(password)
  ]);
  await writeFile(usersPath, `${JSON.stringify({
    users: [
      {
        id: "user-browser-admin",
        email: "browser-admin@example.test",
        passwordSalt: adminPassword.salt,
        passwordHash: adminPassword.hash
      },
      {
        id: "user-browser-standard",
        email,
        passwordSalt: userPassword.salt,
        passwordHash: userPassword.hash
      }
    ],
    sessions: []
  })}\n`, { mode: 0o600 });
  const databasePath = path.join(userDataRoot, "film-studio.sqlite");
  const database = new FilmDatabase({
    databasePath,
    userDataRoot,
    projectsRoot,
    usersPath,
    modelConfigPath,
    defaultOwnerEmail: "browser-admin@example.test"
  });
  database.updateUser("user-browser-standard", {
    status: "active",
    emailVerified: true
  }, null, "test.user.enabled");
  database.close();

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/index.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_ORIGIN: baseUrl,
      FILM_AUTH_STORE_PATH: usersPath,
      FILM_USER_DATA_ROOT: userDataRoot,
      FILM_PROJECTS_ROOT: projectsRoot,
      FILM_DATABASE_PATH: databasePath,
      FILM_DEFAULT_OWNER_EMAIL: "browser-admin@example.test",
      FILM_COOKIE_SECURE: "0",
      FILM_ALLOW_REGISTRATION: "0",
      FILM_TEST_MODE: "1",
      NODE_ENV: "test"
    },
    stdio: "ignore"
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error("E2E server exited during startup.");
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("E2E server did not become ready.");
});

test.afterAll(async () => {
  child?.kill("SIGTERM");
  if (child && child.exitCode === null) await once(child, "exit").catch(() => {});
  if (root) await rm(root, { recursive: true, force: true });
});

test("standard user can sign in, use the accessible security dialog, and cannot call Dreamina", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.locator("form").getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".account-label")).toHaveText(email);

  const securityButton = page.getByRole("button", { name: "账户安全" });
  await securityButton.click();
  const dialog = page.getByRole("dialog", { name: "账户安全" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("今日 Film Run")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(securityButton).toBeFocused();

  const projectResponse = await page.request.post(`${baseUrl}/api/film/projects`, {
    data: { title: "E2E Project", prompt: "A small browser test film." }
  });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).project;
  const filmResponse = await page.request.post(`${baseUrl}/api/film/task`, {
    data: { projectId: project.id, prompt: "BYOK must be required.", background: false }
  });
  const filmPayload = await filmResponse.json();
  expect(filmResponse.status(), JSON.stringify(filmPayload)).toBe(400);
  expect(filmPayload.code).toBe("BYOK_REQUIRED");
  const assetResponse = await page.request.post(`${baseUrl}/api/film/projects/${encodeURIComponent(project.id)}/assets/actions`, {
    data: { action: "generate-image", type: "image", prompt: "must not run" }
  });
  expect(assetResponse.status()).toBe(403);
  expect((await assetResponse.json()).code).toBe("ASSET_ADMIN_REQUIRED");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("main")).toBeVisible();
});
