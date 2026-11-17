// El recorrido del juego: partida nueva, fechas, convocatoria, partidos y cierre.
import { type Fx, type Game, type Lineup, type Msg, type Order, type P, type Tactics, LINE, ageOf, clamp, gauss, hash, pick, rngFor } from './core.ts';
import { CONMEBOL, FORMS, HOSTS_2030, abroad, altitudeEdge, homeAltitude, venueOf } from './data.ts';
import { type RawWorld, available, bestXI, buildPlayers, clubsFrom, effective, fresh, poolOf, refreshStrengths, rollYear, urnsFrom, youthOf } from './players.ts';
import { createTour, elimSlots, elimTable, fixturesFor, myTourMatch, odds, playStage, qualify, quick, rank, rankOf, roundRobin, stopLabel, stopsFor, tourFx, winnerOf } from './world.ts';
import type { MatchInit, PIn, Result, TeamIn } from './engine.ts';
import { checkPromises, drawEvents } from './events.ts';
import { SAVE_V } from './save.ts';
import { leer } from './lectura.ts';

let CLUBS: Record<string, string[]> = {}, URNS: Record<string, [string[], string[]]> = {};
export let LEAGUES: Record<string, [string, string]> = {};
export function setWorld(raw: RawWorld) { CLUBS = clubsFrom(raw); URNS = urnsFrom(raw); LEAGUES = raw.leagues; }

export const byId = (g: Game) => { const m = new Map<number, P>(); for (const p of g.players) m.set(p.id, p); return m; };
export const myPool = (g: Game) => poolOf(g, g.me);
export const nat = (g: Game, c: string) => g.nations[c] ?? { c, n: c, iso: '', conf: '', pts: 1000, str: 55, youth: 30 };
export const curStop = (g: Game) => g.stops[g.stop];
export const curFx = (g: Game): Fx | undefined => g.fx[g.md];
export function bump(g: Game, d: Partial<Game['meters']>) {
  for (const k in d) { const key = k as keyof Game['meters']; const v = Math.round(d[key]!); g.meters[key] = clamp(g.meters[key] + v, 0, 100); g.delta[key] = (g.delta[key] ?? 0) + v; }
}
export function mail(g: Game, who: Msg['who'], from: string, text: string) { g.inbox.unshift({ id: g.next++, who, from, text, when: stopLabel(curStop(g)) }); if (g.inbox.length > 60) g.inbox.length = 60; }

function goalFor(g: Game): [string, string] {
  const order = [...CONMEBOL].sort((a, b) => g.nations[b].str - g.nations[a].str), i = order.indexOf(g.me);
  if (HOSTS_2030.includes(g.me)) return ['top4', 'Terminar entre los cuatro primeros de las eliminatorias'];
  if (i <= 5) return ['clasificar', `Clasificar al Mundial ${g.cycle + 4}`];
  if (i <= 7) return ['top6', 'Terminar entre los seis primeros de las eliminatorias'];
  return ['pts15', 'Sumar al menos 15 puntos en las eliminatorias'];
}

export function newGame(raw: RawWorld, me: string, dt: string, seed: number): Game {
  setWorld(raw);
  const nations: Game['nations'] = {};
  for (const [c, n, iso, conf, rk] of raw.nations) nations[c] = { c, n, iso, conf, pts: Math.round(1880 * Math.exp(-0.0045 * (rk - 1))), str: 60, youth: 40 };
  const g: Game = {
    v: SAVE_V, seed, me, dt, started: Date.now(), cycle: 2026, stops: stopsFor(2026), stop: 0, md: 0, ph: 'entre',
    players: buildPlayers(raw, seed), nations, squad: [], lineup: { xi: [], bench: [], cap: 0, pk: 0, tac: { form: '4-3-3', ment: 2, pres: 1, linea: 1, ancho: 1, ritmo: 1, estilo: 0, corner: 0, ord: {} } }, fx: [],
    elim: { rounds: [], res: [], done: 0 }, tour: null, qualified: null,
    meters: { fed: 55, prensa: 50, hinchas: 55, vestuario: 60, clubes: 50, quimica: 40 }, delta: {}, goal: '', goalKey: '',
    acts: [], actsLeft: 3, scout: false, inbox: [], pending: [], seenEv: [], promises: [], log: [], history: [],
    record: { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 }, next: 9_000_000,
  };
  refreshStrengths(g);
  for (const c in nations) nations[c].youth = youthOf(nations[c].str);
  g.elim.rounds = roundRobin(CONMEBOL, rngFor(g, 'eliminatorias')); g.elim.res = g.elim.rounds.map(() => []);
  [g.goalKey, g.goal] = goalFor(g);
  startStop(g, true);
  mail(g, 'ct', 'Cuerpo técnico', 'Profe, ya está armada una lista tentativa para la primera fecha. Revísela cuando pueda; la cambiamos donde vea necesario.');
  mail(g, 'fed', 'Federación', `Estimado profesor ${dt}: le damos la bienvenida. El objetivo del ciclo es ${g.goal.charAt(0).toLowerCase() + g.goal.slice(1)}. Cuente con nosotros.`);
  return g;
}

