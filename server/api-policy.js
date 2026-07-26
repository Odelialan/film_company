const genericProviderError = "Model provider request failed.";
const omittedPublicKeys = new Set([
  "command",
  "providerPayload",
  "stderr",
  "stdout"
]);

function collectProviderErrors(value, errors, seen) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (typeof value.providerError === "string" && value.providerError.trim()) {
    errors.add(value.providerError);
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectProviderErrors(child, errors, seen);
  }
}

function replaceProviderErrors(value, providerErrors) {
  let next = String(value);
  for (const error of providerErrors) {
    if (error) next = next.split(error).join(genericProviderError);
  }
  return next;
}

function sanitizeValue(value, providerErrors, seen) {
  if (typeof value === "string") return replaceProviderErrors(value, providerErrors);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, providerErrors, seen));

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (omittedPublicKeys.has(key)) continue;
    if (key === "providerError") {
      sanitized[key] = child ? genericProviderError : null;
      continue;
    }
    sanitized[key] = sanitizeValue(child, providerErrors, seen);
  }
  if (sanitized.id === "model-error" && typeof sanitized.detail === "string") {
    sanitized.detail = genericProviderError;
  }
  return sanitized;
}

export function sanitizePublicPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const providerErrors = new Set();
  collectProviderErrors(payload, providerErrors, new WeakSet());
  return sanitizeValue(payload, providerErrors, new WeakSet());
}

export function normalizeApiErrorPayload(statusCode, payload, retryAfterHeader = 0) {
  const retryAfter = Number(payload?.retryAfter || retryAfterHeader || 0);
  return {
    ok: false,
    code: String(payload?.code || (
      statusCode === 401 ? "AUTHENTICATION_REQUIRED"
        : statusCode === 403 ? "FORBIDDEN"
          : statusCode === 404 ? "NOT_FOUND"
            : statusCode === 409 ? "CONFLICT"
              : statusCode === 413 ? "PAYLOAD_TOO_LARGE"
                : statusCode === 429 ? "RATE_LIMITED"
                  : statusCode >= 500 ? "INTERNAL_ERROR"
                    : "BAD_REQUEST"
    )),
    error: String(payload?.error || (
      statusCode >= 500 ? "The request could not be completed." : "The request was rejected."
    )),
    ...(retryAfter > 0 ? { retryAfter } : {})
  };
}
