export function validateTurnstileResult(result, {
  hostname,
  action,
  now = Date.now(),
  maxAgeMs = 300_000
}) {
  const challengeAt = new Date(result?.challenge_ts || 0).getTime();
  return result?.success === true
    && String(result.hostname || "").toLowerCase() === String(hostname || "").toLowerCase()
    && String(result.action || "") === String(action || "")
    && Number.isFinite(challengeAt)
    && now - challengeAt >= 0
    && now - challengeAt <= maxAgeMs;
}

export function generateRegistrationCode(random = Math.random) {
  return String(Math.floor(10_000_000 + random() * 90_000_000)).padStart(8, "0");
}
