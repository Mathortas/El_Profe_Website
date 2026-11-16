import { useState } from 'react';
import { ArrowRight, Binoculars, Building2, Check, Dumbbell, Landmark, Plane, Search, Users } from 'lucide-react';
import { Button, Panel, StaffTip, Tag } from '../design';
import { COMP_NAME, type Game } from '../game/core.ts';
import { ACTS, doAct, myPool, toLista } from '../game/flow.ts';
import { eventView, resolveEvent } from '../game/events.ts';
import { act, go, openPlayer } from './store.ts';
import { Meters, Nat, status } from './common.tsx';

const ICON: Record<string, typeof Plane> = { gira: Plane, clubes: Building2, micro: Dumbbell, rival: Binoculars, juveniles: Search, fede: Landmark };

export function Events({ g }: { g: Game }) {
  const [done, setDone] = useState<{ title: string; text: string }[]>([]);
  if (!g.pending.length && !done.length) return null;
  return (
    <div className="events">
      {g.pending.map((pd, i) => { const v = eventView(g, pd); return (
        <article key={pd.ev} className="ev">
          <span className="ev__place">{v.e.place}</span><h3>{v.title}</h3><p>{v.text}</p>
          <div className="ev__opts">
            {v.e.opts.map((o, k) => <button key={o.t} onClick={() => { let txt = ''; act(x => { txt = resolveEvent(x, i, k); }); setDone(d => [{ title: v.title, text: txt }, ...d]); }}><b>{o.t}</b><span>{o.hint}</span></button>)}
          </div>
        </article>); })}
      {done.map(d => <article key={d.title} className="ev ev--done"><span className="ev__place"><Check size={14} /> Resuelto</span><h3>{d.title}</h3><p>{d.text}</p></article>)}
    </div>
  );
}

export function EntreFechas({ g }: { g: Game }) {
  const open = g.ph === 'entre', staffUsed = g.acts.includes('*');
  const out = myPool(g).filter(p => p.inj || p.sus).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  return (
    <div className="grid entre">
      <div className="stack">
        <Panel title="Qué hacer hasta la próxima fecha" icon={<Plane size={17} />} actions={open ? <Tag tone={g.actsLeft ? 'info' : undefined}>Te quedan {g.actsLeft} de 3</Tag> : <Tag>Fecha en curso</Tag>}>
          <div className="acts">
            {ACTS.map(a => { const I = ICON[a.id], used = g.acts.includes(a.id); return (
              <div key={a.id} className={`actc${used ? ' used' : ''}`}>
                <I size={20} /><div><b>{a.title}</b><p>{a.desc}</p></div>
                {used ? <Tag tone="good">Hecho</Tag> : open && <div className="actc__btns">
                  <Button size="sm" variant="primary" disabled={g.actsLeft <= 0} onClick={() => act(x => doAct(x, a.id, false))}>Ir yo</Button>
                  <Button size="sm" disabled={staffUsed} onClick={() => act(x => doAct(x, a.id, true))}>Cuerpo técnico</Button>
                </div>}
              </div>); })}
          </div>
          <StaffTip who="Cuerpo técnico">Podemos encargarnos de una tarea por fecha. Rinde la mitad que si va usted.</StaffTip>
        </Panel>
        <Events g={g} />
      </div>
      <div className="stack">
        <Panel title="Lo que viene" icon={<Users size={17} />}>
          <ul className="fxlist">{g.fx.map(f => <li key={f.id}><span className="muted">{COMP_NAME[f.comp]}</span><Nat g={g} c={f.h} short /><b className="num">vs</b><Nat g={g} c={f.a} short /></li>)}</ul>
          {open ? <Button variant="primary" icon={<ArrowRight size={16} />} disabled={g.pending.length > 0} onClick={() => { act(toLista); go('lista'); }}>{g.pending.length ? 'Resuelve los pendientes primero' : 'Armar la lista'}</Button> : <Button onClick={() => go('fecha')}>Ir a la fecha</Button>}
        </Panel>
        <Panel title="Estado"><Meters g={g} all /></Panel>
        <Panel title="Bajas">
          <ul className="plain">{out.map(p => <li key={p.id}><button className="link" onClick={() => openPlayer(p.id)}>{p.n}</button><span className="muted">{status(p)}</span></li>)}{!out.length && <li className="muted">Nadie entre algodones.</li>}</ul>
        </Panel>
      </div>
    </div>
  );
}
