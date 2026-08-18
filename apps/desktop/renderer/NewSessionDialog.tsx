import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CreateSessionInput, SessionTypeDto } from '../shared/session-contracts';

interface Props {
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: CreateSessionInput) => Promise<void>;
}

export function NewSessionDialog({ error, onCancel, onSubmit }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SessionTypeDto>('CLASS');
  const [subject, setSubject] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = getFocusable(dialog.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    titleInput.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyboard);
      previousFocus?.focus();
    };
  }, []);

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
        ref={dialog}
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
              ref={titleInput}
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
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

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden);
}
