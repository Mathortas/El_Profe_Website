// Prueba sin interfaz: juega muchos partidos y muestra promedios para calibrar el motor.
import { readFileSync } from 'node:fs';
import { buildPlayers, bestXI, type RawWorld } from '../src/game/players.ts';
import { Match, type TeamIn } from '../src/game/engine.ts';
import { FORMS } from '../src/game/data.ts';
import type { P } from '../src/game/core.ts';

const raw: RawWorld = JSON.parse(readFileSync(new URL('../src/data/world.json', import.meta.url), 'utf8'));
const players = buildPlayers(raw, 7);
export function team(code: string, form = '4-3-3', ment = 2): TeamIn {
  const pool = players.filter(p => p.nat === code), by = new Map(pool.map(p => [p.id, p]));
  const xi = bestXI(pool, form), spots = FORMS[form];
  const pin = (p: P) => ({ id: p.id, n: p.n, pos: p.pos, ovr: p.ovr, six: p.six });
  const rest = pool.filter(p => !xi.includes(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 12);
  void spots;
  return { code, name: code, xi: xi.map(id => pin(by.get(id)!)), bench: rest.map(pin), tac: { form, ment, pres: 1, linea: 1, ancho: 1, ritmo: 1 }, boost: 1, drain: 1, ai: true };
}
if (process.argv[1]?.endsWith("sim.ts")) main();
function main() {
const pairs = (process.argv[2] ?? 'PER-CHI,ARG-BOL,BRA-ARG,PER-BRA,ESP-PER').split(',');
const N = Number(process.argv[3] ?? 60);
for (const pr of pairs) {
  const [h, a] = pr.split('-');
  let gh = 0, ga = 0, w = 0, d = 0, l = 0; const st = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; let cards = 0, t0 = Date.now(), maxG = 0;
  for (let i = 0; i < N; i++) {
    const m = new Match({ home: team(h), away: team(a), seed: 1000 + i, ko: false });
    const r = m.finish();
    gh += r.gh; ga += r.ga; if (r.gh > r.ga) w++; else if (r.gh === r.ga) d++; else l++;
    r.stats.forEach((s, k) => { st[k * 2] += s[0]; st[k * 2 + 1] += s[1]; }); cards += Object.keys(r.cards).length; maxG = Math.max(maxG, r.gh + r.ga);
  }
  const f = (x: number) => (x / N).toFixed(1);
  console.log(`${pr}: goles ${f(gh)}-${f(ga)}  G/E/P ${w}/${d}/${l}  pos ${f(st[0])}  tiros ${f(st[2])}-${f(st[3])}  al arco ${f(st[4])}-${f(st[5])}  córners ${f(st[6])}-${f(st[7])}  faltas ${f(st[8])}-${f(st[9])}  pases ${f(st[10])}-${f(st[11])} (buenos ${f(st[12])}-${f(st[13])})  tarjetas ${f(cards)}  máx ${maxG}  ${Math.round((Date.now() - t0) / N)} ms/partido`);
}
}
