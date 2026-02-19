'use strict';

/**
 * Redaction layer — strips sensitive fields and masks values that look like
 * secrets before any data reaches the browser.
 */

const SENSITIVE_KEY_RE =
  /token|secret|key|password|cookie|oauth|authorization|bearer|credential|refresh|webhook/i;

// Matches long random / base64-looking strings (≥ 20 chars of alphanumeric + /+=-)
const RANDOM_VALUE_RE = /^[A-Za-z0-9+/=\-_]{20,}$/;

/**
 * Deep-clone an object while stripping / masking sensitive data.
 * Returns a new object — never mutates the input.
 */
function redact(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskIfSecret(obj);
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj !== 'object') return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string' && RANDOM_VALUE_RE.test(v) && v.length >= 32) {
      // Looks like a token/key value even if the key name is innocuous
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

/**
 * If a standalone string looks like a secret, mask it.
 */
function maskIfSecret(str) {
  if (RANDOM_VALUE_RE.test(str) && str.length >= 40) {
    return '[REDACTED]';
  }
  return str;
}

module.exports = { redact };
