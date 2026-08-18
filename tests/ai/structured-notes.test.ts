import { describe, expect, it, vi } from 'vitest';
import { GenerateStructuredNotes, InvalidAIResponseError, parseStructuredNotes } from '@lecta/ai';
import type { StructuredNotes } from '@lecta/domain';

const valid = {
  summary: 'Resumen',
  topics: [{ title: 'Tema', notes: ['Apunte'] }],
  keyConcepts: ['Hexagonal'],
  tasks: ['Entregar práctica'],
  studyQuestions: ['¿Qué es un puerto?'],
  importantMoments: [{ timestamp: 12, title: 'Definición', description: 'Explicación' }],
  examMentions: ['Examen el viernes'],
};

describe('structured notes', () => {
  it('validates the complete schema and rejects invalid provider output', () => {
    expect(parseStructuredNotes(valid).importantMoments[0]?.timestamp).toBe(12);
    expect(() => parseStructuredNotes({ ...valid, tasks: 'invalid' })).toThrow(
      InvalidAIResponseError,
    );
  });

  it('processes hierarchically and regenerates without modifying the transcript', async () => {
    let stored: StructuredNotes | null = null;
    const transcript = {
      id: 'transcript-1',
      sessionId: 'session-1',
      language: 'es',
      createdAt: new Date(),
      segments: [
        { id: 'a', sessionId: 'session-1', startTime: 0, endTime: 10, text: 'A'.repeat(420) },
        { id: 'b', sessionId: 'session-1', startTime: 10, endTime: 20, text: 'B'.repeat(420) },
      ],
    };
    const original = JSON.stringify(transcript);
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce({ partial: 1 })
      .mockResolvedValueOnce({ partial: 2 })
      .mockResolvedValue(valid);
    const service = new GenerateStructuredNotes({
      provider: { generateJson },
      transcripts: { getTranscriptBySessionId: () => Promise.resolve(transcript) },
      notes: {
        getBySessionId: () => Promise.resolve(stored),
        save: (value) => {
          stored = value;
          return Promise.resolve();
        },
      },
      generateId: () => 'notes-1',
      now: () => new Date('2026-08-13T12:00:00Z'),
      chunkSize: 500,
    });
    const result = await service.execute({
      sessionId: 'session-1',
      signal: new AbortController().signal,
    });
    expect(generateJson).toHaveBeenCalledTimes(3);
    expect(result.id).toBe('notes-1');
    expect(JSON.stringify(transcript)).toBe(original);
    generateJson
      .mockReset()
      .mockResolvedValue({ partial: true })
      .mockResolvedValueOnce({ partial: 1 })
      .mockResolvedValueOnce({ partial: 2 })
      .mockResolvedValue(valid);
    expect(
      (await service.execute({ sessionId: 'session-1', signal: new AbortController().signal })).id,
    ).toBe('notes-1');
  });

  it('does not overwrite existing notes when synthesis is invalid', async () => {
    const previous = {
      id: 'old',
      sessionId: 's',
      transcriptId: 't',
      ...valid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const save = vi.fn();
    const service = new GenerateStructuredNotes({
      provider: { generateJson: vi.fn().mockResolvedValue({ invalid: true }) },
      notes: { getBySessionId: () => Promise.resolve(previous), save },
      transcripts: {
        getTranscriptBySessionId: () =>
          Promise.resolve({
            id: 't',
            sessionId: 's',
            language: 'es',
            createdAt: new Date(),
            segments: [{ id: 'x', sessionId: 's', startTime: 0, endTime: 1, text: 'Hola' }],
          }),
      },
      generateId: () => 'new',
      now: () => new Date(),
    });
    await expect(
      service.execute({ sessionId: 's', signal: new AbortController().signal }),
    ).rejects.toThrow(InvalidAIResponseError);
    expect(save).not.toHaveBeenCalled();
  });
});
