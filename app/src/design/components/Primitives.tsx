import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Panel({ title, icon, actions, flush, children, className = '' }: {
  title?: ReactNode; icon?: ReactNode; actions?: ReactNode; flush?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <section className={`ep-panel ${className}`}>
      {(title || actions) && (
        <header className="ep-panel__head">
          {title && <h2 className="ep-panel__title">{icon}{title}</h2>}
          {actions}
        </header>
      )}
      <div className={flush ? 'ep-panel__body--flush' : 'ep-panel__body'}>{children}</div>
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: ReactNode;
};
export function Button({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }: BtnProps) {
  const cls = ['ep-btn', variant !== 'secondary' && `ep-btn--${variant}`, size === 'sm' && 'ep-btn--sm', className].filter(Boolean).join(' ');
  return <button className={cls} {...rest}>{icon}{children}</button>;
}

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="ep-icon-btn" aria-label={label} title={label} {...rest}>{children}</button>;
}

export function Chip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: ReactNode }) {
  return <button className="ep-chip" aria-pressed={pressed} onClick={onToggle}>{children}</button>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="ep-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Tag({ tone, children }: { tone?: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`ep-tag${tone ? ` ep-tag--${tone}` : ''}`}>{children}</span>;
}
