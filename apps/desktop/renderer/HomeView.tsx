import { useEffect, useState } from 'react';
import type {
  IncompleteRecordingDto,
  LibraryQueryDto,
  SessionDto,
  SessionTypeDto,
  KnowledgeAnswerDto,
} from '../shared/session-contracts';
import { formatDate, formatDuration, sessionStatusLabel, sessionTypeLabel } from './session-format';

interface Props {
  sessions: readonly SessionDto[];
  recentClasses: readonly SessionDto[];
  recentMeetings: readonly SessionDto[];
  subjects: readonly string[];
  total: number;
  incomplete: readonly IncompleteRecordingDto[];
  error: string | null;
  onNew: () => void;
  onSelect: (session: SessionDto) => void;
  onSearch: (query: LibraryQueryDto) => Promise<void>;
  onOpenSource: (sessionId: string, timestamp: number) => void;
  onRecover: (sessionId: string) => void;
  onDiscard: (sessionId: string) => void;
}

export function HomeView(props: Props) {
  const { onSearch } = props;
  const [text, setText] = useState('');
  const [type, setType] = useState<SessionTypeDto | ''>('');
  const [subject, setSubject] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState('');
  const [knowledge, setKnowledge] = useState<KnowledgeAnswerDto | null>(null);
  const [asking, setAsking] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const pageSize = 12;
  const filtered = Boolean(text || type || subject || dateFrom || dateTo || sort === 'OLDEST');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void onSearch({
        page,
        pageSize,
        sort,
        ...(text.trim() ? { text } : {}),
        ...(type ? { type } : {}),
        ...(subject ? { subject } : {}),
        ...(dateFrom ? { dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString() } : {}),
        ...(dateTo ? { dateTo: new Date(`${dateTo}T23:59:59.999`).toISOString() } : {}),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, type, subject, dateFrom, dateTo, sort, page, onSearch]);

  const resetPage = () => setPage(1);
  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setKnowledgeError(null);
    try {
      setKnowledge(await window.lecta.knowledge.ask(question));
    } catch (cause) {
      setKnowledgeError(
        cause instanceof Error ? cause.message : 'No se pudo consultar el conocimiento.',
      );
    } finally {
      setAsking(false);
    }
  };
  return (
    <>
      <header className="home-header">
        <div>
          <span className="brand">Lecta</span>
          <h1>Biblioteca</h1>
          <p>Encuentra una idea, una clase o una decisión en segundos.</p>
        </div>
        <button className="primary-button" onClick={props.onNew}>
          Nueva sesión
        </button>
      </header>
      {props.error && (
        <p className="error-banner" role="alert">
          {props.error}
        </p>
      )}
      {props.incomplete.map((recording) => (
        <aside className="recovery-banner" key={recording.sessionId}>
          <div>
            <strong>Encontramos una grabación que no terminó correctamente.</strong>
            <p>Los fragmentos guardados siguen disponibles.</p>
          </div>
          <div className="recovery-actions">
            <button
              className="text-button danger"
              onClick={() => props.onDiscard(recording.sessionId)}
            >
              Descartar
            </button>
            <button className="primary-button" onClick={() => props.onRecover(recording.sessionId)}>
              Recuperar
            </button>
          </div>
        </aside>
      ))}

      <section className="ask-lecta">
        <div>
          <span className="eyebrow">CONOCIMIENTO LOCAL</span>
          <h2>Preguntar a Lecta</h2>
          <p>Las respuestas siempre incluyen el fragmento original y su momento exacto.</p>
        </div>
        <form
          aria-label="Preguntar al conocimiento de Lecta"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <input
            aria-label="¿Qué quieres encontrar?"
            value={question}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="¿Qué quieres encontrar?"
          />
          <button className="primary-button" disabled={asking || !question.trim()}>
            {asking ? 'Buscando…' : 'Preguntar'}
          </button>
        </form>
        {knowledgeError && (
          <p className="error-banner" role="alert">
            {knowledgeError}
          </p>
        )}
        {knowledge && (
          <div className="knowledge-answer" role="status" aria-live="polite">
            <h3>Respuesta</h3>
            <p>{knowledge.answer}</p>
            {knowledge.sources.length > 0 && (
              <>
                <h3>Fuentes</h3>
                <div className="knowledge-sources">
                  {knowledge.sources.map((source) => (
                    <article key={source.id}>
                      <div>
                        <strong>{source.sessionTitle}</strong>
                        <span>
                          {new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(
                            new Date(source.sessionDate),
                          )}
                        </span>
                      </div>
                      <p>“{source.text}”</p>
                      <button
                        className="timestamp-button"
                        onClick={() => props.onOpenSource(source.sessionId, source.startTime)}
                      >
                        ▶ {formatDuration(source.startTime * 1000, true)} · Reproducir
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="library-tools" aria-label="Buscar y filtrar sesiones">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              resetPage();
            }}
            placeholder="Buscar en títulos, transcripciones y apuntes"
          />
        </label>
        <div className="filter-row">
          <select
            aria-label="Tipo"
            value={type}
            onChange={(event) => {
              setType(event.target.value as SessionTypeDto | '');
              resetPage();
            }}
          >
            <option value="">Todos los tipos</option>
            <option value="CLASS">Clases</option>
            <option value="MEETING">Reuniones</option>
            <option value="OTHER">Otros</option>
          </select>
          <select
            aria-label="Materia o proyecto"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              resetPage();
            }}
          >
            <option value="">Todas las materias y proyectos</option>
            {props.subjects.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <label>
            Desde{' '}
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                resetPage();
              }}
            />
          </label>
          <label>
            Hasta{' '}
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                resetPage();
              }}
            />
          </label>
          <select
            aria-label="Orden"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as 'NEWEST' | 'OLDEST');
              resetPage();
            }}
          >
            <option value="NEWEST">Más recientes</option>
            <option value="OLDEST">Más antiguas</option>
          </select>
        </div>
      </section>

      {!filtered && (
        <div className="recent-sections">
          <RecentSection
            title="Clases recientes"
            sessions={props.recentClasses}
            onSelect={props.onSelect}
            empty="Tus clases recientes aparecerán aquí."
          />
          <RecentSection
            title="Reuniones recientes"
            sessions={props.recentMeetings}
            onSelect={props.onSelect}
            empty="Tus reuniones recientes aparecerán aquí."
          />
        </div>
      )}

      <section aria-labelledby="library-title" className="library-results">
        <div className="section-heading">
          <h2 id="library-title">{filtered ? 'Resultados' : 'Todas las sesiones'}</h2>
          <span>
            {props.total} {props.total === 1 ? 'sesión' : 'sesiones'}
          </span>
        </div>
        {props.sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">L</div>
            <h3>{filtered ? 'No encontramos coincidencias' : 'Tu biblioteca está vacía'}</h3>
            <p>
              {filtered
                ? 'Prueba otras palabras o elimina algún filtro.'
                : 'Crea una sesión para empezar a construir tu biblioteca.'}
            </p>
          </div>
        ) : (
          <div className="session-list">
            {props.sessions.map((session) => (
              <SessionRow key={session.id} session={session} onSelect={props.onSelect} />
            ))}
          </div>
        )}
        {props.total > pageSize && (
          <nav className="pagination" aria-label="Paginación">
            <button
              className="secondary-button"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {Math.ceil(props.total / pageSize)}
            </span>
            <button
              className="secondary-button"
              disabled={page * pageSize >= props.total}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
    </>
  );
}

