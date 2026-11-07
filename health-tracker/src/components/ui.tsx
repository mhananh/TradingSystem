import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { parseNumberInput } from '../domain/validation';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, title, action, as: As = 'section' }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: 'section' | 'div' }) {
  return (
    <As className={cx('rounded-3xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-16px_rgba(0,0,0,0.6)]', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  children, onClick, variant = 'secondary', type = 'button', disabled, className, full, ariaLabel,
}: { children: ReactNode; onClick?: () => void; variant?: BtnVariant; type?: 'button' | 'submit'; disabled?: boolean; className?: string; full?: boolean; ariaLabel?: string }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-accent text-on-accent font-semibold shadow-[0_8px_24px_-8px_var(--color-accent)] active:brightness-90 disabled:opacity-40 disabled:shadow-none',
    secondary: 'bg-soft text-ink border border-line active:bg-line disabled:opacity-40',
    ghost: 'bg-transparent text-accent active:bg-accent-soft disabled:opacity-50',
    danger: 'bg-urgent-soft text-urgent border border-urgent/30 active:brightness-110 disabled:opacity-40',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition-colors', styles[variant], full && 'w-full', className)}
    >
      {children}
    </button>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}

/** Numeric input that accepts comma decimals and reports invalid text without crashing. */
export function NumberField({
  label, value, onChange, unit, min, max, step = 'any', hint, placeholder, id: idProp, integer,
}: {
  label: ReactNode; value: number | undefined; onChange: (v: number | undefined) => void; unit?: string; min?: number; max?: number;
  step?: string; hint?: ReactNode; placeholder?: string; id?: string; integer?: boolean;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  const [err, setErr] = useState<string | null>(null);
  const lastExternal = useRef(value);
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setText(value == null ? '' : String(value).replace('.', ','));
      setErr(null);
    }
  }, [value]);
  const commit = (t: string) => {
    const n = parseNumberInput(t);
    if (n === 'invalid') return setErr('Masukkan angka yang valid.');
    if (n != null && min != null && n < min) return setErr(`Minimal ${String(min).replace('.', ',')}${unit ? ' ' + unit : ''}.`);
    if (n != null && max != null && n > max) return setErr(`Maksimal ${String(max).replace('.', ',')}${unit ? ' ' + unit : ''}.`);
    setErr(null);
    const v = n == null ? undefined : integer ? Math.round(n) : n;
    lastExternal.current = v;
    onChange(v);
  };
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <div className={cx('flex min-h-11 items-center rounded-xl border bg-field px-3', err ? 'border-caution' : 'border-line')}>
        <input
          id={id}
          inputMode="decimal"
          step={step}
          className="w-full min-w-0 bg-transparent py-2 text-[16px] outline-none tabular"
          value={text}
          placeholder={placeholder}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-err` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
        />
        {unit && <span className="ml-2 shrink-0 text-sm text-muted">{unit}</span>}
      </div>
      {err && (
        <p id={`${id}-err`} className="mt-1 text-xs text-caution">
          {err}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, multiline, hint, type = 'text' }: { label: ReactNode; value: string | undefined; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: ReactNode; type?: string }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {multiline ? (
        <textarea id={id} rows={3} className="w-full rounded-xl border border-line bg-field px-3 py-2 text-[16px] outline-none" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={type} className="min-h-11 w-full rounded-xl border border-line bg-field px-3 text-[16px] outline-none" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function TimeField({ label, value, onChange, hint }: { label: ReactNode; value: string | undefined; onChange: (v: string | undefined) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <input id={id} type="time" className="min-h-11 w-full rounded-xl border border-line bg-field px-3 text-[16px] outline-none tabular" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}

export function DateField({ label, value, onChange, max, min }: { label: ReactNode; value: string | undefined; onChange: (v: string) => void; max?: string; min?: string }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input id={id} type="date" max={max} min={min} className="min-h-11 w-full rounded-xl border border-line bg-field px-3 text-[16px] outline-none" value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange, allowClear = true }: { label?: ReactNode; options: readonly { id: T; label: string }[]; value: T | undefined; onChange: (v: T | undefined) => void; allowClear?: boolean }) {
  return (
    <fieldset>
      {label && <legend className="mb-1 text-sm font-medium">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on && allowClear ? undefined : o.id)}
              className={cx('min-h-11 rounded-xl border px-3 text-sm', on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-field text-ink')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Chips({ label, options, value, onChange }: { label?: ReactNode; options: readonly { id: string; label: string }[]; value: string[] | undefined; onChange: (v: string[]) => void }) {
  const cur = value ?? [];
  return (
    <fieldset>
      {label && <legend className="mb-1 text-sm font-medium">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = cur.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? cur.filter((x) => x !== o.id) : [...cur, o.id])}
              className={cx('min-h-11 rounded-full border px-3 text-sm', on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-field')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Scale5({ label, value, onChange, low, high }: { label: ReactNode; value: number | undefined; onChange: (v: number | undefined) => void; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${n} dari 5`}
            onClick={() => onChange(value === n ? undefined : n)}
            className={cx('min-h-11 rounded-xl border text-[15px] tabular', value === n ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-field')}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="text-[15px]">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function Section({ title, summary, children, defaultOpen, icon }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode }) {
  return (
    <details className="group rounded-3xl border border-line bg-card" open={defaultOpen}>
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
        {icon && <span className="text-accent">{icon}</span>}
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          {summary && <span className="block text-xs text-muted">{summary}</span>}
        </span>
        <ChevronDown className="h-5 w-5 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}

export function Note({ tone = 'info', children, title }: { tone?: 'info' | 'caution' | 'urgent' | 'positive'; children: ReactNode; title?: ReactNode }) {
  const map = {
    info: ['bg-info-soft text-info', Info],
    caution: ['bg-caution-soft text-caution', AlertTriangle],
    urgent: ['bg-urgent-soft text-urgent', AlertTriangle],
    positive: ['bg-accent-soft text-accent', CheckCircle2],
  } as const;
  const [cls, Icon] = map[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl p-3 text-sm', cls)} role={tone === 'urgent' ? 'alert' : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="text-ink">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'caution' | 'info' }) {
  const t = { neutral: 'bg-soft text-muted', accent: 'bg-accent-soft text-accent', caution: 'bg-caution-soft text-caution', info: 'bg-info-soft text-info' }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', t)}>{children}</span>;
}

export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Progress({ value, max, label, tone = 'accent' }: { value: number; max: number; label: string; tone?: 'accent' | 'neutral' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2.5 w-full overflow-hidden rounded-full bg-soft">
      <div className={cx('h-full rounded-full', tone === 'accent' ? 'bg-accent' : 'bg-muted')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-line bg-bg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-soft">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel, danger, requireText }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean; requireText?: string }) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="text-[15px] text-ink">{body}</div>
      {requireText && <TextField label={`Ketik "${requireText}" untuk konfirmasi`} value={typed} onChange={setTyped} />}
      <div className="flex gap-2">
        <Button full onClick={onCancel}>Batal</Button>
        <Button full variant={danger ? 'danger' : 'primary'} disabled={!!requireText && typed.trim().toUpperCase() !== requireText} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

// ---------- Toasts with optional undo ----------
interface ToastMsg {
  id: number;
  text: string;
  undo?: () => void;
}
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, undo?: () => void) => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m.slice(-2), { id, text, undo }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), undo ? 7000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
        {msgs.map((m) => (
          <div key={m.id} className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-elev px-4 py-3 text-sm text-ink shadow-2xl">
            <span>{m.text}</span>
            {m.undo && (
              <button
                type="button"
                className="min-h-11 rounded-lg px-2 font-semibold text-accent"
                onClick={() => {
                  m.undo!();
                  setMsgs((all) => all.filter((x) => x.id !== m.id));
                }}
              >
                Urungkan
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
