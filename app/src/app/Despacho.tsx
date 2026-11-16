import { ArrowRight, CalendarDays, ClipboardCheck, ListChecks, Target, Trophy } from 'lucide-react';
import { Button, Fixture, Panel, Tag } from '../design';
import { COMP_NAME, type Game } from '../game/core.ts';
import { curFx, curStop, myRank, nat } from '../game/flow.ts';
import { elimTable, odds, stopLabel, venueFor } from '../game/world.ts';
import { go, viewFor } from './store.ts';
import { Meters, Nat, Stat, score } from './common.tsx';

export const STEPS: { ph: Game['ph'][]; label: string; view: 'entre' | 'lista' | 'fecha' }[] = [
  { ph: ['entre'], label: 'Trabajo entre fechas', view: 'entre' },
  { ph: ['lista'], label: 'Armar y anunciar la lista', view: 'lista' },
  { ph: ['previa', 'partido', 'post'], label: 'Jugar los partidos', view: 'fecha' },
  { ph: ['cierre'], label: 'Cerrar la fecha', view: 'fecha' },
];
export function Despacho({ g }: { g: Game }) {
  const s = curStop(g), fx = curFx(g) ?? g.fx[g.fx.length - 1], cur = STEPS.findIndex(x => x.ph.includes(g.ph));
  const rival = fx ? (fx.h === g.me ? fx.a : fx.h) : '', v = fx ? venueFor(g, fx) : null;
  const o = fx ? odds(g, fx.h, fx.a, !!fx.neutral) : [0, 0, 0], mine = fx?.h === g.me ? o[0] : o[2];
  const tab = elimTable(g), pos = tab.findIndex(r => r.c === g.me) + 1;
  return (
    <div className="grid desk">
      <Panel title="Próximo partido" icon={<CalendarDays size={17} />} className="desk__next">
        {fx && <>
          <Fixture home={{ iso: nat(g, fx.h).iso, code: nat(g, fx.h).c, sub: nat(g, fx.h).n }} away={{ iso: nat(g, fx.a).iso, code: nat(g, fx.a).c, sub: nat(g, fx.a).n }} date={`${COMP_NAME[fx.comp]} · ${fx.label}`} place={fx.neutral ? 'Cancha neutral' : v ? `${v[0]}, ${v[1]}` : ''} note={fx.gh !== undefined ? score(fx.gh, fx.ga, fx.pens) : undefined} />
          <div className="row wrap">
            <Tag tone={mine > 0.5 ? 'good' : mine > 0.3 ? 'info' : 'warn'}>Ganamos {Math.round(mine * 100)}% de las veces</Tag>
            <span className="muted">Rival: nivel {Math.round(nat(g, rival).str)}, puesto {Object.values(g.nations).filter(n => n.pts > nat(g, rival).pts).length + 1} del ranking</span>
          </div>
        </>}
        <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => go(viewFor(g))}>{STEPS[cur]?.label ?? 'Continuar'}</Button>
      </Panel>
      <Panel title="Cómo estás parado" icon={<Target size={17} />} className="desk__meters">
        <Meters g={g} all />
        <p className="goal"><b>Objetivo:</b> {g.goal}.</p>
      </Panel>
      <Panel title={`Esta fecha: ${stopLabel(s)}`} icon={<ListChecks size={17} />}>
        <ol className="steps">
          {STEPS.map((st, i) => <li key={st.label} className={i < cur ? 'done' : i === cur ? 'now' : ''}><button onClick={() => go(st.view)}>{i < cur ? <ClipboardCheck size={16} /> : <span className="num">{i + 1}</span>}{st.label}</button></li>)}
        </ol>
        <ul className="fxlist">
          {g.fx.map(f => <li key={f.id}><span className="muted">{COMP_NAME[f.comp]}</span><Nat g={g} c={f.h} short /><b className="num">{score(f.gh, f.ga, f.pens)}</b><Nat g={g} c={f.a} short /></li>)}
        </ul>
      </Panel>
      <Panel title="El ciclo" icon={<Trophy size={17} />}>
        <div className="stats">
          <Stat label="Ranking FIFA" value={`#${myRank(g)}`} /><Stat label="Eliminatorias" value={g.elim.done ? `${pos}.º · ${tab[pos - 1].pts} pts` : 'Empiezan en 2027'} />
          <Stat label="Partidos" value={g.record.pj} /><Stat label="G · E · P" value={`${g.record.g} · ${g.record.e} · ${g.record.p}`} /><Stat label="Goles" value={`${g.record.gf}–${g.record.gc}`} />
        </div>
        <h3>Últimos resultados</h3>
        <ul className="fxlist">
          {g.log.slice(0, 5).map(l => <li key={l.fx.id}><span className="muted">{COMP_NAME[l.fx.comp]}</span><Nat g={g} c={l.fx.h} short /><b className="num">{score(l.fx.gh, l.fx.ga, l.fx.pens)}</b><Nat g={g} c={l.fx.a} short /></li>)}
          {!g.log.length && <li className="muted">Todavía no dirigiste ningún partido.</li>}
        </ul>
      </Panel>
    </div>
  );
}
