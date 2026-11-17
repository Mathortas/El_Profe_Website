// Versiones del guardado. Cada vez que cambia la forma de la partida se suma un paso acá,
// para que una partida vieja se pueda seguir jugando.
import type { Game } from './core.ts';

export const SAVE_V = 2;

/** Cada paso lleva una partida de la versión N a la N+1. */
const STEPS: Record<number, (g: Game) => void> = {
  // 2: estilo de juego, jugada de córner, pateadores, órdenes individuales y cansancio dentro de la fecha.
  1: g => {
    g.lineup.tac.estilo ??= 0; g.lineup.tac.corner ??= 0; g.lineup.tac.ord ??= {};
    g.lineup.fk ??= 0; g.lineup.ck ??= 0;
    for (const p of g.players) p.fat ??= 0;
  },
};

/** Deja la partida en la versión actual. Devuelve null si no se puede leer o si viene de una versión más nueva. */
export function migrate(raw: unknown): Game | null {
  const g = raw as Partial<Game> | null;
  if (!g || typeof g !== 'object' || !Array.isArray(g.players) || !g.lineup?.tac || !g.nations || !g.me) return null;
  let v = Number(g.v) || 1;
  if (v > SAVE_V) return null;
  for (; v < SAVE_V; v++) STEPS[v]?.(g as Game);
  g.v = SAVE_V;
  return g as Game;
}
