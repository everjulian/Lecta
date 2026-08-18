import { describe, expect, it, vi } from 'vitest';
import { AskKnowledge, INSUFFICIENT_ANSWER, KnowledgeChunker, KnowledgeRetriever } from '@lecta/ai';

describe('semantic knowledge', () => {
  it('chunks transcript while preserving session and time metadata', () => {
    const chunks = new KnowledgeChunker(20).chunk({
      id: 'transcript-1',
      sessionId: 'session-1',
      segments: [
        { startTime: 10, endTime: 15, text: 'Clean Architecture' },
        { startTime: 15, endTime: 20, text: 'Puertos y adaptadores' },
      ],
    });
    expect(chunks).toEqual([
      {
        id: 'transcript-1:0',
        sessionId: 'session-1',
        startTime: 10,
        endTime: 15,
        text: 'Clean Architecture',
      },
      {
        id: 'transcript-1:1',
        sessionId: 'session-1',
        startTime: 15,
        endTime: 20,
        text: 'Puertos y adaptadores',
      },
    ]);
  });

  it('ranks retrieval results and removes evidence below threshold', async () => {
    const search = vi.fn().mockResolvedValue([
      { id: 'best', sessionId: 's', startTime: 1, endTime: 2, text: 'REST', score: 0.91 },
      { id: 'weak', sessionId: 's', startTime: 3, endTime: 4, text: 'Otro', score: 0.2 },
    ]);
    const retriever = new KnowledgeRetriever(
      { model: 'test', embed: () => Promise.resolve([[1, 0]]) },
      { search, replaceSession: () => Promise.resolve(), isIndexed: () => Promise.resolve(true) },
      0.5,
    );
    expect((await retriever.retrieve('APIs')).map((item) => item.id)).toEqual(['best']);
    expect(search).toHaveBeenCalledWith([1, 0], 'test', 6);
  });

  it('returns validated local citations', async () => {
    const match = {
      id: 'chunk-1',
      sessionId: 'session-1',
      startTime: 34,
      endTime: 48,
      text: 'Se explicó Clean Architecture',
      score: 0.9,
    };
    const source = {
      ...match,
      sessionTitle: 'Ingeniería de Software',
      sessionDate: new Date('2026-08-07'),
    };
    const answer = new AskKnowledge(
      { retrieve: () => Promise.resolve([match]) },
      { enrich: () => Promise.resolve([source]) },
      {
        generateJson: () =>
          Promise.resolve({
            answer: 'Fue explicada en Ingeniería de Software.',
            citationIds: ['chunk-1'],
          }),
      },
    );
    expect(await answer.execute('¿Dónde?', new AbortController().signal)).toEqual({
      answer: 'Fue explicada en Ingeniería de Software.',
      sources: [source],
      insufficient: false,
    });
  });

  it('uses the safe empty answer for no evidence, unknown citations and invalid responses', async () => {
    const noEvidence = new AskKnowledge(
      { retrieve: () => Promise.resolve([]) },
      { enrich: () => Promise.resolve([]) },
      { generateJson: vi.fn() },
    );
    expect((await noEvidence.execute('Nada', new AbortController().signal)).answer).toBe(
      INSUFFICIENT_ANSWER,
    );
    const match = {
      id: 'known',
      sessionId: 's',
      startTime: 0,
      endTime: 1,
      text: 'texto',
      score: 1,
    };
    for (const response of [
      { answer: 'Inventada', citationIds: ['unknown'] },
      { malformed: true },
    ]) {
      const service = new AskKnowledge(
        { retrieve: () => Promise.resolve([match]) },
        {
          enrich: () =>
            Promise.resolve([{ ...match, sessionTitle: 'Clase', sessionDate: new Date() }]),
        },
        { generateJson: () => Promise.resolve(response) },
      );
      const result = await service.execute('Pregunta', new AbortController().signal);
      expect(result).toMatchObject({
        answer: INSUFFICIENT_ANSWER,
        sources: [],
        insufficient: true,
      });
    }
  });
});
