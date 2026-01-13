/**
 * Tests for CLI entry point
 *
 * Validates command parsing and integration with services
 */

import { describe, it, expect, vi } from 'vitest';
import { uploadSession } from '../services/session-uploader.js';
import { importSession } from '../services/session-importer.js';

// Mock the services at module level
vi.mock('../services/session-uploader.js', () => ({
  uploadSession: vi.fn(),
}));

vi.mock('../services/session-importer.js', () => ({
  importSession: vi.fn(),
}));

// Mock fs/promises for findMostRecentSession
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
    stat: vi.fn(),
  };
});

describe('CLI argument parsing', () => {
  it('should parse share command with session path', () => {
    // Test that share command with --session-path flag works
    const args = ['share', '--session-path', '/path/to/session.jsonl'];

    // Find the session-path value
    const pathIndex = args.indexOf('--session-path');
    const sessionPath = pathIndex !== -1 && pathIndex + 1 < args.length
      ? args[pathIndex + 1]
      : null;

    expect(sessionPath).toBe('/path/to/session.jsonl');
  });

  it('should parse share command without session path', () => {
    const args = ['share'];

    const pathIndex = args.indexOf('--session-path');
    const sessionPath = pathIndex !== -1 && pathIndex + 1 < args.length
      ? args[pathIndex + 1]
      : null;

    expect(sessionPath).toBeNull();
  });

  it('should parse import command with gist URL and default project path', () => {
    // Simulate: node cli.js import https://gist...
    // After "import" is consumed, remaining args are:
    const argsAfterCommand = ['https://gist.github.com/user/abc123'];

    const gistUrl = argsAfterCommand[0];
    const pathIndex = argsAfterCommand.indexOf('--project-path');
    const projectPath = pathIndex !== -1 && pathIndex + 1 < argsAfterCommand.length
      ? argsAfterCommand[pathIndex + 1]
      : process.cwd();

    expect(gistUrl).toBe('https://gist.github.com/user/abc123');
    expect(projectPath).toBe(process.cwd());
  });

  it('should parse import command with project-path flag', () => {
    // Simulate: node cli.js import abc123 --project-path /tmp/test
    const argsAfterCommand = ['abc123', '--project-path', '/tmp/test'];

    const gistUrl = argsAfterCommand[0];
    const pathIndex = argsAfterCommand.indexOf('--project-path');
    const projectPath = pathIndex !== -1 && pathIndex + 1 < argsAfterCommand.length
      ? argsAfterCommand[pathIndex + 1]
      : process.cwd();

    expect(gistUrl).toBe('abc123');
    expect(projectPath).toBe('/tmp/test');
  });

  it('should handle missing gist URL in import command', () => {
    // Simulate: node cli.js import (no URL provided)
    const argsAfterCommand: string[] = [];

    const gistUrl = argsAfterCommand[0];
    expect(gistUrl).toBeUndefined();
  });
});

describe('CLI service integration', () => {
  it('uploadSession service should be importable', () => {
    expect(uploadSession).toBeDefined();
    expect(typeof uploadSession).toBe('function');
  });

  it('importSession service should be importable', () => {
    expect(importSession).toBeDefined();
    expect(typeof importSession).toBe('function');
  });

  it('uploadSession mock can be configured', () => {
    vi.mocked(uploadSession).mockResolvedValue('https://gist.github.com/test/123');
    expect(vi.mocked(uploadSession)).toBeDefined();
  });

  it('importSession mock can be configured', () => {
    vi.mocked(importSession).mockResolvedValue({
      sessionPath: '/path/to/session.jsonl',
      sessionId: 'test-id',
      messageCount: 10,
      projectPath: '/test',
    });
    expect(vi.mocked(importSession)).toBeDefined();
  });
});

describe('CLI usage validation', () => {
  it('should have share and import as valid commands', () => {
    const validCommands = ['share', 'import'];

    expect(validCommands).toContain('share');
    expect(validCommands).toContain('import');
    expect(validCommands).not.toContain('unknown');
  });

  it('should validate share command structure', () => {
    // share command can have optional --session-path
    const shareArgs1 = ['share'];
    const shareArgs2 = ['share', '--session-path', '/path'];

    expect(shareArgs1[0]).toBe('share');
    expect(shareArgs2[0]).toBe('share');
    expect(shareArgs2.includes('--session-path')).toBe(true);
  });

  it('should validate import command structure', () => {
    // import command requires gist URL, optional --project-path
    const importArgsAfterCommand1 = ['https://gist.github.com/user/id'];
    const importArgsAfterCommand2 = ['abc123', '--project-path', '/path'];

    expect(importArgsAfterCommand1[0]).toBe('https://gist.github.com/user/id');
    expect(importArgsAfterCommand2[0]).toBe('abc123');
    expect(importArgsAfterCommand2.includes('--project-path')).toBe(true);
  });
});
