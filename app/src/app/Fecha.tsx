import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ArrowRight, FastForward, MapPin, Play, Shield, Sparkles } from 'lucide-react';
import { Button, FormArrow, Panel, PositionChip, Segmented, StatDuel, Tag, type Form } from '../design';
import { COMP_NAME, type Game, type Order, type P } from '../game/core.ts';
import { FORMS, VENUES, altitudeEdge, fit, homeAltitude } from '../game/data.ts';
import { ESTILOS, afterPost, autoLineup, byId, closeStop, curFx, curStop, finishMatch, lineupOk, matchInit, myRank, nat, rivalPlan, swapLineup } from '../game/flow.ts';
import { Match } from '../game/engine.ts';
import { available } from '../game/players.ts';
import { odds, stopLabel, venueFor } from '../game/world.ts';
import { act, go, openPlayer } from './store.ts';
import { Lvl, Meters, Nat, score } from './common.tsx';
import { Events } from './EntreFechas.tsx';
import { Partido } from './Partido.tsx';

const ESTILO_HINT = [
  'Sin un plan marcado: el equipo decide según la jugada.',
  'Bloque atrás y salida rápida al recuperar. Rinde con delanteros veloces y contra rivales que se adelantan.',
  'Toque corto y paciencia hasta tres cuartos de cancha. Pide volantes de buen pase; cansa al rival y remata menos.',
  'Se abre la cancha y se busca el centro. Rinde con un nueve que gane de cabeza y laterales que suban.',
  'Pelota larga al delantero de referencia y a pelear la segunda. Rinde con un nueve fuerte; se pierde la pelota más seguido.',
];
const TAC: { key: 'estilo' | 'ment' | 'pres' | 'linea' | 'ancho' | 'ritmo' | 'corner'; label: string; opts: string[] }[] = [
  { key: 'estilo', label: 'Estilo', opts: ESTILOS },
  { key: 'ment', label: 'Mentalidad', opts: ['Muy cerrada', 'Cauta', 'Equilibrada', 'Ofensiva', 'A todo'] },
  { key: 'pres', label: 'Presión', opts: ['Esperar', 'Media', 'Alta'] },
  { key: 'linea', label: 'Línea defensiva', opts: ['Atrás', 'Media', 'Adelantada'] },
  { key: 'ancho', label: 'Ancho', opts: ['Cerrado', 'Normal', 'Abierto'] },
  { key: 'ritmo', label: 'Ritmo', opts: ['Pausado', 'Normal', 'Directo'] },
  { key: 'corner', label: 'Córners', opts: ['Variado', 'Primer palo', 'Segundo palo', 'En corto'] },
];

const ORD: { key: Order; label: string; hint: string; ball: boolean }[] = [
  { key: 'sube', label: 'Sube', hint: 'se suma al ataque y tarda más en volver', ball: false },
  { key: 'queda', label: 'Se queda', hint: 'guarda su lugar cuando el equipo ataca', ball: false },
  { key: 'abre', label: 'Abierto', hint: 'juega pegado a la raya', ball: false },
  { key: 'cierra', label: 'Cerrado', hint: 'se mete hacia adentro', ball: false },
  { key: 'fuerte', label: 'Marca fuerte', hint: 'va a cada pelota; más faltas y tarjetas', ball: false },
  { key: 'tira', label: 'Tira', hint: 'prueba al arco cuando tiene espacio', ball: true },
  { key: 'encara', label: 'Encara', hint: 'busca el mano a mano; pierde más pelotas', ball: true },
  { key: 'simple', label: 'Juega simple', hint: 'toca y no arriesga', ball: true },
];
const CLASH: Record<Order, Order[]> = { sube: ['queda'], queda: ['sube'], abre: ['cierra'], cierra: ['abre'], fuerte: [], tira: ['simple'], encara: ['simple'], simple: ['tira', 'encara'] };
function toggleOrder(g: Game, id: number, o: Order) {
  const ord = (g.lineup.tac.ord ??= {}), cur = ord[id] ?? [];
  const next = cur.includes(o) ? cur.filter(x => x !== o) : [...cur.filter(x => !CLASH[o].includes(x)), o];
  if (next.length) ord[id] = next; else delete ord[id];
}

