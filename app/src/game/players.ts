import { type Game, type Nation, type P, type Pos, type Rng, ageOf, clamp, gauss, hash, pick, rngFor, rngOf } from './core.ts';
import { FORMS, HOME, LEAGUE, LOCAL, canJoin, fit } from './data.ts';

export interface RawWorld { asof: string; nations: [string, string, string, string, number][]; leagues: Record<string, [string, string]>; players: (string | number)[][] }

// Reparto del nivel entre RIT, TIR, PAS, REG, DEF, FIS según el puesto.
const SHAPE: Record<Pos, number[]> = {
  POR: [-12, -30, -8, -20, 2, 1], LI: [4, -10, 0, 1, 2, 1], LD: [4, -10, 0, 1, 2, 1], CI: [5, -8, 1, 3, -1, 1], CD: [5, -8, 1, 3, -1, 1],
  DFC: [-4, -16, -5, -9, 7, 6], MCD: [-3, -8, 2, -2, 5, 5], MC: [0, -3, 5, 3, -2, 0], MI: [5, -2, 3, 4, -6, -2], MD: [5, -2, 3, 4, -6, -2],
  MCO: [1, 3, 5, 6, -14, -5], EI: [7, 2, 0, 6, -18, -5], ED: [7, 2, 0, 6, -18, -5], DC: [3, 7, -5, 2, -22, 3],
};
const PEAK = [[24, 27], [28, 32], [26, 31], [26, 30]];                 // precoz, tardío, meseta, parejo
export const CURVE_NAME = ['Precoz', 'Tardío', 'De meseta', 'Parejo'];

const ageBonus = (age: number) => (age <= 28 ? -Math.min(5, Math.max(0, 23 - age)) : age <= 33 ? Math.min(5, age - 28) : 5 - (age - 33) * 0.9);
function levelFromValue(valK: number, peakK: number, age: number, caps: number): number {
  let v = valK;
  if (age >= 30) v = Math.max(v, peakK * (age >= 34 ? 0.12 : 0.22));
  const base = v > 0 ? 38 + 10.4 * Math.log10(Math.max(v, 25)) : 52 + Math.min(caps, 40) * 0.25;
  return clamp(base + ageBonus(age) + Math.min(caps, 60) / 30, 40, 94);
}
/** Valor de mercado aproximado (en miles) para un nivel y una edad: la inversa de lo anterior. */
export const valueOf = (ovr: number, age: number) => Math.round(Math.pow(10, clamp((ovr - ageBonus(age) - 38) / 10.4, 1.4, 5.4)));

function sixFor(pos: Pos, ovr: number, r: Rng): number[] {
  return SHAPE[pos].map(d => Math.round(clamp(ovr + d + (r() * 8 - 4), 20, 99)));
}

export function buildPlayers(raw: RawWorld, seed: number, year = 2026): P[] {
  return raw.players.map(row => {
    const [id, n, nat, nat2, by, bm, pos, foot, h, val, peak, old, club, lg, mins, games, goals, ast, caps, ig] = row as [number, string, string, string, number, number, Pos, string, number, number, number, number, string, string, number, number, number, number, number, number];
    const r = rngOf(hash(`${seed}:p:${id}`));
    const age = year - by - (7 < bm ? 1 : 0);
    const ovr = Math.round(levelFromValue(val, peak, age, caps));
    const traj = old > 0 && val / old >= 2 ? 3 : old > 0 && val / old >= 1.3 ? 1.5 : 0;
    const pot = Math.round(clamp(age <= 23 ? ovr + (24 - age) * 1.5 + traj + r() * 4 : age <= 27 ? ovr + r() * 2 : ovr, ovr, 96));
    const tracked = !!lg && (games > 0 || val === 0);                              // hay ligas sin datos de minutos
    const share = tracked ? Math.min(1, mins / 2700) : clamp(0.5 + gauss(r) * 0.2, 0.1, 1);
    const prod = games > 0 ? (goals + ast) / games : 0;
    const form = tracked ? (share > 0.75 && prod > 0.4 ? 2 : share > 0.55 ? 1 : share < 0.15 ? -1 : 0) : Math.round(clamp(gauss(r) * 0.8, -1, 1));
    return {
      id, n, nat, nat2, by, bm, pos, foot, h, val, club, lg, ovr, pot, six: sixFor(pos, ovr, r), form, mins: share, caps, ig,
      per: [0, 0, 0, 0].map(() => Math.round(clamp(11 + gauss(r) * 3.5, 1, 20))), curve: Math.floor(r() * 4),
      inj: 0, yel: 0, sus: 0, rel: 50, ret: 0, seen: 1, last: [], u21: age < 21 ? Math.min(caps, 3) : 0, tied: caps > 3,
    } satisfies P;
  });
}

