/**
 * Tests for path encoding utilities
 *
 * Validates Claude Code's path encoding scheme for session directories.
 * Claude Code encoding:
 * 1. Replaces `/` with `-` (keeping leading dash from root /)
 * 2. Replaces `_` with `-` (normalizes underscores to hyphens)
 */

import { describe, it, expect } from 'vitest';
import { encodeProjectPath, decodeProjectPath, getSessionDirectory } from '../utils/path-encoding.js';
import { homedir } from 'os';
import { join } from 'path';

describe('path-encoding', () => {
  describe('encodeProjectPath', () => {
    it('encodes absolute Unix path correctly (keeps leading dash)', () => {
      const result = encodeProjectPath('/Users/name/project');
      expect(result).toBe('-Users-name-project');
    });

    it('encodes path with multiple segments', () => {
      const result = encodeProjectPath('/Users/name/my-project/subdir');
      expect(result).toBe('-Users-name-my-project-subdir');
    });

    it('handles path with existing dashes', () => {
      const result = encodeProjectPath('/Users/name/my-awesome-project');
      expect(result).toBe('-Users-name-my-awesome-project');
    });

    it('handles single segment path', () => {
      const result = encodeProjectPath('/project');
      expect(result).toBe('-project');
    });

    it('handles path with multiple consecutive slashes', () => {
      const result = encodeProjectPath('/Users//name///project');
      expect(result).toBe('-Users--name---project');
    });

    it('handles path with trailing slash', () => {
      const result = encodeProjectPath('/Users/name/project/');
      expect(result).toBe('-Users-name-project-');
    });

    it('converts underscores to hyphens', () => {
      const result = encodeProjectPath('/Users/name/my_project');
      expect(result).toBe('-Users-name-my-project');
    });

    it('handles path with both underscores and dashes', () => {
      const result = encodeProjectPath('/Users/name/my_cool-project');
      expect(result).toBe('-Users-name-my-cool-project');
    });
  });

  describe('decodeProjectPath', () => {
    it('decodes encoded path correctly (leading dash becomes /)', () => {
      const result = decodeProjectPath('-Users-name-project');
      expect(result).toBe('/Users/name/project');
    });

    it('decodes path with multiple segments', () => {
      const result = decodeProjectPath('-Users-name-myproject-subdir');
      expect(result).toBe('/Users/name/myproject/subdir');
    });

    it('is inverse of encodeProjectPath for paths without underscores', () => {
      const original = '/Users/name/project';
      const encoded = encodeProjectPath(original);
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe(original);
    });

    it('handles single segment', () => {
      const result = decodeProjectPath('-project');
      expect(result).toBe('/project');
    });

    it('handles paths without leading dash (legacy format)', () => {
      // Legacy format without leading dash
      const result = decodeProjectPath('Users-name-project');
      expect(result).toBe('Users/name/project');
    });
  });

  describe('getSessionDirectory', () => {
    it('constructs correct session directory path', () => {
      const projectPath = '/Users/name/project';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', '-Users-name-project');
      expect(result).toBe(expected);
    });

    it('handles complex project paths', () => {
      const projectPath = '/Users/name/my-awesome-project/subdir';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', '-Users-name-my-awesome-project-subdir');
      expect(result).toBe(expected);
    });

    it('handles project path with existing dashes', () => {
      const projectPath = '/opt/code/my-app';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', '-opt-code-my-app');
      expect(result).toBe(expected);
    });

    it('handles project path with underscores', () => {
      const projectPath = '/Users/name/cc_links';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', '-Users-name-cc-links');
      expect(result).toBe(expected);
    });
  });
});