/** Marca personal: un jugador propio sigue a uno del rival por toda la cancha. */
export function Marca({ g, mine, rivals, onChange }: { g: Game; mine: number[]; rivals: { id: number; n: string; role: string }[]; onChange?: () => void }) {
  const m = byId(g), mk = g.lineup.tac.marca, target = mk && rivals.some(r => r.id === mk[1]) ? mk[1] : 0;
  const best = [...mine].sort((a, b) => (m.get(b)?.six[4] ?? 0) - (m.get(a)?.six[4] ?? 0))[0] ?? 0;
  const set = (a: number, b: number) => { act(x => { if (a && b) x.lineup.tac.marca = [a, b]; else delete x.lineup.tac.marca; }); onChange?.(); };
  return (
    <div className="row wrap marca">
      <label className="field inline">Marca personal a<select value={target} onChange={e => set(mk && mine.includes(mk[0]) ? mk[0] : best, Number(e.target.value))}><option value={0}>Nadie</option>{rivals.map(r => <option key={r.id} value={r.id}>{r.n} ({r.role})</option>)}</select></label>
      {target > 0 && <label className="field inline">Lo sigue<select value={mk![0]} onChange={e => set(Number(e.target.value), target)}>{mine.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>}
      {target > 0 && <span className="muted small">Le quita espacio a su figura, pero deja libre su zona.</span>}
    </div>
  );
}

/** Órdenes individuales para los jugadores de campo que están en `ids`. */
export function Orders({ g, ids, sel, onSel, onChange, compact }: { g: Game; ids: number[]; sel: number; onSel: (id: number) => void; onChange?: () => void; compact?: boolean }) {
  const m = byId(g), ord = g.lineup.tac.ord ?? {}, id = ids.includes(sel) ? sel : 0, cur = ord[id] ?? [];
  const given = ids.filter(x => ord[x]?.length);
  const chip = (o: (typeof ORD)[number]) => <button key={o.key} className={`chip${cur.includes(o.key) ? ' on' : ''}`} aria-pressed={cur.includes(o.key)} title={o.hint} onClick={() => { act(x => toggleOrder(x, id, o.key)); onChange?.(); }}>{o.label}</button>;
  return (
    <div className="orders">
      <label className="field inline">Jugador<select value={id} onChange={e => onSel(Number(e.target.value))}><option value={0}>Elige a quién</option>{ids.map(x => <option key={x} value={x}>{m.get(x)?.n}{ord[x]?.length ? ' ·' : ''}</option>)}</select></label>
      {id ? <>
        <div className="orders__row"><span>Sin pelota</span><div className="row wrap">{ORD.filter(o => !o.ball).map(chip)}</div></div>
        <div className="orders__row"><span>Con pelota</span><div className="row wrap">{ORD.filter(o => o.ball).map(chip)}</div></div>
      </> : <p className="muted small">Toca un jugador de campo en la cancha o elígelo acá.</p>}
      {given.length > 0 && <ul className="orders__list">{given.map(x => <li key={x}><button className="link" onClick={() => onSel(x)}>{m.get(x)?.n.split(' ').slice(-1)[0]}</button><span>{ord[x].map(o => ORD.find(k => k.key === o)!).map(o => (compact ? o.label.toLowerCase() : `${o.label.toLowerCase()} (${o.hint})`)).join(compact ? ', ' : '; ')}</span></li>)}</ul>}
    </div>
  );
}

export function Tactics({ g, onChange }: { g: Game; onChange?: () => void }) {
  const t = g.lineup.tac;
  return (
    <div className="tac">
      <p className="tac__hint" key={t.estilo ?? 0}>{ESTILO_HINT[t.estilo ?? 0]}</p>
      {TAC.map(row => <div key={row.key} className="tac__row"><span>{row.label}</span>
        <Segmented label={row.label} value={String(t[row.key] ?? 0)} onChange={v => { act(x => { x.lineup.tac[row.key] = Number(v); }); onChange?.(); }} options={row.opts.map((o, i) => ({ value: String(i), label: o }))} /></div>)}
    </div>
  );
}

function Pitch({ g, sel, onPick, onSwap }: { g: Game; sel: number; onPick: (id: number) => void; onSwap: (a: number, b: number) => void }) {
  const m = byId(g), spots = FORMS[g.lineup.tac.form], svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const pt = (e: RPointerEvent) => { const ctm = svg.current?.getScreenCTM(); if (!ctm) return null; const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()); return { x: q.x, y: q.y }; };
  const drop = () => {
    if (!drag) return;
    if (!drag.moved) onPick(drag.id);
    else { let best = 0, bd = 120; g.lineup.xi.forEach((id, i) => { if (id === drag.id) return; const d = Math.hypot(spots[i][1] * 10 + 40 - drag.x, spots[i][2] * 10 - drag.y); if (d < bd) { bd = d; best = id; } }); if (best) onSwap(drag.id, best); }
    setDrag(null);
  };
  return (
    <svg ref={svg} className="pitch" viewBox="0 0 1050 680" role="group" aria-label="Once titular" onPointerUp={drop} onPointerLeave={drop}
      onPointerMove={e => { if (!drag) return; const q = pt(e); if (q) setDrag(d => d && { ...d, x: q.x, y: q.y, moved: d.moved || Math.hypot(q.x - d.sx, q.y - d.sy) > 16 }); }}>
      <rect width="1050" height="680" rx="14" className="pitch__grass" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} x={i * 150} width="75" height="680" className="pitch__stripe" />)}
      <g className="pitch__lines"><rect x="6" y="6" width="1038" height="668" rx="8" /><line x1="525" y1="6" x2="525" y2="674" /><circle cx="525" cy="340" r="91" /><rect x="6" y="138" width="165" height="404" /><rect x="879" y="138" width="165" height="404" /><rect x="6" y="248" width="55" height="184" /><rect x="989" y="248" width="55" height="184" /></g>
      {g.lineup.xi.map((id, i) => { const p = m.get(id); if (!p) return null; const [role, x, y] = spots[i], ok = fit(p.pos, role), bad = !available(p), dr = drag?.id === id && drag.moved;
        const px = dr ? drag!.x : x * 10 + 40, py = dr ? drag!.y : y * 10;
        return (
          <g key={id} style={{ transform: `translate(${px}px, ${py}px)` }} className={`pp${sel === id ? ' sel' : ''}${bad ? ' bad' : ok < 0.9 ? ' off' : ''}${dr ? ' drag' : ''}`} role="button" aria-label={`${p.n}, ${role}`}
            onPointerDown={e => { const q = pt(e); if (q) setDrag({ id, x: q.x, y: q.y, sx: q.x, sy: q.y, moved: false }); }}>
            <circle r="30" /><text className="pp__ovr" y="8">{p.ovr}</text>
            <text className="pp__n" y="52">{p.n.split(' ').slice(-1)[0]}{g.lineup.cap === id ? ' (C)' : ''}</text>
            <text className="pp__r" y="-38">{role}</text>
            {g.lineup.tac.ord?.[id]?.length ? <circle className="pp__ord" cx="25" cy="-23" r="8" /> : null}
            {(p.fat ?? 0) >= 0.45 && <text className="pp__t" y="72">{(p.fat ?? 0) >= 0.62 ? 'muy cansado' : 'cansado'}</text>}
          </g>); })}
    </svg>
  );
}

