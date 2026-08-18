import type { StructuredNotes } from '@lecta/domain';
import type { GenerateNotesDependencies, GenerationProgress } from './ai-types';
import { parseStructuredNotes } from './structured-notes-schema';
import { TranscriptChunker } from './transcript-chunker';

export class GenerateStructuredNotes {
  constructor(private readonly deps: GenerateNotesDependencies) {}

  async execute(input: {
    sessionId: string;
    signal: AbortSignal;
    onProgress?: (progress: GenerationProgress) => void;
  }): Promise<StructuredNotes> {
    const transcript = await this.deps.transcripts.getTranscriptBySessionId(input.sessionId);
    if (!transcript) throw new Error('Transcript not found');
    input.onProgress?.({ stage: 'CHUNKING', percent: 5 });
    const chunks = new TranscriptChunker(this.deps.chunkSize).chunk(transcript.segments);
    if (chunks.length === 0) throw new Error('Transcript is empty');

    const partials: unknown[] = [];
    for (const [index, chunk] of chunks.entries()) {
      if (input.signal.aborted) throw new Error('AI generation cancelled');
      partials.push(
        await this.deps.provider.generateJson({
          systemPrompt: PARTIAL_SYSTEM_PROMPT,
          userPrompt: `Fragmento ${index + 1}/${chunks.length}. Conserva timestamps.\n${chunk.text}`,
          signal: input.signal,
        }),
      );
      input.onProgress?.({
        stage: 'SUMMARIZING',
        percent: 10 + Math.round(((index + 1) / chunks.length) * 55),
      });
    }

    input.onProgress?.({ stage: 'SYNTHESIZING', percent: 75 });
    const content = parseStructuredNotes(
      await this.deps.provider.generateJson({
        systemPrompt: FINAL_SYSTEM_PROMPT,
        userPrompt: `Síntesis parciales con referencias temporales:\n${JSON.stringify(partials)}`,
        signal: input.signal,
      }),
    );
    const previous = await this.deps.notes.getBySessionId(input.sessionId);
    const now = this.deps.now();
    const notes: StructuredNotes = {
      id: previous?.id ?? this.deps.generateId(),
      sessionId: input.sessionId,
      transcriptId: transcript.id,
      ...content,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    input.onProgress?.({ stage: 'SAVING', percent: 95 });
    await this.deps.notes.save(notes);
    return notes;
  }
}

const PARTIAL_SYSTEM_PROMPT = `Analiza un fragmento de transcripción educativa o de reunión. Devuelve JSON compacto con: summary, topics, keyConcepts, tasks, studyQuestions, importantMoments y examMentions. Cada importantMoment usa timestamp numérico en segundos. No inventes información.`;

const FINAL_SYSTEM_PROMPT = `Sintetiza análisis parciales en español. Devuelve exclusivamente JSON válido con este schema: {"summary":"string","topics":[{"title":"string","notes":["string"]}],"keyConcepts":["string"],"tasks":["string"],"studyQuestions":["string"],"importantMoments":[{"timestamp":0,"title":"string","description":"string"}],"examMentions":["string"]}. Elimina duplicados, preserva timestamps útiles y no inventes.`;
