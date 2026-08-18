import { useEffect, useState } from 'react';
import type {
  SessionDto,
  TranscriptDto,
  TranscriptionJobDto,
  TranscriptionModel,
  TranscriptionResourceMode,
  StructuredNotesDto,
  AIGenerationProgressDto,
} from '../shared/session-contracts';
import { formatDuration, sessionStatusLabel, sessionTypeLabel } from './session-format';
import type { MicrophoneOption } from './recording/electron-engine';
import { SessionMaterials } from './SessionMaterials';

interface Props {
  session: SessionDto;
  microphones: readonly MicrophoneOption[];
  microphoneId: string;
  error: string | null;
  onBack: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onMicrophoneChange: (deviceId: string) => void;
  onShowFile: () => Promise<void>;
  transcriptionJob: TranscriptionJobDto | null;
  transcript: TranscriptDto | null;
  transcriptionModel: TranscriptionModel;
  transcriptionMode: TranscriptionResourceMode;
  onTranscriptionModelChange: (model: TranscriptionModel) => void;
  onTranscriptionModeChange: (mode: TranscriptionResourceMode) => void;
  onTranscribe: () => void;
  onCancelTranscription: () => void;
  onRestartTranscription: () => void;
  notes: StructuredNotesDto | null;
  aiProgress: AIGenerationProgressDto | null;
  aiError: string | null;
  onGenerateNotes: () => void;
  initialTimestamp: number | null;
}

export function SessionView({
  session,
  microphones,
  microphoneId,
  error,
  onBack,
  onStart,
  onPause,
  onResume,
  onFinish,
  onMicrophoneChange,
  onShowFile,
  transcriptionJob,
  transcript,
  transcriptionModel,
  transcriptionMode,
  onTranscriptionModelChange,
  onTranscriptionModeChange,
  onTranscribe,
  onCancelTranscription,
  onRestartTranscription,
  notes,
  aiProgress,
  aiError,
  onGenerateNotes,
  initialTimestamp,
}: Props) {
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    if (session.status !== 'RECORDING') return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session.status]);

  const duration =
    session.durationMs +
    (session.status === 'RECORDING' && currentTime !== null
      ? Math.max(0, currentTime - new Date(session.updatedAt).getTime())
      : 0);

  return (
    <section className="session-view">
      <nav>
        <button className="back-button" onClick={onBack}>
          ← Volver a sesiones
        </button>
        <span className="brand">Lecta</span>
      </nav>
      <div className="session-content">
        <div className="session-identity">
          <span className="type-chip">{sessionTypeLabel[session.type]}</span>
          <h1>{session.title}</h1>
          {session.subject && <p>{session.subject}</p>}
        </div>
        <div className={`recording-orb orb-${session.status.toLowerCase()}`}>
          <span />
        </div>
        <time className="timer">{formatDuration(duration, true)}</time>
        <div className="current-status">
          <span className={`status-dot status-${session.status.toLowerCase()}`} />
          {sessionStatusLabel[session.status]}
        </div>
        {session.status === 'IDLE' && (
          <label className="microphone-picker">
            Micrófono
            <select
              value={microphoneId}
              onChange={(event) => onMicrophoneChange(event.target.value)}
            >
              {microphones.length === 0 && <option value="">Predeterminado de Windows</option>}
              {microphones.map((microphone) => (
                <option key={microphone.deviceId} value={microphone.deviceId}>
                  {microphone.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="error-banner compact">{error}</p>}
        <div className="recording-actions">
          {session.status === 'IDLE' && (
            <button className="record-button" onClick={onStart}>
              <span />
              Grabar
            </button>
          )}
          {session.status === 'RECORDING' && (
            <>
              <button className="primary-button" onClick={onPause}>
                Pausar
              </button>
              <button className="secondary-button danger" onClick={onFinish}>
                Finalizar
              </button>
            </>
          )}
          {session.status === 'PAUSED' && (
            <>
              <button className="primary-button" onClick={onResume}>
                Reanudar
              </button>
              <button className="secondary-button danger" onClick={onFinish}>
                Finalizar
              </button>
            </>
          )}
          {session.status === 'PROCESSING' && (
            <p className="processing-copy">Procesando la sesión…</p>
          )}
          {(session.status === 'COMPLETED' || session.status === 'FAILED') && (
            <>
              {session.status === 'COMPLETED' && (
                <button className="primary-button" onClick={() => void onShowFile()}>
                  Mostrar archivo
                </button>
              )}
              <button className="secondary-button" onClick={onBack}>
                Volver al historial
              </button>
            </>
          )}
        </div>
        <p className="mock-note">
          {session.status === 'RECORDING'
            ? 'Audio del sistema y micrófono se guardan en fragmentos seguros'
            : 'Lecta nunca comienza a grabar sin tu acción'}
        </p>
        {session.status === 'COMPLETED' && (
          <SessionMaterials
            job={transcriptionJob}
            transcript={transcript}
            model={transcriptionModel}
            resourceMode={transcriptionMode}
            onModelChange={onTranscriptionModelChange}
            onModeChange={onTranscriptionModeChange}
            onTranscribe={onTranscribe}
            onCancel={onCancelTranscription}
            onRestart={onRestartTranscription}
            notes={notes}
            aiProgress={aiProgress}
            aiError={aiError}
            onGenerate={onGenerateNotes}
            initialTimestamp={initialTimestamp}
          />
        )}
      </div>
    </section>
  );
}
