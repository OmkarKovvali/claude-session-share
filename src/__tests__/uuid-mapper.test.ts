/**
 * Tests for UUID remapper with collision avoidance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UUIDMapper } from '../utils/uuid-mapper.js';
import type { UserMessage, AssistantMessage, FileHistorySnapshot } from '../session/types.js';

describe('UUIDMapper', () => {
  let mapper: UUIDMapper;

  beforeEach(() => {
    mapper = new UUIDMapper();
  });

  describe('remap', () => {
    it('should generate a new UUID for a given input', () => {
      const original = 'abc-123-def';
      const remapped = mapper.remap(original);

      expect(remapped).toBeTruthy();
      expect(remapped).not.toBe(original);
      expect(typeof remapped).toBe('string');
    });

    it('should return the same UUID for the same input (consistency)', () => {
      const original = 'abc-123-def';

      const remapped1 = mapper.remap(original);
      const remapped2 = mapper.remap(original);
      const remapped3 = mapper.remap(original);

      expect(remapped1).toBe(remapped2);
      expect(remapped2).toBe(remapped3);
    });

    it('should generate different UUIDs for different inputs', () => {
      const uuid1 = mapper.remap('original-1');
      const uuid2 = mapper.remap('original-2');
      const uuid3 = mapper.remap('original-3');

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it('should handle null input by returning null', () => {
      const result = mapper.remap(null);

      expect(result).toBeNull();
    });

    it('should always return null for null input (multiple calls)', () => {
      const result1 = mapper.remap(null);
      const result2 = mapper.remap(null);
      const result3 = mapper.remap(null);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should generate valid UUID v4 format', () => {
      const remapped = mapper.remap('test-uuid');

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(remapped).toMatch(uuidRegex);
    });
  });

  describe('remapMessage', () => {
    it('should remap UUIDs in a user message', () => {
      const original: UserMessage = {
        type: 'user',
        uuid: 'user-uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: 'parent-uuid-1',
        message: {
          role: 'user',
          content: 'Hello, world!',
        },
        cwd: '/home/user/project',
        version: '1.0.0',
        gitBranch: 'main',
        isSidechain: false,
      };

      const remapped = mapper.remapMessage(original);

      // UUIDs should be different
      expect(remapped.uuid).not.toBe(original.uuid);
      expect(remapped.sessionId).not.toBe(original.sessionId);
      expect(remapped.parentUuid).not.toBe(original.parentUuid);

      // Other fields should be preserved
      expect(remapped.type).toBe(original.type);
      expect(remapped.timestamp).toBe(original.timestamp);
      expect((remapped as UserMessage).message).toEqual(original.message);
      expect((remapped as UserMessage).cwd).toBe(original.cwd);
      expect((remapped as UserMessage).version).toBe(original.version);
      expect((remapped as UserMessage).gitBranch).toBe(original.gitBranch);
      expect((remapped as UserMessage).isSidechain).toBe(original.isSidechain);
    });

    it('should remap UUIDs in an assistant message', () => {
      const original: AssistantMessage = {
        type: 'assistant',
        uuid: 'assistant-uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:01:00Z',
        parentUuid: 'parent-uuid-2',
        messageId: 'msg-123',
        snapshot: {
          thinking: 'Let me help you',
          messages: [
            { role: 'assistant', content: 'Here is the answer' },
          ],
        },
      };

      const remapped = mapper.remapMessage(original);

      // UUIDs should be different
      expect(remapped.uuid).not.toBe(original.uuid);
      expect(remapped.sessionId).not.toBe(original.sessionId);
      expect(remapped.parentUuid).not.toBe(original.parentUuid);

      // Other fields should be preserved
      expect(remapped.type).toBe(original.type);
      expect(remapped.timestamp).toBe(original.timestamp);
      expect((remapped as AssistantMessage).messageId).toBe(original.messageId);
      expect((remapped as AssistantMessage).snapshot).toEqual(original.snapshot);
    });

    it('should remap UUIDs in a file-history-snapshot message', () => {
      const original: FileHistorySnapshot = {
        type: 'file-history-snapshot',
        uuid: 'snapshot-uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:02:00Z',
        parentUuid: null,
        isSnapshotUpdate: true,
        snapshot: {
          files: [
            { path: '/home/user/project/file.ts' },
          ],
        },
      };

      const remapped = mapper.remapMessage(original);

      // UUIDs should be different (except parentUuid which is null)
      expect(remapped.uuid).not.toBe(original.uuid);
      expect(remapped.sessionId).not.toBe(original.sessionId);
      expect(remapped.parentUuid).toBeNull();

      // Other fields should be preserved
      expect(remapped.type).toBe(original.type);
      expect(remapped.timestamp).toBe(original.timestamp);
      expect((remapped as FileHistorySnapshot).isSnapshotUpdate).toBe(original.isSnapshotUpdate);
      expect((remapped as FileHistorySnapshot).snapshot).toEqual(original.snapshot);
    });

    it('should not mutate the original message (immutability)', () => {
      const original: UserMessage = {
        type: 'user',
        uuid: 'user-uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: 'parent-uuid-1',
        message: {
          role: 'user',
          content: 'Test message',
        },
        cwd: '/home/user/project',
        version: '1.0.0',
      };

      const originalCopy = { ...original };
      const remapped = mapper.remapMessage(original);

      // Original should be unchanged
      expect(original).toEqual(originalCopy);
      expect(original.uuid).toBe('user-uuid-1');
      expect(original.sessionId).toBe('session-123');
      expect(original.parentUuid).toBe('parent-uuid-1');

      // Remapped should be different
      expect(remapped.uuid).not.toBe(original.uuid);
    });

    it('should preserve parent-child relationships through consistent remapping', () => {
      const parentMessage: UserMessage = {
        type: 'user',
        uuid: 'parent-uuid',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Parent' },
        cwd: '/home/user/project',
        version: '1.0.0',
      };

      const childMessage: AssistantMessage = {
        type: 'assistant',
        uuid: 'child-uuid',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:01:00Z',
        parentUuid: 'parent-uuid', // References parent
        messageId: 'msg-1',
        snapshot: {
          thinking: null,
          messages: [],
        },
      };

      const remappedParent = mapper.remapMessage(parentMessage);
      const remappedChild = mapper.remapMessage(childMessage);

      // Child's parentUuid should equal parent's uuid after remapping
      expect(remappedChild.parentUuid).toBe(remappedParent.uuid);

      // Both should have same sessionId after remapping
      expect(remappedChild.sessionId).toBe(remappedParent.sessionId);
    });

    it('should handle multiple messages with consistent session ID remapping', () => {
      const messages: UserMessage[] = [
        {
          type: 'user',
          uuid: 'uuid-1',
          sessionId: 'session-abc',
          timestamp: '2024-01-01T00:00:00Z',
          parentUuid: null,
          message: { role: 'user', content: 'Message 1' },
          cwd: '/home/user/project',
          version: '1.0.0',
        },
        {
          type: 'user',
          uuid: 'uuid-2',
          sessionId: 'session-abc',
          timestamp: '2024-01-01T00:01:00Z',
          parentUuid: 'uuid-1',
          message: { role: 'user', content: 'Message 2' },
          cwd: '/home/user/project',
          version: '1.0.0',
        },
        {
          type: 'user',
          uuid: 'uuid-3',
          sessionId: 'session-abc',
          timestamp: '2024-01-01T00:02:00Z',
          parentUuid: 'uuid-2',
          message: { role: 'user', content: 'Message 3' },
          cwd: '/home/user/project',
          version: '1.0.0',
        },
      ];

      const remapped = messages.map((msg) => mapper.remapMessage(msg));

      // All should have the same remapped sessionId
      expect(remapped[0].sessionId).toBe(remapped[1].sessionId);
      expect(remapped[1].sessionId).toBe(remapped[2].sessionId);

      // Parent-child chain should be preserved
      expect(remapped[1].parentUuid).toBe(remapped[0].uuid);
      expect(remapped[2].parentUuid).toBe(remapped[1].uuid);
    });

    it('should handle null parentUuid correctly', () => {
      const message: UserMessage = {
        type: 'user',
        uuid: 'root-uuid',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null, // Root message
        message: { role: 'user', content: 'Root message' },
        cwd: '/home/user/project',
        version: '1.0.0',
      };

      const remapped = mapper.remapMessage(message);

      // parentUuid should remain null
      expect(remapped.parentUuid).toBeNull();
      expect(remapped.uuid).not.toBe(message.uuid);
      expect(remapped.sessionId).not.toBe(message.sessionId);
    });
  });
});
