import type { TranscriptSegment } from '@lecta/domain';

export interface TranscriptChunk {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export class TranscriptChunker {
  constructor(private readonly maxCharacters = 12_000) {
    if (maxCharacters < 500) throw new Error('Chunk size must be at least 500 characters');
  }

  chunk(segments: readonly TranscriptSegment[]): readonly TranscriptChunk[] {
    const chunks: TranscriptChunk[] = [];
    let lines: string[] = [];
    let characters = 0;
    let startTime = 0;
    let endTime = 0;

    const flush = () => {
      if (lines.length === 0) return;
      chunks.push({ index: chunks.length, startTime, endTime, text: lines.join('\n') });
      lines = [];
      characters = 0;
    };

    for (const segment of segments) {
      const line = `[${formatTimestamp(segment.startTime)}–${formatTimestamp(segment.endTime)}] ${segment.text.trim()}`;
      if (lines.length > 0 && characters + line.length + 1 > this.maxCharacters) flush();
      if (lines.length === 0) startTime = segment.startTime;
      endTime = segment.endTime;
      lines.push(line);
      characters += line.length + 1;
    }
    flush();
    return chunks;
  }
}

function formatTimestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return [hours, minutes, remaining].map((part) => part.toString().padStart(2, '0')).join(':');
}
