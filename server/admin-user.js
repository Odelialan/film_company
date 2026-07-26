#!/usr/bin/env node
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { derivePasswordRecord } from "./auth-policy.js";
import { FilmDatabase } from "./database.js";

process.umask(0o077);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const userDataRoot = process.env.FILM_USER_DATA_ROOT
  ? path.resolve(process.env.FILM_USER_DATA_ROOT)
  : path.join(__dirname, "user-data");
const databasePath = process.env.FILM_DATABASE_PATH
  ? path.resolve(process.env.FILM_DATABASE_PATH)
  : path.join(userDataRoot, "film-studio.sqlite");
const projectsRoot = process.env.FILM_PROJECTS_ROOT
  ? path.resolve(process.env.FILM_PROJECTS_ROOT)
  : path.join(repoRoot, "projects");
const usersPath = process.env.FILM_AUTH_STORE_PATH
  ? path.resolve(process.env.FILM_AUTH_STORE_PATH)
  : path.join(__dirname, "users.json");
const modelConfigPath = path.join(__dirname, "model-config.json");
const command = String(process.argv[2] || "").trim();
const email = String(process.argv[3] || "").trim().toLowerCase();

function usage() {
  console.error("Usage: npm run admin-user -- <reset-password|enable|disable|verify-email|grant-admin|revoke-admin|revoke-sessions> <email>");
}

if (!command || !email) {
  usage();
  process.exitCode = 2;
} else {
  const database = new FilmDatabase({
    databasePath,
    userDataRoot,
    projectsRoot,
    usersPath,
    modelConfigPath,
    defaultOwnerEmail: process.env.FILM_DEFAULT_OWNER_EMAIL || ""
  });
  try {
    const user = database.getUserByEmail(email);
    if (!user) throw new Error("User not found.");
    if (command === "reset-password") {
      const password = fs.readFileSync(0, "utf8").replace(/\r?\n$/, "");
      if (password.length < 12 || password.length > 1024) throw new Error("Password must be between 12 and 1024 characters.");
      const record = await derivePasswordRecord(password);
      database.updateUser(user.id, {
        passwordSalt: record.salt,
        passwordHash: record.hash,
        passwordUpdatedAt: new Date().toISOString(),
        revokeSessions: true
      }, null, "admin.password.reset");
    } else if (command === "enable") {
      database.updateUser(user.id, { status: "active", revokeSessions: true }, null, "admin.user.enabled");
    } else if (command === "disable") {
      database.updateUser(user.id, { status: "disabled", revokeSessions: true }, null, "admin.user.disabled");
    } else if (command === "verify-email") {
      database.updateUser(user.id, { emailVerified: true }, null, "admin.email.verified");
    } else if (command === "grant-admin") {
      database.updateUser(user.id, { role: "admin", revokeSessions: true }, null, "admin.role.granted");
    } else if (command === "revoke-admin") {
      database.updateUser(user.id, { role: "user", revokeSessions: true }, null, "admin.role.revoked");
    } else if (command === "revoke-sessions") {
      database.updateUser(user.id, { revokeSessions: true }, null, "admin.sessions.revoked");
    } else {
      usage();
      process.exitCode = 2;
      throw new Error("Unsupported command.");
    }
    if (!process.exitCode) console.log(`Completed ${command} for ${email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = process.exitCode || 1;
  } finally {
    database.close();
  }
}
