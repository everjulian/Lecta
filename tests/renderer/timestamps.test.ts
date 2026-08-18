import { describe, expect, it } from 'vitest';
import { formatTimestamp } from '../../apps/desktop/renderer/session-format';

describe('formatTimestamp', () => {
  it('formats clickable transcript positions as HH:MM:SS', () => {
    expect(formatTimestamp(272)).toBe('00:04:32');
    expect(formatTimestamp(3_661)).toBe('01:01:01');
  });
});
