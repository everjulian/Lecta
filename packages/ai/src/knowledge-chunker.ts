import type { KnowledgeChunk, KnowledgeTranscript } from './knowledge-types';

export class KnowledgeChunker {
  constructor(private readonly maxCharacters = 900) {}

  chunk(transcript: KnowledgeTranscript): readonly KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    let current: { startTime: number; endTime: number; text: string }[] = [];
    let length = 0;
    const flush = () => {
      const first = current[0];
      const last = current.at(-1);
      if (!first || !last) return;
      chunks.push({
        id: `${transcript.id}:${chunks.length}`,
        sessionId: transcript.sessionId,
        startTime: first.startTime,
        endTime: last.endTime,
        text: current
          .map((segment) => segment.text.trim())
          .filter(Boolean)
          .join(' '),
      });
      current = [];
      length = 0;
    };
    for (const segment of transcript.segments) {
      const size = segment.text.trim().length + 1;
      if (current.length > 0 && length + size > this.maxCharacters) flush();
      if (segment.text.trim()) {
        current.push(segment);
        length += size;
      }
    }
    flush();
    return chunks;
  }
}