// --- Entre fechas ---
const INJ = ['Desgarro en el isquiotibial', 'Esguince de tobillo', 'Sobrecarga muscular', 'Molestia en la rodilla', 'Contractura en el gemelo'];
export function startStop(g: Game, first = false) {
  const s = curStop(g), r = rngFor(g, `parada:${g.cycle}:${g.stop}`);
  g.ph = 'entre'; g.md = 0; g.acts = []; g.actsLeft = 3; g.scout = false; g.delta = {};
  if (!first) {
    // Los ánimos vuelven de a poco a su nivel normal y el entendimiento se pierde si no se trabaja.
    const mt = g.meters; mt.prensa += Math.round((50 - mt.prensa) * 0.08); mt.hinchas += Math.round((52 - mt.hinchas) * 0.08); mt.vestuario += Math.round((60 - mt.vestuario) * 0.1);
    mt.fed += Math.round((55 - mt.fed) * 0.04); mt.quimica = Math.max(20, mt.quimica - 5); mt.clubes += Math.round((50 - mt.clubes) * 0.06);
    const top = new Set(myPool(g).sort((a, b) => b.ovr - a.ovr).slice(0, 34).map(p => p.id));
    for (const p of myPool(g)) {
      p.fat = 0;
      p.form = clamp(Math.round(p.form * 0.5 + gauss(r) * 0.9 + (p.mins - 0.5) * 1.2), -2, 2);
      if (p.inj > 0) { p.inj--; if (p.inj === 0 && top.has(p.id)) mail(g, 'med', 'Cuerpo médico', `${p.n} recibió el alta y vuelve a estar disponible.`); }
      else if (r() < 0.045) { p.inj = 1 + Math.floor(r() * 3); p.injWhat = pick(r, INJ); if (top.has(p.id)) mail(g, 'med', 'Cuerpo médico', `${p.n}: ${p.injWhat.toLowerCase()} en su club. Baja estimada: ${p.inj === 1 ? 'esta fecha' : `${p.inj} fechas`}.`); }
    }
  }
  if (s.kind === 'torneo') {
    g.tour = createTour(g, s.comp as 'CA' | 'MU', s.y);
    if (g.tour.teams.includes(g.me)) { for (const p of myPool(g)) { p.yel = 0; } g.fx = [tourFx(g, myTourMatch(g)!)]; }
    else g.fx = fixturesFor(g, { ...s, kind: 'fecha', comp: 'AM', n: 2 });
  } else g.fx = fixturesFor(g, s);
  g.squad = g.squad.filter(id => { const p = g.players.find(x => x.id === id); return p && available(p); });
  const rivals = g.fx.map(f => nat(g, f.h === g.me ? f.a : f.h).n);
  const what = s.kind === 'torneo' && g.tour?.teams.includes(g.me) ? `empieza ${s.comp === 'CA' ? 'la Copa América' : 'el Mundial'}; debutamos contra ${rivals[0]}` : `nos esperan ${rivals.join(', ').replace(/, ([^,]*)$/, (_, last: string) => `${/^(i|hi)/i.test(last) ? ' e ' : ' y '}${last}`)}`;
  mail(g, 'fed', 'Federación', `Estimado profesor: en ${s.m.toLowerCase()} ${what}. Quedamos atentos a su lista.`);
  g.pending.push(...drawEvents(g, 'entre', r));
}

