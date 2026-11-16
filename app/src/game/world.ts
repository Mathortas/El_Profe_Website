import { type Comp, type Fx, type Game, type Rng, type Stop, type TM, type Tour, clamp, poisson, rngFor } from './core.ts';
import { CONMEBOL, HOSTS_2030, altitudeEdge, homeAltitude, venueOf } from './data.ts';

// --- Calendario de un ciclo de cuatro años ---
export function stopsFor(y: number): Stop[] {
  return [
    { y, m: 'Septiembre–octubre', kind: 'fecha', comp: 'AM', n: 4 },
    { y, m: 'Noviembre', kind: 'fecha', comp: 'AM', n: 2 },
    { y: y + 1, m: 'Marzo', kind: 'fecha', comp: 'AM', n: 2 },
    { y: y + 1, m: 'Junio', kind: 'fecha', comp: 'AM', n: 2 },
    { y: y + 1, m: 'Septiembre–octubre', kind: 'fecha', comp: 'EL', n: 4, rounds: [0, 1, 2, 3] },
    { y: y + 1, m: 'Noviembre', kind: 'fecha', comp: 'EL', n: 2, rounds: [4, 5] },
    { y: y + 2, m: 'Marzo', kind: 'fecha', comp: 'EL', n: 2, rounds: [6, 7] },
    { y: y + 2, m: 'Junio–julio', kind: 'torneo', comp: 'CA', n: 0 },
    { y: y + 2, m: 'Septiembre–octubre', kind: 'fecha', comp: 'EL', n: 4, rounds: [8, 9, 10, 11] },
    { y: y + 2, m: 'Noviembre', kind: 'fecha', comp: 'EL', n: 2, rounds: [12, 13] },
    { y: y + 3, m: 'Marzo', kind: 'fecha', comp: 'EL', n: 2, rounds: [14, 15] },
    { y: y + 3, m: 'Junio', kind: 'fecha', comp: 'EL', n: 2, rounds: [16, 17] },
    { y: y + 3, m: 'Septiembre–octubre', kind: 'fecha', comp: 'AM', n: 4 },
    { y: y + 3, m: 'Noviembre', kind: 'fecha', comp: 'RE', n: 2 },
    { y: y + 4, m: 'Marzo', kind: 'fecha', comp: 'AM', n: 2 },
    { y: y + 4, m: 'Junio–julio', kind: 'torneo', comp: 'MU', n: 0 },
  ];
}
export const stopLabel = (s: Stop) => `${s.m} de ${s.y}`;

// --- Resultado rápido para los partidos que no juegas ---
export function expected(g: Game, h: string, a: string, neutral = false, venueAlt = 0): [number, number] {
  const d = (g.nations[h]?.str ?? 60) - (g.nations[a]?.str ?? 60);
  const alt = neutral ? 0 : altitudeEdge(venueAlt || homeAltitude(h), homeAltitude(a));
  return [clamp(1.3 + 0.085 * d + (neutral ? 0 : 0.32) + alt, 0.2, 3.8), clamp(1.12 - 0.085 * d - alt * 0.5, 0.15, 3.4)];
}
export function quick(g: Game, r: Rng, h: string, a: string, neutral = false, ko = false): { gh: number; ga: number; pens?: [number, number] } {
  const [lh, la] = expected(g, h, a, neutral);
  const gh = poisson(r, lh), ga = poisson(r, la);
  if (ko && gh === ga) { const w = r() < 0.5 + (lh - la) * 0.05; return { gh, ga, pens: w ? [5, 4] : [4, 5] }; }
  return { gh, ga };
}
/** Probabilidades de ganar, empatar y perder para el local, por simulación corta. */
export function odds(g: Game, h: string, a: string, neutral = false, alt = 0): [number, number, number] {
  const [lh, la] = expected(g, h, a, neutral, alt);
  const pmf = (l: number) => { const o = [Math.exp(-l)]; for (let k = 1; k < 9; k++) o.push((o[k - 1] * l) / k); return o; };
  const ph = pmf(lh), pa = pmf(la); let w = 0, d = 0, l = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const p = ph[i] * pa[j]; if (i > j) w += p; else if (i === j) d += p; else l += p; }
  const t = w + d + l; return [w / t, d / t, l / t];
}

