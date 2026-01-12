/**
 * Secret redaction utilities for tool results
 *
 * Detects and redacts common secret patterns:
 * - API keys, tokens, access keys
 * - Environment variable values
 * - GitHub tokens
 * - AWS credentials
 * - Long base64/hex strings
 */

/**
 * Pattern-based secret detection and redaction
 *
 * Philosophy: Better to redact too much (false positive) than leak secrets (false negative)
 */
export function redactSecrets(content: string): string {
  if (!content) {
    return content;
  }

  let redacted = content;

  // Pattern 1: API keys in JSON/object notation
  // Matches: "api_key": "value", "apiKey": "value", "API_KEY": "value"
  redacted = redacted.replace(
    /(["']?(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|token|access[_-]?token|auth[_-]?token|bearer[_-]?token)["']?\s*[=:]\s*)["']([^"'\s]{8,})["']/gi,
    '$1"[REDACTED]"'
  );

  // Pattern 2: Environment variable format (KEY=value)
  // Matches: API_KEY=abc123, SECRET_TOKEN=xyz789
  redacted = redacted.replace(
    /\b([A-Z_]+(?:KEY|TOKEN|SECRET|PASSWORD|AUTH)[A-Z_]*)\s*=\s*([^\s"']{8,})/g,
    '$1=[REDACTED]'
  );

  // Pattern 3: GitHub tokens
  // Matches: ghp_, ghs_, github_pat_
  redacted = redacted.replace(/\b(ghp_|ghs_|github_pat_)[a-zA-Z0-9]{30,}/g, '[REDACTED]');

  // Pattern 4: AWS access keys
  // Matches: AKIA..., aws_secret_access_key with long value
  redacted = redacted.replace(/\bAKIA[A-Z0-9]{16}\b/g, '[REDACTED]');
  redacted = redacted.replace(
    /(aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*)["']?([^\s"']{20,})["']?/gi,
    '$1[REDACTED]'
  );

  // Pattern 5: Generic long strings that look like secrets
  // Base64-like strings (alphanumeric + / + =, 32+ chars)
  // Hex strings (32+ hex chars)
  // Only in value positions (after = or :)
  redacted = redacted.replace(/([=:]\s*)["']?([A-Za-z0-9+/]{32,}={0,2})["']?/g, (match, prefix, value) => {
    // Avoid redacting things that look like file paths or normal text
    if (value.includes('/') && value.split('/').length > 2) {
      return match; // Likely a file path
    }
    return prefix + '[REDACTED]';
  });

  // Pattern 6: Private keys (BEGIN PRIVATE KEY)
  redacted = redacted.replace(
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    '[REDACTED PRIVATE KEY]'
  );

  return redacted;
}
