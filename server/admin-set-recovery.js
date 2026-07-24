import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveRecoveryAnswerRecord, normalizeRecoveryAnswer, parseUsersRecord } from "./auth-policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersPath = process.env.FILM_AUTH_STORE_PATH
  ? path.resolve(process.env.FILM_AUTH_STORE_PATH)
  : path.join(__dirname, "users.json");
const email = String(process.argv[2] || "").trim().toLowerCase();
const questionId = String(process.argv[3] || "").trim();
const allowedQuestionIds = new Set(["account_name", "recovery_phrase", "childhood_story", "first_creation", "memorable_place"]);

if (!email || !allowedQuestionIds.has(questionId)) {
  console.error("Usage: node server/admin-set-recovery.js <email> <question-id> < answer-on-stdin");
  process.exit(2);
}

let answerText = "";
for await (const chunk of process.stdin) answerText += chunk.toString("utf8");
const answer = normalizeRecoveryAnswer(answerText);
if (answer.length < 3 || answer.length > 200) {
  console.error("Recovery answer must be between 3 and 200 normalized characters.");
  process.exit(2);
}

const record = parseUsersRecord(await fsp.readFile(usersPath, "utf8"));
const user = record.users.find((item) => String(item.email || "").toLowerCase() === email);
if (!user) {
  console.error("Account not found.");
  process.exit(3);
}

const answerRecord = await deriveRecoveryAnswerRecord(answer);
user.recovery = {
  questionId,
  answerSalt: answerRecord.salt,
  answerHash: answerRecord.hash,
  updatedAt: new Date().toISOString(),
  configuredBy: "local_admin"
};

const backupPath = path.join(path.dirname(usersPath), "users.backup.json");
const tempPath = path.join(path.dirname(usersPath), `.users.${process.pid}.tmp`);
await fsp.copyFile(usersPath, backupPath);
await fsp.chmod(backupPath, 0o600);
try {
  await fsp.writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fsp.rename(tempPath, usersPath);
  await fsp.chmod(usersPath, 0o600);
} catch (error) {
  await fsp.rm(tempPath, { force: true }).catch(() => {});
  throw error;
}

if (!fs.existsSync(usersPath)) throw new Error("Authentication store write did not complete.");
console.log(`Recovery question configured for ${email}.`);
