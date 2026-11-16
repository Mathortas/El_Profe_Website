import { Match } from '../src/game/engine.ts';
import { team } from './sim.ts';
const m = new Match({ home: team('PER'), away: team('BRA'), seed: 5, ko: false });
let prev = '';
while (m.phase !== 'fin') {
  if (m.phase === 'ht') m.cmd({ type: 'resume' });
  const b = m.ball; const before = JSON.stringify({ s: b.state, x: b.x, y: b.y, tx: b.tx, ty: b.ty, dur: b.dur, air: b.air, shot: b.shot, to: b.to, last: b.last, restart: m.restart });
  m.step();
  const bad = m.ps.find(p => Number.isNaN(p.x) || Number.isNaN(p.sta));
  if (Number.isNaN(b.x) || bad) { console.log('t', m.t.toFixed(1), 'antes', before, '\nprev', prev, '\nahora', b.state, b.x, b.tx, bad ? [bad.team, bad.role, bad.x, bad.vx, bad.sta, bad.six] : ''); break; }
  prev = before;
}
