import { useCallback, useEffect, useState } from 'react';
import type {
  CreateSessionInput,
  IncompleteRecordingDto,
  SessionDto,
  TranscriptDto,
  TranscriptionJobDto,
  TranscriptionModel,
  TranscriptionResourceMode,
  StructuredNotesDto,
  AIGenerationProgressDto,
  LibraryQueryDto,
} from '../shared/session-contracts';
import { HomeView } from './HomeView';
import { NewSessionDialog } from './NewSessionDialog';
import {
  createRecordingEngine,
  listMicrophones,
  type MicrophoneOption,
} from './recording/electron-engine';
import { SessionView } from './SessionView';

export function App() {
  const [engine] = useState(createRecordingEngine);
  const [sessions, setSessions] = useState<readonly SessionDto[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [subjects, setSubjects] = useState<readonly string[]>([]);
  const [recentClasses, setRecentClasses] = useState<readonly SessionDto[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<readonly SessionDto[]>([]);
  const [incomplete, setIncomplete] = useState<readonly IncompleteRecordingDto[]>([]);
  const [microphones, setMicrophones] = useState<readonly MicrophoneOption[]>([]);
  const [microphoneId, setMicrophoneId] = useState('');
  const [selected, setSelected] = useState<SessionDto | null>(null);
  const [initialTimestamp, setInitialTimestamp] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptionJob, setTranscriptionJob] = useState<TranscriptionJobDto | null>(null);
  const [transcript, setTranscript] = useState<TranscriptDto | null>(null);
  const [transcriptionModel, setTranscriptionModel] = useState<TranscriptionModel>('small');
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionResourceMode>('LIGHT');
  const [notes, setNotes] = useState<StructuredNotesDto | null>(null);
  const [aiProgress, setAIProgress] = useState<AIGenerationProgressDto | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);

  const searchLibrary = useCallback(async (query: LibraryQueryDto) => {
    const result = await window.lecta.sessions.searchLibrary(query);
    setSessions(result.items);
    setLibraryTotal(result.total);
  }, []);
  const loadSessions = async () => {
    const base = { page: 1, pageSize: 20, sort: 'NEWEST' as const };
    const [all, classes, meetings, storedSubjects] = await Promise.all([
      window.lecta.sessions.searchLibrary(base),
      window.lecta.sessions.searchLibrary({ ...base, pageSize: 4, type: 'CLASS' }),
      window.lecta.sessions.searchLibrary({ ...base, pageSize: 4, type: 'MEETING' }),
      window.lecta.sessions.listSubjects(),
    ]);
    setSessions(all.items);
    setLibraryTotal(all.total);
    setRecentClasses(classes.items);
    setRecentMeetings(meetings.items);
    setSubjects(storedSubjects);
  };
  const loadIncomplete = async () => setIncomplete(await window.lecta.recording.listIncomplete());
  const selectedSessionId = selected?.id;

  useEffect(() => {
    void Promise.all([
      window.lecta.sessions.searchLibrary({ page: 1, pageSize: 20, sort: 'NEWEST' }),
      window.lecta.sessions.searchLibrary({ page: 1, pageSize: 4, sort: 'NEWEST', type: 'CLASS' }),
      window.lecta.sessions.searchLibrary({
        page: 1,
        pageSize: 4,
        sort: 'NEWEST',
        type: 'MEETING',
      }),
      window.lecta.sessions.listSubjects(),
      window.lecta.recording.listIncomplete(),
      window.lecta.recording.getMicrophonePreference(),
      listMicrophones(),
    ])
      .then(
        ([library, classes, meetings, storedSubjects, storedIncomplete, preference, devices]) => {
          setSessions(library.items);
          setLibraryTotal(library.total);
          setRecentClasses(classes.items);
          setRecentMeetings(meetings.items);
          setSubjects(storedSubjects);
          setIncomplete(storedIncomplete);
          setMicrophones(devices);
          setMicrophoneId(preference ?? devices[0]?.deviceId ?? '');
        },
      )
      .catch((cause: unknown) => setError(messageFrom(cause)));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    const sessionId = selectedSessionId;
    void Promise.all([
      window.lecta.transcription.getJob(sessionId),
      window.lecta.transcription.getTranscript(sessionId),
      window.lecta.ai.getNotes(sessionId),
    ]).then(([job, storedTranscript, storedNotes]) => {
      setTranscriptionJob(job);
      setTranscript(storedTranscript);
      setNotes(storedNotes);
      if (job) {
        setTranscriptionModel(job.model);
        setTranscriptionMode(job.resourceMode);
      }
    });
    const stopTranscription = window.lecta.transcription.onProgress((job) => {
      if (job.sessionId !== sessionId) return;
      setTranscriptionJob(job);
      if (job.status === 'COMPLETED') {
        void window.lecta.transcription.getTranscript(sessionId).then(setTranscript);
      }
    });
    const stopAI = window.lecta.ai.onProgress((progress) => {
      if (progress.sessionId === sessionId) setAIProgress(progress);
    });
    return () => {
      stopTranscription();
      stopAI();
    };
  }, [selectedSessionId]);

  const createSession = async (input: CreateSessionInput) => {
    try {
      const session = await window.lecta.sessions.create(input);
      setCreating(false);
      setError(null);
      setSelected(session);
      await loadSessions();
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const start = async () => {
    if (!selected) return;
    const microphone = microphones.find((device) => device.deviceId === microphoneId);
    try {
      await engine.start({
        sessionId: selected.id,
        ...(microphoneId ? { microphoneDeviceId: microphoneId } : {}),
        microphoneLabel: microphone?.label ?? 'Micrófono predeterminado',
      });
      await window.lecta.recording.setMicrophonePreference(microphoneId || null);
      setSelected(await window.lecta.sessions.start(selected.id));
      setError(null);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const pause = async () => runRecordingAction(() => engine.pause(), window.lecta.sessions.pause);
  const resume = async () =>
    runRecordingAction(() => engine.resume(), window.lecta.sessions.resume);
  const finish = async () => runRecordingAction(() => engine.stop(), window.lecta.sessions.finish);

  const runRecordingAction = async (
    recordingAction: () => Promise<unknown>,
    sessionAction: (id: string) => Promise<SessionDto>,
  ) => {
    if (!selected) return;
    try {
      await recordingAction();
      setSelected(await sessionAction(selected.id));
      setError(null);
      await loadSessions();
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const resolveIncomplete = async (sessionId: string, action: 'recover' | 'discard') => {
    try {
      await window.lecta.recording[action](sessionId);
      await Promise.all([loadIncomplete(), loadSessions()]);
      setError(null);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const transcribe = async () => {
    if (!selected) return;
    try {
      setTranscriptionJob(
        await window.lecta.transcription.enqueue({
          sessionId: selected.id,
          model: transcriptionModel,
          resourceMode: transcriptionMode,
        }),
      );
      setError(null);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const cancelTranscription = async () => {
    if (!transcriptionJob) return;
    await window.lecta.transcription.cancel(transcriptionJob.id);
  };

  const restartTranscription = async () => {
    if (!transcriptionJob) return;
    try {
      setTranscriptionJob(await window.lecta.transcription.restart(transcriptionJob.id));
      setError(null);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const generateNotes = async () => {
    if (!selected) return;
    try {
      setAIError(null);
      setAIProgress({ sessionId: selected.id, stage: 'CHUNKING', progress: 0 });
      setNotes(await window.lecta.ai.generate(selected.id));
    } catch (cause) {
      setAIError(messageFrom(cause));
    } finally {
      setAIProgress(null);
    }
  };

  return (
    <main className="app-shell">
      {selected ? (
        <SessionView
          key={`${selected.id}-${selected.updatedAt}`}
          session={selected}
          microphones={microphones}
          microphoneId={microphoneId}
          error={error}
          onMicrophoneChange={setMicrophoneId}
          onBack={() => {
            setSelected(null);
            setError(null);
            void loadSessions();
          }}
          onStart={() => void start()}
          onPause={() => void pause()}
          onResume={() => void resume()}
          onFinish={() => void finish()}
          onShowFile={() => window.lecta.recording.showInFolder(selected.id)}
          transcriptionJob={transcriptionJob}
          transcript={transcript}
          transcriptionModel={transcriptionModel}
          transcriptionMode={transcriptionMode}
          onTranscriptionModelChange={setTranscriptionModel}
          onTranscriptionModeChange={setTranscriptionMode}
          onTranscribe={() => void transcribe()}
          onCancelTranscription={() => void cancelTranscription()}
          onRestartTranscription={() => void restartTranscription()}
          notes={notes}
          aiProgress={aiProgress}
          aiError={aiError}
          onGenerateNotes={() => void generateNotes()}
          initialTimestamp={initialTimestamp}
        />
      ) : (
        <HomeView
          sessions={sessions}
          total={libraryTotal}
          subjects={subjects}
          recentClasses={recentClasses}
          recentMeetings={recentMeetings}
          onSearch={searchLibrary}
          onOpenSource={(sessionId, timestamp) => {
            void window.lecta.sessions.get(sessionId).then((session) => {
              setInitialTimestamp(timestamp);
              setSelected(session);
            });
          }}
          incomplete={incomplete}
          error={error}
          onRecover={(id) => void resolveIncomplete(id, 'recover')}
          onDiscard={(id) => void resolveIncomplete(id, 'discard')}
          onNew={() => setCreating(true)}
          onSelect={(session) => {
            setTranscriptionJob(null);
            setTranscript(null);
            setNotes(null);
            setAIProgress(null);
            setAIError(null);
            setSelected(session);
            setInitialTimestamp(null);
          }}
        />
      )}
      {creating && (
        <NewSessionDialog
          error={error}
          onCancel={() => {
            setCreating(false);
            setError(null);
          }}
          onSubmit={createSession}
        />
      )}
    </main>
  );
}

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Ocurrió un error inesperado';
}
