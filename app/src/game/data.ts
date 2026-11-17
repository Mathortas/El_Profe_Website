import type { Pos } from './core.ts';

/** Formaciones en metros (ataque hacia la derecha, y=0 es la banda izquierda). */
export type Spot = [Pos, number, number];
export const FORMS: Record<string, Spot[]> = {
  '4-3-3': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MCD', 41, 34], ['MC', 53, 21], ['MC', 53, 47], ['EI', 74, 11], ['DC', 80, 34], ['ED', 74, 57]],
  '4-2-3-1': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MCD', 41, 26], ['MCD', 41, 42], ['EI', 64, 11], ['MCO', 61, 34], ['ED', 64, 57], ['DC', 81, 34]],
  '4-4-2': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MI', 55, 10], ['MC', 48, 27], ['MC', 48, 41], ['MD', 55, 58], ['DC', 77, 27], ['DC', 77, 41]],
  '3-5-2': [['POR', 5, 34], ['DFC', 22, 19], ['DFC', 20, 34], ['DFC', 22, 49], ['CI', 50, 8], ['MCD', 40, 34], ['MC', 54, 24], ['MC', 54, 44], ['CD', 50, 60], ['DC', 76, 27], ['DC', 76, 41]],
  '5-3-2': [['POR', 5, 34], ['CI', 33, 8], ['DFC', 20, 22], ['DFC', 18, 34], ['DFC', 20, 46], ['CD', 33, 60], ['MC', 49, 21], ['MCD', 45, 34], ['MC', 49, 47], ['DC', 74, 27], ['DC', 74, 41]],
  '4-1-4-1': [['POR', 5, 34], ['LI', 27, 9], ['DFC', 22, 26], ['DFC', 22, 42], ['LD', 27, 59], ['MCD', 38, 34], ['MI', 58, 10], ['MC', 52, 26], ['MC', 52, 42], ['MD', 58, 58], ['DC', 80, 34]],
};

/** Qué tan bien rinde un jugador de puesto `a` jugando en `b` (1 = natural). */
const NEAR: Record<string, string[]> = {
  POR: [], LI: ['CI', 'LD', 'MI'], CI: ['LI', 'MI', 'EI'], DFC: ['MCD', 'LD', 'LI'], LD: ['CD', 'LI', 'MD'], CD: ['LD', 'MD', 'ED'],
  MCD: ['MC', 'DFC'], MI: ['EI', 'CI', 'MC', 'LI'], MC: ['MCD', 'MCO', 'MI', 'MD'], MD: ['ED', 'CD', 'MC', 'LD'], MCO: ['MC', 'DC', 'EI', 'ED'],
  EI: ['MI', 'ED', 'DC', 'MCO'], DC: ['MCO', 'EI', 'ED'], ED: ['MD', 'EI', 'DC', 'MCO'],
};
export function fit(a: Pos, b: Pos): number {
  if (a === b) return 1;
  if (a === 'POR' || b === 'POR') return 0.35;
  const i = NEAR[a].indexOf(b);
  return i < 0 ? 0.8 : i < 2 ? 0.95 : 0.9;
}