export interface Act { id: string; title: string; desc: string }
export const ACTS: Act[] = [
  { id: 'gira', title: 'Gira por el exterior', desc: 'Visitar a los que juegan afuera. Mejora la relación con ellos.' },
  { id: 'clubes', title: 'Recorrer clubes locales', desc: 'Reuniones con técnicos y dirigentes. Mejora el trato con los clubes.' },
  { id: 'micro', title: 'Microciclo con locales', desc: 'Tres días de trabajo con jugadores del torneo local. Suma entendimiento.' },
  { id: 'rival', title: 'Estudiar a los rivales', desc: 'Ver sus últimos partidos. Pequeña ventaja en esta fecha.' },
  { id: 'juveniles', title: 'Seguir juveniles', desc: 'Ver torneos sub-20. Conoces mejor a las promesas.' },
  { id: 'fede', title: 'Reunión con la federación', desc: 'Alinear expectativas con los dirigentes. Sube su confianza.' },
];
export function doAct(g: Game, id: string, staff: boolean) {
  if (g.acts.includes(id) || (!staff && g.actsLeft <= 0) || (staff && g.acts.includes('*'))) return;
  const k = staff ? 0.5 : 1, pool = myPool(g), r = rngFor(g, `accion:${g.stop}:${id}`);
  if (id === 'gira') for (const p of pool) if (abroad(p)) { p.rel = clamp(p.rel + 8 * k, 0, 100); }
  if (id === 'clubes') { bump(g, { clubes: 8 * k }); pool.filter(p => p.gen).slice(0, 3).forEach(p => (p.seen = Math.min(1, p.seen + 0.3))); }
  if (id === 'micro') { const ok = g.meters.clubes >= 45; bump(g, { quimica: (ok ? 6 : 4) * k, clubes: ok ? 0 : -5 }); for (const p of pool) if (!abroad(p) && r() < 0.3) p.form = Math.min(2, p.form + 1); }
  if (id === 'rival') g.scout = true;
  if (id === 'juveniles') for (const p of pool) { if (p.gen) p.seen = Math.min(1, p.seen + 0.35 * k); if (ageOf(p, curStop(g).y) <= 21) p.rel = clamp(p.rel + 4 * k, 0, 100); }
  if (id === 'fede') bump(g, { fed: 3 * k });
  g.acts.push(id); if (staff) g.acts.push('*'); else g.actsLeft--;
}

