import { useEffect, useState } from 'react';
import { Briefcase, CalendarDays, ClipboardList, Landmark, Moon, Newspaper, Plane, Stethoscope, Sun, Trophy, Users, X, Building2, MessageSquare } from 'lucide-react';
import { Button, Crest, IconButton, Message, Phone, PhoneDock, PlayerCard, AttributeList, StatDuel, Tag, applyMode, initialMode, saveMode, type Mode } from '../design';
import { ATTRS } from '../styleguide/sample';
import type { Game, Msg } from '../game/core.ts';
import { COMP_NAME } from '../game/core.ts';
import { byId, curStop, nat } from '../game/flow.ts';
import { CURVE_NAME } from '../game/players.ts';
import { stopLabel } from '../game/world.ts';
import { act, boot, compare, go, openPlayer, useStore, type View } from './store.ts';
import { age, clubOf, known, leagueOf, money, potText, status, toCard } from './common.tsx';
import { Inicio } from './Inicio.tsx';
import { Despacho } from './Despacho.tsx';
import { EntreFechas } from './EntreFechas.tsx';
import { Convocatoria } from './Convocatoria.tsx';
import { Fecha } from './Fecha.tsx';
import { Torneos } from './Torneos.tsx';
import { Oficina } from './Oficina.tsx';
import './app.css';

const NAV: { id: View; label: string; icon: typeof Briefcase }[] = [
  { id: 'despacho', label: 'Despacho', icon: Briefcase },
  { id: 'entre', label: 'Entre fechas', icon: Plane },
  { id: 'lista', label: 'Convocatoria', icon: ClipboardList },
  { id: 'fecha', label: 'Fecha FIFA', icon: CalendarDays },
  { id: 'torneos', label: 'Torneos', icon: Trophy },
  { id: 'oficina', label: 'Oficina', icon: Landmark },
];
const WHO: Record<Msg['who'], typeof Briefcase> = { fed: Landmark, med: Stethoscope, club: Building2, prensa: Newspaper, ct: Users, jug: MessageSquare };