/** Nivel relativo de cada liga (1 = la más fuerte). Las que no están valen 0,6. */
export const LEAGUE: Record<string, number> = {
  GB1: 1, ES1: 0.97, IT1: 0.95, L1: 0.95, FR1: 0.9, PO1: 0.82, NL1: 0.82, BRA1: 0.8, BE1: 0.78, TR1: 0.76, ARG1: 0.74,
  MEX1: 0.72, SA1: 0.72, MLS1: 0.7, RU1: 0.7, SC1: 0.66, GR1: 0.66, DK1: 0.66, A1: 0.66, C1: 0.66, TS1: 0.66, JAP1: 0.66,
  BRA2: 0.62, COL1: 0.62, URU1: 0.6, ECU1: 0.6, CHI1: 0.58, PAR1: 0.58, PER1: 0.55, BOL1: 0.5, VEN1: 0.5,
};
/** Ligas del propio país de cada selección. */
export const HOME: Record<string, string[]> = {
  PER: ['PER1'], COL: ['COL1'], CHI: ['CHI1'], ECU: ['ECU1'], URU: ['URU1'], PAR: ['PAR1'], BOL: ['BOL1'], VEN: ['VEN1'], ARG: ['ARG1'], BRA: ['BRA1', 'BRA2'],
  ENG: ['GB1'], ESP: ['ES1'], ITA: ['IT1'], GER: ['L1'], FRA: ['FR1'], POR: ['PO1'], NED: ['NL1'], BEL: ['BE1'], TUR: ['TR1'], MEX: ['MEX1'], USA: ['MLS1'], KSA: ['SA1'],
  RUS: ['RU1'], SCO: ['SC1'], GRE: ['GR1'], DEN: ['DK1'], AUT: ['A1'], SUI: ['C1'], CZE: ['TS1'], JPN: ['JAP1'], AUS: ['AUS1'], CRO: ['KR1'], NOR: ['NO1'], POL: ['PL1'],
  ROU: ['RO1'], KOR: ['RSK1'], SWE: ['SE1'], SRB: ['SER1'], UKR: ['UKR1'],
};
const SOUTH = new Set(['PER1', 'COL1', 'CHI1', 'ECU1', 'URU1', 'PAR1', 'BOL1', 'VEN1', 'BRA2']);
/** Juega fuera de su país. Sin liga conocida se toma como liga local. */
export const abroad = (p: { nat: string; lg: string }) => !!p.lg && !(HOME[p.nat] ?? []).includes(p.lg);
/** Las ligas sudamericanas chicas reciben a los del país y a sudamericanos de cierto nivel. */
export const canJoin = (nat: string, lg: string, ovr: number) => !SOUTH.has(lg) || (HOME[nat] ?? []).includes(lg) || (nat in LOCAL && ovr >= 67);
export const LOCAL: Record<string, number> = { BRA: 0.8, ARG: 0.74, COL: 0.62, URU: 0.6, ECU: 0.6, CHI: 0.58, PAR: 0.58, PER: 0.55, BOL: 0.5, VEN: 0.5 };

/** Sedes de local: [estadio, ciudad, altura en metros, capacidad en miles]. */
export type Venue = [string, string, number, number];
export const VENUES: Record<string, Venue[]> = {
  PER: [['Estadio Nacional', 'Lima', 150, 43], ['Monumental', 'Lima', 250, 80], ['Monumental de la UNSA', 'Arequipa', 2335, 40], ['Inca Garcilaso de la Vega', 'Cusco', 3360, 42]],
  ARG: [['Monumental', 'Buenos Aires', 10, 85], ['La Bombonera', 'Buenos Aires', 10, 54], ['Mario Alberto Kempes', 'Córdoba', 400, 57]],
  BRA: [['Maracanã', 'Río de Janeiro', 10, 78], ['Morumbi', 'São Paulo', 760, 66], ['Mané Garrincha', 'Brasilia', 1170, 72]],
  URU: [['Centenario', 'Montevideo', 40, 60], ['Campeón del Siglo', 'Montevideo', 40, 40]],
  COL: [['Metropolitano', 'Barranquilla', 20, 46], ['El Campín', 'Bogotá', 2640, 39]],
  CHI: [['Nacional', 'Santiago', 570, 48], ['Zorros del Desierto', 'Calama', 2260, 12]],
  ECU: [['Rodrigo Paz Delgado', 'Quito', 2780, 41], ['Monumental', 'Guayaquil', 10, 59]],
  PAR: [['Defensores del Chaco', 'Asunción', 100, 42], ['La Nueva Olla', 'Asunción', 100, 45]],
  BOL: [['Hernando Siles', 'La Paz', 3640, 41], ['Municipal de El Alto', 'El Alto', 4090, 25], ['Tahuichi Aguilera', 'Santa Cruz', 420, 38]],
  VEN: [['Monumental', 'Maturín', 70, 52], ['Olímpico de la UCV', 'Caracas', 900, 24]],
};
export const venueOf = (nat: string, i = 0): Venue => (VENUES[nat] ?? [['Estadio Nacional', '', 100, 40]])[i] ?? VENUES[nat][0];
/** Ventaja en goles esperados por jugar en altura contra un rival que no está acostumbrado. */
export const altitudeEdge = (meters: number, rivalHome: number) => Math.min(0.75, Math.max(0, (meters - Math.max(rivalHome, 1200)) / 1000) * 0.335);
export const homeAltitude = (nat: string) => Math.max(...(VENUES[nat] ?? [['', '', 0, 0]]).map(v => v[2]));

