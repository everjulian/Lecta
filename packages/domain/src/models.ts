export interface Recording {
  id: string;
  sessionId: string;
  filePath: string;
  durationMs: number;
}
export interface TranscriptSegment {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  text: string;
}
export interface Transcript {
  id: string;
  sessionId: string;
  language: string | null;
  createdAt: Date;
  segments: readonly TranscriptSegment[];
}
export interface Note {
  id: string;
  sessionId: string;
  content: string;
}
export interface Task {
  id: string;
  sessionId: string;
  title: string;
  completed: boolean;
}

export interface StructuredTopic {
  title: string;
  notes: readonly string[];
}

export interface ImportantMoment {
  timestamp: number;
  title: string;
  description: string;
}

export interface StructuredNotes {
  id: string;
  sessionId: string;
  transcriptId: string;
  summary: string;
  topics: readonly StructuredTopic[];
  keyConcepts: readonly string[];
  tasks: readonly string[];
  studyQuestions: readonly string[];
  importantMoments: readonly ImportantMoment[];
  examMentions: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}
