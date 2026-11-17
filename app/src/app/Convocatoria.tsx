import { useMemo, useRef, useState } from 'react';
import { Megaphone, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { Button, Chip, FormArrow, Panel, PositionChip, Segmented, SortableTable, Tag, posRank, type Column, type Form } from '../design';
import { type Game, type P, LINE, clamp, rngFor } from '../game/core.ts';
import { SQUAD_MAX, confirmSquad, myPool, nat, suggestSquad } from '../game/flow.ts';
import { abroad } from '../game/data.ts';
import { available } from '../game/players.ts';
import { act, compare, go, openPlayer } from './store.ts';
import { Lvl, Nat, age, clubOf, known, leagueOf, money, potText, status } from './common.tsx';

type Line = 'ALL' | 'POR' | 'DEF' | 'MED' | 'DEL';
export function Convocatoria({ g }: { g: Game }) {
  const [line, setLine] = useState<Line>('ALL'), [where, setWhere] = useState<'all' | 'local' | 'out'>('all');
  const [onlyOk, setOnlyOk] = useState(false), [u23, setU23] = useState(false), [dual, setDual] = useState(false), [others, setOthers] = useState(false), [q, setQ] = useState('');
  const first = useRef(0);
  const editable = g.ph === 'entre' || g.ph === 'lista', inSquad = new Set(g.squad);
  const rows = useMemo(() => {
    const base = others ? g.players.filter(p => p.nat2 === g.me && p.nat !== g.me && !p.tied && p.ret === 0) : myPool(g);
    return base.filter(p => (line === 'ALL' || LINE[p.pos] === line) && (where === 'all' || (where === 'local') === !abroad(p)) && (!onlyOk || available(p)) && (!u23 || age(g, p) <= 23) && (!dual || !!p.nat2) && (!q || p.n.toLowerCase().includes(q.toLowerCase())));
    // eslint-disable-next-line
  }, [g, g.players.length, line, where, onlyOk, u23, dual, others, q, g.squad.length]);
  const sq = g.squad.map(id => g.players.find(p => p.id === id)!).filter(Boolean);
  const count = (l: string) => sq.filter(p => LINE[p.pos] === l).length;
  const avg = sq.length ? Math.round(sq.reduce((s, p) => s + p.ovr, 0) / sq.length) : 0;
  const toggle = (p: P) => { if (!editable || others || !available(p)) return; act(x => { const i = x.squad.indexOf(p.id); if (i >= 0) x.squad.splice(i, 1); else if (x.squad.length < SQUAD_MAX) x.squad.push(p.id); }); };
  const dbl = (p: P) => { if (first.current && first.current !== p.id) { compare([first.current, p.id]); first.current = 0; } else first.current = p.id; };
  const court = (p: P) => act(x => {
    const r = rngFor(x, `convencer:${p.id}:${x.stop}`), theirs = nat(x, p.nat).str, chance = clamp(0.45 + (theirs - p.ovr) / 40 + (p.rel - 50) / 100, 0.1, 0.9);
    x.acts.push('dual');
    if (r() < chance) { const old = p.nat; p.nat = x.me; p.nat2 = old; p.rel = 70; x.inbox.unshift({ id: x.next++, who: 'jug', from: p.n, text: 'Profe, acepto. Quiero jugar por la selección.', when: 'Hoy' }); }
    else { p.rel = clamp(p.rel - 10, 0, 100); x.inbox.unshift({ id: x.next++, who: 'jug', from: p.n, text: 'Gracias por la llamada, pero por ahora prefiero esperar a mi otra selección.', when: 'Hoy' }); }
  });
  const cols: Column<P>[] = [
    { key: 'in', label: '', sortValue: p => (inSquad.has(p.id) ? 0 : 1), render: p => (others ? <Button size="sm" icon={<UserPlus size={14} />} disabled={g.acts.includes('dual')} onClick={e => { e.stopPropagation(); court(p); }}>Convencer</Button> : <input type="checkbox" aria-label={`Convocar a ${p.n}`} checked={inSquad.has(p.id)} disabled={!editable || !available(p)} readOnly />) },
    { key: 'pos', label: 'Pos', sortValue: p => posRank(p.pos), render: p => <PositionChip pos={p.pos} /> },
    { key: 'n', label: 'Jugador', sortValue: p => p.n, render: p => <span className="pname"><button className="link" onClick={e => { e.stopPropagation(); openPlayer(p.id); }}>{p.n}</button>{p.nat2 && <Tag tone={p.tied ? undefined : 'warn'}>{nat(g, others ? p.nat : p.nat2).c}</Tag>}{p.gen && <Tag tone="info">Juvenil</Tag>}</span> },
    { key: 'age', label: 'Edad', num: true, sortValue: p => age(g, p), render: p => age(g, p) },
    { key: 'club', label: 'Club', sortValue: p => clubOf(g, p), render: p => <span className="club">{clubOf(g, p)}</span> },
    { key: 'lg', label: 'Liga', sortValue: p => leagueOf(p), render: p => <span className="muted">{leagueOf(p)}</span> },
    { key: 'ovr', label: 'Nivel', num: true, sortValue: p => p.ovr, render: p => <Lvl p={p} /> },
    { key: 'pot', label: 'Pot', num: true, sortValue: p => p.pot, render: p => (known(p) ? p.pot : potText(p)) },
    { key: 'form', label: 'Forma', sortValue: p => p.form, render: p => <FormArrow form={p.form as Form} /> },
    { key: 'min', label: 'Min', num: true, sortValue: p => p.mins, render: p => `${Math.round(p.mins * 100)}%` },
    { key: 'caps', label: 'PJ', num: true, sortValue: p => p.caps, render: p => p.caps },
    { key: 'val', label: 'Valor', num: true, sortValue: p => p.val, render: p => money(p.val) },
    { key: 'st', label: 'Estado', sortValue: p => status(p), render: p => (status(p) ? <Tag tone="bad">{status(p)}</Tag> : p.rel < 25 ? <Tag tone="warn">Relación fría</Tag> : '') },
  ];
  const okToAnnounce = g.ph === 'lista' && sq.length >= 18 && count('POR') >= 2;
  return (
    <div className="stack">
      <Panel title="Convocatoria" icon={<Megaphone size={17} />} actions={<div className="row">
        {editable && <Button size="sm" icon={<Sparkles size={15} />} onClick={() => act(x => { x.squad = suggestSquad(x); })}>Que la arme el ayudante</Button>}
        {editable && <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => act(x => { x.squad = []; })}>Vaciar</Button>}
        {g.ph === 'lista' ? <Button variant="primary" disabled={!okToAnnounce} onClick={() => { act(confirmSquad); go('fecha'); }}>Anunciar la lista</Button> : g.ph === 'entre' ? <Tag>Se anuncia al terminar el trabajo entre fechas</Tag> : <Tag tone="good">Lista anunciada</Tag>}
      </div>}>
        <div className="sqbar">
          <div className="sqbar__n"><b className="num">{sq.length}</b><span>/ {SQUAD_MAX} convocados</span></div>
          {(['POR', 'DEF', 'MED', 'DEL'] as const).map(l => <div key={l} className="sqbar__l"><span>{l}</span><b className="num">{count(l)}</b></div>)}
          <div className="sqbar__l"><span>Nivel medio</span><b className="num">{avg || '—'}</b></div>
          <div className="sqbar__l"><span>Juegan afuera</span><b className="num">{sq.filter(abroad).length}</b></div>
          <div className="sqbar__l"><span>Sub-23</span><b className="num">{sq.filter(p => age(g, p) <= 23).length}</b></div>
        </div>
        <div className="filters">
          <Segmented label="Línea" value={line} onChange={setLine} options={[{ value: 'ALL', label: 'Todos' }, { value: 'POR', label: 'Arqueros' }, { value: 'DEF', label: 'Defensas' }, { value: 'MED', label: 'Medios' }, { value: 'DEL', label: 'Delanteros' }]} />
          <Segmented label="Dónde juega" value={where} onChange={setWhere} options={[{ value: 'all', label: 'Todas las ligas' }, { value: 'local', label: 'Liga local' }, { value: 'out', label: 'Exterior' }]} />
          <Chip pressed={onlyOk} onToggle={() => setOnlyOk(!onlyOk)}>Disponibles</Chip>
          <Chip pressed={u23} onToggle={() => setU23(!u23)}>Sub-23</Chip>
          <Chip pressed={dual} onToggle={() => setDual(!dual)}>Doble nacionalidad</Chip>
          <Chip pressed={others} onToggle={() => setOthers(!others)}>Elegibles de otras selecciones</Chip>
          <input className="search" placeholder="Buscar jugador" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar jugador" />
        </div>
        {others && <p className="note">Juegan por otra selección, pero nacieron aquí o tienen la nacionalidad y todavía pueden cambiar. Puedes intentar convencer a uno por fecha. <Nat g={g} c={g.me} /></p>}
      </Panel>
      <Panel flush>
        <SortableTable columns={cols} rows={rows} initialSort={{ key: 'pos', dir: 'asc' }} selected={others ? [] : g.squad} onRowClick={toggle} onRowDoubleClick={dbl} caption="Jugadores disponibles para la selección" />
        {!rows.length && <p className="muted pad">Ningún jugador coincide con los filtros.</p>}
      </Panel>
      <p className="muted small">Un clic convoca o quita. Doble clic en dos jugadores los compara. El nombre abre la ficha.</p>
    </div>
  );
}
