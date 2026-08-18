import { useEffect, useState, type FormEvent } from 'react';
import type { CreateSessionInput, IpcErrorDto, SessionTypeDto } from '../shared/session-contracts';
import { ErrorNotice } from './ErrorNotice';

interface Props {
  error: IpcErrorDto | null;
  onCancel: () => void;
  onSubmit: (input: CreateSessionInput) => Promise<void>;
}

export function NewSessionDialog({ error, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SessionTypeDto>('CLASS');
  const [subject, setSubject] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSubmit({
      title,
      type,
      ...(subject.trim() ? { subject } : {}),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setSaving(false);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">NUEVA SESIÓN</span>
            <h2 id="new-title">¿Qué vas a registrar?</h2>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onCancel}>
            ×
          </button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Título
            <input
              autoFocus
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Repaso de anatomía"
            />
          </label>
          <fieldset>
            <legend>Tipo</legend>
            <div className="type-options">
              {(
                [
                  ['CLASS', 'Clase'],
                  ['MEETING', 'Reunión'],
                  ['OTHER', 'Otro'],
                ] as const
              ).map(([value, label]) => (
                <label
                  className={type === value ? 'type-option selected' : 'type-option'}
                  key={value}
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            {type === 'CLASS' ? 'Materia' : type === 'MEETING' ? 'Proyecto' : 'Materia o proyecto'}{' '}
            <span>Opcional</span>
            <input
              maxLength={120}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ej. Biología II"
            />
          </label>
          <label>
            Tags <span>Opcional · separados por comas</span>
            <input
              maxLength={240}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Ej. Universidad, parcial, arquitectura"
            />
          </label>
          {error && <ErrorNotice error={error} />}
          <div className="dialog-actions">
            <button type="button" className="text-button" onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary-button" disabled={!title.trim() || saving}>
              {saving ? 'Creando…' : 'Crear sesión'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
