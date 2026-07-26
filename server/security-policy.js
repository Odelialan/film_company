import path from "node:path";

const editableProjectExtensions = new Set([".md", ".csv"]);
const mediaAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".webm"]);

function policyError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeTrustedModelBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw policyError("Model base URL must be a valid HTTP(S) URL.");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw policyError("Model base URL contains a forbidden protocol, credential, query, or fragment.");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "https:" && !loopbackHosts.has(url.hostname.toLowerCase())) {
    throw policyError("Model base URL must use HTTPS unless it targets an explicit loopback address.");
  }
  return url.href.replace(/\/$/, "");
}

export function normalizeRelativeProjectPath(relativePath) {
  const value = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!value || path.posix.isAbsolute(value) || value.split("/").some((part) => part === "..")) {
    return "";
  }
  return path.posix.normalize(value).replace(/^\/+/, "");
}

export function assertWebEditableProjectPath(relativePath) {
  const normalized = normalizeRelativeProjectPath(relativePath);
  const segments = normalized.split("/").filter(Boolean);
  const extension = path.posix.extname(normalized).toLowerCase();
  const reserved = segments.some((segment) => segment.startsWith("_") || segment.startsWith("."));
  if (!normalized || reserved || !editableProjectExtensions.has(extension)) {
    throw policyError("Only non-reserved Markdown and CSV project documents can be edited through the web API.");
  }
  return normalized;
}

export function assertAllowedMediaAssetPath(relativePath) {
  const normalized = normalizeRelativeProjectPath(relativePath);
  if (!normalized || !mediaAssetExtensions.has(path.posix.extname(normalized).toLowerCase())) {
    throw policyError("Requested file type is not an allowed media asset.", 415);
  }
  return normalized;
}

export function allowedMediaAssetExtensions() {
  return new Set(mediaAssetExtensions);
}
