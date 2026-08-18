import type { ImportantMoment, StructuredTopic } from '@lecta/domain';

export interface StructuredNotesContent {
  summary: string;
  topics: readonly StructuredTopic[];
  keyConcepts: readonly string[];
  tasks: readonly string[];
  studyQuestions: readonly string[];
  importantMoments: readonly ImportantMoment[];
  examMentions: readonly string[];
}

export class InvalidAIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAIResponseError';
  }
}

export function parseStructuredNotes(value: unknown): StructuredNotesContent {
  const object = requireObject(value, 'response');
  return {
    summary: requireString(object['summary'], 'summary'),
    topics: requireArray(object['topics'], 'topics').map((item, index) => {
      const topic = requireObject(item, `topics[${index}]`);
      return {
        title: requireString(topic['title'], `topics[${index}].title`),
        notes: requireStringArray(topic['notes'], `topics[${index}].notes`),
      };
    }),
    keyConcepts: requireStringArray(object['keyConcepts'], 'keyConcepts'),
    tasks: requireStringArray(object['tasks'], 'tasks'),
    studyQuestions: requireStringArray(object['studyQuestions'], 'studyQuestions'),
    importantMoments: requireArray(object['importantMoments'], 'importantMoments').map(
      (item, index) => {
        const moment = requireObject(item, `importantMoments[${index}]`);
        const timestamp = moment['timestamp'];
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0) {
          throw new InvalidAIResponseError(
            `importantMoments[${index}].timestamp must be non-negative`,
          );
        }
        return {
          timestamp,
          title: requireString(moment['title'], `importantMoments[${index}].title`),
          description: requireString(
            moment['description'],
            `importantMoments[${index}].description`,
          ),
        };
      },
    ),
    examMentions: requireStringArray(object['examMentions'], 'examMentions'),
  };
}

function requireObject(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidAIResponseError(`${path} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new InvalidAIResponseError(`${path} must be an array`);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidAIResponseError(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, path: string): readonly string[] {
  return requireArray(value, path).map((item, index) => requireString(item, `${path}[${index}]`));
}