// --- Ranking FIFA ---
const WEIGHT: Record<Comp, number> = { AM: 10, EL: 25, RE: 25, CA: 35, MU: 50 };
export function rank(g: Game, comp: Comp, h: string, a: string, gh: number, ga: number, pens?: [number, number], ko = false) {
  const H = g.nations[h], A = g.nations[a]; if (!H || !A) return;
  const we = 1 / (Math.pow(10, -(H.pts - A.pts) / 600) + 1);
  const w = gh > ga ? 1 : gh < ga ? 0 : pens ? (pens[0] > pens[1] ? 0.75 : 0.5) : 0.5;
  const wa = gh < ga ? 1 : gh > ga ? 0 : pens ? (pens[1] > pens[0] ? 0.75 : 0.5) : 0.5;
  const dh = WEIGHT[comp] * (w - we), da = WEIGHT[comp] * (wa - (1 - we));
  H.pts += ko && dh < 0 ? 0 : dh; A.pts += ko && da < 0 ? 0 : da;
}
export const ranking = (g: Game) => Object.values(g.nations).sort((x, y) => y.pts - x.pts);
export const rankOf = (g: Game, c: string) => ranking(g).findIndex(n => n.c === c) + 1;

// --- Eliminatorias: todos contra todos, ida y vuelta ---
export function roundRobin(teams: string[], r: Rng): [string, string][][] {
  const t = [...teams]; for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  const n = t.length, half: [string, string][][] = [];
  for (let k = 0; k < n - 1; k++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) { const x = t[i], y = t[n - 1 - i]; round.push((i === 0 ? k % 2 === 1 : i % 2 === 0) ? [y, x] : [x, y]); }
    half.push(round); t.splice(1, 0, t.pop()!);
  }
  return [...half, ...half.map(rd => rd.map(([h, a]) => [a, h] as [string, string]))];
}
export interface Row { c: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; pts: number }
export function tableOf(teams: string[], matches: { h: string; a: string; gh?: number; ga?: number }[]): Row[] {
  const rows: Record<string, Row> = Object.fromEntries(teams.map(c => [c, { c, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }]));
  for (const m of matches) {
    if (m.gh === undefined || m.ga === undefined) continue;
    const H = rows[m.h], A = rows[m.a]; if (!H || !A) continue;
    H.pj++; A.pj++; H.gf += m.gh; H.gc += m.ga; A.gf += m.ga; A.gc += m.gh;
    if (m.gh > m.ga) { H.g++; A.p++; H.pts += 3; } else if (m.gh < m.ga) { A.g++; H.p++; A.pts += 3; } else { H.e++; A.e++; H.pts++; A.pts++; }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || x.c.localeCompare(y.c));
}
export function elimMatches(g: Game) {
  return g.elim.rounds.flatMap((rd, i) => rd.map(([h, a], j) => ({ h, a, gh: g.elim.res[i]?.[j]?.[0], ga: g.elim.res[i]?.[j]?.[1] })));
}
export const elimTable = (g: Game) => tableOf(CONMEBOL, elimMatches(g));
/** Quiénes clasifican de Sudamérica: los anfitriones ya están; hay tres cupos directos y un repechaje. */
export function elimSlots(g: Game) {
  const rest = elimTable(g).filter(r => !HOSTS_2030.includes(r.c)).map(r => r.c);
  return { direct: rest.slice(0, 3), playoff: rest[3] };
}

