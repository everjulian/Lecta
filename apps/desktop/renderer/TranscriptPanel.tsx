import { useEffect, useRef } from 'react';
import type {
  TranscriptDto,
  TranscriptionJobDto,
  TranscriptionModel,
  TranscriptionResourceMode,
} from '../shared/session-contracts';
import { formatTimestamp } from './session-format';

interface Props {
  job: TranscriptionJobDto | null;
  transcript: TranscriptDto | null;
  model: TranscriptionModel;
  resourceMode: TranscriptionResourceMode;
  onModelChange: (model: TranscriptionModel) => void;
  onModeChange: (mode: TranscriptionResourceMode) => void;
  onStart: () => void;
  onCancel: () => void;
  onRestart: () => void;
  initialTimestamp?: number | null;
}

export function TranscriptPanel(props: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const seek = (seconds: number) => {
    if (!audio.current) return;
    audio.current.currentTime = seconds;
    void audio.current.play();
  };
  useEffect(() => {
    if (props.initialTimestamp === null || props.initialTimestamp === undefined) return;
    const player = audio.current;
    if (!player) return;
    const open = () => seek(props.initialTimestamp ?? 0);
    if (player.readyState >= 1) open();
    else player.addEventListener('loadedmetadata', open, { once: true });
    return () => player.removeEventListener('loadedmetadata', open);
  }, [props.initialTimestamp]);

  if (props.transcript && (!props.job || props.job.status === 'COMPLETED')) {
    return (
      <section className="transcript-panel">
        <div className="transcript-heading">
          <div>
            <span className="eyebrow">TRANSCRIPCIÓN</span>
            <h2>Contenido de la sesión</h2>
          </div>
          {props.transcript.language && (
            <span className="language-chip">{props.transcript.language}</span>
          )}
        </div>
        <audio ref={audio} src={props.transcript.audioUrl} preload="metadata" controls />
        <div className="transcript-segments">
          {props.transcript.segments.map((segment) => (
            <article key={segment.id}>
              <button className="timestamp-button" onClick={() => seek(segment.startTime)}>
                {formatTimestamp(segment.startTime)}
              </button>
              <p>{segment.text}</p>
            </article>
          ))}
        </div>
        {props.job?.status === 'COMPLETED' && (
          <button className="text-button retranscribe-button" onClick={props.onRestart}>
            Volver a transcribir
          </button>
        )}
      </section>
    );
  }

  if (props.job && !['FAILED', 'CANCELLED'].includes(props.job.status)) {
    return (
      <section className="transcription-progress">
        <div>
          <strong>{jobLabel[props.job.status]}</strong>
          <span>{props.job.progress}%</span>
        </div>
        <progress value={props.job.progress} max="100" />
        {!['SAVING', 'COMPLETED'].includes(props.job.status) && (
          <button className="text-button danger" onClick={props.onCancel}>
            Cancelar
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="transcription-start">
      <div>
        <strong>Grabación guardada ✓</strong>
        <p>Transcribe localmente sin enviar audio a internet.</p>
      </div>
      {props.job?.error && <p className="form-error">{props.job.error}</p>}
      <div className="transcription-options">
        <label>
          Modelo
          <select
            value={props.model}
            onChange={(event) => props.onModelChange(event.target.value as TranscriptionModel)}
          >
            <option value="small">Small · recomendado</option>
            <option value="medium">Medium · más preciso</option>
          </select>
        </label>
        <label>
          Recursos
          <select
            value={props.resourceMode}
            onChange={(event) =>
              props.onModeChange(event.target.value as TranscriptionResourceMode)
            }
          >
            <option value="LIGHT">Modo ligero</option>
            <option value="NORMAL">Modo normal</option>
          </select>
        </label>
      </div>
      <button className="primary-button" onClick={props.job ? props.onRestart : props.onStart}>
        {props.job ? 'Reiniciar transcripción' : 'Transcribir ahora'}
      </button>
    </section>
  );
}

const jobLabel: Readonly<Record<TranscriptionJobDto['status'], string>> = {
  QUEUED: 'En cola…',
  PREPARING: 'Preparando el modelo…',
  TRANSCRIBING: 'Transcribiendo…',
  SAVING: 'Guardando transcripción…',
  COMPLETED: 'Transcripción completada',
  FAILED: 'La transcripción falló',
  CANCELLED: 'Transcripción cancelada',
};