/** Colores de camiseta: [principal, secundario]. */
export const KIT: Record<string, [string, string]> = {
  PER: ['#ffffff', '#d91023'], ARG: ['#75aadb', '#ffffff'], BRA: ['#ffdc02', '#009739'], URU: ['#5cb8e6', '#111111'], COL: ['#fcd116', '#003893'],
  CHI: ['#d52b1e', '#0039a6'], ECU: ['#ffd100', '#034ea2'], PAR: ['#d52b1e', '#ffffff'], BOL: ['#007934', '#ffffff'], VEN: ['#7b1e3a', '#ffcc00'],
  ESP: ['#c60b1e', '#ffc400'], FRA: ['#21304d', '#ffffff'], ENG: ['#ffffff', '#1b2a5c'], POR: ['#b3122a', '#046a38'], GER: ['#ffffff', '#111111'],
  ITA: ['#1b6fc2', '#ffffff'], NED: ['#f36c21', '#111111'], BEL: ['#c8102e', '#111111'], CRO: ['#ffffff', '#e30a17'], MEX: ['#006847', '#ffffff'],
  USA: ['#ffffff', '#1f3b73'], JPN: ['#1c3f94', '#ffffff'], KOR: ['#e4002b', '#111111'], MAR: ['#c1272d', '#006233'], SEN: ['#ffffff', '#00853f'],
  CAN: ['#d80621', '#ffffff'], CRC: ['#d21034', '#002b7f'], PAN: ['#d21034', '#ffffff'], HON: ['#ffffff', '#0073cf'], JAM: ['#fed100', '#009b3a'],
};
const PALETTE: [string, string][] = [['#2f6fb5', '#ffffff'], ['#c0392b', '#ffffff'], ['#1e8a4c', '#ffffff'], ['#e0a526', '#1a1a1a'], ['#ffffff', '#2c3e50'], ['#6b3fa0', '#ffffff'], ['#1a1a1a', '#e8e8e8'], ['#e67e22', '#ffffff']];
export function kitOf(code: string): [string, string] {
  if (KIT[code]) return KIT[code];
  let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
/** Evita que los dos equipos salgan del mismo color. */
export function kits(home: string, away: string): [[string, string], [string, string]] {
  const a = kitOf(home); let b = kitOf(away);
  const lum = (c: string) => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; };
  const dist = (x: string, y: string) => { const p = parseInt(x.slice(1), 16), q = parseInt(y.slice(1), 16); return Math.abs((p >> 16) - (q >> 16)) + Math.abs(((p >> 8) & 255) - ((q >> 8) & 255)) + Math.abs((p & 255) - (q & 255)); };
  if (dist(a[0], b[0]) < 140) b = dist(a[0], b[1]) > 140 ? [b[1], b[0]] : lum(a[0]) > 128 ? ['#1c2530', '#ffffff'] : ['#f2f2f2', '#1c2530'];
  return [a, b];
}

export const CONMEBOL = ['ARG', 'BRA', 'URU', 'COL', 'ECU', 'PAR', 'CHI', 'PER', 'VEN', 'BOL'];
export const HOSTS_2030 = ['ESP', 'POR', 'MAR', 'ARG', 'URU', 'PAR'];
