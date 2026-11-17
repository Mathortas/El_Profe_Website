// Motor de partido 2D. Simula 22 jugadores y la pelota en pasos de 0,1 s.
// Un partido dura 600 s de simulación (300 por tiempo); el reloj los muestra como 90 minutos.
import { type Order, type Pos, type Rng, type Tactics, LINE, clamp, rngOf } from './core.ts';
import { FORMS, fit } from './data.ts';

export interface PIn { id: number; n: string; pos: Pos; ovr: number; six: number[]; sta0?: number }
export interface TeamIn { code: string; name: string; xi: PIn[]; bench: PIn[]; tac: Tactics; boost: number; drain: number; pk?: number; fk?: number; ck?: number; ai: boolean }
export interface MatchInit { home: TeamIn; away: TeamIn; seed: number; ko: boolean }
export interface MEvent { min: number; type: 'gol' | 'amarilla' | 'roja' | 'cambio' | 'ocasion' | 'lesion' | 'info' | 'penal'; team: number; text: string; pid?: number }
export type Cmd = { type: 'sub'; team: number; out: number; in: number } | { type: 'tac'; team: number; tac: Tactics } | { type: 'talk'; team: number; k: number } | { type: 'resume' };
export interface Frame { t: number; min: number; score: [number, number]; ball: [number, number, number]; pos: number[]; owner: number; banner: string; phase: string; sta: number[]; shot: boolean }
export interface Result { gh: number; ga: number; pens?: [number, number]; events: MEvent[]; rating: Record<number, number>; stats: number[][]; tact: number[][]; mins: Record<number, number>; played: number[]; injured: number[]; cards: Record<number, string>; scorers: { id: number; min: number; team: number }[] }

