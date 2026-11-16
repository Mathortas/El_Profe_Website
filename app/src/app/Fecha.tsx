import { useState } from 'react';
import { ArrowRight, FastForward, MapPin, Play, Shield, Sparkles } from 'lucide-react';
import { Button, FormArrow, Panel, PositionChip, Segmented, StatDuel, Tag, type Form } from '../design';
import { COMP_NAME, type Game, type P } from '../game/core.ts';
import { FORMS, VENUES, altitudeEdge, fit, homeAltitude } from '../game/data.ts';
import { afterPost, autoLineup, byId, closeStop, curFx, curStop, finishMatch, lineupOk, matchInit, myRank, nat, swapLineup } from '../game/flow.ts';
import { Match } from '../game/engine.ts';
import { available, poolOf } from '../game/players.ts';
import { odds, stopLabel, venueFor } from '../game/world.ts';
import { act, go, openPlayer } from './store.ts';
import { Lvl, Meters, Nat, score } from './common.tsx';
import { Events } from './EntreFechas.tsx';
import { Partido } from './Partido.tsx';

const TAC: { key: 'ment' | 'pres' | 'linea' | 'ancho' | 'ritmo'; label: string; opts: string[] }[] = [
  { key: 'ment', label: 'Mentalidad', opts: ['Muy cerrada', 'Cauta', 'Equilibrada', 'Ofensiva', 'A todo'] },
  { key: 'pres', label: 'Presión', opts: ['Esperar', 'Media', 'Alta'] },
  { key: 'linea', label: 'Línea defensiva', opts: ['Atrás', 'Media', 'Adelantada'] },
  { key: 'ancho', label: 'Ancho', opts: ['Cerrado', 'Normal', 'Abierto'] },
  { key: 'ritmo', label: 'Ritmo', opts: ['Pausado', 'Normal', 'Directo'] },
];

export function Tactics({ g, onChange }: { g: Game; onChange?: () => void }) {
  const t = g.lineup.tac;
  return (
    <div className="tac">
      {TAC.map(row => <div key={row.key} className="tac__row"><span>{row.label}</span>
        <Segmented label={row.label} value={String(t[row.key])} onChange={v => { act(x => { x.lineup.tac[row.key] = Number(v); }); onChange?.(); }} options={row.opts.map((o, i) => ({ value: String(i), label: o }))} /></div>)}
    </div>
  );
}

function Pitch({ g, sel, onPick }: { g: Game; sel: number; onPick: (id: number) => void }) {
  const m = byId(g), spots = FORMS[g.lineup.tac.form];
  return (
    <svg className="pitch" viewBox="0 0 1050 680" role="group" aria-label="Once titular">
      <rect width="1050" height="680" rx="14" className="pitch__grass" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} x={i * 150} width="75" height="680" className="pitch__stripe" />)}
      <g className="pitch__lines"><rect x="6" y="6" width="1038" height="668" rx="8" /><line x1="525" y1="6" x2="525" y2="674" /><circle cx="525" cy="340" r="91" /><rect x="6" y="138" width="165" height="404" /><rect x="879" y="138" width="165" height="404" /><rect x="6" y="248" width="55" height="184" /><rect x="989" y="248" width="55" height="184" /></g>
      {g.lineup.xi.map((id, i) => { const p = m.get(id); if (!p) return null; const [role, x, y] = spots[i], ok = fit(p.pos, role), bad = !available(p);
        return (
          <g key={id} transform={`translate(${x * 10 + 40},${y * 10})`} className={`pp${sel === id ? ' sel' : ''}${bad ? ' bad' : ok < 0.9 ? ' off' : ''}`} onClick={() => onPick(id)} role="button" aria-label={`${p.n}, ${role}`}>
            <circle r="30" /><text className="pp__ovr" y="8">{p.ovr}</text>
            <text className="pp__n" y="52">{p.n.split(' ').slice(-1)[0]}{g.lineup.cap === id ? ' (C)' : ''}</text>
            <text className="pp__r" y="-38">{role}</text>
          </g>); })}
    </svg>
  );
}

function Previa({ g }: { g: Game }) {
  const fx = curFx(g)!, [sel, setSel] = useState(0), m = byId(g);
  const home = fx.h === g.me, rival = home ? fx.a : fx.h, R = nat(g, rival), v = venueFor(g, fx);
  const o = odds(g, fx.h, fx.a, !!fx.neutral, v ? v[2] : 0), mine = home ? o[0] : o[2], theirs = home ? o[2] : o[0];
  const stars = poolOf(g, rival).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  const pickP = (id: number) => { if (!sel) setSel(id); else if (sel === id) setSel(0); else { act(x => swapLineup(x, sel, id)); setSel(0); } };
  const edge = !fx.neutral && v ? altitudeEdge(v[2], homeAltitude(fx.a)) : 0;
  const ready = lineupOk(g) && !g.pending.length;
  const sim = () => { act(x => { finishMatch(x, new Match(matchInit(x)).finish()); }); };
  const benchRow = (p: P) => (
    <li key={p.id} className={sel === p.id ? 'sel' : ''}><button onClick={() => pickP(p.id)}><PositionChip pos={p.pos} /><span className="bn">{p.n}</span><FormArrow form={p.form as Form} /><Lvl p={p} /></button><button className="link small" onClick={() => openPlayer(p.id)}>ficha</button></li>
  );
  return (
    <div className="stack">
      <Events g={g} />
      <div className="grid previa">
        <Panel title={`${COMP_NAME[fx.comp]} · ${fx.label}`} icon={<Shield size={17} />} actions={<div className="row"><Button size="sm" icon={<Sparkles size={15} />} onClick={() => act(x => autoLineup(x))}>Mejor once</Button></div>}>
          <div className="row wrap between">
            <Segmented label="Formación" value={g.lineup.tac.form} onChange={f => act(x => autoLineup(x, f))} options={Object.keys(FORMS).map(f => ({ value: f, label: f }))} />
            <span className="muted small">Toca dos jugadores para intercambiarlos.</span>
          </div>
          <Pitch g={g} sel={sel} onPick={pickP} />
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
            <ul className="plain">{stars.map(p => <li key={p.id}><span><PositionChip pos={p.pos} /> {p.n}</span><Lvl p={p} /></li>)}</ul>
            {g.scout && <Tag tone="info">Rival estudiado: pequeña ventaja</Tag>}
          </Panel>
          <Panel title="Planteo"><Tactics g={g} />
            <div className="row wrap">
              <label className="field inline">Capitán<select value={g.lineup.cap} onChange={e => act(x => { x.lineup.cap = Number(e.target.value); })}>{g.lineup.xi.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
              <label className="field inline">Penales<select value={g.lineup.pk} onChange={e => act(x => { x.lineup.pk = Number(e.target.value); })}>{g.lineup.xi.map(id => <option key={id} value={id}>{m.get(id)?.n}</option>)}</select></label>
            </div>
          </Panel>
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
  const S = ['Posesión', 'Tiros', 'Al arco', 'Córners', 'Faltas', 'Pases', 'Pases buenos'];
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
