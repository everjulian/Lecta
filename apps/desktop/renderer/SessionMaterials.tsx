import { useRef, useState, type KeyboardEvent } from 'react';
import type {
  AIGenerationProgressDto,
  StructuredNotesDto,
  TranscriptDto,
  TranscriptionJobDto,
  TranscriptionModel,
  TranscriptionResourceMode,
} from '../shared/session-contracts';
import { formatTimestamp } from './session-format';
import { TranscriptPanel } from './TranscriptPanel';

type Tab = 'summary' | 'notes' | 'transcript' | 'audio';
const tabs: ReadonlyArray<readonly [Tab, string]> = [
  ['summary', 'Resumen'],
  ['notes', 'Apuntes'],
  ['transcript', 'Transcripción'],
  ['audio', 'Audio'],
];
interface Props {
  notes: StructuredNotesDto | null;
  aiProgress: AIGenerationProgressDto | null;
  aiError: string | null;
  transcript: TranscriptDto | null;
  job: TranscriptionJobDto | null;
  model: TranscriptionModel;
  resourceMode: TranscriptionResourceMode;
  onModelChange: (value: TranscriptionModel) => void;
  onModeChange: (value: TranscriptionResourceMode) => void;
  onTranscribe: () => void;
  onCancel: () => void;
  onRestart: () => void;
  onGenerate: () => void;
  initialTimestamp: number | null;
}

export function SessionMaterials(props: Props) {
  const [tab, setTab] = useState<Tab>(props.initialTimestamp === null ? 'summary' : 'transcript');
  const audio = useRef<HTMLAudioElement>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const seek = (seconds: number) => {
    if (!audio.current) return;
    audio.current.currentTime = seconds;
    void audio.current.play();
  };
  const generating = props.aiProgress !== null;
  const selectTab = (index: number) => {
    const next = tabs[index];
    if (!next) return;
    setTab(next[0]);
    tabButtons.current[index]?.focus();
  };
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(next);
  };

  return (
    <section className="materials">
      <div className="material-tabs" role="tablist" aria-label="Contenido de la sesión">
        {tabs.map(([id, label], index) => (
          <button
            ref={(element) => {
              tabButtons.current[index] = element;
            }}
            key={id}
            id={`material-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`material-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
            onKeyDown={(event) => handleTabKey(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'summary' && (
        <div
          id="material-panel-summary"
          className="material-panel"
          role="tabpanel"
          aria-labelledby="material-tab-summary"
        >
          {!props.transcript ? (
            <p className="empty-copy">
              Primero transcribe la grabación para generar material de estudio.
            </p>
          ) : props.notes ? (
            <>
              <div className="material-heading">
                <div>
                  <span className="eyebrow">RESUMEN</span>
                  <h2>Resumen general</h2>
                </div>
                <button
                  className="secondary-button"
                  disabled={generating}
                  onClick={props.onGenerate}
                >
                  Regenerar resumen
                </button>
              </div>
              <p className="summary-copy">{props.notes.summary}</p>
              {props.notes.examMentions.length > 0 && (
                <section className="exam-box">
                  <h3>Exámenes y entregables</h3>
                  <ul>
                    {props.notes.examMentions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <GenerateState {...props} />
          )}
          {props.aiError && (
            <p className="error-banner" role="alert">
              {props.aiError}
            </p>
          )}
          {props.aiProgress && <AIProgress value={props.aiProgress} />}
        </div>
      )}
      {tab === 'notes' && (
        <div
          id="material-panel-notes"
          className="material-panel"
          role="tabpanel"
          aria-labelledby="material-tab-notes"
        >
          {!props.notes ? (
            <p className="empty-copy">Genera el resumen para ver apuntes, conceptos y preguntas.</p>
          ) : (
            <>
              <h2>Apuntes estructurados</h2>
              <div className="topic-list">
                {props.notes.topics.map((topic) => (
                  <section key={topic.title}>
                    <h3>{topic.title}</h3>
                    <ul>
                      {topic.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <h2>Conceptos clave</h2>
              <div className="concept-grid">
                {props.notes.keyConcepts.map((item) => (
                  <article key={item}>{item}</article>
                ))}
              </div>
              <h2>Tareas</h2>
              <div className="check-list">
                {props.notes.tasks.map((item) => (
                  <label key={item}>
                    <input type="checkbox" />
                    {item}
                  </label>
                ))}
              </div>
              <h2>Para estudiar</h2>
              <ol>
                {props.notes.studyQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <h2>Momentos importantes</h2>
              <div className="moment-list">
                {props.notes.importantMoments.map((moment) => (
                  <article key={`${moment.timestamp}-${moment.title}`}>
                    <button className="timestamp-button" onClick={() => seek(moment.timestamp)}>
                      {formatTimestamp(moment.timestamp)}
                    </button>
                    <div>
                      <strong>{moment.title}</strong>
                      <p>{moment.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'transcript' && (
        <div
          id="material-panel-transcript"
          role="tabpanel"
          aria-labelledby="material-tab-transcript"
        >
          <TranscriptPanel
            job={props.job}
            transcript={props.transcript}
            model={props.model}
            resourceMode={props.resourceMode}
            onModelChange={props.onModelChange}
            onModeChange={props.onModeChange}
            onStart={props.onTranscribe}
            onCancel={props.onCancel}
            onRestart={props.onRestart}
            initialTimestamp={props.initialTimestamp}
          />
        </div>
      )}
      {tab === 'audio' && (
        <div
          id="material-panel-audio"
          className="material-panel"
          role="tabpanel"
          aria-labelledby="material-tab-audio"
        >
          <h2>Audio de la sesión</h2>
          {props.transcript ? (
            <audio controls src={props.transcript.audioUrl} />
          ) : (
            <p className="empty-copy">
              El audio estará disponible aquí cuando la grabación esté preparada.
            </p>
          )}
        </div>
      )}
      {props.transcript && (
        <audio
          className="hidden-audio"
          ref={audio}
          src={props.transcript.audioUrl}
          preload="metadata"
        />
      )}
    </section>
  );
}

function GenerateState(props: Props) {
  return (
    <div className="generate-state">
      <strong>Convierte la transcripción en material útil</strong>
      <p>Genera resumen, apuntes, tareas y preguntas sin modificar el audio ni la transcripción.</p>
      <button
        className="primary-button"
        disabled={props.aiProgress !== null}
        onClick={props.onGenerate}
      >
        Generar apuntes
      </button>
    </div>
  );
}
function AIProgress({ value }: { value: AIGenerationProgressDto }) {
  const labels = {
    CHUNKING: 'Preparando transcripción…',
    SUMMARIZING: 'Analizando contenido…',
    SYNTHESIZING: 'Creando apuntes…',
    SAVING: 'Guardando…',
  };
  return (
    <div className="ai-progress" role="status" aria-live="polite">
      <div>
        <strong>{labels[value.stage]}</strong>
        <span>{value.progress}%</span>
      </div>
      <progress aria-label="Progreso de generación de apuntes" value={value.progress} max="100" />
    </div>
  );
}