export const poolOf = (g: { players: P[] }, nat: string) => g.players.filter(p => p.nat === nat && p.ret === 0);
export const available = (p: P) => p.inj === 0 && p.sus === 0 && p.ret === 0;
/** Nivel con el que rinde hoy: nivel, forma y encaje en el puesto. */
export const effective = (p: P, at: Pos = p.pos) => (p.ovr + p.form * 1.3) * fit(p.pos, at) * (1 - (p.fat ?? 0) * 0.1);
/** Con cuánto físico arranca un partido según lo que jugó en la fecha. */
export const fresh = (p: P) => 1 - (p.fat ?? 0) * 0.35;

/** Mejor once posible con un grupo de jugadores para una formación. */
export function bestXI(pool: P[], form: string): number[] {
  const spots = FORMS[form] ?? FORMS['4-3-3'];
  const free = new Set(pool.filter(available));
  const xi: number[] = new Array(spots.length).fill(0);
  // Primero los puestos con menos candidatos naturales.
  const order = spots.map((s, i) => ({ i, n: pool.filter(p => p.pos === s[0]).length })).sort((a, b) => a.n - b.n);
  for (const { i } of order) {
    let best: P | null = null, score = -1;
    for (const p of free) { const s = effective(p, spots[i][0]); if (s > score) { score = s; best = p; } }
    if (best) { xi[i] = best.id; free.delete(best); }
  }
  return xi;
}
export function teamRating(pool: P[], form = '4-3-3'): number {
  const spots = FORMS[form] ?? FORMS['4-3-3'];
  const byId = new Map(pool.map(p => [p.id, p]));
  const xi = bestXI(pool, form);
  let sum = 0, n = 0;
  xi.forEach((id, i) => { const p = byId.get(id); if (p) { sum += effective(p, spots[i][0]); n++; } });
  return n ? sum / n : 50;
}
export function refreshStrengths(g: Game) {
  const by: Record<string, P[]> = {};
  for (const p of g.players) if (p.ret === 0) (by[p.nat] ??= []).push(p);
  for (const c in g.nations) g.nations[c].str = teamRating(by[c] ?? []);
}
export const youthOf = (str: number) => clamp((str - 60) * 2.2 + 30, 15, 95);

// --- Paso de un año: edad, crecimiento, clubes, retiros y camada nueva ---
function moveClub(p: P, r: Rng, clubs: Record<string, string[]>) {
  const want = clamp((p.ovr - 56) / 34, 0.4, 1);
  const here = p.lg ? LEAGUE[p.lg] ?? 0.6 : LOCAL[p.nat] ?? 0.5;
  if (Math.abs(want - here) < 0.12 || r() > 0.3) return;
  if (want < here) {                                                               // le queda grande la liga: vuelve a su país o se queda donde está
    const home = (HOME[p.nat] ?? []).find(l => clubs[l]);
    if (!p.lg || !home || p.lg === home) return;
    if ((LEAGUE[home] ?? 0.6) < here) { p.lg = home; p.club = pick(r, clubs[home]); p.mins = clamp(0.55 + gauss(r) * 0.2, 0.1, 1); return; }
  }
  const options = Object.keys(clubs).filter(l => Math.abs((LEAGUE[l] ?? 0.6) - want) < 0.1 && canJoin(p.nat, l, p.ovr));
  if (!options.length) return;
  p.lg = pick(r, options); p.club = pick(r, clubs[p.lg]); p.mins = clamp(0.45 + gauss(r) * 0.2, 0.1, 1);
}

export function rollYear(g: Game, year: number, clubs: Record<string, string[]>, urns: Record<string, [string[], string[]]>) {
  const r = rngFor(g, `año:${year}`);
  for (const p of g.players) {
    if (p.ret === 2) continue;
    const age = ageOf(p, year);
    const [from, to] = PEAK[p.curve];
    let d = 0;
    if (age < from) d = Math.max(0, (p.pot - p.ovr) * (0.16 + 0.1 * p.mins + 0.004 * (p.per[1] - 10) + r() * 0.08)) + (r() - 0.4);
    else if (age <= to) d = r() * 1.2 - 0.6;
    else d = -(age - to) * (0.45 + r() * 0.5) * (p.curve === 0 ? 1.2 : 1);
    const before = p.ovr;
    p.ovr = Math.round(clamp(p.ovr + d, 35, 96));
    if (age > to) p.pot = Math.min(p.pot, p.ovr + 1);
    const real = p.ovr - before;
    if (real !== 0) {
      const w = real > 0 ? [0.6, 1.1, 1.2, 1.1, 1, 1] : [1.7, 0.7, 0.4, 0.8, 0.7, 1.7];
      p.six = p.six.map((v, i) => Math.round(clamp(v + real * w[i], 20, 99)));
    }
    p.val = valueOf(p.ovr, age);
    p.mins = clamp(p.mins + gauss(r) * 0.15 + (p.ovr - 55 - ((p.lg ? LEAGUE[p.lg] ?? 0.6 : LOCAL[p.nat] ?? 0.5) * 34)) / 120, 0.05, 1);
    moveClub(p, r, clubs);
    if (age >= 40 || (age >= 35 && r() < (age - 34) * 0.22)) { p.ret = 2; continue; }
    if (p.nat !== g.me && p.ret === 0 && age >= 34 && r() < 0.25) p.ret = 1;
  }
  for (const c in g.nations) {
    const nt = g.nations[c];
    nt.youth = clamp(nt.youth + gauss(r) * 3, 10, 98);
    const size = nt.conf === 'CONMEBOL' ? 7 : 3;
    for (let i = 0; i < size; i++) g.players.push(newYouth(g, nt, year, r, urns[c], clubs));
  }
  refreshStrengths(g);
}

