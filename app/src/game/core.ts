// Tipos y utilidades base del juego. Todo aquí es serializable: el guardado es el objeto Game tal cual.

export type Pos = 'POR' | 'LI' | 'CI' | 'DFC' | 'LD' | 'CD' | 'MCD' | 'MI' | 'MC' | 'MD' | 'MCO' | 'EI' | 'DC' | 'ED';
export type Comp = 'AM' | 'EL' | 'CA' | 'MU' | 'RE';
export const COMP_NAME: Record<Comp, string> = { AM: 'Amistoso', EL: 'Eliminatorias', CA: 'Copa América', MU: 'Mundial', RE: 'Repechaje' };

export interface P {
  id: number; n: string; nat: string; nat2: string; by: number; bm: number;
  pos: Pos; foot: string; h: number; val: number; club: string; lg: string;
  ovr: number; pot: number; six: number[];           // RIT, TIR, PAS, REG, DEF, FIS
  form: number;                                       // -2..2
  mins: number;                                       // 0..1, cuánto juega en su club
  caps: number; ig: number;
  per: number[];                                      // ambición, profesionalismo, temple, liderazgo (1..20)
  curve: number;                                      // 0 precoz, 1 tardío, 2 meseta, 3 parejo
  inj: number; injWhat?: string;                      // fechas que le quedan de baja
  fat?: number;                                       // 0..1, cansancio acumulado dentro de la fecha
  yel: number; sus: number;
  rel: number;                                        // relación con el DT, 0..100
  ret: number;                                        // 0 activo, 1 dejó la selección, 2 retirado
  gen?: 1; seen: number;                              // juvenil generado y cuánto se sabe de él (0..1)
  last: number[];                                     // últimas notas con la selección
  u21: number; tied: boolean;                         // partidos oficiales antes de los 21 y si ya quedó atado
}

export interface Nation { c: string; n: string; iso: string; conf: string; pts: number; str: number; youth: number }
/** Órdenes individuales. Sin pelota: sube, queda, abre, cierra, fuerte. Con pelota: tira, encara, simple. */
export type Order = 'sube' | 'queda' | 'abre' | 'cierra' | 'fuerte' | 'tira' | 'encara' | 'simple';
/**
 * `corner`: 0 variado, 1 primer palo, 2 segundo palo, 3 en corto. `ord`: órdenes por id de jugador.
 * `estilo`: 0 equilibrado, 1 contraataque, 2 posesión, 3 por las bandas, 4 juego directo.
 * `marca`: [id del que marca, id del rival marcado].
 */
export interface Tactics { form: string; ment: number; pres: number; linea: number; ancho: number; ritmo: number; corner?: number; estilo?: number; marca?: [number, number]; ord?: Record<number, Order[]> }
export interface Lineup { xi: number[]; bench: number[]; cap: number; pk: number; fk?: number; ck?: number; tac: Tactics }

export interface Fx {
  id: number; comp: Comp; h: string; a: string; label: string; neutral?: boolean;
  venue?: number; gh?: number; ga?: number; pens?: [number, number]; ko?: boolean; round?: number;
}
export interface Stop { y: number; m: string; kind: 'fecha' | 'torneo'; comp: Comp; n: number; rounds?: number[] }
export interface TM { h: string; a: string; gh?: number; ga?: number; pens?: [number, number]; g?: number; md?: number }
export interface Tour { id: 'CA' | 'MU'; y: number; teams: string[]; groups: string[][]; gm: TM[]; ko: TM[][]; stage: number; champ?: string; host: string }
export interface Msg { id: number; who: 'fed' | 'med' | 'club' | 'prensa' | 'ct' | 'jug'; from: string; text: string; when: string; read?: boolean }
export interface Pending { ev: string; who?: number; rival?: string }
/** `an`: análisis del partido (remates, zonas, lectura táctica y lo que dijo el ayudante). Solo se guarda en los últimos partidos. */
export interface MatchLog { fx: Fx; my: number; their: number; rating: Record<number, number>; scorers: string[]; stats: number[][]; note?: string; an?: { shots: number[][]; heat: number[][]; tact: number[][]; sta: number[]; read: { tono: 'bien' | 'ojo' | 'dato'; texto: string }[] } }

export interface Game {
  v: number; seed: number; me: string; dt: string; started: number;
  cycle: number;                                      // año en que arranca el ciclo
  stops: Stop[]; stop: number; md: number;
  ph: 'entre' | 'lista' | 'previa' | 'partido' | 'post' | 'cierre' | 'fin';
  players: P[]; nations: Record<string, Nation>;
  squad: number[]; lineup: Lineup; fx: Fx[];          // partidos tuyos de la fecha en curso
  elim: { rounds: [string, string][][]; res: ([number, number] | null)[][]; done: number };
  tour: Tour | null; qualified: string[] | null;
  meters: { fed: number; prensa: number; hinchas: number; vestuario: number; clubes: number; quimica: number };
  delta: Partial<Game['meters']>;
  goal: string; goalKey: string;
  acts: string[]; actsLeft: number; scout: boolean;
  inbox: Msg[]; pending: Pending[]; seenEv: string[]; promises: { who: number; what: string; by: number }[];
  log: MatchLog[]; history: { y: number; text: string }[];
  record: { pj: number; g: number; e: number; p: number; gf: number; gc: number };
  next: number; over?: string; lastTalk?: number;
}

// --- Azar con semilla ---
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export type Rng = () => number;
export function rngOf(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngFor = (g: { seed: number }, key: string) => rngOf(hash(`${g.seed}:${key}`));
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];
export const gauss = (r: Rng) => (r() + r() + r() + r() - 2) / 0.58;      // ~N(0,1)
export function poisson(r: Rng, lambda: number): number {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
export const ageOf = (p: P, y: number, month = 7) => y - p.by - (month < p.bm ? 1 : 0);
export const LINE: Record<Pos, 'POR' | 'DEF' | 'MED' | 'DEL'> = {
  POR: 'POR', LI: 'DEF', CI: 'DEF', DFC: 'DEF', LD: 'DEF', CD: 'DEF', MCD: 'MED', MI: 'MED', MC: 'MED', MD: 'MED', MCO: 'MED', EI: 'DEL', DC: 'DEL', ED: 'DEL',
};
