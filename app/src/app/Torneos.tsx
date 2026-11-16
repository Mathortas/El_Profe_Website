import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Panel, Segmented, Tag } from '../design';
import type { Game } from '../game/core.ts';
import { HOSTS_2030 } from '../game/data.ts';
import { myPool, nat } from '../game/flow.ts';
import { type Row, elimSlots, elimTable, groupTable, koName, ranking } from '../game/world.ts';
import { openPlayer } from './store.ts';
import { Nat, score } from './common.tsx';

function Table({ g, rows, marks }: { g: Game; rows: Row[]; marks?: (c: string, i: number) => string }) {
  return (
    <table className="ep-table tbl">
      <thead><tr><th>#</th><th>Selección</th><th className="r">PJ</th><th className="r">G</th><th className="r">E</th><th className="r">P</th><th className="r">GF</th><th className="r">GC</th><th className="r">DG</th><th className="r">Pts</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.c} className={`${r.c === g.me ? 'me' : ''} ${marks?.(r.c, i) ?? ''}`}><td className="num">{i + 1}</td><td><Nat g={g} c={r.c} /></td><td className="r num">{r.pj}</td><td className="r num">{r.g}</td><td className="r num">{r.e}</td><td className="r num">{r.p}</td><td className="r num">{r.gf}</td><td className="r num">{r.gc}</td><td className="r num">{r.gf - r.gc}</td><td className="r num"><b>{r.pts}</b></td></tr>)}</tbody>
    </table>
  );
}

export function Torneos({ g }: { g: Game }) {
  const [tab, setTab] = useState<'elim' | 'copa' | 'rank' | 'gol'>(g.tour && !g.tour.champ ? 'copa' : 'elim');
  const slots = elimSlots(g), t = g.tour;
  const rk = ranking(g), myI = rk.findIndex(n => n.c === g.me);
  const shown = [...rk.slice(0, 20), ...(myI >= 20 ? rk.slice(Math.max(20, myI - 2), myI + 3) : [])];
  const scorers = myPool(g).filter(p => p.ig > 0).sort((a, b) => b.ig - a.ig).slice(0, 15);
  return (
    <div className="stack">
      <Segmented label="Torneo" value={tab} onChange={setTab} options={[{ value: 'elim', label: 'Eliminatorias' }, { value: 'copa', label: t ? (t.id === 'CA' ? `Copa América ${t.y}` : `Mundial ${t.y}`) : 'Copa y Mundial' }, { value: 'rank', label: 'Ranking FIFA' }, { value: 'gol', label: 'Goleadores' }]} />
      {tab === 'elim' && <div className="grid two">
        <Panel title={`Eliminatorias al Mundial ${g.cycle + 4}`} icon={<Trophy size={17} />} flush>
          <Table g={g} rows={elimTable(g)} marks={c => (HOSTS_2030.includes(c) ? 'host' : slots.direct.includes(c) ? 'q' : slots.playoff === c ? 'po' : '')} />
          <p className="legend"><i className="q" /> Clasifica <i className="po" /> Repechaje <i className="host" /> Sede, ya clasificada</p>
        </Panel>
        <Panel title="Tus partidos">
          <ul className="fxlist">{g.elim.rounds.map((rd, i) => { const j = rd.findIndex(m => m.includes(g.me)), m = rd[j], res = g.elim.res[i]?.[j]; return <li key={i}><span className="muted">Fecha {i + 1}</span><Nat g={g} c={m[0]} short /><b className="num">{res ? score(res[0], res[1]) : '–'}</b><Nat g={g} c={m[1]} short /></li>; })}</ul>
        </Panel>
      </div>}
      {tab === 'copa' && (!t ? <Panel><p className="muted">La Copa América se juega en junio de {g.cycle + 2} y el Mundial en junio de {g.cycle + 4}.</p></Panel> : <>
        {t.champ && <Panel><p><b>Campeón:</b> <Nat g={g} c={t.champ} /></p></Panel>}
        {t.ko.length > 0 && <Panel title="Eliminación directa"><div className="ko">{t.ko.map((rd, i) => <div key={i}><h3>{koName(t, i)}</h3><ul className="fxlist">{rd.map((m, k) => <li key={k} className={m.h === g.me || m.a === g.me ? 'me' : ''}><Nat g={g} c={m.h} short /><b className="num">{score(m.gh, m.ga, m.pens)}</b><Nat g={g} c={m.a} short /></li>)}</ul></div>)}</div></Panel>}
        <div className="grid groups">{t.groups.map((_, gi) => <Panel key={gi} title={`Grupo ${String.fromCharCode(65 + gi)}`} flush><Table g={g} rows={groupTable(t, gi)} marks={(_c, i) => (i < 2 ? 'q' : '')} /></Panel>)}</div>
      </>)}
      {tab === 'rank' && <Panel title="Ranking FIFA" flush>
        <table className="ep-table tbl"><thead><tr><th>#</th><th>Selección</th><th>Confederación</th><th className="r">Puntos</th><th className="r">Nivel</th></tr></thead>
          <tbody>{shown.map(n => <tr key={n.c} className={n.c === g.me ? 'me' : ''}><td className="num">{rk.indexOf(n) + 1}</td><td><Nat g={g} c={n.c} /></td><td className="muted">{n.conf}</td><td className="r num">{Math.round(n.pts)}</td><td className="r num">{Math.round(n.str)}</td></tr>)}</tbody></table>
      </Panel>}
      {tab === 'gol' && <Panel title={`Goleadores de ${nat(g, g.me).n}`}>
        <ul className="plain">{scorers.map(p => <li key={p.id}><button className="link" onClick={() => openPlayer(p.id)}>{p.n}</button><span><b className="num">{p.ig}</b> goles en {p.caps} partidos</span></li>)}{!scorers.length && <li className="muted">Todavía sin goles.</li>}</ul>
        <Tag>Incluye los goles anteriores a tu llegada</Tag>
      </Panel>}
    </div>
  );
}
