import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, type TeamIn } from '../src/game/engine.ts';
import { team } from '../scripts/sim.ts';

const jugar = (h: TeamIn, a: TeamIn, seed: number, ko = false) => new Match({ home: h, away: a, seed, ko }).finish();

test('la misma semilla da el mismo partido', () => {
  const a = jugar(team('PER'), team('CHI'), 77), b = jugar(team('PER'), team('CHI'), 77);
  assert.deepEqual([a.gh, a.ga, a.events.length, a.stats], [b.gh, b.ga, b.events.length, b.stats]);
});

test('los promedios del partido se parecen a los reales', () => {
  let goles = 0, tiros = 0, faltas = 0, corners = 0; const n = 40;
  for (let i = 0; i < n; i++) {
    const r = jugar(team(i % 2 ? 'PER' : 'URU'), team(i % 2 ? 'CHI' : 'PAR'), 9000 + i);
    goles += r.gh + r.ga; tiros += r.stats[1][0] + r.stats[1][1]; faltas += r.stats[4][0] + r.stats[4][1]; corners += r.stats[3][0] + r.stats[3][1];
  }
  assert.ok(goles / n > 1.8 && goles / n < 3.5, `goles por partido: ${(goles / n).toFixed(2)}`);
  assert.ok(tiros / n > 16 && tiros / n < 34, `tiros por partido: ${(tiros / n).toFixed(1)}`);
  assert.ok(faltas / n > 14 && faltas / n < 32, `faltas por partido: ${(faltas / n).toFixed(1)}`);
  assert.ok(corners / n > 5 && corners / n < 13, `córners por partido: ${(corners / n).toFixed(1)}`);
});

test('ninguna posición ni nota queda sin número', () => {
  const m = new Match({ home: team('ARG'), away: team('BOL'), seed: 5, ko: false }); m.finish();
  const f = m.frame();
  assert.ok(f.pos.every(Number.isFinite) && f.ball.every(Number.isFinite) && f.sta.every(Number.isFinite));
  assert.ok(Object.values(m.result().rating).every(Number.isFinite));
});

test('todos los estilos, órdenes y jugadas terminan el partido', () => {
  for (let estilo = 0; estilo <= 4; estilo++) {
    const h = team('PER'), a = team('ECU');
    h.tac = { ...h.tac, estilo, corner: estilo % 4, ment: estilo, linea: estilo % 3, pres: estilo % 3, marca: [h.xi[5].id, a.xi[9].id], ord: { [h.xi[9].id]: ['encara', 'tira'], [h.xi[2].id]: ['fuerte', 'queda'], [h.xi[7].id]: ['sube', 'abre'] } };
    const r = jugar(h, a, 300 + estilo);
    assert.ok(r.gh >= 0 && r.ga >= 0 && r.played.length >= 22);
  }
});

test('un partido de eliminación directa siempre tiene ganador', () => {
  for (let i = 0; i < 12; i++) {
    const r = jugar(team('COL'), team('ECU'), 800 + i, true);
    assert.ok(r.gh !== r.ga || (r.pens && r.pens[0] !== r.pens[1]), `semilla ${800 + i} terminó sin ganador`);
  }
});

// Se mira solo a los titulares que terminaron el partido: los que entran llegan frescos.
test('el planteo cambia el partido: presionar alto cansa más que esperar', () => {
  const fisico = (pres: number) => { let s = 0;
    for (let i = 0; i < 12; i++) { const h = team('PER'); h.ai = false; h.tac = { ...h.tac, pres }; const m = new Match({ home: h, away: team('CHI'), seed: 60 + i, ko: false }); m.finish(); const tit = m.roster().filter(p => p.team === 0 && p.on && h.xi.some(q => q.id === p.id)); s += tit.reduce((x, p) => x + p.sta, 0) / tit.length; }
    return s / 12; };
  const espera = fisico(0), alta = fisico(2);
  assert.ok(espera > alta + 0.04, `esperar ${espera.toFixed(2)} · presión alta ${alta.toFixed(2)}`);
});
