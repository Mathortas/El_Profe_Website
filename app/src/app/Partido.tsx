import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FastForward, Pause, Play, RectangleVertical, Repeat, Goal, HeartPulse, Info } from 'lucide-react';
import { Button, Panel, PositionChip, Segmented, StatDuel, Tag } from '../design';
import type { Game } from '../game/core.ts';
import { FORMS, kits } from '../game/data.ts';
import { curFx, finishMatch, matchInit, nat } from '../game/flow.ts';
import type { Frame, MEvent, PIn, Result } from '../game/engine.ts';
import { act, getGame } from './store.ts';
import { Tactics } from './Fecha.tsx';
import { Nat } from './common.tsx';

interface Ros { id: number; n: string; team: number; role: string; on: boolean; yel: number; hurt: boolean; rate: number; sta: number }
interface Part { x: number; y: number; vx: number; vy: number; c: string; life: number }
const W = 105, H = 68, PAD = 2;
const EV_ICON: Record<MEvent['type'], typeof Goal> = { gol: Goal, amarilla: RectangleVertical, roja: RectangleVertical, cambio: Repeat, ocasion: Info, lesion: HeartPulse, info: Info, penal: Goal };

export function Partido({ g }: { g: Game }) {
  const init = useMemo(() => matchInit(g), []); // eslint-disable-line
  const fx = curFx(g)!, my = fx.h === g.me ? 0 : 1, colors = useMemo(() => kits(fx.h, fx.a), [fx.h, fx.a]);
  const canvas = useRef<HTMLCanvasElement>(null), wk = useRef<Worker | null>(null);
  const fr = useRef({ prev: null as Frame | null, cur: null as Frame | null, tPrev: 0, tCur: 0, roles: [] as string[], names: [] as string[], goalAt: 0, goalTeam: 0, parts: [] as Part[], trail: [] as number[][], last: 0 });
  const [hud, setHud] = useState({ min: 1, a: 0, b: 0, banner: '', phase: 'juego', wait: false });
  const [events, setEvents] = useState<MEvent[]>([]), [roster, setRoster] = useState<Ros[]>([]), [bench, setBench] = useState<PIn[][]>([[], []]);
  const [stats, setStats] = useState<number[][]>([]), [subs, setSubs] = useState([0, 0]), [end, setEnd] = useState<Result | null>(null);
  const [speed, setSpeed] = useState('2'), [paused, setPaused] = useState(false), [tab, setTab] = useState<'relato' | 'cambios' | 'planteo' | 'datos'>('relato'), [out, setOut] = useState(0), [talked, setTalked] = useState(false);
  const [goal, setGoal] = useState<{ text: string; team: number; k: number } | null>(null);
  const send = (m: unknown) => wk.current?.postMessage(m);

  useEffect(() => {
    const w = new Worker(new URL('../game/worker.ts', import.meta.url), { type: 'module' }); wk.current = w;
    let goalTimer = 0;
    w.onmessage = e => {
      const d = e.data;
      if (d.type === 'end') { setEnd(d.result as Result); return; }
      const f = d.f as Frame, r = fr.current; r.prev = r.cur; r.tPrev = r.tCur; r.cur = f; r.tCur = performance.now();
      setHud(h => (h.min === f.min && h.a === f.score[0] && h.b === f.score[1] && h.banner === f.banner && h.phase === f.phase && h.wait === d.wait ? h : { min: f.min, a: f.score[0], b: f.score[1], banner: f.banner, phase: f.phase, wait: d.wait }));
      if (d.events.length) {
        setEvents(ev => [...(d.events as MEvent[]).slice().reverse(), ...ev]);
        for (const ev of d.events as MEvent[]) if (ev.type === 'gol') {
          r.goalAt = performance.now(); r.goalTeam = ev.team;
          const gx = ev.team === 0 ? W : 0, [c1, c2] = colors[ev.team];
          for (let i = 0; i < 70; i++) r.parts.push({ x: gx + (ev.team === 0 ? -1 : 1) * Math.random() * 3, y: H / 2 + (Math.random() - 0.5) * 8, vx: (ev.team === 0 ? -1 : 1) * (4 + Math.random() * 16), vy: (Math.random() - 0.5) * 22, c: i % 3 === 0 ? '#ffffff' : i % 2 ? c1 : c2, life: 1 });
          setGoal({ text: ev.text, team: ev.team, k: Date.now() }); clearTimeout(goalTimer); goalTimer = window.setTimeout(() => setGoal(null), 2600);
        }
      }
      if (d.roster) { setRoster(d.roster); r.roles = (d.roster as Ros[]).map(x => x.role); r.names = (d.roster as Ros[]).map(x => x.n.split(' ').slice(-1)[0]); setBench(d.bench); setStats(d.stats); setSubs(d.subs.slice()); }
    };
    w.postMessage({ type: 'init', init });
    let raf = 0;
    const css = getComputedStyle(document.documentElement), grass = css.getPropertyValue('--pitch').trim() || '#2a6b43', grass2 = css.getPropertyValue('--pitch-2').trim() || '#256139';
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current, r = fr.current; if (!c || !r.cur) return;
      const now = performance.now(), dts = Math.min(0.05, (now - (r.last || now)) / 1000); r.last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(c.clientWidth * dpr), ch = Math.round((c.clientWidth * (H + PAD * 2)) / (W + PAD * 2) * dpr);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const ctx = c.getContext('2d')!, k = cw / (W + PAD * 2), X = (x: number) => (x + PAD) * k, Y = (y: number) => (y + PAD) * k;
      const since = now - r.goalAt, shake = since < 500 ? (1 - since / 500) * 0.55 * k : 0;
      ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      ctx.fillStyle = grass; ctx.fillRect(-4, -4, cw + 8, ch + 8);
      ctx.fillStyle = grass2; for (let i = 0; i < 7; i++) ctx.fillRect(X(i * 15), Y(0), 7.5 * k, H * k);
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = Math.max(1, 0.18 * k);
      ctx.strokeRect(X(0), Y(0), W * k, H * k); ctx.beginPath(); ctx.moveTo(X(W / 2), Y(0)); ctx.lineTo(X(W / 2), Y(H)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(W / 2), Y(H / 2), 9.15 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(W / 2), Y(H / 2), 0.4 * k, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      for (const s of [0, 1]) {
        ctx.strokeRect(X(s ? W - 16.5 : 0), Y(H / 2 - 20.15), 16.5 * k, 40.3 * k); ctx.strokeRect(X(s ? W - 5.5 : 0), Y(H / 2 - 9.16), 5.5 * k, 18.32 * k);
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(X(s ? W : -1.7), Y(H / 2 - 3.66), 1.7 * k, 7.32 * k); ctx.strokeRect(X(s ? W : -1.7), Y(H / 2 - 3.66), 1.7 * k, 7.32 * k);
      }
      if (since < 1100) {                                                            // destello en el arco del gol
        const gx = X(r.goalTeam === 0 ? W : 0), gr = ctx.createRadialGradient(gx, Y(H / 2), 0, gx, Y(H / 2), 30 * k);
        gr.addColorStop(0, `rgba(255,255,255,${0.5 * (1 - since / 1100)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
      }
      const a = r.prev ? Math.min(1, (now - r.tCur) / Math.max(16, r.tCur - r.tPrev)) : 1;
      const lerp = (p: number, q: number) => (Math.abs(q - p) > 9 ? q : p + (q - p) * a);
      const cur = r.cur, prev = r.prev ?? cur;
      const bx = lerp(prev.ball[0], cur.ball[0]), by = lerp(prev.ball[1], cur.ball[1]), bz = lerp(prev.ball[2], cur.ball[2]);
      const lt = r.trail[r.trail.length - 1];
      if (!lt || Math.hypot(lt[0] - bx, lt[1] - by) > 0.5) { r.trail.push([bx, by]); if (r.trail.length > 9) r.trail.shift(); }
      if (cur.owner < 0 && r.trail.length > 3 && Math.hypot(r.trail[0][0] - bx, r.trail[0][1] - by) > 5) r.trail.forEach((p, i) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), (0.15 + i * 0.05) * k, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.05 + i * 0.045})`; ctx.fill(); });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 22; i++) {
        const x = lerp(prev.pos[i * 2], cur.pos[i * 2]), y = lerp(prev.pos[i * 2 + 1], cur.pos[i * 2 + 1]); if (x < -5) continue;
        const team = i < 11 ? 0 : 1, gk = r.roles[i] === 'POR', [p1, p2] = colors[team], own = cur.owner === i;
        ctx.beginPath(); ctx.ellipse(X(x) + 0.3 * k, Y(y) + 0.75 * k, 1.35 * k, 0.7 * k, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fill();
        if (own) { const pulse = 2.05 + Math.sin(now / 140) * 0.18; ctx.beginPath(); ctx.arc(X(x), Y(y), pulse * k, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 0.26 * k; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(X(x), Y(y), 1.38 * k, 0, Math.PI * 2); ctx.fillStyle = gk ? '#161a1f' : p1; ctx.fill();
        ctx.lineWidth = 0.3 * k; ctx.strokeStyle = gk ? p1 : p2; ctx.stroke();
        ctx.font = `600 ${Math.round(1.5 * k)}px "Archivo Variable", sans-serif`; ctx.fillStyle = gk ? '#fff' : p2; ctx.fillText(String((i % 11) + 1), X(x), Y(y) + 0.08 * k);
        if (own && r.names[i]) {
          ctx.font = `600 ${Math.round(1.45 * k)}px "Archivo Variable", sans-serif`; const tw = ctx.measureText(r.names[i]).width + 1.2 * k;
          ctx.fillStyle = 'rgba(10,12,14,.72)'; ctx.fillRect(X(x) - tw / 2, Y(y) - 4.3 * k, tw, 2 * k);
          ctx.fillStyle = '#fff'; ctx.fillText(r.names[i], X(x), Y(y) - 3.25 * k);
        }
      }
      ctx.beginPath(); ctx.ellipse(X(bx) + bz * 0.25 * k, Y(by) + bz * 0.35 * k + 0.2 * k, 0.6 * k, 0.4 * k, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(X(bx), Y(by) - bz * 0.5 * k, (0.62 + bz * 0.05) * k, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 0.12 * k; ctx.strokeStyle = '#111'; ctx.stroke();
      if (r.parts.length) {                                                          // papelitos del festejo
        r.parts = r.parts.filter(p => p.life > 0);
        for (const p of r.parts) { p.x += p.vx * dts; p.y += p.vy * dts; p.vx *= 0.97; p.vy *= 0.97; p.life -= dts * 0.55; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(X(p.x), Y(p.y), 0.55 * k, 0.9 * k); }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearTimeout(goalTimer); w.terminate(); };
  }, []); // eslint-disable-line
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setPaused(p => { wk.current?.postMessage({ type: 'pause', v: !p }); return !p; }); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);

  const mine = roster.filter(r => r.team === my && r.on), left = 5 - subs[my], diff = (my === 0 ? hud.a - hud.b : hud.b - hud.a);
  const talk = (k: number) => { send({ type: 'cmd', cmd: { type: 'talk', team: my, k } }); setTalked(true); };
  const TALK = diff < 0 ? ['Hay que ir a buscarlo: todos un paso adelante', 'Confío en ustedes: jueguen como saben', 'Primero ordenarnos, el gol va a llegar']
    : diff > 0 ? ['Vamos por otro para cerrarlo', 'Sigan así, sin regalar nada', 'A cuidar la pelota y bajar el ritmo']
    : ['Soltarse más: el partido está para ganarlo', 'Paciencia, lo estamos haciendo bien', 'No regalar nada atrás'];
  const S = ['Posesión', 'Tiros', 'Al arco', 'Córners', 'Faltas', 'Pases', 'Pases buenos', 'Fueras de juego'];
  return (
    <div className="match">
      <div className="match__main">
        <div className={`sb${goal ? ' sb--goal' : ''}`}>
          <Nat g={g} c={fx.h} /><b className="sb__score num" key={`${hud.a}-${hud.b}`}>{hud.a} – {hud.b}</b><Nat g={g} c={fx.a} />
          <span className="sb__min num">{hud.phase === 'ht' ? 'Descanso' : hud.phase === 'fin' ? 'Final' : `${hud.min}'`}</span>
          <i className="sb__bar" style={{ width: `${Math.min(100, (hud.min / (hud.min > 90 ? 120 : 90)) * 100)}%` }} />
        </div>
        <div className="cancha">
          <canvas ref={canvas} aria-label="Cancha" />
          {hud.banner && hud.phase === 'juego' && !goal && <div className="cancha__banner" key={hud.banner}>{hud.banner}</div>}
          {goal && <div className={`cancha__goal${goal.team === my ? ' mine' : ''}`} key={goal.k}><b>¡Gol!</b><span>{goal.text.replace('Gol de ', '')} · {nat(g, goal.team === 0 ? fx.h : fx.a).n}</span></div>}
          {hud.phase === 'ht' && !end && <div className="cancha__over"><div className="over">
            <h3>Entretiempo · {nat(g, fx.h).c} {hud.a} – {hud.b} {nat(g, fx.a).c}</h3>
            {!talked ? <><p>¿Qué les dices?</p><div className="ev__opts">{TALK.map((t, i) => <button key={t} onClick={() => talk(i)}><b>{t}</b><span>{['El equipo se adelanta. Queda más expuesto.', 'Sube la confianza. No cambia el plan.', 'El equipo se repliega. Ataca con menos gente.'][i]}</span></button>)}</div></> : <p className="muted">Dicho. Puedes hacer cambios antes de volver.</p>}
            <Button variant="primary" icon={<Play size={16} />} onClick={() => send({ type: 'cmd', cmd: { type: 'resume' } })}>Jugar el segundo tiempo</Button>
          </div></div>}
          {hud.wait && hud.phase === 'juego' && <div className="cancha__over"><div className="over"><h3>Un jugador quedó sentido</h3><p>Puedes cambiarlo en la pestaña Cambios o dejarlo en cancha.</p><Button variant="primary" onClick={() => send({ type: 'cmd', cmd: { type: 'resume' } })}>Seguir</Button></div></div>}
          {end && <div className="cancha__over"><div className="over"><h3>Final: {nat(g, fx.h).n} {end.gh} – {end.ga} {nat(g, fx.a).n}{end.pens ? ` (${end.pens[0]}–${end.pens[1]} en penales)` : ''}</h3><Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => act(x => finishMatch(x, end))}>Ver el resumen</Button></div></div>}
        </div>
        <div className="ctrl">
          <Button size="sm" icon={paused ? <Play size={15} /> : <Pause size={15} />} onClick={() => { send({ type: 'pause', v: !paused }); setPaused(!paused); }}>{paused ? 'Seguir' : 'Pausa'}</Button>
          <Segmented label="Velocidad" value={speed} onChange={v => { setSpeed(v); send({ type: 'speed', v: Number(v) }); }} options={['1', '2', '4', '8'].map(v => ({ value: v, label: `×${v}` }))} />
          <Button size="sm" variant="ghost" icon={<FastForward size={15} />} onClick={() => send({ type: 'skip' })}>Saltar al final</Button>
          <span className="muted small">La barra espaciadora pausa.</span>
        </div>
      </div>
      <Panel className="match__side">
        <Segmented label="Panel" value={tab} onChange={setTab} options={[{ value: 'relato', label: 'Relato' }, { value: 'cambios', label: `Cambios (${left})` }, { value: 'planteo', label: 'Planteo' }, { value: 'datos', label: 'Datos' }]} />
        {tab === 'relato' && <ul className="feed">{events.map((e, i) => { const I = EV_ICON[e.type]; return <li key={events.length - i} className={`${e.type}${e.team === my ? ' mine' : ''}`}><span className="num">{e.min}'</span><I size={15} /><span>{e.text}</span></li>; })}{!events.length && <li className="muted">Empezó el partido.</li>}</ul>}
        {tab === 'cambios' && <div className="subs">
          <p className="muted small">{left ? 'Elige quién sale y después quién entra.' : 'Ya hiciste los cinco cambios.'}</p>
          <ul>{mine.map(r => <li key={r.id} className={out === r.id ? 'sel' : ''}><button onClick={() => setOut(out === r.id ? 0 : r.id)} disabled={!left}><PositionChip pos={r.role} /><span className="bn">{r.n}</span>{r.hurt && <Tag tone="bad">Sentido</Tag>}{r.yel > 0 && <Tag tone="warn">Amarilla</Tag>}<i className="sta"><i style={{ width: `${Math.round(r.sta * 100)}%` }} className={r.sta < 0.55 ? 'low' : ''} /></i><b className="num">{r.rate.toFixed(1)}</b></button></li>)}</ul>
          <h3>Banco</h3>
          <ul>{(bench[my] ?? []).map(p => <li key={p.id}><button disabled={!out || !left} onClick={() => { send({ type: 'cmd', cmd: { type: 'sub', team: my, out, in: p.id } }); setOut(0); }}><PositionChip pos={p.pos} /><span className="bn">{p.n}</span><b className="num">{p.ovr}</b></button></li>)}</ul>
        </div>}
        {tab === 'planteo' && <div className="stack">
          <Segmented label="Formación" value={g.lineup.tac.form} onChange={f => { act(x => { x.lineup.tac.form = f; }); send({ type: 'cmd', cmd: { type: 'tac', team: my, tac: { ...getGame().lineup.tac } } }); }} options={Object.keys(FORMS).map(f => ({ value: f, label: f }))} />
          <Tactics g={g} onChange={() => send({ type: 'cmd', cmd: { type: 'tac', team: my, tac: { ...getGame().lineup.tac } } })} />
        </div>}
        {tab === 'datos' && <div>{stats.map((s, i) => <StatDuel key={i} label={S[i]} home={my === 0 ? s[0] : s[1]} away={my === 0 ? s[1] : s[0]} suffix={i === 0 ? '%' : ''} />)}</div>}
      </Panel>
    </div>
  );
}