// --- Convocatoria ---
export const SQUAD_MAX = 26;
export function suggestSquad(g: Game): number[] {
  const pool = myPool(g).filter(available), form = g.lineup.tac.form;
  const xi = bestXI(pool, form), out = new Set(xi.filter(Boolean));
  const quota = { POR: 3, DEF: 8, MED: 8, DEL: 7 }, count = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  const byPid = new Map(pool.map(p => [p.id, p]));
  for (const id of out) count[LINE[byPid.get(id)!.pos]]++;
  for (const p of pool.sort((a, b) => effective(b) - effective(a))) {
    if (out.size >= SQUAD_MAX) break; const l = LINE[p.pos];
    if (!out.has(p.id) && count[l] < quota[l]) { out.add(p.id); count[l]++; }
  }
  return [...out];
}
export function toLista(g: Game) { if (g.squad.length < 18) g.squad = suggestSquad(g); g.ph = 'lista'; }
export function confirmSquad(g: Game) {
  const pool = myPool(g).filter(available).sort((a, b) => b.ovr - a.ovr), r = rngFor(g, `lista:${g.cycle}:${g.stop}`);
  const out = pool.slice(0, 9).filter(p => !g.squad.includes(p.id));
  const hot = g.squad.map(id => pool.find(p => p.id === id)).filter(p => p && p.form === 2).length;
  bump(g, { hinchas: -Math.min(6, out.length * 2) + Math.min(3, hot), prensa: -Math.min(4, out.length) + Math.min(2, hot) });
  mail(g, 'prensa', 'Prensa', out.length ? `La lista sorprendió por las ausencias de ${out.slice(0, 3).map(p => p.n).join(', ')}.` : 'La lista salió sin sorpresas: están los que se esperaba.');
  for (const p of out) p.rel = clamp(p.rel - 4, 0, 100);
  autoLineup(g);
  g.pending.push(...drawEvents(g, 'lista', r), ...drawEvents(g, 'concentracion', r));
  g.ph = 'previa';
}
export function autoLineup(g: Game, form = g.lineup.tac.form) {
  const m = byId(g), squad = g.squad.map(id => m.get(id)!).filter(p => p && available(p));
  const xi = bestXI(squad, form), rest = squad.filter(p => !xi.includes(p.id)).sort((a, b) => effective(b) - effective(a));
  const on = xi.map(id => m.get(id)!).filter(Boolean);
  const cap = [...on].sort((a, b) => b.per[3] * 3 + b.caps / 4 - (a.per[3] * 3 + a.caps / 4))[0]?.id ?? 0;
  const pk = [...on].sort((a, b) => b.six[1] - a.six[1])[0]?.id ?? 0;
  const field = on.filter(p => p.pos !== 'POR'), keep = (id?: number) => (id && xi.includes(id) ? id : 0);
  const fk = keep(g.lineup.fk) || ([...field].sort((a, b) => b.six[1] + b.six[2] - (a.six[1] + a.six[2]))[0]?.id ?? 0);
  const ck = keep(g.lineup.ck) || ([...field].sort((a, b) => b.six[2] - a.six[2])[0]?.id ?? 0);
  g.lineup = { xi, bench: rest.map(p => p.id), cap: g.lineup.xi.includes(g.lineup.cap) && xi.includes(g.lineup.cap) ? g.lineup.cap : cap, pk, fk, ck, tac: { ...g.lineup.tac, form } };
}
export function swapLineup(g: Game, a: number, b: number) {
  const L = g.lineup, ia = L.xi.indexOf(a), ib = L.xi.indexOf(b), ba = L.bench.indexOf(a), bb = L.bench.indexOf(b);
  if (ia >= 0 && ib >= 0) { L.xi[ia] = b; L.xi[ib] = a; }
  else if (ia >= 0 && bb >= 0) { L.xi[ia] = b; L.bench[bb] = a; }
  else if (ib >= 0 && ba >= 0) { L.xi[ib] = a; L.bench[ba] = b; }
  if (!L.xi.includes(L.cap)) L.cap = L.xi[0]; if (!L.xi.includes(L.pk)) L.pk = L.xi[L.xi.length - 1];
  if (L.fk && !L.xi.includes(L.fk)) L.fk = 0; if (L.ck && !L.xi.includes(L.ck)) L.ck = 0;
}
export function lineupOk(g: Game) { const m = byId(g); return g.lineup.xi.length === 11 && g.lineup.xi.every(id => { const p = m.get(id); return p && available(p); }); }

