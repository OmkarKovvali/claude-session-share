/**
 * UUID remapper for session import with collision avoidance
 *
 * Provides consistent UUID remapping to avoid conflicts when importing
 * sessions into local Claude Code storage. Maintains parent-child
 * relationships through consistent mapping.
 */

import { randomUUID } from 'crypto';
import type { SessionMessage } from '../session/types.js';

/**
 * Maps original UUIDs to new UUIDs consistently
 *
 * Ensures that the same original UUID always maps to the same new UUID
 * within a session import operation. This preserves message threading
 * and parent-child relationships.
 */
export class UUIDMapper {
  private map: Map<string, string>;

  constructor() {
    this.map = new Map();
  }

  /**
   * Remap a UUID to a new collision-free UUID
   *
   * @param originalUuid - The original UUID to remap (or null)
   * @returns A new UUID that consistently maps from the original, or null if input is null
   *
   * @example
   * const mapper = new UUIDMapper();
   * const newUuid1 = mapper.remap('abc-123'); // Generates new UUID
   * const newUuid2 = mapper.remap('abc-123'); // Returns same UUID as newUuid1
   * mapper.remap(null); // Returns null
   */
  remap(originalUuid: string | null): string | null {
    // Handle null gracefully (used for root messages with no parent)
    if (originalUuid === null) {
      return null;
    }

    // Check if we've already mapped this UUID
    const existing = this.map.get(originalUuid);
    if (existing) {
      return existing;
    }

    // Generate a new UUID and cache the mapping
    const newUuid = randomUUID();
    this.map.set(originalUuid, newUuid);
    return newUuid;
  }

  /**
   * Remap all UUIDs in a session message
   *
   * Creates an immutable copy of the message with remapped uuid, sessionId,
   * and parentUuid fields. Preserves all other fields unchanged.
   *
   * @param message - The original session message
   * @returns A new message with remapped UUIDs (original unchanged)
   *
   * @example
   * const mapper = new UUIDMapper();
   * const original = { type: 'user', uuid: 'abc', sessionId: '123', parentUuid: null, ... };
   * const remapped = mapper.remapMessage(original);
   * // original is unchanged, remapped has new UUIDs
   */
  remapMessage(message: SessionMessage): SessionMessage {
    // Create immutable copy with remapped UUID fields
    // Spread operator preserves all other fields (type, message, cwd, etc.)
    return {
      ...message,
      uuid: this.remap(message.uuid)!,
      sessionId: this.remap(message.sessionId)!,
      parentUuid: this.remap(message.parentUuid),
    };
  }
}
