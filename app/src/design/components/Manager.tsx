import { useState, type ReactNode } from 'react';
import { ClipboardCheck, Smartphone, UserRound, X } from 'lucide-react';
import { Segmented } from './Primitives';

/* ---------- Celular con pendientes ---------- */
export function Phone({ title, count, filters, children }: { title: string; count?: number; filters?: ReactNode; children: ReactNode }) {
  return (
    <div className="ep-phone">
      <div className="ep-phone__screen">
        <div className="ep-phone__bar"><span>9:41</span><span>5G</span></div>
        <div className="ep-phone__head">
          <h3>{title}</h3>
          {count !== undefined && <span className="ep-count" aria-label={`${count} pendientes`}>{count}</span>}
        </div>
        {filters && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px 10px' }}>{filters}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Message({ icon, from, time, text, unread, actions }: {
  icon: ReactNode; from: string; time: string; text: ReactNode; unread?: boolean; actions?: ReactNode;
}) {
  return (
    <div className={`ep-msg${unread ? ' ep-msg--unread' : ''}`}>
      <div className="ep-msg__av">{icon}</div>
      <div>
        <div className="ep-msg__top"><b>{from}</b><time>{time}</time></div>
        <p>{text}</p>
        {actions && <div className="ep-msg__acts">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------- Tarea delegable ---------- */
export type Owner = 'me' | 'staff';
export function Task({ icon, title, sub, owner, onOwner, done }: {
  icon: ReactNode; title: string; sub: ReactNode; owner: Owner; onOwner: (o: Owner) => void; done?: boolean;
}) {
  return (
    <div className={`ep-task${done ? ' ep-task--done' : ''}`}>
      <div className="ep-task__icon">{done ? <ClipboardCheck size={18} /> : icon}</div>
      <div>
        <div className="ep-task__title">{title}</div>
        <div className="ep-task__sub">{sub}</div>
      </div>
      {!done && (
        <Segmented<Owner> label={`Quién se encarga: ${title}`} value={owner} onChange={onOwner}
          options={[{ value: 'me', label: 'Yo' }, { value: 'staff', label: 'Cuerpo técnico' }]} />
      )}
    </div>
  );
}

/* ---------- Recomendación del cuerpo técnico ---------- */
export function StaffTip({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div className="ep-tip">
      <div className="ep-tip__av"><UserRound size={18} /></div>
      <div><b>{who}</b><p>{children}</p></div>
    </div>
  );
}

/* ---------- Opciones en tarjetas (táctica, sede, etc.) ---------- */
export interface Option { id: string; icon?: ReactNode; title: string; desc: string }
export function OptionGrid({ options, value, onChange, label }: { options: Option[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="ep-options" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} className="ep-option" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          <span className="ep-option__head">{o.icon}{o.title}</span>
          <p>{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

/* ---------- Celular que aparece y se oculta ---------- */
export function PhoneDock({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ep-dock">
      <div className="ep-dock__panel" data-open={open} aria-hidden={!open}>{children}</div>
      <button className="ep-dock__btn" onClick={() => setOpen(o => !o)} aria-expanded={open}
        aria-label={open ? 'Guardar el celular' : `Abrir el celular, ${count} pendientes`}>
        {open ? <X size={22} /> : <Smartphone size={22} />}
        {!open && count > 0 && <span className="ep-count">{count}</span>}
      </button>
    </div>
  );
}

/* ---------- Escudo genérico con la bandera (no reproduce escudos reales) ---------- */
export function Crest({ iso }: { iso: string }) {
  return <span className="ep-crest" aria-hidden><span className={`fi fi-${iso}`} /></span>;
}
