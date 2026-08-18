import { describe, expect, it } from 'vitest';
import { TranscriptChunker } from '@lecta/ai';

describe('TranscriptChunker', () => {
  it('splits on segment boundaries and preserves timestamps', () => {
    const segments = Array.from({ length: 5 }, (_, index) => ({
      id: `s-${index}`,
      sessionId: 'session-1',
      startTime: index * 60,
      endTime: index * 60 + 20,
      text: `Contenido importante ${index} `.repeat(8),
    }));
    const chunks = new TranscriptChunker(500).chunk(segments);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.startTime).toBe(0);
    expect(chunks.at(-1)?.endTime).toBe(260);
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('[00:00:00–00:00:20]');
  });
});