const POS_MIX: Pos[] = ['POR', 'DFC', 'DFC', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MC', 'MCO', 'EI', 'ED', 'DC', 'DC', 'MI', 'MD'];
const DIASPORA: Record<string, string[]> = { PER: ['ESP', 'ITA', 'USA', 'ARG', 'CHI', 'JPN'], BOL: ['ESP', 'ARG', 'USA'], ECU: ['ESP', 'USA', 'ITA'], COL: ['ESP', 'USA'], VEN: ['ESP', 'USA', 'COL'], PAR: ['ARG', 'ESP'], URU: ['ARG', 'ESP'], CHI: ['ARG', 'ESP', 'SWE'], ARG: ['ESP', 'ITA', 'USA'], BRA: ['POR', 'USA', 'ITA'] };
export function newYouth(g: Game, nt: Nation, year: number, r: Rng, urn: [string[], string[]] | undefined, clubs: Record<string, string[]>): P {
  const pos = pick(r, POS_MIX);
  const pot = Math.round(clamp(52 + nt.youth * 0.28 + gauss(r) * 7, 50, 95));
  const ovr = Math.round(clamp(pot - (12 + r() * 10), 40, 80));
  const name = urn && urn[0].length ? `${pick(r, urn[0])} ${pick(r, urn[1])}` : `Juvenil ${g.next}`;
  const abroad = pot > 80 && r() < 0.3 && clubs.PO1;
  const home = HOME[nt.c]?.[0] ?? '';
  const lg = abroad ? pick(r, ['PO1', 'NL1', 'BE1', 'ES1']) : clubs[home] ? home : '';
  const dia = DIASPORA[nt.c];
  return {
    id: g.next++, n: name, nat: nt.c, nat2: dia && r() < 0.1 ? pick(r, dia) : '', by: year - 17, bm: 1 + Math.floor(r() * 12), pos,
    foot: r() < 0.24 ? 'I' : 'D', h: Math.round(clamp(178 + gauss(r) * 6 + (pos === 'POR' || pos === 'DFC' ? 7 : 0), 162, 200)),
    val: valueOf(ovr, 17), club: lg && clubs[lg] ? pick(r, clubs[lg]) : '', lg, ovr, pot, six: sixFor(pos, ovr, r), form: 0, mins: clamp(0.3 + gauss(r) * 0.15, 0.05, 0.9),
    caps: 0, ig: 0, per: [0, 0, 0, 0].map(() => Math.round(clamp(11 + gauss(r) * 3.5, 1, 20))), curve: Math.floor(r() * 4),
    inj: 0, yel: 0, sus: 0, rel: 50, ret: 0, gen: 1, seen: 0.25, last: [], u21: 0, tied: false,
  };
}

/** Lo que el DT ve del nivel de un juvenil poco conocido: un rango que se cierra al seguirlo. */
export function seenRange(p: P, key: 'ovr' | 'pot'): [number, number] {
  const w = Math.round((1 - p.seen) * (key === 'pot' ? 12 : 6));
  const off = (hash(`${p.id}:${key}`) % (w * 2 + 1)) - w;
  const mid = p[key] + Math.round(off * 0.5);
  return [clamp(mid - w, 30, 99), clamp(mid + w, 30, 99)];
}

export function urnsFrom(raw: RawWorld): Record<string, [string[], string[]]> {
  const u: Record<string, [string[], string[]]> = {};
  for (const row of raw.players) {
    const parts = String(row[1]).split(' ');
    if (parts.length < 2) continue;
    const e = (u[row[2] as string] ??= [[], []]);
    e[0].push(parts[0]); e[1].push(parts[parts.length - 1]);
  }
  return u;
}
export function clubsFrom(raw: RawWorld): Record<string, string[]> {
  const c: Record<string, Set<string>> = {};
  for (const row of raw.players) if (row[13] && row[12]) (c[row[13] as string] ??= new Set()).add(row[12] as string);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, [...v]]));
}
