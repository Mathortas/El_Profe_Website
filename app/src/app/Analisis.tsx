// Análisis del partido: mapa de remates, dónde se tuvo la pelota, números tácticos y lo que dice el ayudante.
import { Lightbulb, TriangleAlert, ThumbsUp } from 'lucide-react';
import { StatDuel } from '../design';
import type { Lectura } from '../game/lectura.ts';

const RES = ['Afuera', 'Atajado', 'Gol', 'Bloqueado'];
const ICON = { bien: ThumbsUp, ojo: TriangleAlert, dato: Lightbulb } as const;

/** Lo que dice el ayudante. `vivo` anima cada cambio. */
export function Ayudante({ items, vivo }: { items: Pick<Lectura, 'tono' | 'texto'>[]; vivo?: boolean }) {
  if (!items.length) return <p className="muted small">Todavía no hay mucho para decir.</p>;
  return (
    <ul className={`ayu${vivo ? ' vivo' : ''}`}>
      {items.map((x, i) => { const I = ICON[x.tono as keyof typeof ICON] ?? Lightbulb; return <li key={x.texto} className={x.tono} style={{ animationDelay: `${i * 90}ms` }}><I size={16} aria-hidden="true" /><span>{x.texto}</span></li>; })}
    </ul>
  );
}

/** Cancha completa: nuestros remates atacan hacia la derecha y los del rival hacia la izquierda. */
export function MapaRemates({ shots, my, names }: { shots: number[][]; my: number; names: [string, string] }) {
  const xg = [0, 0]; shots.forEach(s => { xg[s[0] === my ? 0 : 1] += s[3]; });
  return (
    <figure className="shotmap">
      <svg viewBox="-2 -2 109 72" role="img" aria-label={`Mapa de remates: ${names[0]} a la derecha, ${names[1]} a la izquierda`}>
        <rect x="0" y="0" width="105" height="68" rx="1.5" className="sm__grass" />
        <g className="sm__lines"><rect x="0" y="0" width="105" height="68" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" /><rect x="0" y="13.85" width="16.5" height="40.3" /><rect x="88.5" y="13.85" width="16.5" height="40.3" /><rect x="0" y="24.85" width="5.5" height="18.3" /><rect x="99.5" y="24.85" width="5.5" height="18.3" /></g>
        {shots.map((s, i) => {
          const ours = s[0] === my, x = ours ? s[1] : 105 - s[1], y = ours ? s[2] : 68 - s[2], r = 0.9 + s[3] * 5;
          return (
            <g key={i} className={`sm__shot ${ours ? 'ours' : 'theirs'} r${s[4]}`} style={{ animationDelay: `${120 + i * 45}ms` }}>
              <circle cx={x} cy={y} r={r}><title>{`${s[5]}' · ${RES[s[4]]} · ${Math.round(s[3] * 100)} % de gol`}</title></circle>
              {s[4] === 3 && <path d={`M${x - r * 0.6} ${y - r * 0.6}L${x + r * 0.6} ${y + r * 0.6}M${x + r * 0.6} ${y - r * 0.6}L${x - r * 0.6} ${y + r * 0.6}`} />}
            </g>
          );
        })}
      </svg>
      <figcaption className="sm__leg">
        <span><i className="dot ours" />{names[0]}: {shots.filter(s => s[0] === my).length} remates, {xg[0].toFixed(1)} goles esperados</span>
        <span><i className="dot theirs" />{names[1]}: {shots.filter(s => s[0] !== my).length} remates, {xg[1].toFixed(1)} goles esperados</span>
        <span className="muted">Más grande, más clara la ocasión. Relleno: gol.</span>
      </figcaption>
    </figure>
  );
}

/** Dónde tuvo la pelota un equipo, en su sentido de ataque (de izquierda a derecha). */
export function MapaCalor({ heat, label }: { heat: number[]; label: string }) {
  const tot = heat.reduce((a, b) => a + b, 0) || 1, max = Math.max(...heat, 1);
  const thirds = [0, 1, 2].map(k => Math.round(([0, 1, 2, 3].reduce((a, row) => a + heat[row * 6 + k * 2] + heat[row * 6 + k * 2 + 1], 0) / tot) * 100));
  return (
    <figure className="heat">
      <div className="heat__grid" role="img" aria-label={`${label}: ${thirds[0]} % en su tercio, ${thirds[1]} % en el medio y ${thirds[2]} % en el tercio rival`}>
        {heat.map((v, i) => <i key={i} style={{ opacity: 0.08 + (v / max) * 0.85, animationDelay: `${(i % 6) * 60}ms` }} />)}
      </div>
      <figcaption><b>{label}</b><span className="muted small">Propio {thirds[0]} % · medio {thirds[1]} % · rival {thirds[2]} %</span></figcaption>
    </figure>
  );
}

const TACT = ['Pases al espacio', 'Pases al espacio que llegaron', 'Recuperaciones en campo rival', 'Remates de contraataque', 'Centros', 'Pelotazos'];
export function NumerosTacticos({ tact, my }: { tact: number[][]; my: number }) {
  return <div>{tact.map((t, i) => (i === 0 ? null : <StatDuel key={i} label={TACT[i]} home={t[my]} away={t[1 - my]} />))}</div>;
}
