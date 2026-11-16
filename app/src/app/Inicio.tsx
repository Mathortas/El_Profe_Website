import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Button, Crest, Rating, Tag } from '../design';
import { CONMEBOL, HOSTS_2030, VENUES } from '../game/data.ts';
import { buildPlayers, teamRating } from '../game/players.ts';
import { resume, start, useStore, wipe } from './store.ts';

export function Inicio({ toggle }: { toggle: ReactNode }) {
  const st = useStore(), raw = st.raw!;
  const [pick, setPick] = useState('PER'), [name, setName] = useState('');
  const teams = useMemo(() => {
    const ps = buildPlayers(raw, 1);
    return CONMEBOL.map(c => { const n = raw.nations.find(x => x[0] === c)!; const pool = ps.filter(p => p.nat === c); return { c, n: n[1], iso: n[2], rank: n[4], str: Math.round(teamRating(pool)), best: [...pool].sort((a, b) => b.ovr - a.ovr).slice(0, 3) }; })
      .sort((a, b) => b.str - a.str);
  }, [raw]);
  const sel = teams.find(t => t.c === pick)!, idx = teams.indexOf(sel);
  const goal = HOSTS_2030.includes(pick) ? 'Terminar entre los cuatro primeros de las eliminatorias' : idx <= 5 ? 'Clasificar al Mundial 2030' : idx <= 7 ? 'Terminar entre los seis primeros de las eliminatorias' : 'Sumar al menos 15 puntos en las eliminatorias';
  return (
    <div className="inicio"><div className="inicio__bg" aria-hidden="true" />
      <header className="inicio__top"><b className="logo">El Profe</b>{toggle}</header>
      <div className="inicio__hero">
        <h1>Septiembre de 2026.<br />Empieza un ciclo nuevo.</h1>
        <p>España es campeona del mundo. Quedan cuatro años hasta el Mundial 2030 y una selección sudamericana busca técnico.</p>
        {st.hasSave && <div className="row"><Button variant="primary" icon={<Play size={16} />} onClick={resume}>Continuar la partida guardada</Button><Button variant="ghost" onClick={() => { if (confirm('¿Borrar la partida guardada?')) wipe(); }}>Borrarla</Button></div>}
      </div>
      <div className="inicio__grid">
        <div className="teams" role="radiogroup" aria-label="Selección">
          {teams.map(t => (
            <button key={t.c} role="radio" aria-checked={pick === t.c} className={`team${pick === t.c ? ' on' : ''}`} onClick={() => setPick(t.c)}>
              <Crest iso={t.iso} /><span className="team__n">{t.n}</span><Rating value={t.str} size="sm" /><span className="team__r num">#{t.rank}</span>
            </button>
          ))}
        </div>
        <section className="offer" key={pick}>
          <div className="offer__head"><Crest iso={sel.iso} /><div><h2>{sel.n}</h2><span className="muted">Puesto {sel.rank} del ranking FIFA · nivel {sel.str}</span></div></div>
          <dl>
            <dt>Objetivo del ciclo</dt><dd>{goal}</dd>
            <dt>Dificultad</dt><dd>{idx <= 2 ? <Tag tone="good">Favorita</Tag> : idx <= 5 ? <Tag tone="info">Pareja</Tag> : idx <= 7 ? <Tag tone="warn">Cuesta arriba</Tag> : <Tag tone="bad">Muy difícil</Tag>}</dd>
            <dt>Figuras</dt><dd>{sel.best.map(p => `${p.n} (${p.ovr})`).join(', ')}</dd>
            <dt>Sedes</dt><dd>{VENUES[pick].map(v => `${v[1]}${v[2] > 2000 ? ` (${v[2]} m)` : ''}`).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</dd>
            {HOSTS_2030.includes(pick) && <><dt>Mundial 2030</dt><dd>Ya clasificada por ser sede de los partidos inaugurales.</dd></>}
          </dl>
          <label className="field">Tu nombre<input value={name} onChange={e => setName(e.target.value)} placeholder="Apellido del técnico" maxLength={24} /></label>
          <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => start(pick, name.trim())}>Firmar con {sel.n}</Button>
        </section>
      </div>
    </div>
  );
}