export default function App() {
  const st = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => { applyMode(mode); saveMode(mode); }, [mode]);
  useEffect(() => { void boot(); }, []);
  const toggle = <IconButton label={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>{mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</IconButton>;
  if (!st.ready) return <div className="boot">Cargando jugadores…</div>;
  const g = st.g;
  if (!g) return <Inicio toggle={toggle} />;
  const s = curStop(g), me = nat(g, g.me), unread = g.inbox.filter(m => !m.read).length;
  return (
    <div className="app">
      <header className="app-top">
        <div className="app-brand"><Crest iso={me.iso} /><div><b>{me.n}</b><span>{stopLabel(s)} · {s.kind === 'torneo' ? COMP_NAME[s.comp] : s.comp === 'RE' ? 'Repechaje y amistosos' : `${COMP_NAME[s.comp]}${s.comp === 'AM' ? 's' : ''}`}</span></div></div>
        <nav className="app-nav" aria-label="Secciones">
          {NAV.map(n => <button key={n.id} className={st.view === n.id ? 'on' : ''} onClick={() => go(n.id)}><n.icon size={17} /><span>{n.label}</span></button>)}
        </nav>
        {toggle}
      </header>
      <main className="app-main">
        {g.ph === 'fin' ? <Fin g={g} /> : st.view === 'despacho' ? <Despacho g={g} /> : st.view === 'entre' ? <EntreFechas g={g} /> : st.view === 'lista' ? <Convocatoria g={g} /> : st.view === 'fecha' ? <Fecha g={g} /> : st.view === 'torneos' ? <Torneos g={g} /> : <Oficina g={g} />}
      </main>
      <PhoneDock count={unread}>
        <Phone title="Mensajes" count={unread} filters={unread ? <Button size="sm" variant="ghost" onClick={() => act(x => x.inbox.forEach(m => (m.read = true)))}>Marcar leídos</Button> : undefined}>
          {g.inbox.slice(0, 25).map(m => { const I = WHO[m.who]; return <Message key={m.id} icon={<I size={16} />} from={m.from} time={m.when} text={m.text} unread={!m.read} />; })}
          {!g.inbox.length && <p className="muted pad">Sin mensajes.</p>}
        </Phone>
      </PhoneDock>
      {st.player > 0 && <PlayerDrawer g={g} id={st.player} />}
      {st.compare.length === 2 && <Compare g={g} ids={st.compare} />}
    </div>
  );
}

function Fin({ g }: { g: Game }) {
  return (
    <div className="center-card">
      <h1>Fin del ciclo</h1>
      <p>{g.over}</p>
      <p className="muted">Dirigiste {g.record.pj} partidos: {g.record.g} ganados, {g.record.e} empatados y {g.record.p} perdidos.</p>
      <Button variant="primary" onClick={() => go('oficina')}>Ver la oficina</Button>
    </div>
  );
}

function PlayerDrawer({ g, id }: { g: Game; id: number }) {
  const p = byId(g).get(id); if (!p) return null;
  const card = toCard(g, p), k = known(p);
  const PERS = ['Ambición', 'Profesionalismo', 'Temple', 'Liderazgo'];
  const word = (v: number) => (v >= 16 ? 'muy alto' : v >= 12 ? 'alto' : v >= 8 ? 'normal' : 'bajo');
  return (
    <aside className="drawer" role="dialog" aria-label={`Ficha de ${p.n}`}>
      <div className="drawer__head"><b>Ficha del jugador</b><IconButton label="Cerrar" onClick={() => openPlayer(0)}><X size={18} /></IconButton></div>
      <div className="drawer__body">
        <PlayerCard p={k ? card : { ...card, ovr: Math.round((card.ovr + 0) / 1), pot: card.pot }} />
        {!k && <p className="note">Lo has visto poco. Nivel estimado {p.gen ? `${Math.max(30, p.ovr - 5)}–${p.ovr + 5}` : p.ovr}, potencial {potText(p)}. Seguirlo afina estos números.</p>}
        <div className="facts">
          <div><span>Edad</span><b>{age(g, p)}</b></div><div><span>Club</span><b>{clubOf(g, p)}</b></div><div><span>Liga</span><b>{leagueOf(p)}</b></div>
          <div><span>Valor</span><b>{money(p.val)}</b></div><div><span>Potencial</span><b>{potText(p)}</b></div><div><span>Altura</span><b>{p.h ? `${p.h} cm` : '—'}</b></div>
          <div><span>Pie</span><b>{p.foot === 'I' ? 'Izquierdo' : p.foot === 'A' ? 'Ambos' : 'Derecho'}</b></div><div><span>Partidos</span><b>{p.caps} ({p.ig} goles)</b></div><div><span>Crecimiento</span><b>{CURVE_NAME[p.curve]}</b></div>
          <div><span>Relación</span><b>{p.rel >= 70 ? 'Muy buena' : p.rel >= 45 ? 'Buena' : p.rel >= 25 ? 'Fría' : 'Mala'}</b></div>
          <div><span>Otra selección</span><b>{p.nat2 ? `${nat(g, p.nat2).n}${p.tied ? ' (ya atado)' : ' (aún puede irse)'}` : '—'}</b></div>
          <div><span>Estado</span><b>{status(p) || 'Disponible'}</b></div>
        </div>
        <h3>Personalidad</h3>
        <div className="tags">{PERS.map((n, i) => <Tag key={n} tone={p.per[i] >= 14 ? 'good' : p.per[i] <= 7 ? 'warn' : undefined}>{n}: {k ? word(p.per[i]) : 'por conocer'}</Tag>)}</div>
        <h3>Atributos</h3>
        <AttributeList groups={ATTRS(card)} />
      </div>
    </aside>
  );
}

function Compare({ g, ids }: { g: Game; ids: number[] }) {
  const m = byId(g), a = m.get(ids[0]), b = m.get(ids[1]); if (!a || !b) return null;
  const L = ['Ritmo', 'Tiro', 'Pase', 'Regate', 'Defensa', 'Físico'];
  return (
    <div className="modal" role="dialog" aria-label="Comparar jugadores" onClick={() => compare([])}>
      <div className="modal__box" onClick={e => e.stopPropagation()}>
        <div className="drawer__head"><b>Comparar</b><IconButton label="Cerrar" onClick={() => compare([])}><X size={18} /></IconButton></div>
        <div className="cmp">
          <PlayerCard p={toCard(g, a)} /><PlayerCard p={toCard(g, b)} />
        </div>
        <div className="cmp__duel">
          <StatDuel label="Nivel" home={a.ovr} away={b.ovr} /><StatDuel label="Potencial" home={a.pot} away={b.pot} />
          {L.map((l, i) => <StatDuel key={l} label={l} home={a.six[i]} away={b.six[i]} />)}
          <StatDuel label="Edad" home={age(g, a)} away={age(g, b)} /><StatDuel label="Partidos" home={a.caps} away={b.caps} />
        </div>
      </div>
    </div>
  );
}
