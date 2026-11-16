import { Landmark, ScrollText, Trash2 } from 'lucide-react';
import { Button, Panel, Tag } from '../design';
import { COMP_NAME, type Game } from '../game/core.ts';
import { goalMet, myRank, nat } from '../game/flow.ts';
import { stopLabel } from '../game/world.ts';
import { wipe } from './store.ts';
import { Meters, Stat } from './common.tsx';

export function Oficina({ g }: { g: Game }) {
  const f = g.meters.fed;
  return (
    <div className="grid two">
      <div className="stack">
        <Panel title="Tu contrato" icon={<Landmark size={17} />}>
          <p><b>{g.dt}</b>, director técnico de {nat(g, g.me).n}. Ciclo {g.cycle}–{g.cycle + 4}.</p>
          <p className="goal"><b>Objetivo:</b> {g.goal}. {g.elim.done >= 18 ? (goalMet(g) ? <Tag tone="good">Cumplido</Tag> : <Tag tone="bad">No cumplido</Tag>) : <Tag>En curso</Tag>}</p>
          <p className="muted">{f >= 65 ? 'La federación está conforme con tu trabajo.' : f >= 40 ? 'La federación te respalda, pero espera más.' : f > 15 ? 'Tu puesto está en riesgo: si la confianza baja de 15, termina el contrato.' : 'La federación ya no confía.'} Al final del ciclo se renueva con 40 o más de confianza, o si cumples el objetivo.</p>
          <Meters g={g} all />
        </Panel>
        <Panel title="Números del ciclo">
          <div className="stats"><Stat label="Partidos" value={g.record.pj} /><Stat label="Ganados" value={g.record.g} /><Stat label="Empatados" value={g.record.e} /><Stat label="Perdidos" value={g.record.p} /><Stat label="Goles" value={`${g.record.gf}–${g.record.gc}`} /><Stat label="Ranking" value={`#${myRank(g)}`} /></div>
        </Panel>
        <Panel title="Partida">
          <p className="muted">Se guarda sola en este navegador después de cada decisión.</p>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => { if (confirm('¿Borrar la partida y volver al inicio? No se puede deshacer.')) wipe(); }}>Borrar la partida</Button>
        </Panel>
      </div>
      <div className="stack">
        <Panel title="Calendario del ciclo">
          <ol className="cal">{g.stops.map((s, i) => <li key={i} className={i < g.stop ? 'done' : i === g.stop ? 'now' : ''}><span>{stopLabel(s)}</span><b>{s.kind === 'torneo' ? COMP_NAME[s.comp] : s.comp === 'EL' ? `Eliminatorias, fechas ${s.rounds![0] + 1}–${s.rounds![s.rounds!.length - 1] + 1}` : s.comp === 'RE' ? 'Repechaje o amistosos' : `${s.n} amistosos`}</b></li>)}</ol>
        </Panel>
        <Panel title="Historia" icon={<ScrollText size={17} />}>
          <ul className="plain hist">{g.history.map((h, i) => <li key={i}><b className="num">{h.y}</b><span>{h.text}</span></li>)}{!g.history.length && <li className="muted">La historia se escribe partido a partido.</li>}</ul>
        </Panel>
      </div>
    </div>
  );
}
