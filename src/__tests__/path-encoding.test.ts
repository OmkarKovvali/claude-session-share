/**
 * Tests for path encoding utilities
 *
 * Validates Claude Code's path encoding scheme for session directories.
 */

import { describe, it, expect } from 'vitest';
import { encodeProjectPath, decodeProjectPath, getSessionDirectory } from '../utils/path-encoding.js';
import { homedir } from 'os';
import { join } from 'path';

describe('path-encoding', () => {
  describe('encodeProjectPath', () => {
    it('encodes absolute Unix path correctly', () => {
      const result = encodeProjectPath('/Users/name/project');
      expect(result).toBe('Users-name-project');
    });

    it('encodes path with multiple segments', () => {
      const result = encodeProjectPath('/Users/name/my-project/subdir');
      expect(result).toBe('Users-name-my-project-subdir');
    });

    it('handles path with existing dashes', () => {
      const result = encodeProjectPath('/Users/name/my-awesome-project');
      expect(result).toBe('Users-name-my-awesome-project');
    });

    it('handles single segment path', () => {
      const result = encodeProjectPath('/project');
      expect(result).toBe('project');
    });

    it('handles path with multiple consecutive slashes', () => {
      const result = encodeProjectPath('/Users//name///project');
      expect(result).toBe('Users--name---project');
    });

    it('handles path with trailing slash', () => {
      const result = encodeProjectPath('/Users/name/project/');
      expect(result).toBe('Users-name-project-');
    });
  });

  describe('decodeProjectPath', () => {
    it('decodes encoded path correctly', () => {
      const result = decodeProjectPath('Users-name-project');
      expect(result).toBe('/Users/name/project');
    });

    it('decodes path with multiple segments', () => {
      const result = decodeProjectPath('Users-name-myproject-subdir');
      expect(result).toBe('/Users/name/myproject/subdir');
    });

    it('is inverse of encodeProjectPath', () => {
      const original = '/Users/name/project';
      const encoded = encodeProjectPath(original);
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe(original);
    });

    it('handles single segment', () => {
      const result = decodeProjectPath('project');
      expect(result).toBe('/project');
    });
  });

  describe('getSessionDirectory', () => {
    it('constructs correct session directory path', () => {
      const projectPath = '/Users/name/project';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', 'Users-name-project');
      expect(result).toBe(expected);
    });

    it('handles complex project paths', () => {
      const projectPath = '/Users/name/my-awesome-project/subdir';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', 'Users-name-my-awesome-project-subdir');
      expect(result).toBe(expected);
    });

    it('handles project path with existing dashes', () => {
      const projectPath = '/opt/code/my-app';
      const result = getSessionDirectory(projectPath);
      const expected = join(homedir(), '.claude', 'projects', 'opt-code-my-app');
      expect(result).toBe(expected);
    });
  });
});