// --- Partidos tuyos de una fecha ---
export function fixturesFor(g: Game, s: Stop): Fx[] {
  const r = rngFor(g, `fx:${g.stop}:${s.y}`);
  if (s.comp === 'EL' && s.rounds) {
    return s.rounds.map(rd => {
      const [h, a] = g.elim.rounds[rd].find(m => m.includes(g.me))!;
      return { id: g.next++, comp: 'EL' as Comp, h, a, label: `Fecha ${rd + 1}`, round: rd, venue: 0 };
    });
  }
  if (s.comp === 'RE') {
    const { playoff } = elimSlots(g);
    if (playoff === g.me) {
      const rival = Object.values(g.nations).filter(n => n.conf !== 'CONMEBOL' && n.conf !== 'UEFA').sort((x, y) => y.pts - x.pts).slice(8, 14)[Math.floor(r() * 6)].c;
      return [{ id: g.next++, comp: 'AM', h: g.me, a: friendly(g, r, []), label: 'Amistoso de preparación', venue: 0 }, { id: g.next++, comp: 'RE', h: g.me, a: rival, label: 'Repechaje', neutral: true, ko: true }];
    }
  }
  const used: string[] = [];
  return Array.from({ length: s.n }, (_, i) => {
    const rival = friendly(g, r, used); used.push(rival);
    const home = i % 2 === 0;
    return { id: g.next++, comp: 'AM' as Comp, h: home ? g.me : rival, a: home ? rival : g.me, label: 'Amistoso', venue: 0 };
  });
}
function friendly(g: Game, r: Rng, used: string[]): string {
  const all = ranking(g), mine = all.findIndex(n => n.c === g.me);
  const near = all.filter((n, i) => n.c !== g.me && !used.includes(n.c) && Math.abs(i - mine) <= 28);
  return near[Math.floor(r() * near.length)].c;
}

// --- Torneos con grupos y eliminación directa ---
export function createTour(g: Game, id: 'CA' | 'MU', y: number): Tour {
  const r = rngFor(g, `torneo:${id}:${y}`);
  const byPts = (cs: string[]) => [...cs].sort((a, b) => g.nations[b].pts - g.nations[a].pts);
  let teams: string[];
  if (id === 'CA') teams = [...CONMEBOL, ...byPts(Object.keys(g.nations).filter(c => g.nations[c].conf === 'CONCACAF')).slice(0, 6)];
  else teams = g.qualified ?? qualify(g);
  const nG = teams.length / 4, pots = [0, 1, 2, 3].map(k => byPts(teams).slice(k * nG, (k + 1) * nG));
  // Tu selección y el anfitrión no dependen del sorteo para existir, pero el resto se mezcla dentro de cada bombo.
  pots.forEach(p => { for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } });
  const groups = Array.from({ length: nG }, (_, i) => pots.map(p => p[i]));
  const gm: TM[] = [];
  groups.forEach((t, gi) => [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]].forEach(([a, b, c, d], md) => { gm.push({ h: t[a], a: t[b], g: gi, md }, { h: t[c], a: t[d], g: gi, md }); }));
  return { id, y, teams, groups, gm, ko: [], stage: 0, host: id === 'CA' ? 'USA' : 'ESP' };
}
export const KO_NAMES = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
export const koName = (t: Tour, round: number) => KO_NAMES[KO_NAMES.length - (t.id === 'CA' ? 3 : 5) + round];
export const groupTable = (t: Tour, gi: number) => tableOf(t.groups[gi], t.gm.filter(m => m.g === gi));
function seedKO(t: Tour): TM[] {
  const tabs = t.groups.map((_, gi) => groupTable(t, gi));
  if (t.id === 'CA') return [[0, 1], [1, 0], [2, 3], [3, 2]].map(([x, y]) => ({ h: tabs[x][0].c, a: tabs[y][1].c }));
  const key = (row: Row) => row.pts * 10000 + (row.gf - row.gc) * 100 + row.gf;
  const firsts = tabs.map(tb => tb[0]).sort((a, b) => key(b) - key(a)), seconds = tabs.map(tb => tb[1]).sort((a, b) => key(b) - key(a));
  const thirds = tabs.map(tb => tb[2]).sort((a, b) => key(b) - key(a)).slice(0, 8);
  const seeded = [...firsts, ...seconds, ...thirds].map(x => x.c);
  return Array.from({ length: 16 }, (_, i) => ({ h: seeded[i], a: seeded[31 - i] }));
}
export const winnerOf = (m: TM) => (m.gh! > m.ga! || (m.gh === m.ga && m.pens && m.pens[0] > m.pens[1]) ? m.h : m.a);
/** El partido tuyo que toca en la etapa actual, si sigues en carrera. */
export function myTourMatch(g: Game): TM | null {
  const t = g.tour; if (!t || t.champ) return null;
  const list = t.stage < 3 ? t.gm.filter(m => m.md === t.stage) : t.ko[t.stage - 3] ?? [];
  return list.find(m => (m.h === g.me || m.a === g.me) && m.gh === undefined) ?? null;
}
/** Juega lo que falta de la etapa (lo tuyo ya debe estar cargado) y avanza a la siguiente. */
export function playStage(g: Game) {
  const t = g.tour!; const r = rngFor(g, `etapa:${t.id}:${t.y}:${t.stage}`);
  const isKO = t.stage >= 3;
  const list = isKO ? t.ko[t.stage - 3] : t.gm.filter(m => m.md === t.stage);
  for (const m of list) {
    if (m.gh === undefined) { const q = quick(g, r, m.h, m.a, true, isKO); m.gh = q.gh; m.ga = q.ga; m.pens = q.pens; rank(g, t.id, m.h, m.a, q.gh, q.ga, q.pens, isKO); }
  }
  t.stage++;
  if (t.stage === 3) t.ko.push(seedKO(t));
  else if (t.stage > 3) {
    const prev = t.ko[t.stage - 4];
    if (prev.length === 1) { t.champ = winnerOf(prev[0]); return; }
    const w = prev.map(winnerOf);
    t.ko.push(Array.from({ length: w.length / 2 }, (_, i) => ({ h: w[i * 2], a: w[i * 2 + 1] })));
  }
}
export function tourFx(g: Game, m: TM): Fx {
  const t = g.tour!;
  return { id: g.next++, comp: t.id, h: m.h, a: m.a, neutral: true, ko: t.stage >= 3, label: t.stage < 3 ? `Grupo ${String.fromCharCode(65 + (m.g ?? 0))} · fecha ${t.stage + 1}` : koName(t, t.stage - 3) };
}