// --- Partido ---
const STYLES = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-4-1', '3-5-2', '5-3-2'];
const pin = (p: P, at = p.pos, tired = 0): PIn => ({ id: p.id, n: p.n, pos: p.pos, ovr: Math.round(effective(p, at)), six: p.six.map(v => Math.round(v * (1 + p.form * 0.015))), sta0: fresh(p) - tired });
export const ESTILOS = ['Equilibrado', 'Contraataque', 'Posesión', 'Por las bandas', 'Juego directo'];
/** Estilo que elige un rival según lo que tiene: velocidad arriba, un nueve fuerte, buen pie en el medio. */
function aiStyle(on: P[], form: string, d: number): number {
  const spots = FORMS[form], avg = (l: P[], k: number) => l.reduce((x, p) => x + p.six[k], 0) / (l.length || 1);
  const fw = on.filter((_, i) => LINE[spots[i][0]] === 'DEL'), md = on.filter((_, i) => LINE[spots[i][0]] === 'MED');
  const nine = Math.max(0, ...fw.map(p => p.six[5]));
  if (d < -5) return avg(fw, 0) >= 78 || nine < 80 ? 1 : 4;
  if (d > 4 && avg(md, 2) >= 78) return 2;
  if (nine >= 82 && avg(md, 2) < 76) return 4;
  if (nine >= 78 && fw.length >= 3) return 3;
  return avg(fw, 0) >= 82 ? 1 : 0;
}
function aiTeam(g: Game, code: string, rival: string): TeamIn {
  const pool = poolOf(g, code).filter(available), form = STYLES[hash(code) % 4], spots = FORMS[form], m = new Map(pool.map(p => [p.id, p]));
  const xi = bestXI(pool, form), d = nat(g, code).str - nat(g, rival).str;
  const bench = pool.filter(p => !xi.includes(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 12);
  const ment = d > 6 ? 3 : d < -6 ? 1 : 2, ord: Record<number, Order[]> = {};
  xi.forEach((id, i) => {                                                         // el rival también da indicaciones a sus figuras
    const p = m.get(id); if (!p) return; const role = spots[i][0], o: Order[] = [];
    if ((role === 'LI' || role === 'LD') && ment >= 3) o.push('sube');
    if ((role === 'LI' || role === 'LD' || role === 'MCD') && ment <= 1) o.push('queda');
    if ((role === 'EI' || role === 'ED' || role === 'MCO') && p.six[3] >= 82) o.push('encara');
    if (p.six[1] >= 84 && role !== 'POR') o.push('tira');
    if (role === 'MCD' && p.six[4] >= 80) o.push('fuerte');
    if (o.length) ord[id] = o;
  });
  const on = xi.map(id => m.get(id)!).filter(Boolean), tired = Math.min(g.md, 3) * 0.05;          // el rival también llega con partidos encima
  const estilo = aiStyle(on, form, d);
  return {
    code, name: nat(g, code).n, xi: xi.map((id, i) => pin(m.get(id)!, spots[i][0], tired)), bench: bench.map(p => pin(p)),
    tac: { form, ment, pres: d > 4 ? 2 : estilo === 1 ? 0 : 1, linea: d > 4 ? 2 : d < -6 || estilo === 1 ? 0 : 1, ancho: estilo === 3 ? 2 : 1, ritmo: estilo === 4 || estilo === 1 ? 2 : estilo === 2 ? 0 : 1, corner: hash(code + 'ck') % 3, estilo, ord },
    boost: 1, drain: 1, ai: true,
  };
}
/** Lo que se sabe del rival antes de jugar: formación, once probable y, si se lo estudió, cómo juega. */
export function rivalPlan(g: Game) {
  const fx = curFx(g); if (!fx) return null;
  const t = aiTeam(g, fx.h === g.me ? fx.a : fx.h, g.me), spots = FORMS[t.tac.form];
  return { form: t.tac.form, estilo: t.tac.estilo ?? 0, ment: t.tac.ment, linea: t.tac.linea, pres: t.tac.pres, xi: t.xi.map((p, i) => ({ id: p.id, n: p.n, role: spots[i][0], ovr: p.ovr })) };
}
export function matchInit(g: Game): MatchInit {
  const fx = curFx(g)!, m = byId(g), spots = FORMS[g.lineup.tac.form], iAmHome = fx.h === g.me, rival = iAmHome ? fx.a : fx.h;
  const mine: TeamIn = {
    code: g.me, name: nat(g, g.me).n, xi: g.lineup.xi.map((id, i) => pin(m.get(id)!, spots[i][0])), bench: g.lineup.bench.map(id => pin(m.get(id)!)), tac: { ...g.lineup.tac }, pk: g.lineup.pk, fk: g.lineup.fk, ck: g.lineup.ck, ai: false, drain: 1,
    boost: (1 + (g.meters.quimica - 50) / 1000) * (1 + (g.meters.vestuario - 50) / 1500) * (g.scout ? 1.012 : 1),
  };
  const other = aiTeam(g, rival, g.me), home = iAmHome ? mine : other, away = iAmHome ? other : mine;
  if (!fx.neutral) {
    const alt = venueOf(fx.h, iAmHome ? fx.venue ?? 0 : 0)[2], edge = altitudeEdge(alt, homeAltitude(fx.a));
    home.boost *= 1.03; away.boost *= 1 - edge * 0.05; away.drain *= 1 + edge * 1.3;
  }
  return { home, away, seed: hash(`${g.seed}:partido:${fx.id}`), ko: !!fx.ko };
}
export const tacOf = (g: Game): Tactics => g.lineup.tac;

export function finishMatch(g: Game, res: Result) {
  const fx = curFx(g)!, home = fx.h === g.me, my = home ? res.gh : res.ga, their = home ? res.ga : res.gh, m = byId(g);
  const s = curStop(g), r = rngFor(g, `post:${fx.id}`), competitive = fx.comp !== 'AM';
  const [w, d, l] = odds(g, fx.h, fx.a, !!fx.neutral, fx.neutral ? 0 : venueOf(fx.h, home ? fx.venue ?? 0 : 0)[2]);
  const exp = home ? w + d / 2 : l + d / 2;
  const penW = res.pens ? (home ? res.pens[0] > res.pens[1] : res.pens[1] > res.pens[0]) : false;
  const v = my > their || penW ? 1 : my === their && !res.pens ? 0.5 : 0;
  fx.gh = res.gh; fx.ga = res.ga; fx.pens = res.pens;
  rank(g, fx.comp, fx.h, fx.a, res.gh, res.ga, res.pens, !!fx.ko);
  if (fx.comp === 'EL' && fx.round !== undefined) { const j = g.elim.rounds[fx.round].findIndex(x => x.includes(g.me)); g.elim.res[fx.round][j] = [res.gh, res.ga]; }
  if (g.tour && (fx.comp === 'CA' || fx.comp === 'MU')) { const tm = myTourMatch(g); if (tm) { tm.gh = res.gh; tm.ga = res.ga; tm.pens = res.pens; } }
  const rec = g.record; rec.pj++; rec.gf += my; rec.gc += their; if (v === 1 && !res.pens) rec.g++; else if (v === 0 && !res.pens) rec.p++; else rec.e++;
  const mineIds = new Set(myPool(g).map(p => p.id));
  for (const p of myPool(g)) if (p.sus > 0 && competitive && !res.played.includes(p.id)) p.sus = 0;
  // Cansancio dentro de la fecha: el que juega acumula, el que descansa recupera.
  for (const p of myPool(g)) p.fat = clamp((p.fat ?? 0) * 0.55 + (res.mins?.[p.id] ?? 0) * 0.35, 0, 1);
  for (const id of res.played) {
    const p = m.get(id); if (!p || !mineIds.has(id)) continue;
    const rt = res.rating[id] ?? 6;
    p.caps++; p.last.push(rt); if (p.last.length > 5) p.last.shift();
    p.form = clamp(p.form + (rt >= 7.6 ? 1 : rt <= 5.4 ? -1 : 0), -2, 2); p.rel = clamp(p.rel + 2, 0, 100);
    if (competitive) { if (ageOf(p, s.y) < 21) p.u21++; if (p.u21 > 3 || p.caps > 3 || fx.comp === 'CA' || fx.comp === 'MU') p.tied = true; }
    const card = res.cards[id];
    if (competitive && card === 'r') p.sus = 1; else if (competitive && card === 'y') { p.yel++; if (p.yel >= 2) { p.yel = 0; p.sus = 1; } }
    if (res.injured.includes(id) && r() < 0.6) { p.inj = 1 + Math.floor(r() * 3); p.injWhat = pick(r, INJ); mail(g, 'med', 'Cuerpo médico', `${p.n}: ${p.injWhat.toLowerCase()}. Queda descartado ${p.inj === 1 ? 'para la próxima fecha' : `por ${p.inj} fechas`}.`); }
  }
  for (const sc of res.scorers) { const p = m.get(sc.id); if (p && mineIds.has(sc.id)) p.ig++; }
  const imp = fx.comp === 'AM' ? 0.5 : fx.comp === 'EL' ? 1 : fx.ko ? 1.9 : 1.4;
  bump(g, { fed: (v - exp) * 8 * imp + (v === 1 ? 1 : v === 0 ? -1.5 : 0), prensa: (v - exp) * 11 * imp + (v === 0 ? -1 : 0), hinchas: (v - exp) * 9 * imp + clamp(my - their, -3, 2), vestuario: (v === 1 ? 2 : v === 0 ? -3 : 0) * imp, quimica: 1 });
  const names = res.scorers.map(sc => `${m.get(sc.id)?.n ?? '—'} ${sc.min}'${(sc.team === 0) === home ? '' : ' (rival)'}`);
  const side = home ? 0 : 1;
  const read = res.tact ? leer({ my: side, min: 90, stats: res.stats, tact: res.tact, fisico: res.sta?.[side], fisicoRival: res.sta?.[1 - side], tac: g.lineup.tac }, 4).map(({ tono, texto }) => ({ tono, texto })) : [];
  const an = res.shots ? { shots: res.shots, heat: res.heat, tact: res.tact, sta: res.sta, read } : undefined;
  g.log.unshift({ fx: { ...fx }, my, their, rating: res.rating, scorers: names, stats: res.stats, note: res.pens ? (penW ? 'pen' : 'penp') : undefined, an });
  if (g.log.length > 80) g.log.length = 80;
  for (let i = 12; i < g.log.length; i++) delete g.log[i].an;                       // el análisis completo solo de los últimos partidos
  g.lastTalk = undefined;
  g.pending.push(...drawEvents(g, 'post', r));
  g.ph = 'post';
}

/** Juega el resto de la jornada y deja listo lo siguiente. */
export function afterPost(g: Game) {
  const fx = curFx(g)!, r = rngFor(g, `jornada:${fx.id}`);
  if (fx.comp === 'EL' && fx.round !== undefined) {
    g.elim.rounds[fx.round].forEach(([h, a], j) => { if (!g.elim.res[fx.round!][j]) { const q = quick(g, r, h, a); g.elim.res[fx.round!][j] = [q.gh, q.ga]; rank(g, 'EL', h, a, q.gh, q.ga); } });
    g.elim.done = Math.max(g.elim.done, fx.round + 1);
  }
  if (g.tour && (fx.comp === 'CA' || fx.comp === 'MU')) {
    playStage(g); const next = myTourMatch(g);
    if (next) g.fx.push(tourFx(g, next)); else finishTour(g);
  }
  g.md++;
  if (g.md < g.fx.length) { fixLineup(g); g.ph = 'previa'; } else g.ph = 'cierre';
}
function finishTour(g: Game) { const t = g.tour!; let guard = 0; while (!t.champ && guard++ < 10) playStage(g); }
export function fixLineup(g: Game) { if (!lineupOk(g)) autoLineup(g); else { const m = byId(g); g.lineup.bench = g.lineup.bench.filter(id => available(m.get(id)!)); } }

/** Resumen de cómo le fue a tu selección en el torneo que acaba de terminar. */
export function tourSummary(g: Game): string {
  const t = g.tour!; const name = t.id === 'CA' ? 'Copa América' : 'Mundial';
  if (!t.teams.includes(g.me)) return `${nat(g, t.champ ?? '').n} ganó el ${name}. No participamos.`;
  if (t.champ === g.me) return `¡Campeones de ${t.id === 'CA' ? 'la Copa América' : 'el Mundial'} ${t.y}!`;
  const lost = t.ko.findIndex(rd => rd.some(mm => (mm.h === g.me || mm.a === g.me) && winnerOf(mm) !== g.me));
  const where = lost < 0 ? 'la fase de grupos' : ['dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'la final'][5 - (t.id === 'CA' ? 3 : 5) + lost];
  return `Quedamos fuera en ${where} de ${t.id === 'CA' ? 'la Copa América' : 'el Mundial'} ${t.y}. Campeón: ${nat(g, t.champ ?? '').n}.`;
}

export function goalMet(g: Game): boolean {
  const tab = elimTable(g), pos = tab.findIndex(x => x.c === g.me) + 1, pts = tab.find(x => x.c === g.me)?.pts ?? 0;
  if (g.goalKey === 'top4') return pos <= 4;
  if (g.goalKey === 'top6') return pos <= 6;
  if (g.goalKey === 'pts15') return pts >= 15;
  return (g.qualified ?? []).includes(g.me) || elimSlots(g).direct.includes(g.me);
}

export function closeStop(g: Game) {
  const s = curStop(g), r = rngFor(g, `cierre:${g.cycle}:${g.stop}`);
  for (const id of g.squad) { const p = g.players.find(x => x.id === id); if (p && !g.log.slice(0, g.fx.length).some(l => l.rating[id] !== undefined)) p.rel = clamp(p.rel - 1, 0, 100); }
  for (const t of checkPromises(g)) mail(g, 'jug', 'Plantel', t);
  if (s.kind === 'torneo' && g.tour) {
    if (!g.tour.champ) finishTour(g);
    const txt = tourSummary(g); g.history.unshift({ y: s.y, text: txt });
    if (g.tour.champ === g.me) bump(g, { fed: 25, hinchas: 25, prensa: 20, vestuario: 15 });
    mail(g, 'prensa', 'Prensa', txt);
  }
  if (s.comp === 'EL' && s.rounds?.includes(17)) {
    const pos = elimTable(g).findIndex(x => x.c === g.me) + 1, ok = goalMet(g);
    g.history.unshift({ y: s.y, text: `Eliminatorias: terminamos en el puesto ${pos}. ${ok ? 'Objetivo cumplido.' : 'No se cumplió el objetivo.'}` });
    bump(g, { fed: ok ? 12 : -14, hinchas: ok ? 8 : -8 });
    mail(g, 'fed', 'Federación', ok ? 'Estimado profesor: el objetivo de las eliminatorias está cumplido. Lo felicitamos a usted y al plantel.' : 'Estimado profesor: el resultado de las eliminatorias no es el que acordamos. Tendremos que conversar.');
  }
  if (s.comp === 'RE') g.qualified = qualify(g);
  if (s.m === 'Noviembre') {
    const f = g.meters.fed;
    mail(g, 'fed', 'Federación', `Estimado profesor: cerramos ${s.y}. ${f >= 65 ? 'El directorio está conforme con el trabajo.' : f >= 40 ? 'El directorio lo respalda, aunque espera una mejora.' : 'El directorio está preocupado. Los próximos partidos serán decisivos.'}`);
    g.history.unshift({ y: s.y, text: `Balance del año: ${g.record.g} ganados, ${g.record.e} empatados y ${g.record.p} perdidos en el ciclo.` });
  }
  if (s.m.startsWith('Junio')) { rollYear(g, s.y, CLUBS, URNS); g.players = g.players.filter(p => p.ret !== 2 || (p.nat === g.me && p.caps >= 20)); mail(g, 'ct', 'Cuerpo técnico', 'Profe, cerró la temporada en los clubes. Hay juveniles nuevos para seguir y algunos referentes ya sienten los años.'); void r; }
  if (g.meters.fed <= 15) { g.over = 'La federación decidió terminar su contrato.'; g.ph = 'fin'; return; }
  g.stop++;
  if (g.stop >= g.stops.length) {
    const ok = goalMet(g) || g.tour?.champ === g.me;
    if (g.meters.fed < 40 && !ok) { g.over = 'Terminó el ciclo y la federación no renovó su contrato.'; g.ph = 'fin'; return; }
    g.cycle += 4; g.stops = stopsFor(g.cycle); g.stop = 0; g.tour = null; g.qualified = null;
    g.elim = { rounds: roundRobin(CONMEBOL, rngFor(g, `eliminatorias:${g.cycle}`)), res: [], done: 0 }; g.elim.res = g.elim.rounds.map(() => []);
    [g.goalKey, g.goal] = goalFor(g);
    g.history.unshift({ y: g.cycle, text: `Renovación: empieza el ciclo ${g.cycle}–${g.cycle + 4}.` });
    mail(g, 'fed', 'Federación', `Estimado profesor: renovamos su contrato hasta ${g.cycle + 4}. El nuevo objetivo es ${g.goal.charAt(0).toLowerCase() + g.goal.slice(1)}.`);
  }
  startStop(g);
}

export const myRank = (g: Game) => rankOf(g, g.me);
export type { Lineup };
