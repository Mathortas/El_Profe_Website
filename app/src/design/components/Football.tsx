import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Activity, CircleAlert, HeartPulse, Shirt } from 'lucide-react';
import type { Form, Line, Player } from '../types';

/* ---------- Niveles ---------- */
export type Tier = 'bronze' | 'silver' | 'gold';
export const tierOf = (v: number): Tier => (v >= 75 ? 'gold' : v >= 65 ? 'silver' : 'bronze');
const TIER_NAME: Record<Tier, string> = { bronze: 'bronce', silver: 'plata', gold: 'oro' };

export function Rating({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const t = tierOf(value);
  return (
    <span className={`ep-rating ep-rating--${t}${size !== 'md' ? ` ep-rating--${size}` : ''}`} title={`Media ${value}, ${TIER_NAME[t]}`}>
      {value}
    </span>
  );
}

export function AttrValue({ value }: { value: number }) {
  return <b className={`ep-value ep-value--${tierOf(value)}`}>{value}</b>;
}

/* ---------- Forma (flechas estilo PES) ---------- */
const FORM: Record<Form, { color: string; angle: number; label: string }> = {
  2: { color: 'var(--form-2)', angle: -90, label: 'Muy buena forma' },
  1: { color: 'var(--form-1)', angle: -45, label: 'Buena forma' },
  0: { color: 'var(--form-0)', angle: 0, label: 'Forma normal' },
  [-1]: { color: 'var(--form-m1)', angle: 45, label: 'Mala forma' },
  [-2]: { color: 'var(--form-m2)', angle: 90, label: 'Muy mala forma' },
};
export function FormArrow({ form, withLabel }: { form: Form; withLabel?: boolean }) {
  const f = FORM[form];
  return (
    <span className="ep-form" title={f.label}>
      <svg viewBox="0 0 20 20" role="img" aria-label={f.label}>
        <circle cx="10" cy="10" r="9.5" fill={f.color} opacity=".16" />
        <g transform={`rotate(${f.angle} 10 10)`}>
          <path d="M4.5 10h9M10 5.8l4.2 4.2-4.2 4.2" fill="none" stroke={f.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      {withLabel && <span>{f.label}</span>}
    </span>
  );
}

/* ---------- Posición ---------- */
const LINE_CLASS: Record<Line, string> = { POR: 'gk', DEF: 'def', MED: 'mid', DEL: 'att' };
export const lineOf = (pos: string): Line =>
  pos === 'POR' ? 'POR' : ['DFC', 'LD', 'LI', 'CD', 'CI'].includes(pos) ? 'DEF' : ['MCD', 'MC', 'MCO', 'MI', 'MD'].includes(pos) ? 'MED' : 'DEL';
/** Orden de lectura en el campo: arquero, defensa de izquierda a derecha, medio y ataque. */
export const POS_ORDER = ['POR', 'LI', 'CI', 'DFC', 'LD', 'CD', 'MCD', 'MI', 'MC', 'MD', 'MCO', 'EI', 'DC', 'ED'];
export const posRank = (pos: string) => { const i = POS_ORDER.indexOf(pos); return i < 0 ? 99 : i; };

export function PositionChip({ pos }: { pos: string }) {
  return <span className={`ep-pos ep-pos--${LINE_CLASS[lineOf(pos)]}`}>{pos}</span>;
}

/* ---------- Bandera ---------- */
export function Flag({ iso, name, size }: { iso: string; name?: ReactNode; size?: 'lg' }) {
  return (
    <span className={`ep-flag${size ? ` ep-flag--${size}` : ''}`}>
      <span className={`fi fi-${iso}`} role="img" aria-label={typeof name === 'string' ? name : iso} />
      {name}
    </span>
  );
}

/* ---------- Valor de mercado ---------- */
export const money = (m: number) =>
  m >= 1 ? `US$ ${m.toLocaleString('es-PE', { maximumFractionDigits: 1 })} M` : `US$ ${Math.round(m * 1000)} mil`;

/* ---------- Tarjeta de jugador ---------- */
const SIX = ['RIT', 'TIR', 'PAS', 'REG', 'DEF', 'FÍS'];
export function PlayerCard({ p }: { p: Player }) {
  const t = tierOf(p.ovr);
  return (
    <article className="ep-card">
      <div className={`ep-card__ovr ep-rating--${t}`}>
        <b>{p.ovr}</b><span>{p.pos}</span>
      </div>
      <div>
        <h3 className="ep-card__name">{p.name}</h3>
        <div className="ep-card__meta">
          <span>{p.club}</span><span>{p.age} años</span><span>{money(p.value)}</span>
        </div>
        <div className="ep-card__meta" style={{ marginTop: 8 }}>
          <FormArrow form={p.form} withLabel />
          <span>Potencial <AttrValue value={p.pot} /></span>
        </div>
      </div>
      <div className="ep-card__status">
        {p.last5 && (
          <div title="Notas en sus últimos partidos con el club">
            <Activity aria-hidden />
            <span className="ep-card__last">
              {p.last5.map((n, i) => <i key={i} className={n >= 7.2 ? 'hi' : n < 6.3 ? 'lo' : ''}>{n.toFixed(1)}</i>)}
            </span>
          </div>
        )}
        <div><Shirt aria-hidden />{p.caps ?? 0} partidos con la selección</div>
        {p.yellows ? <div><span className="ep-yellow" aria-hidden />{p.yellows} amarilla{p.yellows > 1 ? 's' : ''}{p.yellows >= 2 ? ', suspendido con otra' : ''}</div> : null}
        <div style={p.injury ? { color: 'var(--bad)' } : undefined}>
          {p.injury ? <CircleAlert aria-hidden /> : <HeartPulse aria-hidden />}{p.injury ?? 'Sin molestias'}
        </div>
      </div>
      <div className="ep-card__six">
        {p.six.map((v, i) => (
          <div key={SIX[i]}><AttrValue value={v} /><span>{SIX[i]}</span></div>
        ))}
      </div>
    </article>
  );
}

/* ---------- Atributos detallados ---------- */
export function AttributeList({ groups }: { groups: { title: string; items: [string, number][] }[] }) {
  return (
    <div className="ep-attrs">
      {groups.map(g => (
        <div key={g.title} style={{ display: 'contents' }}>
          <h4>{g.title}</h4>
          {g.items.map(([label, v]) => (
            <div className={`ep-attr ep-value--${tierOf(v)}`} key={label}>
              <span style={{ color: 'var(--text)' }}>{label}</span>
              <span className="ep-attr__bar"><i style={{ width: `${v}%` }} /></span>
              <AttrValue value={v} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- Formación dibujada ---------- */
export type Spot = [string, number, number]; // posición, x (0–105), y (0–68)
export const FORMATIONS: Record<string, Spot[]> = {
  '4-3-3': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MCD', 41, 34], ['MC', 53, 21], ['MC', 53, 47], ['EI', 74, 11], ['DC', 80, 34], ['ED', 74, 57]],
  '4-2-3-1': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MCD', 41, 26], ['MCD', 41, 42], ['EI', 64, 11], ['MCO', 61, 34], ['ED', 64, 57], ['DC', 81, 34]],
  '4-4-2': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MI', 55, 10], ['MC', 48, 27], ['MC', 48, 41], ['MD', 55, 58], ['DC', 77, 27], ['DC', 77, 41]],
  '3-5-2': [['POR', 5, 34], ['DFC', 22, 19], ['DFC', 20, 34], ['DFC', 22, 49], ['CI', 50, 8], ['MCD', 40, 34], ['MC', 54, 24], ['MC', 54, 44], ['CD', 50, 60], ['DC', 76, 27], ['DC', 76, 41]],
  '5-3-2': [['POR', 5, 34], ['CI', 33, 8], ['DFC', 20, 22], ['DFC', 18, 34], ['DFC', 20, 46], ['CD', 33, 60], ['MC', 49, 21], ['MCD', 45, 34], ['MC', 49, 47], ['DC', 74, 27], ['DC', 74, 41]],
};
/** Puesto según la zona del campo (ataque hacia la derecha, y=0 es la banda izquierda). */
export function roleAt(x: number, y: number): string {
  const wideL = (lim: number) => y < lim, wideR = (lim: number) => y > 68 - lim;
  if (x < 35) return wideL(17) ? 'LI' : wideR(17) ? 'LD' : 'DFC';
  if (x < 47) return wideL(15) ? 'CI' : wideR(15) ? 'CD' : 'MCD';
  if (x < 62) return wideL(14) ? 'MI' : wideR(14) ? 'MD' : 'MC';
  if (x < 74) return wideL(15) ? 'EI' : wideR(15) ? 'ED' : 'MCO';
  return wideL(17) ? 'EI' : wideR(17) ? 'ED' : 'DC';
}

export function Formation({ name, highlight, editable, resetKey = 0 }: {
  name: string; highlight?: string; editable?: boolean; resetKey?: number;
}) {
  const [spots, setSpots] = useState<Spot[]>(FORMATIONS[name] ?? FORMATIONS['4-3-3']);
  const [drag, setDrag] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { setSpots(FORMATIONS[name] ?? FORMATIONS['4-3-3']); }, [name, resetKey]);

  const toPitch = (e: RPointerEvent) => {
    const el = svg.current; const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x / 10, y: pt.y / 10 };
  };
  const move = (e: RPointerEvent) => {
    if (drag === null) return;
    const p = toPitch(e); if (!p) return;
    setSpots(prev => prev.map((sp, i) => {
        if (i !== drag) return sp;
        if (i === 0) return ['POR', Math.min(14, Math.max(3, p.x)), Math.min(50, Math.max(18, p.y))] as Spot;
        const x = Math.min(100, Math.max(14, p.x)), y = Math.min(65, Math.max(3, p.y));
        return [roleAt(x, y), x, y] as Spot;
    }));
  };

  const s = 10;
  return (
    <svg ref={svg} className={`ep-formation${editable ? ' ep-formation--edit' : ''}`} viewBox="0 0 1050 680" role="img"
      aria-label={`Formación ${name}`} onPointerMove={editable ? move : undefined} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 105} y="0" width="105" height="680" fill={i % 2 ? 'rgba(255,255,255,.04)' : 'transparent'} />
      ))}
      <g fill="none" stroke="var(--pitch-line)" strokeWidth="3">
        <rect x="12" y="12" width="1026" height="656" rx="2" />
        <line x1="525" y1="12" x2="525" y2="668" />
        <circle cx="525" cy="340" r="88" />
        <rect x="12" y="140" width="160" height="400" />
        <rect x="878" y="140" width="160" height="400" />
      </g>
      {spots.map(([pos, x, y], i) => {
        const on = highlight === pos || drag === i;
        return (
          <g key={i} className="ep-dot" transform={`translate(${x * s} ${y * s})`}
            onPointerDown={editable ? (e) => { (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId); setDrag(i); } : undefined}>
            <circle r="30" fill="var(--accent)" opacity={highlight && !on ? .45 : 1} stroke="var(--accent-2)" strokeWidth={on ? 6 : 4} />
            <text y="9" textAnchor="middle" fontSize="25" fontWeight="750" fill="var(--on-accent)" style={{ fontStretch: '72%', pointerEvents: 'none' }}>{pos}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Partido programado ---------- */
export function Fixture({ home, away, date, place, note }: {
  home: { iso: string; code: string; sub?: string }; away: { iso: string; code: string; sub?: string };
  date: string; place: string; note?: ReactNode;
}) {
  return (
    <div className="ep-fixture">
      <div className="ep-fixture__team">
        <Flag iso={home.iso} size="lg" />
        <div><b>{home.code}</b>{home.sub && <span>{home.sub}</span>}</div>
      </div>
      <div className="ep-fixture__mid"><strong>{date}</strong>{place}{note && <div>{note}</div>}</div>
      <div className="ep-fixture__team">
        <div><b>{away.code}</b>{away.sub && <span>{away.sub}</span>}</div>
        <Flag iso={away.iso} size="lg" />
      </div>
    </div>
  );
}
