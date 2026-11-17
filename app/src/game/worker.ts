// El partido corre en un hilo aparte para que la interfaz no se trabe.
import { Match, type Cmd, type MatchInit } from './engine.ts';

let m: Match | null = null, speed = 2, paused = false, timer = 0, acc = 0, sent = 0, last = 0, ticks = 0, ended = false;
const post = (full: boolean) => {
  if (!m) return;
  const events = m.events.slice(sent); sent = m.events.length;
  postMessage({ type: 'frame', f: m.frame(), events, roster: full || events.length ? m.roster() : undefined, stats: full || events.length ? m.result().stats : undefined, tact: full || events.length ? m.tact : undefined, bench: full || events.length ? m.bench : undefined, subs: m.subs, wait: m.humanWait });
};
function tick() {
  if (!m || ended) return;
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (paused || m.phase === 'ht' || m.humanWait) { post(ticks++ % 15 === 0); return; }
  acc += dt * speed;
  while (acc >= 0.1 && m.phase === 'juego' && !m.humanWait) { m.step(); acc -= 0.1; if (Math.floor(m.t * 10) % 50 === 0) m.aiManage(); }
  post(ticks++ % 15 === 0);
  if (m.phase === 'fin') finish();
}
function finish() { if (!m || ended) return; ended = true; clearInterval(timer); post(true); postMessage({ type: 'end', result: m.result() }); }

onmessage = (e: MessageEvent) => {
  const d = e.data as { type: string; init?: MatchInit; v?: number | boolean; cmd?: Cmd };
  if (d.type === 'init' && d.init) { m = new Match(d.init); speed = 2; paused = false; acc = 0; sent = 0; ended = false; last = performance.now(); clearInterval(timer); timer = setInterval(tick, 33) as unknown as number; post(true); }
  else if (!m) return;
  else if (d.type === 'speed') speed = d.v as number;
  else if (d.type === 'pause') paused = d.v as boolean;
  else if (d.type === 'cmd' && d.cmd) { m.cmd(d.cmd); post(true); }
  else if (d.type === 'skip') { m.finish(); finish(); }
};