/** Las 48 del Mundial: anfitriones, Sudamérica por la tabla y el resto por cupos con algo de azar. */
export function qualify(g: Game): string[] {
  const r = rngFor(g, `clasificados:${g.cycle}`);
  const { direct, playoff } = elimSlots(g);
  const out = new Set<string>([...HOSTS_2030.filter(c => g.nations[c]), ...direct]);
  const quota: Record<string, number> = { UEFA: 16, CAF: 10, AFC: 8, CONCACAF: 6, OFC: 1 };
  for (const conf in quota) {
    const cands = Object.values(g.nations).filter(n => n.conf === conf).map(n => ({ c: n.c, s: n.str + (r() - 0.5) * 9 })).sort((a, b) => b.s - a.s);
    let need = quota[conf] - [...out].filter(c => g.nations[c].conf === conf).length;
    for (const c of cands) { if (need <= 0) break; if (!out.has(c.c)) { out.add(c.c); need--; } }
  }
  const madeIt = g.log.some(l => l.fx.comp === 'RE' && ((l.fx.h === g.me && l.my > l.their) || (l.fx.a === g.me && l.my > l.their) || l.note === 'pen'));
  if (playoff && (playoff === g.me ? madeIt : r() < 0.55)) out.add(playoff);
  const rest = Object.values(g.nations).filter(n => !out.has(n.c) && n.conf !== 'CONMEBOL').sort((a, b) => b.str - a.str);
  while (out.size < 48 && rest.length) out.add(rest.shift()!.c);
  return [...out];
}

export const venueFor = (g: Game, fx: Fx) => (fx.neutral ? null : venueOf(fx.h, fx.h === g.me ? fx.venue ?? 0 : 0));
