// Prueba sin interfaz: juega ciclos completos con decisiones automáticas.
import { readFileSync } from 'node:fs';
import type { RawWorld } from '../src/game/players.ts';
import { afterPost, closeStop, confirmSquad, curFx, curStop, doAct, finishMatch, matchInit, myPool, nat, newGame, toLista } from '../src/game/flow.ts';
import { resolveEvent } from '../src/game/events.ts';
import { Match } from '../src/game/engine.ts';
import { elimTable, rankOf, stopLabel } from '../src/game/world.ts';
import { ageOf } from '../src/game/core.ts';

const raw: RawWorld = JSON.parse(readFileSync(new URL('../src/data/world.json', import.meta.url), 'utf8'));
const me = process.argv[2] ?? 'PER', cycles = Number(process.argv[3] ?? 1);
const g = newGame(raw, me, 'Prueba', 42);
console.log('objetivo:', g.goal, '| fuerza', nat(g, me).str.toFixed(1), '| ranking', rankOf(g, me), '| jugadores', g.players.length);
const t0 = Date.now(); let evs = 0;
const flush = () => { while (g.pending.length) { resolveEvent(g, 0, 0); evs++; } };
while (g.ph !== 'fin' && g.cycle < 2026 + cycles * 4) {
  const s = curStop(g), label = stopLabel(s);
  flush(); doAct(g, 'rival', false); doAct(g, 'micro', false); doAct(g, 'gira', true);
  toLista(g); confirmSquad(g); flush();
  const out: string[] = [];
  while (g.ph === 'previa') {
    const fx = curFx(g)!; const res = new Match(matchInit(g)).finish();
    finishMatch(g, res); flush();
    out.push(`${fx.comp} ${nat(g, fx.h).c} ${res.gh}-${res.ga}${res.pens ? ` (${res.pens[0]}-${res.pens[1]}p)` : ''} ${nat(g, fx.a).c}`);
    afterPost(g);
  }
  console.log(`${label.padEnd(30)} ${out.join(' | ')}  · fed ${g.meters.fed} pren ${g.meters.prensa} hin ${g.meters.hinchas} vest ${g.meters.vestuario} quim ${g.meters.quimica} rk ${rankOf(g, me)}`);
  const wasTour = s.kind === 'torneo';
  closeStop(g);
  if (wasTour) console.log('   →', g.history[0]?.text);
  if (s.comp === 'EL' && s.rounds?.includes(17)) { console.log(elimTable(g).map((r, i) => `${i + 1}.${r.c} ${r.pts}`).join('  ')); console.log('   →', g.history[0]?.text); }
}
const pool = myPool(g).sort((a, b) => b.ovr - a.ovr);
console.log('fin:', g.over ?? 'sigue', '| récord', JSON.stringify(g.record), '| eventos', evs, '| ms', Date.now() - t0, '| jugadores', g.players.length, '| juveniles propios', pool.filter(p => p.gen).length);
console.log('mejores:', pool.slice(0, 8).map(p => `${p.n} ${p.ovr}/${p.pot} (${ageOf(p, curStop(g).y)}${p.gen ? ', juvenil' : ''})`).join(' · '));
console.log('mensajes:', g.inbox.slice(0, 4).map(m => `[${m.from}] ${m.text}`).join('\n          '));
console.log('guardado:', (JSON.stringify(g).length / 1e6).toFixed(2), 'MB');