function Previa({ g }: { g: Game }) {
  const fx = curFx(g)!, [sel, setSel] = useState(0), m = byId(g);
  const home = fx.h === g.me, rival = home ? fx.a : fx.h, R = nat(g, rival), v = venueFor(g, fx);
  const o = odds(g, fx.h, fx.a, !!fx.neutral, v ? v[2] : 0), mine = home ? o[0] : o[2], theirs = home ? o[2] : o[0];
  const plan = rivalPlan(g);
  const pickP = (id: number) => {
    if (!sel || sel === id) { setSel(sel === id ? 0 : id); return; }
    // Titular y suplente se intercambian; dos titulares (o dos suplentes) solo cambian la selección.
    if (g.lineup.xi.includes(sel) !== g.lineup.xi.includes(id)) { act(x => swapLineup(x, sel, id)); setSel(0); } else setSel(id);
  };
  const edge = !fx.neutral && v ? altitudeEdge(v[2], homeAltitude(fx.a)) : 0;
  const ready = lineupOk(g) && !g.pending.length;
  const field = g.lineup.xi.filter((_, i) => FORMS[g.lineup.tac.form][i][0] !== 'POR');
  const sim = () => { act(x => { finishMatch(x, new Match(matchInit(x)).finish()); }); };
  const benchRow = (p: P) => (
    <li key={p.id} className={sel === p.id ? 'sel' : ''}><button onClick={() => pickP(p.id)}><PositionChip pos={p.pos} /><span className="bn">{p.n}</span>{(p.fat ?? 0) >= 0.45 && <Tag tone="warn">Cansado</Tag>}<FormArrow form={p.form as Form} /><Lvl p={p} /></button><button className="link small" onClick={() => openPlayer(p.id)}>ficha</button></li>
  );
  return (
    <div className="stack">
      <Events g={g} />
      <div className="grid previa">
        <Panel title={`${COMP_NAME[fx.comp]} · ${fx.label}`} icon={<Shield size={17} />} actions={<div className="row"><Button size="sm" icon={<Sparkles size={15} />} onClick={() => act(x => autoLineup(x))}>Mejor once</Button></div>}>
          <div className="row wrap between">
            <Segmented label="Formación" value={g.lineup.tac.form} onChange={f => act(x => autoLineup(x, f))} options={Object.keys(FORMS).map(f => ({ value: f, label: f }))} />
            <span className="muted small">Arrastra un titular sobre otro para cambiarlos de puesto. Toca uno y después un suplente para que entre.</span>
          </div>
          <Pitch g={g} sel={sel} onPick={pickP} onSwap={(x1, x2) => { act(x => swapLineup(x, x1, x2)); setSel(0); }} />
          <h3>Suplentes</h3>
          <ul className="bench">{g.lineup.bench.map(id => m.get(id)!).filter(Boolean).map(benchRow)}</ul>
        </Panel>
        <div className="stack">
          <Panel title="El partido" icon={<MapPin size={17} />}>
            <div className="vs"><Nat g={g} c={fx.h} /><b>vs</b><Nat g={g} c={fx.a} /></div>
            <p className="muted">{fx.neutral ? 'Cancha neutral.' : v ? `${v[0]}, ${v[1]}${v[2] > 1500 ? ` · ${v[2]} m de altura` : ''} · ${v[3]}.000 personas` : ''}</p>
            {home && !fx.neutral && VENUES[g.me] && <Segmented label="Sede" value={String(fx.venue ?? 0)} onChange={i => act(x => { curFx(x)!.venue = Number(i); })} options={VENUES[g.me].map((s, i) => ({ value: String(i), label: s[1] === VENUES[g.me][0][1] && i > 0 ? s[0] : s[1] }))} />}
            {edge > 0.05 && <Tag tone={home ? 'good' : 'warn'}>{home ? 'La altura juega a favor' : 'La altura les pesa a los nuestros'}</Tag>}
            <div className="odds"><i style={{ flex: mine }} className="w" /><i style={{ flex: o[1] }} className="d" /><i style={{ flex: theirs }} className="l" /></div>
            <div className="row between small"><span>Ganamos {Math.round(mine * 100)}%</span><span>Empate {Math.round(o[1] * 100)}%</span><span>Perdemos {Math.round(theirs * 100)}%</span></div>
            <h3>{R.n}: nivel {Math.round(R.str)}</h3>
            {plan && <>
              <p className="small muted">Formación probable: {plan.form}{g.scout ? `. Juega ${ESTILOS[plan.estilo].toLowerCase()}, ${['muy cerrado', 'cauto', 'equilibrado', 'ofensivo', 'a todo'][plan.ment]}, con la línea ${['atrás', 'a media altura', 'adelantada'][plan.linea]}.` : '.'}</p>
              <ul className="plain rivalxi">{plan.xi.map(p => <li key={p.id}><span><PositionChip pos={p.role} /> <button className="link" onClick={() => openPlayer(p.id)}>{p.n.split(' ').slice(-1)[0]}</button></span><b className="num">{p.ovr}</b></li>)}</ul>
            </>}
            {g.scout ? <Tag tone="info">Rival estudiado: sabes cómo va a jugar</Tag> : <p className="note">Si lo estudias entre fechas, acá vas a ver cómo juega.</p>}
          </Panel>
          <Panel title="Planteo"><Tactics g={g} />
            <div className="row wrap">
              <label className="field inline">Capitán<select value={g.lineup.cap} onChange={e => act(x => { x.lineup.cap = Number(e.target.value); })}>{g.lineup.xi.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
              <label className="field inline">Penales<select value={g.lineup.pk} onChange={e => act(x => { x.lineup.pk = Number(e.target.value); })}>{g.lineup.xi.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
              <label className="field inline">Tiros libres<select value={g.lineup.fk ?? 0} onChange={e => act(x => { x.lineup.fk = Number(e.target.value); })}>{field.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
              <label className="field inline">Córners<select value={g.lineup.ck ?? 0} onChange={e => act(x => { x.lineup.ck = Number(e.target.value); })}>{field.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
            </div>
            {plan && <Marca g={g} mine={field} rivals={plan.xi.filter(p => p.role !== 'POR')} />}
          </Panel>
          <Panel title="Órdenes individuales"><Orders g={g} ids={field} sel={sel} onSel={setSel} /></Panel>
          <div className="row">
            <Button variant="primary" icon={<Play size={16} />} disabled={!ready} onClick={() => act(x => { x.ph = 'partido'; })}>Jugar el partido</Button>
            <Button icon={<FastForward size={16} />} disabled={!ready} onClick={sim}>Simular</Button>
          </div>
          {!ready && <p className="note">{g.pending.length ? 'Hay un asunto pendiente arriba.' : 'El once tiene un jugador que no puede jugar.'}</p>}
        </div>
      </div>
    </div>
  );
}

function Post({ g }: { g: Game }) {
  const l = g.log[0], m = byId(g), home = l.fx.h === g.me;
  const mine = Object.entries(l.rating).map(([id, r]) => ({ p: m.get(Number(id)), r })).filter(x => x.p && x.p.nat === g.me).sort((a, b) => b.r - a.r);
  const S = ['Posesión', 'Tiros', 'Al arco', 'Córners', 'Faltas', 'Pases', 'Pases buenos', 'Fueras de juego'];
  return (
    <div className="stack">
      <Panel>
        <div className="final"><Nat g={g} c={l.fx.h} /><b className="num">{score(l.fx.gh, l.fx.ga, l.fx.pens)}</b><Nat g={g} c={l.fx.a} /></div>
        <p className="muted center">{l.scorers.join(' · ') || 'Sin goles'}</p>
      </Panel>
      <Events g={g} />
      <div className="grid two">
        <Panel title="Notas">
          <ul className="plain">{mine.map(({ p, r }) => <li key={p!.id}><span><PositionChip pos={p!.pos} /> <button className="link" onClick={() => openPlayer(p!.id)}>{p!.n}</button></span><b className={`num nota ${r >= 7.5 ? 'hi' : r < 5.5 ? 'lo' : ''}`}>{r.toFixed(1)}</b></li>)}</ul>
        </Panel>
        <div className="stack">
          <Panel title="Estadísticas">{l.stats.map((s, i) => <StatDuel key={i} label={S[i]} home={home ? s[0] : s[1]} away={home ? s[1] : s[0]} suffix={i === 0 ? '%' : ''} />)}</Panel>
          <Panel title="Efecto"><Meters g={g} /></Panel>
          <Button variant="primary" icon={<ArrowRight size={16} />} disabled={g.pending.length > 0} onClick={() => act(afterPost)}>{g.md + 1 < g.fx.length || (g.tour && !g.tour.champ) ? 'Continuar' : 'Ir al cierre de la fecha'}</Button>
        </div>
      </div>
    </div>
  );
}

function Cierre({ g }: { g: Game }) {
  const s = curStop(g), n = g.fx.length, logs = g.log.slice(0, n);
  return (
    <div className="stack narrow">
      <Panel title={`Cierre: ${stopLabel(s)}`}>
        <ul className="fxlist">{logs.map(l => <li key={l.fx.id}><span className="muted">{COMP_NAME[l.fx.comp]}</span><Nat g={g} c={l.fx.h} short /><b className="num">{score(l.fx.gh, l.fx.ga, l.fx.pens)}</b><Nat g={g} c={l.fx.a} short /></li>)}</ul>
        <Meters g={g} all />
        <p>Ranking FIFA: <b className="num">#{myRank(g)}</b>. {g.tour?.champ && s.kind === 'torneo' ? <>Campeón del torneo: <Nat g={g} c={g.tour.champ} />.</> : null}</p>
        <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => { act(closeStop); go('despacho'); }}>Cerrar la fecha y seguir</Button>
      </Panel>
    </div>
  );
}

export function Fecha({ g }: { g: Game }) {
  if (g.ph === 'entre' || g.ph === 'lista') return <Panel><p>La fecha empieza cuando anuncies la lista.</p><Button variant="primary" onClick={() => go(g.ph === 'entre' ? 'entre' : 'lista')}>{g.ph === 'entre' ? 'Ir a entre fechas' : 'Ir a la convocatoria'}</Button></Panel>;
  if (g.ph === 'previa') return <Previa g={g} />;
  if (g.ph === 'partido') return <Partido g={g} />;
  if (g.ph === 'post') return <Post g={g} />;
  return <Cierre g={g} />;
}