interface MP extends PIn { team: number; slot: number; role: Pos; sx: number; sy: number; x: number; y: number; vx: number; vy: number; sta: number; on: boolean; yel: number; rate: number; cool: number; ox: number; oy: number; hurt: boolean }
const W = 105, H = 68, DT = 0.1, HALF = 300;
const RIT = 0, TIR = 1, PAS = 2, REG = 3, DEF = 4, FIS = 5;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export class Match {
  r: Rng; t = 0; phase: 'juego' | 'ht' | 'fin' | 'penales' = 'juego'; period = 0;
  teams: TeamIn[]; ps: MP[] = []; bench: PIn[][]; subs = [0, 0]; used: number[][] = [[], []];
  score: [number, number] = [0, 0]; events: MEvent[] = []; pens?: [number, number];
  // posesión, tiros, al arco, córners, faltas, pases, pases buenos, fueras de juego
  stats = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, owner: -1, last: -1, state: 'dead' as 'held' | 'fly' | 'loose' | 'dead', tx: 0, ty: 0, air: false, shot: null as null | { goal: boolean; save: boolean; by: number; xg: number }, to: -1, dur: 0, age: 0 };
  restart: { type: string; team: number; at: number } | null = null;
  banner = ''; think = 0; pressers: number[][] = [[], []]; pressAt = 0; poss = 0;
  ko: boolean; talkDone = [false, false]; scorers: Result['scorers'] = []; injured: number[] = []; cards: Record<number, string> = {};
  lastSub = [0, 0]; humanWait = false;
  setPlay: { until: number; spots: Map<number, [number, number]> } | null = null;
  // Lectura táctica por equipo: pases al espacio, los que llegaron, recuperaciones en campo rival, tiros de contra, centros, pelotazos
  tact = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  time: Record<number, number> = {};                                             // segundos de simulación jugados por cada jugador
  won = [-99, -99];                                                              // cuándo recuperó la pelota cada equipo
  thru = false;                                                                  // el pase en vuelo va al espacio
  aiAt = [40, 40]; aiNote: string[][] = [[], []];                                // próxima revisión del rival y avisos ya dados   // ubicaciones para un córner o un centro de tiro libre

  constructor(init: MatchInit) {
    this.r = rngOf(init.seed); this.teams = [init.home, init.away]; this.ko = init.ko;
    this.bench = [init.home.bench.slice(), init.away.bench.slice()];
    this.teams.forEach((tm, team) => {
      const spots = FORMS[tm.tac.form] ?? FORMS['4-3-3'];
      tm.xi.forEach((p, slot) => {
        const [role, sx, sy] = spots[slot];
        this.ps.push({ ...p, team, slot, role, sx, sy, x: team ? W - sx * 0.6 : sx * 0.6, y: team ? H - sy : sy, vx: 0, vy: 0, sta: p.sta0 ?? 1, on: true, yel: 0, rate: 6, cool: 0, ox: 0, oy: 0, hurt: false });
        this.used[team].push(p.id);
      });
    });
    const how = ['', ' y sale de contraataque', ' y busca tener la pelota', ' y juega por las bandas', ' y juega directo'];
    this.teams.forEach((tm, team) => { if (tm.ai) this.ev('info', team, `${tm.name} forma ${tm.tac.form}${how[tm.tac.estilo ?? 0]}`); });
    this.setDead('kickoff', 0, W / 2, H / 2, 1.5);
  }

  // --- utilidades ---
  private tx(team: number, x: number) { return team ? W - x : x; }               // a coordenadas del equipo (ataca hacia +x)
  private ty(team: number, y: number) { return team ? H - y : y; }
  private at(p: MP, k: number) {                                                   // atributo efectivo
    const tm = this.teams[p.team];
    return p.six[k] * fit(p.pos, p.role) * (0.74 + 0.26 * p.sta) * tm.boost * (p.hurt ? 0.7 : 1);
  }
  private name(team: number) { return this.teams[team].name; }
  private style(team: number) { return this.teams[team].tac.estilo ?? 0; }
  private counter(team: number) { return this.poss === team && this.t - this.won[team] < 5; }      // ventana de contraataque
  /** A quién marca personalmente este jugador, si tiene esa orden y el marcado sigue en la cancha. */
  private marker(p: MP): MP | undefined { const mk = this.teams[p.team].tac.marca; return mk && mk[0] === p.id ? this.ps.find(o => o.on && o.team !== p.team && o.id === mk[1]) : undefined; }
  private ord(p: MP, o: Order) { const l = this.teams[p.team].tac.ord?.[p.id]; return !!l && l.includes(o); }
  get min() { return Math.min(this.period >= 2 ? 120 : 90, Math.floor((this.t / HALF) * 45) + 1); }
  private ev(type: MEvent['type'], team: number, text: string, pid?: number) { this.events.push({ min: this.min, type, team, text, pid }); }
  private mates(team: number) { return this.ps.filter(p => p.team === team && p.on); }
  private nearestOpp(p: MP, x = p.x, y = p.y) {
    let best = 99; for (const o of this.ps) if (o.on && o.team !== p.team) { const d = dist(x, y, o.x, o.y); if (d < best) best = d; }
    return best;
  }
  private gk(team: number) { return this.ps.find(p => p.team === team && p.on && p.role === 'POR'); }
  private offsideLine(att: number) {                                               // en coordenadas del atacante
    const xs = this.ps.filter(p => p.on && p.team !== att).map(p => this.tx(att, p.x)).sort((a, b) => b - a);
    return Math.max(xs[1] ?? 80, this.tx(att, this.ball.x), W / 2);
  }

  // --- pelota parada ---
  private setDead(type: string, team: number, x: number, y: number, delay: number) {
    const b = this.ball; b.state = 'dead'; b.owner = -1; b.x = clamp(x, 0.5, W - 0.5); b.y = clamp(y, 0.5, H - 0.5); b.z = 0; b.vx = b.vy = 0; b.shot = null; b.to = -1;
    const gxT = this.tx(team, b.x), gyT = this.ty(team, b.y), dG = dist(gxT, gyT, W, H / 2);
    const centro = type === 'corner' || (type === 'fk' && dG < 42 && (dG > 26 || Math.abs(gyT - H / 2) > 16));
    if (centro) delay = Math.max(delay, type === 'corner' ? 4.4 : 3.6);
    this.restart = { type, team, at: this.t + delay }; this.poss = team;
    this.setPlay = centro ? { until: this.t + delay, spots: this.arrange(team, type, gyT < H / 2 ? -1 : 1) } : null;
    const label: Record<string, string> = { kickoff: 'Saque del medio', corner: 'Córner', fk: 'Tiro libre', throw: 'Lateral', goalkick: 'Saque de arco', penalty: 'Penal' };
    this.banner = `${label[type]} · ${this.name(team)}`;
  }
  /** Quién patea: el designado si está en la cancha; si no, el mejor para ese tipo de pelota parada. */
  private taker(type: string, team: number): MP | undefined {
    const b = this.ball, tm = this.teams[team], mates = this.mates(team).filter(p => p.role !== 'POR' || type === 'goalkick');
    const pick = (id?: number) => (id ? mates.find(p => p.id === id) : undefined);
    const gx = this.tx(team, b.x), gy = this.ty(team, b.y), dG = dist(gx, gy, W, H / 2);
    if (type === 'goalkick') return this.gk(team) ?? mates[0];
    if (type === 'penalty') return pick(tm.pk) ?? mates.slice().sort((a, c) => c.six[TIR] - a.six[TIR])[0];
    if (type === 'corner') return pick(tm.ck) ?? mates.slice().sort((a, c) => c.six[PAS] - a.six[PAS])[0];
    if (type === 'fk' && dG < 42) return pick(tm.fk) ?? mates.slice().sort((a, c) => (c.six[TIR] + c.six[PAS]) - (a.six[TIR] + a.six[PAS]))[0];
    if (type === 'fk') return mates.slice().sort((a, c) => (c.six[PAS] - dist(c.x, c.y, b.x, b.y) * 0.6) - (a.six[PAS] - dist(a.x, a.y, b.x, b.y) * 0.6))[0];
    return mates.slice().sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))[0];
  }
  /** Ubicaciones para un centro a balón parado: quién va al área, quién marca y quién se queda. Devuelve coordenadas de cancha por índice. */
  private arrange(team: number, type: string, side: number): Map<number, [number, number]> {
    const spots = new Map<number, [number, number]>(), tk = this.taker(type, team);
    const head = (p: MP) => p.six[FIS] * 0.6 + p.six[TIR] * 0.25 + p.six[DEF] * 0.15;
    const att = this.mates(team).filter(p => p.role !== 'POR' && p !== tk).sort((a, c) => head(c) - head(a));
    // En coordenadas del que ataca: primer palo, segundo palo, punto penal, área chica, borde del área, rebote.
    const box: [number, number][] = [[100, H / 2 + side * 4.2], [99.5, H / 2 - side * 5.5], [94.5, H / 2], [97, H / 2 - side * 1.8], [87, H / 2 - side * 4], [84, H / 2 + side * 9]];
    const back: [number, number][] = [[60, H / 2 - 10], [60, H / 2 + 10], [68, H / 2], [72, H / 2 + side * 14]];
    att.forEach((p, k) => { const s = k < box.length ? box[k] : back[(k - box.length) % back.length]; spots.set(this.ps.indexOf(p), [this.tx(team, s[0]), this.ty(team, s[1])]); });
    const def = this.mates(1 - team).filter(p => p.role !== 'POR').sort((a, c) => (c.six[DEF] + c.six[FIS]) - (a.six[DEF] + a.six[FIS]));
    const toGoal = team ? -1 : 1;                                                 // hacia el arco que se defiende
    def.forEach((p, k) => {
      let w: [number, number];
      if (k < 5) { const s = box[k]; w = [this.tx(team, s[0]) + toGoal * 1.1, this.ty(team, s[1]) + (k % 2 ? 0.8 : -0.8)]; }
      else if (k === 5) w = [this.tx(team, 103.5), this.ty(team, H / 2 + side * 3.4)];                 // el del palo
      else if (k === 6) w = [this.tx(team, 88), this.ty(team, H / 2 + side * 6)];
      else if (k === 7) w = [this.tx(team, 86), this.ty(team, H / 2 - side * 6)];
      else w = [this.tx(team, 62 - (k - 8) * 8), this.ty(team, H / 2 + (k % 2 ? 9 : -9))];              // los que quedan para la contra
      spots.set(this.ps.indexOf(p), w);
    });
    return spots;
  }
  private doRestart() {
    const { type, team } = this.restart!; this.restart = null; this.banner = ''; this.setPlay = null;
    const b = this.ball, taker = this.taker(type, team);
    if (!taker) return;
    taker.x = b.x; taker.y = b.y; b.owner = this.ps.indexOf(taker); b.last = b.owner; b.state = 'held';
    const gx = this.tx(team, b.x), gy = this.ty(team, b.y), dGoal = dist(gx, gy, W, H / 2);
    if (type === 'penalty') { this.shoot(taker, 0.76 + (this.at(taker, TIR) - 70) / 400, true); return; }
    if (type === 'corner') { this.corner(taker); return; }
    if (type === 'fk' && dGoal <= 26 && Math.abs(gy - H / 2) <= 16) {                // tiro libre directo: pesa la pegada y la distancia
      const xg = clamp(0.03 + (this.at(taker, TIR) - 55) / 600 - Math.max(0, dGoal - 20) * 0.006, 0.02, 0.12);
      this.ev('info', team, `Tiro libre de ${taker.n}`, taker.id); this.shoot(taker, xg, false, true); return;
    }
    if (type === 'fk' && dGoal < 42) { this.cross(taker); return; }
    if (type === 'goalkick' && this.r() < 0.3 + this.teams[team].tac.ritmo * 0.12) { this.longBall(taker); return; }
    this.think = 0.2;
  }
  /** Córner según la jugada elegida: primer palo, segundo palo o en corto. */
  private corner(from: MP) {
    const team = from.team, b = this.ball, side = this.ty(team, b.y) < H / 2 ? -1 : 1;
    let mode = this.teams[team].tac.corner ?? 0;
    if (mode === 0) { const k = this.r(); mode = k < 0.45 ? 1 : k < 0.88 ? 2 : 3; }
    const mates = this.mates(team).filter(p => p !== from && p.role !== 'POR');
    if (mode === 3) {
      const near = mates.slice().sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))[0];
      if (near) { this.pass(from, near, false); return; }
    }
    const err = (1 - this.at(from, PAS) / 115) * 9;
    const ax = (mode === 1 ? 99.5 : 97.5) - this.r() * 3 + (this.r() - 0.5) * err, ay = H / 2 + side * (mode === 1 ? 4.2 : -5.5) + (this.r() - 0.5) * (3 + err);
    const wx = clamp(this.tx(team, ax), 1, W - 1), wy = clamp(this.ty(team, ay), 2, H - 2);
    const to = mates.slice().sort((a, c) => dist(a.x, a.y, wx, wy) - dist(c.x, c.y, wx, wy))[0];
    if (!to) { this.think = 0.1; return; }
    this.pass(from, to, true);
    const dd = dist(b.x, b.y, wx, wy) || 1; b.tx = wx; b.ty = wy; b.vx = ((wx - b.x) / dd) * 17; b.vy = ((wy - b.y) / dd) * 17; b.dur = dd / 17;
  }

  // --- acciones con pelota ---
  private pass(from: MP, to: MP, air = false, deep = false) {
    this.thru = false;
    const b = this.ball, d = dist(from.x, from.y, to.x, to.y), pas = this.at(from, PAS);
    const tx0 = this.tx(from.team, to.x), fx0 = this.tx(from.team, from.x);
    if (b.state === 'held' && tx0 > fx0 + 6 && tx0 > W / 2 + 4 && tx0 > this.offsideLine(from.team) - 1.1 && (deep || LINE[to.role] === 'DEL') && this.r() < (deep ? 0.42 : 0.3)) {
      this.stats[7][1 - from.team]++; this.ev('info', from.team, `Fuera de juego de ${to.n}`, to.id);
      this.setDead('fk', 1 - from.team, to.x, to.y, 2); this.banner = `Fuera de juego · ${this.name(from.team)}`; return;
    }
    const press = this.nearestOpp(from);
    const err = (1 - pas / 115) * d * (air ? 0.13 : 0.075) * (press < 2 ? 1.5 : 1);
    const speed = air ? 17 : 15.5, time = d / speed;
    b.tx = clamp(to.x + to.vx * time * 0.7 + (this.r() - 0.5) * 2 * err, 0.5, W - 0.5);
    b.ty = clamp(to.y + to.vy * time * 0.7 + (this.r() - 0.5) * 2 * err, 0.5, H - 0.5);
    const dd = dist(b.x, b.y, b.tx, b.ty) || 1;
    b.vx = ((b.tx - b.x) / dd) * speed; b.vy = ((b.ty - b.y) / dd) * speed; b.dur = dd / speed; b.age = 0;
    b.state = 'fly'; b.air = air; b.owner = -1; b.last = this.ps.indexOf(from); b.to = this.ps.indexOf(to); b.shot = null;
    this.stats[5][from.team]++;
  }
  private cross(from: MP) {
    this.tact[4][from.team]++;
    const team = from.team, box = this.mates(team).filter(p => p !== from && p.role !== 'POR').sort((a, c) => this.tx(team, c.x) - this.tx(team, a.x)).slice(0, 4);
    // Se busca al mejor cabeceador que ya está en el área; si no hay nadie, a la zona de remate.
    const inBox = box.filter(p => this.tx(team, p.x) > 86 && Math.abs(this.ty(team, p.y) - H / 2) < 16).sort((a, c) => c.six[FIS] - a.six[FIS]);
    const target = inBox[0] ?? box[Math.floor(this.r() * box.length)]; if (!target) { this.think = 0.1; return; }
    this.pass(from, target, true);
    const b = this.ball, err = (1 - this.at(from, PAS) / 115) * (this.style(team) === 3 ? 9 : 14);
    let gx = team ? 9 + this.r() * 6 : W - 9 - this.r() * 6, gy = H / 2 + (this.r() - 0.5) * 16;
    if (inBox[0]) { gx = clamp(target.x + (this.r() - 0.5) * err, 1, W - 1); gy = clamp(target.y + (this.r() - 0.5) * err, 2, H - 2); }
    b.tx = gx; b.ty = gy; const dd = dist(b.x, b.y, gx, gy) || 1; b.vx = ((gx - b.x) / dd) * 17; b.vy = ((gy - b.y) / dd) * 17; b.dur = dd / 17;
  }
  private longBall(from: MP) {
    this.tact[5][from.team]++;
    const team = from.team, fwd = this.mates(team).filter(p => LINE[p.role] !== 'POR' && this.tx(team, p.x) > this.tx(team, from.x) + 18);
    const to = fwd[Math.floor(this.r() * fwd.length)]; if (to) this.pass(from, to, true); else this.think = 0.1;
  }
  private shoot(p: MP, xg: number, set: boolean, wall = false) {
    const b = this.ball, team = p.team, keeper = this.gk(1 - team);
    const d = dist(this.tx(team, p.x), this.ty(team, p.y), W, H / 2), press = set || wall ? 9 : this.nearestOpp(p);
    this.stats[1][team]++; if (!set && !wall && this.t - this.won[team] < 8) this.tact[3][team]++;
    const blocked = wall ? this.r() < 0.26 : !set && press < 1.6 && this.r() < 0.24;
    const onT = clamp(0.27 + this.at(p, TIR) / 260 - d / 130 - (press < 2 ? 0.08 : 0), 0.12, 0.92);
    const on = !blocked && this.r() < (set && xg > 0.5 ? 0.92 : onT);
    const kf = keeper ? 1.3 - (keeper.ovr * (0.8 + 0.2 * keeper.sta)) / 190 : 1.6;
    const goal = on && this.r() < clamp((xg / onT) * kf, 0.03, 0.9);
    if (on) this.stats[2][team]++;
    const gx = team ? 0 : W, gy = on ? H / 2 + (this.r() - 0.5) * 6.4 : H / 2 + (this.r() < 0.5 ? -1 : 1) * (4.2 + this.r() * 5);
    const speed = 27, dd = dist(p.x, p.y, gx, gy) || 1, cut = blocked ? Math.min(1, 2.5 / dd) : 1;
    b.tx = p.x + (gx - p.x) * cut; b.ty = p.y + (gy - p.y) * cut;
    b.vx = ((gx - p.x) / dd) * speed; b.vy = ((gy - p.y) / dd) * speed; b.dur = (dd * cut) / speed; b.age = 0;
    b.state = 'fly'; b.air = d > 16; b.owner = -1; b.last = this.ps.indexOf(p); b.to = -1;
    b.shot = { goal, save: on && !goal, by: this.ps.indexOf(p), xg };
    p.rate += on ? 0.12 : -0.03;
    if (blocked) b.shot = null;
    if (xg > 0.16 && !goal) this.ev('ocasion', team, `${p.n} tuvo una clara`, p.id);
  }

  private decide(c: MP) {
    const team = c.team, tm = this.teams[team], cx = this.tx(team, c.x), cy = this.ty(team, c.y);
    const press = this.nearestOpp(c), dGoal = dist(cx, cy, W, H / 2);
    const st0 = this.style(team), st = st0 === 2 && cx > 68 ? 0 : st0, fast = this.counter(team);
    if (c.role === 'POR') { if (this.r() < (st === 4 ? 0.6 : st === 2 ? 0.08 : 0.18 + tm.tac.ritmo * 0.14)) this.longBall(c); else { const m = this.bestPass(c, true); if (m) this.play(c, m); else this.longBall(c); } return; }
    const tira = this.ord(c, 'tira'), encara = this.ord(c, 'encara'), simple = this.ord(c, 'simple');
    let shootV = -1, xg = 0;
    if (dGoal < (tira ? 34 : 30)) {
      const ang = Math.abs(Math.atan2(H / 2 + 3.66 - cy, W - cx) - Math.atan2(H / 2 - 3.66 - cy, W - cx));
      xg = clamp(0.35 * Math.exp(-dGoal / 8.2) * clamp(ang / 0.55, 0.25, 1.15) * (0.55 + this.at(c, TIR) / 140) * (press < 1.8 ? 0.6 : press < 3.5 ? 0.82 : 1), 0.008, 0.62);
      const kp = this.gk(1 - team); if (kp && dist(kp.x, kp.y, c.x, c.y) < 5) xg *= 0.84;      // el arquero achica
      if (st0 === 2) xg *= 1.2;                                                   // el que elabora remata menos, pero mejor parado
      shootV = xg * 5.2 + (dGoal < 11 ? 0.45 : 0) + (tm.tac.ment - 2) * 0.04 + (tira ? 0.14 : 0) - (simple ? 0.05 : 0) - (st === 2 ? 0.02 : 0);
    }
    const wide = Math.abs(cy - H / 2) > 15;
    const waiting = this.ps.filter(p => p.on && p.team === team && p !== c && this.tx(team, p.x) > 86 && Math.abs(this.ty(team, p.y) - H / 2) < 16).length;
    if (cx > (st === 3 ? 81 : 86) && wide && this.r() < (waiting ? (st === 3 ? 0.85 : 0.75) : 0.2)) { this.cross(c); return; }
    const best = this.bestPass(c, false);
    // Conducir: cuánto espacio hay por delante.
    let space = 14;
    for (const o of this.ps) if (o.on && o.team !== team) { const ox = this.tx(team, o.x) - cx, oy = Math.abs(this.ty(team, o.y) - cy); if (ox > -1 && ox < 14 && oy < 5) space = Math.min(space, Math.hypot(ox, oy)); }
    const carryV = 0.26 + (Math.min(space, 12) / 12) * 0.32 + this.at(c, REG) / 420 - (press < 2 ? 0.22 : 0) + (cx > 70 ? 0.06 : 0) + (encara ? 0.14 : simple ? -0.14 : 0) + (st === 1 && fast ? 0.1 : st === 2 ? -0.05 : 0);
    const passV = best ? best.v + (simple ? 0.1 : 0) : -1;
    if (shootV >= passV && shootV >= carryV && shootV > 0.2) { this.shoot(c, xg, false); return; }
    if (best && passV >= carryV) { this.play(c, best); return; }
    this.think = (0.35 + this.r() * 0.3 + (2 - tm.tac.ritmo) * 0.12) * (st === 2 ? 0.8 : 1);           // sigue conduciendo
  }
  private bestPass(c: MP, safe: boolean): { m: MP; v: number; air: boolean; to?: [number, number] } | null {
    const team = c.team, tm = this.teams[team], cx = this.tx(team, c.x), line = this.offsideLine(team);
    const st0 = this.style(team), st = st0 === 2 && cx > 68 ? 0 : st0, fast = this.counter(team), pas = this.at(c, PAS);
    // Cada estilo cambia cuánto vale avanzar, cuánto cuesta el pase aéreo y cuánto se cuida la pelota.
    const progW = (0.011 + tm.tac.ritmo * 0.003) * (st === 2 ? 0.72 : st === 4 ? 1.5 : 1) * (fast ? (st === 1 ? 2 : 1.3) : 1);
    const airCost = st === 4 ? 0.06 : st === 2 ? 0.3 : 0.18, openW = st === 2 ? 0.5 : 0.36, laneW = st === 2 ? 0.6 : 0.45;
    const ref = st === 4 ? this.mates(team).filter(p => LINE[p.role] === 'DEL').sort((a, b) => b.six[FIS] - a.six[FIS])[0] : undefined;
    const opps = this.ps.filter(o => o.on && o.team !== team && o.role !== 'POR');
    let best: { m: MP; v: number; air: boolean; to?: [number, number] } | null = null;
    for (const m of this.ps) {
      if (!m.on || m.team !== team || m === c || m.role === 'POR') continue;
      const d = dist(c.x, c.y, m.x, m.y); if (d < 4 || d > 46) continue;
      const mx = this.tx(team, m.x), my = this.ty(team, m.y);
      if (mx > line + 0.3 && mx > W / 2 && mx > cx) continue;                    // en fuera de juego
      const open = Math.min(this.nearestOpp(m), 10) / 10;
      let lane = 0;
      for (const o of this.ps) if (o.on && o.team !== team) {
        const u = clamp(((o.x - c.x) * (m.x - c.x) + (o.y - c.y) * (m.y - c.y)) / (d * d), 0, 1);
        if (u > 0.12 && u < 0.95 && dist(o.x, o.y, c.x + (m.x - c.x) * u, c.y + (m.y - c.y) * u) < 2.1) lane++;
      }
      const air = d > 28 || lane > 0 && d > 18;
      const prog = mx - cx, inBox = mx > 88.5 && Math.abs(my - H / 2) < 20;
      let v = 0.3 + prog * progW + open * openW - (air ? airCost + (1 - pas / 99) * 0.3 : lane * laneW) + (inBox ? 0.25 : 0) + this.r() * 0.25;
      if (st === 3 && Math.abs(my - H / 2) > 18 && prog > -4) v += 0.16;        // por las bandas
      if (m === ref && prog > 10) v += 0.2;                                      // al delantero de referencia
      if (safe) v = open - Math.abs(prog) * 0.004 - lane;
      if (mx < 25 && cx > 40) v -= 0.25;
      if (!best || v > best.v) best = { m, v, air };
      // Pase al espacio: vale más cuanto más adelantada está la defensa rival y más rápido es el que pica.
      const room = 99 - line;
      if (!safe && cx > 28 && room > 15 && mx > cx + 4 && mx > line - 7 && (LINE[m.role] === 'DEL' || mx > line - 3)) {
        const ax = Math.min(line + 5 + room * 0.3, 95), ay = my + (H / 2 - my) * 0.3, wx = this.tx(team, ax), wy = this.ty(team, ay);
        const run = dist(m.x, m.y, wx, wy), near = opps.map(o => ({ o, d: dist(o.x, o.y, wx, wy) })).sort((a, b) => a.d - b.d).slice(0, 2);
        let edge = 0; for (const k of near) edge += (k.d - run) * 0.035 + (this.at(m, RIT) - this.at(k.o, RIT)) / 160;
        edge /= near.length || 1;
        const far = dist(c.x, c.y, wx, wy);
        const tv = -0.06 + (room - 15) * 0.012 + edge + pas / 500 - (far > 38 ? 0.3 : far > 28 ? 0.1 : 0) + tm.tac.ritmo * 0.05
          + (st === 1 && fast ? 0.28 : st === 4 ? 0.15 : st === 2 ? -0.15 : 0) + (fast ? 0.08 : 0) + this.r() * 0.2;
        if (!best || tv > best.v) best = { m, v: tv, air: far > 24, to: [wx, wy] };
      }
    }
    return best;
  }
  /** Ejecuta el pase elegido. Si va al espacio, la pelota cae por delante del que pica. */
  private play(c: MP, p: { m: MP; air: boolean; to?: [number, number] }) {
    this.pass(c, p.m, p.air, !!p.to);
    const b = this.ball;
    if (!p.to || b.state !== 'fly') return;                                       // pudo cobrarse fuera de juego
    const err = (1 - this.at(c, PAS) / 115) * dist(c.x, c.y, p.to[0], p.to[1]) * 0.1;
    const wx = clamp(p.to[0] + (this.r() - 0.5) * 2 * err, 1, W - 1), wy = clamp(p.to[1] + (this.r() - 0.5) * 2 * err, 1, H - 1);
    const sp = p.air ? 17 : 16.5, dd = dist(b.x, b.y, wx, wy) || 1;
    b.tx = wx; b.ty = wy; b.vx = ((wx - b.x) / dd) * sp; b.vy = ((wy - b.y) / dd) * sp; b.dur = dd / sp; this.thru = true; this.tact[0][c.team]++;
    // Los dos defensores más cercanos al destino ya venían retrocediendo: arrancan con ventaja.
    const cover = this.ps.filter(o => o.on && o.team !== c.team && o.role !== 'POR').sort((a, d) => dist(a.x, a.y, wx, wy) - dist(d.x, d.y, wx, wy)).slice(0, 2);
    for (const o of cover) { const k = dist(o.x, o.y, wx, wy) || 1, v = (4.4 + (o.six[RIT] / 99) * 3.6) * 0.75; o.vx = ((wx - o.x) / k) * v; o.vy = ((wy - o.y) / k) * v; }
  }

  // --- un paso de simulación ---
  step() {
    if (this.phase !== 'juego') return;
    const b = this.ball; this.t += DT;
    if (this.restart && this.t >= this.restart.at) this.doRestart();
    if (this.t >= this.pressAt) { this.pressAt = this.t + 0.3; this.pickPressers(); }
    this.movePlayers();
    if (b.state === 'held') this.held();
    else if (b.state === 'fly') this.fly();
    else if (b.state === 'loose') this.loose();
    if (b.state !== 'dead') this.stats[0][this.poss]++;
    for (const p of this.ps) if (p.on) this.time[p.id] = (this.time[p.id] ?? 0) + DT;
    if (!this.restart || this.restart.type !== 'penalty') this.clock();
  }
  private clock() {
    const end = this.period < 2 ? HALF * (this.period + 1) : 600 + 100 * (this.period - 1);
    if (this.t < end || (this.ball.state === 'fly' && this.ball.shot)) return;
    if (this.period === 0) { this.period = 1; this.phase = 'ht'; this.banner = 'Entretiempo'; this.aiTalk(); this.setDead('kickoff', 1, W / 2, H / 2, 1.5); this.banner = 'Entretiempo'; return; }
    if (this.period === 1 && this.ko && this.score[0] === this.score[1]) { this.period = 2; this.ev('info', 0, 'Hay tiempo suplementario'); this.setDead('kickoff', 0, W / 2, H / 2, 1.5); return; }
    if (this.period === 2) { this.period = 3; this.setDead('kickoff', 1, W / 2, H / 2, 1.5); return; }
    if (this.ko && this.score[0] === this.score[1]) this.shootout();
    this.phase = 'fin'; this.banner = 'Final del partido';
  }
  private shootout() {
    const s: [number, number] = [0, 0];
    const kick = (team: number, i: number) => {
      const ks = this.mates(team).filter(p => p.role !== 'POR').sort((a, c) => c.six[TIR] - a.six[TIR]);
      const k = ks[i % ks.length], gk = this.gk(1 - team);
      const ok = this.r() < clamp(0.76 + (k.six[TIR] - 70) / 300 - ((gk?.ovr ?? 60) - 72) / 300, 0.55, 0.92);
      if (ok) s[team]++;
      this.ev('penal', team, `${k.n} ${ok ? 'convierte' : 'falla'} (${s[0]}–${s[1]})`, k.id);
    };
    for (let i = 0; i < 5; i++) { kick(0, i); kick(1, i); }
    for (let i = 5; s[0] === s[1] && i < 30; i++) { kick(0, i); kick(1, i); }
    this.pens = s;
  }

  private pickPressers() {
    const b = this.ball;
    for (let team = 0; team < 2; team++) {
      const tac = this.teams[team].tac, range = 13 + tac.pres * 7;
      const cands = this.ps.map((p, i) => ({ i, p, d: dist(p.x, p.y, b.x, b.y) })).filter(c => c.p.on && c.p.team === team && c.p.role !== 'POR').sort((a, c) => a.d - c.d);
      const list: number[] = [];
      const inOwnHalf = this.tx(team, b.x) < 55 + tac.pres * 14;
      if (cands[0] && (b.state === 'loose' || cands[0].d < range || inOwnHalf)) list.push(cands[0].i);
      if (cands[1] && this.poss !== team && tac.pres >= 1 && cands[1].d < range * 0.8) list.push(cands[1].i);
      this.pressers[team] = list;
    }
  }

  private movePlayers() {
    const b = this.ball;
    for (let team = 0; team < 2; team++) {
      const tm = this.teams[team], tac = tm.tac, att = this.poss === team;
      const bx = this.tx(team, b.x), by = this.ty(team, b.y);
      const kick = this.restart?.type === 'kickoff';
      const st = tac.estilo ?? 0, fast = att && this.t - this.won[team] < 5;
      const L = clamp(bx - (att ? 30 : 14) + (tac.linea - 1) * 5 + (att ? (tac.ment - 2) * 3 : st === 1 ? -3 : 0), 10, 60);
      const line = att ? this.offsideLine(team) : 0;
      const width = att ? 0.88 + tac.ancho * 0.12 + (st === 3 ? 0.07 : 0) : 0.78 * (0.95 + tac.ancho * 0.05);     // al defender el ancho pesa poco
      for (let i = 0; i < this.ps.length; i++) {
        const p = this.ps[i]; if (p.team !== team || !p.on) continue;
        let gx: number, gy: number, rush = false;                                  // destino en coordenadas del equipo
        if (kick) { gx = p.sx * 0.6 + 2; gy = p.sy; }
        else if (p.role === 'POR') {
          const d = dist(bx, by, 0, H / 2), out = clamp(d * 0.09, 1.2, 9);
          gx = (bx / (d || 1)) * out; gy = H / 2 + ((by - H / 2) / (d || 1)) * out;
          if (b.state === 'fly' && !b.shot && !att) {                               // sale a cortar el pase largo si llega antes
            const fx = this.tx(team, b.tx), fy = this.ty(team, b.ty), rec = b.to >= 0 ? this.ps[b.to] : null;
            const dk = dist(p.x, p.y, b.tx, b.ty), dr = rec ? dist(rec.x, rec.y, b.tx, b.ty) : 99;
            if (fx < 19 && Math.abs(fy - H / 2) < 19 && dk < 13 && dk < dr - 1.5) { gx = fx; gy = fy; rush = true; }
          }
          if (b.state === 'loose' && bx < 16 && Math.abs(by - H / 2) < 20 && dist(p.x, p.y, b.x, b.y) < 12) { gx = bx; gy = by; }
          if (b.state === 'fly' && b.shot) { gx = 1; gy = clamp(this.ty(team, b.ty), H / 2 - 3.4, H / 2 + 3.4); }
        } else {
          const fwd = LINE[p.role] === 'DEL';
          gx = L + (p.sx - 22) * (att ? (st === 2 ? 0.88 : 0.95) : 0.62);
          if (att && st === 3 && bx > 72 && Math.abs(by - H / 2) > 14 && (fwd || p.role === 'MCO')) gx = Math.max(gx, 91 + (p.slot % 3) * 2.5);   // por las bandas: llegan al área a esperar el centro
          if (att && fwd && fast && st === 1) gx += 6;                               // en la contra los de arriba pican
          if (att && st === 4 && !fwd && b.state === 'fly' && b.air && LINE[p.role] === 'MED') gx += 4;  // segunda pelota
          gy = H / 2 + (p.sy - H / 2) * width + (by - H / 2) * (att ? 0.18 : 0.32);
          if (this.ord(p, 'abre')) gy += (p.sy >= H / 2 ? 1 : -1) * (att ? 7 : 3);
          else if (this.ord(p, 'cierra')) gy = H / 2 + (gy - H / 2) * 0.6;
          if (att) { gx = Math.min(gx + p.ox + (this.ord(p, 'sube') ? 6 : this.ord(p, 'queda') ? -7 : 0), line - 0.4, 101); gy += p.oy; }
          else gx = Math.min(gx, bx + (fwd ? (st === 1 ? 22 : 16) : 4)) + (this.ord(p, 'sube') ? 5 : 0);          // el que sube tarda en volver
          gx = clamp(gx, 3, 102); gy = clamp(gy, 2, H - 2);
          const mk = !att ? this.marker(p) : undefined;
          if (mk) { gx = clamp(this.tx(team, mk.x) - 1.3, 3, 100); gy = this.ty(team, mk.y); }       // marca personal: lo sigue a todos lados
          else if (!att && !fwd) {                                                 // marca: se arrima al rival más cercano, del lado del arco
            let near: MP | null = null, nd = 9;
            for (const o of this.ps) if (o.on && o.team !== team) { const d = dist(this.tx(team, o.x), this.ty(team, o.y), gx, gy); if (d < nd) { nd = d; near = o; } }
            const k = this.ord(p, 'fuerte') ? 0.64 : 0.45;
            if (near) { gx = gx * (1 - k) + (this.tx(team, near.x) - 1.5) * k; gy = gy * (1 - k) + this.ty(team, near.y) * k; }
          }
        }
        let wx = this.tx(team, gx), wy = this.ty(team, gy), sprint = rush ? 1 : 0.72;
        if (b.owner === i) continue;                                               // el que lleva la pelota se mueve en held()
        const sp = this.setPlay && b.state === 'dead' && p.role !== 'POR' ? this.setPlay.spots.get(i) : undefined;
        if (sp) { this.run(p, sp[0], sp[1], 0.95); continue; }
        if (b.state === 'dead' && this.restart && this.restart.type !== 'kickoff' && p.role !== 'POR') {
          const d = dist(wx, wy, b.x, b.y), min = this.restart.team === team ? 2 : 9.15;
          if (d < min) { wx = b.x + ((wx - b.x) / (d || 1)) * min; wy = b.y + ((wy - b.y) / (d || 1)) * min; }
        } else if (this.pressers[team].includes(i) && b.state !== 'dead' && (b.state !== 'held' || !att)) { wx = b.x + b.vx * 0.25; wy = b.y + b.vy * 0.25; sprint = 1; }
        else if (b.state === 'fly' && b.to === i) { wx = b.tx; wy = b.ty; sprint = 1; }
        else if (b.state === 'fly' && b.air && !b.shot && p.role !== 'POR' && dist(p.x, p.y, b.tx, b.ty) < 9) { wx = b.tx; wy = b.ty; sprint = 0.95; }
        else if (b.state === 'fly' && this.thru && !att && LINE[p.role] === 'DEF' && dist(p.x, p.y, b.tx, b.ty) < 20) { wx = b.tx; wy = b.ty; sprint = 1; }   // corre hacia atrás a cubrir el pase al espacio
        this.run(p, wx, wy, sprint);
      }
    }
    if (Math.floor(this.t * 10) % 25 === 0) for (const p of this.ps) { p.ox = (this.r() - 0.4) * 7; p.oy = (this.r() - 0.5) * 8; }
  }
  private run(p: MP, wx: number, wy: number, sprint: number) {
    const d = dist(p.x, p.y, wx, wy);
    const top = (4.4 + (p.six[RIT] / 99) * 3.6) * (0.74 + 0.26 * p.sta) * (p.hurt ? 0.6 : 1) * sprint;
    const sp = d < 0.4 ? 0 : Math.min(top, d * 2.2);
    const ax = d ? ((wx - p.x) / d) * sp : 0, ay = d ? ((wy - p.y) / d) * sp : 0;
    p.vx += (ax - p.vx) * 0.3; p.vy += (ay - p.vy) * 0.3;
    p.x = clamp(p.x + p.vx * DT, 0, W); p.y = clamp(p.y + p.vy * DT, 0, H);
    const effort = Math.hypot(p.vx, p.vy) / 8;
    const tac = this.teams[p.team].tac;                                           // el desgaste depende de cuánto corre, del físico y de lo que pide el planteo
    p.sta = Math.max(0.2, p.sta - (0.000028 + effort * effort * 0.00021) * (1.3 - p.six[FIS] / 180) * this.teams[p.team].drain * (1 + tac.pres * 0.16 + (tac.ritmo - 1) * 0.05 + (this.ord(p, 'sube') ? 0.08 : 0)));
    if (p.cool > 0) p.cool -= DT;
  }

  private held() {
    const b = this.ball, c = this.ps[b.owner]; if (!c || !c.on) { b.state = 'loose'; return; }
    const team = c.team; this.poss = team;
    // Conduce hacia el arco, abriéndose o cerrándose según por dónde venga.
    const cx = this.tx(team, c.x), cy = this.ty(team, c.y);
    const goalY = Math.abs(cy - H / 2) > 14 && cx < 84 ? cy : H / 2 + (cy - H / 2) * 0.5;
    if (c.role !== 'POR') this.run(c, this.tx(team, Math.min(cx + 10, 100)), this.ty(team, goalY), this.counter(team) ? (this.style(team) === 1 ? 0.97 : 0.9) : 0.84);
    b.x = c.x + (team ? -0.6 : 0.6); b.y = c.y; b.z = 0;
    // Quite: el rival más cercano intenta robar.
    for (const o of this.ps) {
      if (c.role === 'POR') break;
      if (!o.on || o.team === team || o.cool > 0 || o.role === 'POR' && dist(o.x, o.y, c.x, c.y) > 1.2) continue;
      if (dist(o.x, o.y, c.x, c.y) > 1.5) continue;
      o.cool = 0.9;
      const hard = this.ord(o, 'fuerte');
      const win = clamp(0.3 + (this.at(o, DEF) - this.at(c, REG)) / 230 + (hard ? 0.05 : 0) + (this.ord(c, 'encara') ? 0.07 : 0) + (this.marker(o) === c ? 0.07 : 0), 0.12, 0.66);
      const roll = this.r();
      if (roll < win) { b.owner = this.ps.indexOf(o); b.last = b.owner; this.won[o.team] = this.t; this.poss = o.team; if (this.tx(o.team, o.x) > 55) this.tact[2][o.team]++; o.rate += 0.1; c.rate -= 0.04; this.think = 0.5; return; }
      const area = this.tx(team, c.x) > 88.5 && Math.abs(this.ty(team, c.y) - H / 2) < 20.15;       // en el área propia se cuidan más
      if (roll < win + (0.27 + this.teams[o.team].tac.pres * 0.02 + (hard ? 0.07 : 0)) * (area ? 0.13 : 1)) { this.foul(o, c, hard); return; }
      c.rate += 0.03; this.think = Math.min(this.think, 0.25);
    }
    this.think -= DT;
    if (this.think <= 0 || (this.nearestOpp(c) < 1.9 && this.think < 0.5)) { this.think = (0.6 + this.r() * 0.5 + (2 - this.teams[team].tac.ritmo) * 0.15) * (this.style(team) === 2 ? 0.8 : 1); this.decide(c); }
  }
  private foul(o: MP, c: MP, hard = false) {
    const team = c.team, cx = this.tx(team, c.x), cy = this.ty(team, c.y);
    this.stats[4][o.team]++; o.rate -= 0.08;
    const inBox = cx > 88.5 && Math.abs(cy - H / 2) < 20.15;
    const card = this.r() * (hard ? 0.66 : 1);                                    // el que marca fuerte ve más tarjetas
    if (card < 0.003 || (card < 0.1 && o.yel === 1)) { o.on = false; o.rate -= 1.2; this.cards[o.id] = 'r'; this.ev('roja', o.team, `Roja para ${o.n}`, o.id); }
    else if (card < 0.19 && o.yel === 0) { o.yel = 1; o.rate -= 0.3; this.cards[o.id] = 'y'; this.ev('amarilla', o.team, `Amarilla para ${o.n}`, o.id); }
    if (this.r() < 0.011) { c.hurt = true; this.injured.push(c.id); this.ev('lesion', team, `${c.n} quedó sentido`, c.id); if (!this.teams[team].ai) this.humanWait = true; }
    if (inBox) { this.ev('info', team, `Penal para ${this.name(team)}`); this.setDead('penalty', team, team ? 11 : W - 11, H / 2, 3.5); }
    else this.setDead('fk', team, c.x, c.y, 2.2);
  }

  private fly() {
    const b = this.ball; b.age += DT;
    b.x += b.vx * DT; b.y += b.vy * DT;
    b.z = b.air ? Math.sin(Math.min(1, b.age / b.dur) * Math.PI) * Math.min(6, b.dur * 3.2) : 0;
    const passer = this.ps[b.last];
    if (!b.shot && !b.air && b.age > 0.25) {                                       // pase al ras: puede cortarlo un rival
      for (const o of this.ps) if (o.on && passer && o.team !== passer.team && dist(o.x, o.y, b.x, b.y) < 1.15 && this.r() < 0.32) { this.take(o); o.rate += 0.08; return; }
    }
    if (b.age < b.dur) return;
    if (b.shot) { this.resolveShot(); return; }
    b.x = b.tx; b.y = b.ty; b.z = 0;
    // Llegó: se la queda el más cercano.
    const near = this.ps.filter(p => p.on).map(p => ({ p, d: dist(p.x, p.y, b.x, b.y) })).filter(c => c.d < (b.air ? 3 : 2.3)).sort((a, c) => a.d - c.d);
    if (!near.length) { b.state = 'loose'; b.vx *= 0.45; b.vy *= 0.45; return; }
    let who = near[0].p;
    const kp = passer ? this.gk(1 - passer.team) : undefined;
    if (b.air && passer && kp && this.tx(passer.team, b.x) > 93 && dist(kp.x, kp.y, b.x, b.y) < 6.5) {   // centro al área chica: el arquero puede descolgarlo
      const crowd = near.filter(c => c.p.team === passer.team).length;
      if (this.r() < clamp(0.2 + (kp.ovr - 70) / 150 - crowd * 0.03, 0.08, 0.5)) { passer.rate -= 0.03; kp.rate += 0.12; kp.x = b.x; kp.y = b.y; this.take(kp); this.think = 1.2; return; }
    }
    if (b.air && near.length > 1) {                                                // disputa aérea
      const own = near.find(c => c.p.team === passer?.team), opp = near.find(c => c.p.team !== passer?.team);
      if (own && opp) who = this.r() < clamp(0.5 + (this.at(own.p, FIS) - this.at(opp.p, FIS)) / 160 - (own.d - opp.d) * 0.12, 0.15, 0.85) ? own.p : opp.p;
    }
    if (passer && who.team === passer.team) {
      this.stats[6][passer.team]++; passer.rate += 0.02; 
      const team = who.team, wx = this.tx(team, who.x), wy = this.ty(team, who.y);
      if (b.air && wx > 88 && Math.abs(wy - H / 2) < 14 && who.role !== 'POR') {   // cabezazo o remate de primera
        this.take(who); passer.rate += 0.1;
        this.shoot(who, clamp(this.at(who, TIR) / 1300 + this.at(who, FIS) / 1700 - (this.nearestOpp(who) < 1.5 ? 0.04 : 0) + (this.style(team) === 3 ? 0.03 : 0), 0.02, 0.22), false); return;
      }
      this.take(who); this.think = 0.35 + this.r() * 0.3;
    } else {
      if (passer) passer.rate -= 0.03;
      if (b.air && who.role !== 'POR' && this.tx(who.team, who.x) < 22) {          // despeje
        if (passer && this.r() < 0.48) { this.stats[3][passer.team]++; this.setDead('corner', passer.team, passer.team ? 0.5 : W - 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); return; }
        this.take(who); const up = this.mates(who.team).filter(p => LINE[p.role] !== 'POR' && LINE[p.role] !== 'DEF');
        const to = up[Math.floor(this.r() * up.length)]; if (to) this.pass(who, to, true); return;
      }
      this.take(who); who.rate += 0.06;
    }
  }
  private take(p: MP) { const b = this.ball; if (this.poss !== p.team) this.won[p.team] = this.t;
    const from = this.ps[b.last]; if (this.thru && from && from !== p && from.team === p.team) { this.tact[1][p.team]++; from.rate += 0.1; }
    this.thru = false; b.state = 'held'; b.owner = this.ps.indexOf(p); b.last = b.owner; b.shot = null; b.to = -1; b.vx = b.vy = 0; this.poss = p.team; this.think = 0.45; }

  private resolveShot() {
    const b = this.ball, s = b.shot!, shooter = this.ps[s.by], team = shooter.team, keeper = this.gk(1 - team);
    b.shot = null;
    if (s.goal) {
      this.score[team]++; shooter.rate += 1; this.scorers.push({ id: shooter.id, min: this.min, team });
      this.ev('gol', team, `Gol de ${shooter.n}`, shooter.id);
      for (const p of this.ps) if (p.on && p.team !== team && (LINE[p.role] === 'DEF' || p.role === 'POR')) p.rate -= 0.2;
      for (const p of this.ps) if (p.on && p.team === team) p.rate += 0.08;
      this.setDead('kickoff', 1 - team, W / 2, H / 2, 3.2); this.banner = `Gol de ${this.name(team)} · ${shooter.n}`; return;
    }
    if (s.save && keeper) {
      keeper.rate += 0.22;
      if (this.r() < 0.55) { keeper.x = b.x = team ? 2 : W - 2; b.y = keeper.y; this.take(keeper); this.think = 1.2; return; }
      if (this.r() < 0.6) { this.stats[3][team]++; this.setDead('corner', team, team ? 0.5 : W - 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); return; }
      b.state = 'loose'; b.x = team ? 7 + this.r() * 6 : W - 7 - this.r() * 6; b.y = H / 2 + (this.r() - 0.5) * 18; b.vx = b.vy = 0; return;
    }
    if (b.x > 3 && b.x < W - 3) {                                                  // bloqueado
      if (this.r() < 0.5 && this.tx(team, b.x) > 82) { this.stats[3][team]++; this.setDead('corner', team, team ? 0.5 : W - 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); return; }
      b.state = 'loose'; b.vx = (this.r() - 0.5) * 8; b.vy = (this.r() - 0.5) * 8; return;
    }
    this.setDead('goalkick', 1 - team, team ? 5.5 : W - 5.5, H / 2, 2.4);
  }

  private loose() {
    const b = this.ball; b.x += b.vx * DT; b.y += b.vy * DT; b.vx *= 0.93; b.vy *= 0.93; b.z = 0;
    const last = this.ps[b.last], lt = last ? last.team : 0;
    if (b.y <= 0 || b.y >= H) { this.setDead('throw', 1 - lt, b.x, b.y <= 0 ? 0.5 : H - 0.5, 1.4); return; }
    if (b.x <= 0 || b.x >= W) {
      const side = b.x <= 0 ? 0 : 1;                                              // arco que defiende el equipo `side`
      if (lt === side) { this.stats[3][1 - side]++; this.setDead('corner', 1 - side, side ? W - 0.5 : 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); }
      else this.setDead('goalkick', side, side ? W - 5.5 : 5.5, H / 2, 2.4);
      return;
    }
    for (const p of this.ps) if (p.on && dist(p.x, p.y, b.x, b.y) < 1.3) { this.take(p); return; }
  }

  // --- decisiones del rival y órdenes del usuario ---
  private aiTalk() { for (let t = 0; t < 2; t++) if (this.teams[t].ai) { const diff = this.score[t] - this.score[1 - t]; this.teams[t].tac = { ...this.teams[t].tac, ment: clamp(this.teams[t].tac.ment + (diff < 0 ? 1 : diff > 1 ? -1 : 0), 0, 4) }; } }
  /** El rival lee el partido: marca a la figura, busca la espalda de una defensa adelantada y cambia según el resultado. */
  private aiThink(team: number) {
    if (this.t < this.aiAt[team] || this.phase !== 'juego') return;
    this.aiAt[team] = this.t + 30;
    const tm = this.teams[team], opp = this.teams[1 - team], tac = { ...tm.tac }, diff = this.score[team] - this.score[1 - team], min = this.min, name = this.name(team);
    const said = this.aiNote[team], say = (k: string, text: string) => { if (!said.includes(k)) { said.push(k); this.ev('info', team, text); } };
    const mine = this.mates(team), theirs = this.mates(1 - team), avg = (l: MP[], k: number) => l.reduce((x, p) => x + p.six[k], 0) / (l.length || 1);
    if (!tac.marca && min >= 8) {
      const star = theirs.filter(p => LINE[p.role] === 'DEL' || p.role === 'MCO').sort((a, c) => c.ovr - a.ovr)[0];
      const dog = mine.filter(p => p.role === 'MCD' || p.role === 'MC' || p.role === 'DFC').sort((a, c) => c.six[DEF] - a.six[DEF])[0];
      if (star && dog && star.ovr >= mine.reduce((x, p) => x + p.ovr, 0) / mine.length + 3) { tac.marca = [dog.id, star.id]; say('marca', `${dog.n} sigue a ${star.n} por toda la cancha`); }
    }
    const pace = avg(mine.filter(p => LINE[p.role] === 'DEL'), RIT) - avg(theirs.filter(p => LINE[p.role] === 'DEF'), RIT);
    if (opp.tac.linea === 2 && pace > 1 && min >= 12 && tac.estilo !== 1 && tac.estilo !== 4) { tac.estilo = diff >= 0 ? 1 : 4; say('espalda', `${name} empieza a buscar la espalda de la defensa`); }
    if (opp.tac.ment >= 3 && diff >= 0 && min >= 12 && (tac.estilo ?? 0) === 0) { tac.estilo = 1; say('contra', `${name} espera y sale de contra`); }
    if (diff < 0 && min >= 60 && tac.ment < 3) { tac.ment = 3; tac.pres = 2; say('arriba', `${name} adelanta sus líneas`); }
    if (diff < 0 && min >= 78 && tac.ment < 4) { tac.ment = 4; tac.estilo = 4; say('todo', `${name} se juega todo`); }
    if (diff > 0 && min >= 70 && tac.ment > 1) { tac.ment = 1; tac.linea = Math.min(tac.linea, 1); tac.ritmo = 0; tac.estilo = 1; say('cuida', `${name} se repliega para cuidar la ventaja`); }
    if (diff <= 0 && said.includes('cuida') && tac.ment < 2) { tac.ment = diff < 0 ? 3 : 2; tac.ritmo = 1; }
    if (mine.length < 11 && !said.includes('menos')) { tac.ment = Math.max(0, tac.ment - 1); tac.linea = 0; say('menos', `${name} se reordena con uno menos`); }
    tm.tac = tac;
  }
  /** Cambios y lectura del rival. Con `todos`, también hace los cambios del equipo que maneja la persona (al simular). */
  aiManage(todos = false) {
    for (let team = 0; team < 2; team++) {
      if (!this.teams[team].ai && !todos) continue;
      if (this.teams[team].ai) this.aiThink(team);
      if (this.subs[team] >= 5 || this.t - this.lastSub[team] < 55) continue;
      const hurt = this.ps.find(p => p.on && p.team === team && p.hurt);
      const tired = this.ps.filter(p => p.on && p.team === team && p.role !== 'POR').sort((a, c) => a.sta - c.sta)[0];
      const diff = this.score[team] - this.score[1 - team];
      // Cambio táctico: si pierde, saca al de campo que peor está jugando; si gana al final, refresca la defensa.
      const flop = this.min >= 60 && diff < 0 ? this.ps.filter(p => p.on && p.team === team && LINE[p.role] !== 'POR' && LINE[p.role] !== 'DEF').sort((a, c) => a.rate - c.rate)[0] : null;
      const out = hurt ?? (this.t > 340 && tired && tired.sta < 0.55 ? tired : null) ?? (flop && flop.rate < 6.2 ? flop : null);
      if (!out) continue;
      const cands = this.bench[team].filter(p => (out.role === 'POR') === (p.pos === 'POR')).sort((a, c) => c.ovr * fit(c.pos, out.role) - a.ovr * fit(a.pos, out.role));
      if (cands[0]) this.cmd({ type: 'sub', team, out: out.id, in: cands[0].id });
    }
  }
  cmd(c: Cmd) {
    if (c.type === 'resume') { if (this.phase === 'ht') { this.phase = 'juego'; this.banner = ''; this.setDead('kickoff', 1, W / 2, H / 2, 1.5); } this.humanWait = false; return; }
    if (c.type === 'tac') { const old = this.teams[c.team].tac; this.teams[c.team].tac = c.tac; if (old.form !== c.tac.form) this.reshape(c.team); return; }
    if (c.type === 'talk') { if (this.talkDone[c.team]) return; this.talkDone[c.team] = true; const tm = this.teams[c.team]; tm.boost *= c.k === 1 ? 1.025 : 1.012; tm.tac = { ...tm.tac, ment: clamp(tm.tac.ment + (c.k === 0 ? 1 : c.k === 2 ? -1 : 0), 0, 4) }; return; }
    if (c.type === 'sub') {
      if (this.subs[c.team] >= 5) return;
      const out = this.ps.find(p => p.team === c.team && p.on && p.id === c.out), bi = this.bench[c.team].findIndex(p => p.id === c.in);
      if (!out || bi < 0) return;
      const inn = this.bench[c.team].splice(bi, 1)[0];
      Object.assign(out, { id: inn.id, n: inn.n, pos: inn.pos, ovr: inn.ovr, six: inn.six, sta: inn.sta0 ?? 1, yel: 0, rate: 6, hurt: false });
      this.subs[c.team]++; this.used[c.team].push(inn.id); this.lastSub[c.team] = this.t;
      this.ev('cambio', c.team, `Entra ${inn.n}`, inn.id);
    }
  }
  private reshape(team: number) {
    const spots = FORMS[this.teams[team].tac.form] ?? FORMS['4-3-3'];
    const free = this.ps.filter(p => p.team === team);
    spots.forEach((s, i) => {                                                      // cada puesto nuevo se lo queda el que mejor encaja
      let bi = 0, bv = -1; free.forEach((p, k) => { const v = fit(p.pos, s[0]) + (p.role === s[0] ? 0.05 : 0); if (v > bv) { bv = v; bi = k; } });
      const p = free.splice(bi, 1)[0]; if (p) { p.role = s[0]; p.sx = s[1]; p.sy = s[2]; p.slot = i; }
    });
  }

  frame(): Frame {
    const b = this.ball;
    return {
      t: this.t, min: this.min, score: [this.score[0], this.score[1]], ball: [b.x, b.y, b.z], owner: b.state === 'held' ? b.owner : -1, banner: this.banner, phase: this.phase,
      pos: this.ps.flatMap(p => (p.on ? [p.x, p.y] : [-9, -9])), sta: this.ps.map(p => p.sta), shot: !!b.shot,
    };
  }
  roster() { return this.ps.map(p => ({ id: p.id, n: p.n, team: p.team, role: p.role, on: p.on, yel: p.yel, hurt: p.hurt, rate: Math.round(clamp(p.rate, 3, 10) * 10) / 10, sta: p.sta })); }
  result(): Result {
    const rating: Record<number, number> = {};
    for (const p of this.ps) rating[p.id] = Math.round(clamp(p.rate + (p.role === 'POR' && this.score[1 - p.team] === 0 ? 0.6 : 0), 3, 10) * 10) / 10;
    const tot = this.stats[0][0] + this.stats[0][1] || 1;
    const stats = this.stats.map((s, i) => (i === 0 ? [Math.round((s[0] / tot) * 100), 100 - Math.round((s[0] / tot) * 100)] : s.slice()));
    return { gh: this.score[0], ga: this.score[1], pens: this.pens, events: this.events, rating, stats, tact: this.tact.map(x => x.slice()), mins: Object.fromEntries(Object.entries(this.time).map(([id, t]) => [id, Math.min(1, t / 600)])), played: [...this.used[0], ...this.used[1]], injured: this.injured, cards: this.cards, scorers: this.scorers };
  }
  /** Juega hasta el final sin pausas (para simular o saltar). */
  finish() {
    let guard = 0;
    while (this.phase !== 'fin' && guard++ < 200000) {
      if (this.phase === 'ht' || this.humanWait) this.cmd({ type: 'resume' });
      this.step(); if (guard % 50 === 0) this.aiManage(true);
    }
    return this.result();
  }
}