function RecentSection({
  title,
  sessions,
  onSelect,
  empty,
}: {
  title: string;
  sessions: readonly SessionDto[];
  onSelect: (session: SessionDto) => void;
  empty: string;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {sessions.length === 0 ? (
        <p className="recent-empty">{empty}</p>
      ) : (
        <div className="recent-grid">
          {sessions.map((session) => (
            <button key={session.id} className="session-card" onClick={() => onSelect(session)}>
              <span className={`status-dot status-${session.status.toLowerCase()}`} />
              <strong>{session.title}</strong>
              <small>{session.subject || sessionTypeLabel[session.type]}</small>
              <div>
                <span>{formatDate(session.createdAt)}</span>
                <span>{formatDuration(session.durationMs)}</span>
              </div>
              <span className="status-label">{sessionStatusLabel[session.status]}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionRow({
  session,
  onSelect,
}: {
  session: SessionDto;
  onSelect: (session: SessionDto) => void;
}) {
  return (
    <button className="session-row" onClick={() => onSelect(session)}>
      <div className="session-main">
        <span className={`status-dot status-${session.status.toLowerCase()}`} />
        <div>
          <strong>{session.title}</strong>
          <small>{session.subject || sessionTypeLabel[session.type]}</small>
          {session.tags.length > 0 && (
            <span className="tag-line">{session.tags.map((tag) => `#${tag}`).join(' ')}</span>
          )}
        </div>
      </div>
      <div className="session-meta">
        <span className="type-chip">{sessionTypeLabel[session.type]}</span>
        <span>{formatDate(session.createdAt)}</span>
        <span>{formatDuration(session.durationMs)}</span>
        <span className="status-label">{sessionStatusLabel[session.status]}</span>
        <span className="row-arrow">›</span>
      </div>
    </button>
  );
}
