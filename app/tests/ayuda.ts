// Ayudas para las pruebas: cargar el mundo y jugar una partida entera con decisiones automáticas.
import { readFileSync } from 'node:fs';
import type { Game } from '../src/game/core.ts';
import type { RawWorld } from '../src/game/players.ts';
import { afterPost, closeStop, confirmSquad, curFx, doAct, finishMatch, matchInit, newGame, toLista } from '../src/game/flow.ts';
import { resolveEvent } from '../src/game/events.ts';
import { Match } from '../src/game/engine.ts';

export const raw: RawWorld = JSON.parse(readFileSync(new URL('../src/data/world.json', import.meta.url), 'utf8'));
export const nueva = (me: string, seed = 42) => newGame(raw, me, 'Prueba', seed);
const resolver = (g: Game) => { let n = 0; while (g.pending.length && n++ < 50) resolveEvent(g, 0, 0); };

/** Juega una parada completa: entre fechas, lista y todos los partidos. Devuelve cuántos partidos jugó. */
export function jugarParada(g: Game): number {
  let n = 0;
  resolver(g); doAct(g, 'rival', false); doAct(g, 'micro', false);
  toLista(g); confirmSquad(g); resolver(g);
  while (g.ph === 'previa') { finishMatch(g, new Match(matchInit(g)).finish()); resolver(g); afterPost(g); n++; if (n > 12) throw new Error('la fecha no termina'); }
  closeStop(g);
  return n;
}
/** Juega hasta terminar el ciclo que está en curso. */
export function jugarCiclo(g: Game): number {
  const ciclo = g.cycle; let n = 0, vueltas = 0;
  while (g.ph !== 'fin' && g.cycle === ciclo) { n += jugarParada(g); if (vueltas++ > 40) throw new Error('el ciclo no termina'); }
  return n;
}
