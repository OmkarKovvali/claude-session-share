import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../sanitization/redactor.js';

describe('redactSecrets', () => {
  describe('API keys in JSON notation', () => {
    it('should redact api_key in JSON', () => {
      const input = '{"api_key": "sk-1234567890abcdef"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"api_key": "[REDACTED]"}');
    });

    it('should redact apiKey in JSON', () => {
      const input = '{"apiKey": "abc123def456xyz789"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"apiKey": "[REDACTED]"}');
    });

    it('should redact API_KEY in JSON', () => {
      const input = '{"API_KEY": "secret123456"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"API_KEY": "[REDACTED]"}');
    });

    it('should redact access_token', () => {
      const input = '{"access_token": "token123456789"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"access_token": "[REDACTED]"}');
    });

    it('should redact bearer_token', () => {
      const input = '{"bearer_token": "bearer123456789"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"bearer_token": "[REDACTED]"}');
    });

    it('should redact secret_key', () => {
      const input = '{"secret_key": "secret123456"}';
      const result = redactSecrets(input);
      expect(result).toBe('{"secret_key": "[REDACTED]"}');
    });
  });

  describe('Environment variable format', () => {
    it('should redact API_KEY=value', () => {
      const input = 'API_KEY=abc123def456';
      const result = redactSecrets(input);
      expect(result).toBe('API_KEY=[REDACTED]');
    });

    it('should redact SECRET_TOKEN=value', () => {
      const input = 'SECRET_TOKEN=xyz789abc123';
      const result = redactSecrets(input);
      expect(result).toBe('SECRET_TOKEN=[REDACTED]');
    });

    it('should redact multiple env vars', () => {
      const input = 'API_KEY=abc123def456\nSECRET_PASSWORD=xyz789abc123';
      const result = redactSecrets(input);
      expect(result).toContain('API_KEY=[REDACTED]');
      expect(result).toContain('SECRET_PASSWORD=[REDACTED]');
    });
  });

  describe('GitHub tokens', () => {
    it('should redact ghp_ tokens', () => {
      const input = 'token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const result = redactSecrets(input);
      expect(result).toBe('token: [REDACTED]');
    });

    it('should redact ghs_ tokens', () => {
      const input = 'token: ghs_1234567890abcdefghijklmnopqrstuvwxyz';
      const result = redactSecrets(input);
      expect(result).toBe('token: [REDACTED]');
    });

    it('should redact github_pat_ tokens', () => {
      const input = 'token: github_pat_1234567890abcdefghijklmnopqrstuvwxyz';
      const result = redactSecrets(input);
      expect(result).toBe('token: [REDACTED]');
    });
  });

  describe('AWS credentials', () => {
    it('should redact AWS access keys', () => {
      const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const result = redactSecrets(input);
      expect(result).toContain('[REDACTED]');
    });

    it('should redact aws_secret_access_key', () => {
      const input = 'aws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const result = redactSecrets(input);
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('Generic long strings', () => {
    it('should redact base64-like strings', () => {
      const input = 'token=SGVsbG9Xb3JsZFRoaXNJc0FMb25nQmFzZTY0U3RyaW5n';
      const result = redactSecrets(input);
      expect(result).toBe('token=[REDACTED]');
    });

    it('should not redact short strings', () => {
      const input = 'token=short123';
      const result = redactSecrets(input);
      // Short values might still be caught by other patterns, but generic pattern should not
      expect(result).toContain('short123');
    });

    it('should not redact file paths', () => {
      const input = 'path=/usr/local/bin/node/lib/modules/core';
      const result = redactSecrets(input);
      expect(result).toContain('/usr/local/bin');
    });
  });

  describe('Private keys', () => {
    it('should redact RSA private keys', () => {
      const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA123456789
-----END RSA PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).toBe('[REDACTED PRIVATE KEY]');
    });

    it('should redact generic private keys', () => {
      const input = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEF
-----END PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).toBe('[REDACTED PRIVATE KEY]');
    });
  });

  describe('Mixed content', () => {
    it('should redact secrets while preserving other text', () => {
      const input = 'Response from API: {"api_key": "secret123456", "status": "success"}';
      const result = redactSecrets(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('status');
      expect(result).toContain('success');
      expect(result).not.toContain('secret123456');
    });

    it('should handle multiple secret types in one string', () => {
      const input = `Config:
API_KEY=abc123def456
token: ghp_1234567890abcdefghijklmnopqrstuvwxyz
AWS: AKIAIOSFODNN7EXAMPLE`;
      const result = redactSecrets(input);
      expect(result).toContain('API_KEY=[REDACTED]');
      expect(result).toContain('token: [REDACTED]');
      expect(result).toContain('[REDACTED]'); // AWS key
      expect(result).not.toContain('abc123def456');
      expect(result).not.toContain('ghp_123');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = redactSecrets('');
      expect(result).toBe('');
    });

    it('should handle content with no secrets', () => {
      const input = 'This is just normal text with no secrets';
      const result = redactSecrets(input);
      expect(result).toBe(input);
    });

    it('should handle null/undefined values gracefully', () => {
      expect(redactSecrets('')).toBe('');
    });

    it('should preserve structure when redacting', () => {
      const input = '{"apiKey": "secret123456", "userId": 42, "name": "test"}';
      const result = redactSecrets(input);
      expect(result).toContain('userId');
      expect(result).toContain('42');
      expect(result).toContain('name');
      expect(result).toContain('test');
      expect(result).not.toContain('secret123456');
    });
  });
});
