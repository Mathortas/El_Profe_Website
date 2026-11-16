// Motor de partido 2D. Simula 22 jugadores y la pelota en pasos de 0,1 s.
// Un partido dura 600 s de simulación (300 por tiempo); el reloj los muestra como 90 minutos.
import { type Pos, type Rng, type Tactics, LINE, clamp, rngOf } from './core.ts';
import { FORMS, fit } from './data.ts';

export interface PIn { id: number; n: string; pos: Pos; ovr: number; six: number[] }
export interface TeamIn { code: string; name: string; xi: PIn[]; bench: PIn[]; tac: Tactics; boost: number; drain: number; pk?: number; ai: boolean }
export interface MatchInit { home: TeamIn; away: TeamIn; seed: number; ko: boolean }
export interface MEvent { min: number; type: 'gol' | 'amarilla' | 'roja' | 'cambio' | 'ocasion' | 'lesion' | 'info' | 'penal'; team: number; text: string; pid?: number }
export type Cmd = { type: 'sub'; team: number; out: number; in: number } | { type: 'tac'; team: number; tac: Tactics } | { type: 'talk'; team: number; k: number } | { type: 'resume' };
export interface Frame { t: number; min: number; score: [number, number]; ball: [number, number, number]; pos: number[]; owner: number; banner: string; phase: string; sta: number[] }
export interface Result { gh: number; ga: number; pens?: [number, number]; events: MEvent[]; rating: Record<number, number>; stats: number[][]; played: number[]; injured: number[]; cards: Record<number, string>; scorers: { id: number; min: number; team: number }[] }

interface MP extends PIn { team: number; slot: number; role: Pos; sx: number; sy: number; x: number; y: number; vx: number; vy: number; sta: number; on: boolean; yel: number; rate: number; cool: number; ox: number; oy: number; hurt: boolean }
const W = 105, H = 68, DT = 0.1, HALF = 300;
const RIT = 0, TIR = 1, PAS = 2, REG = 3, DEF = 4, FIS = 5;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export class Match {
  r: Rng; t = 0; phase: 'juego' | 'ht' | 'fin' | 'penales' = 'juego'; period = 0;
  teams: TeamIn[]; ps: MP[] = []; bench: PIn[][]; subs = [0, 0]; used: number[][] = [[], []];
  score: [number, number] = [0, 0]; events: MEvent[] = []; pens?: [number, number];
  // posesión, tiros, al arco, córners, faltas, pases, pases buenos
  stats = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, owner: -1, last: -1, state: 'dead' as 'held' | 'fly' | 'loose' | 'dead', tx: 0, ty: 0, air: false, shot: null as null | { goal: boolean; save: boolean; by: number; xg: number }, to: -1, dur: 0, age: 0 };
  restart: { type: string; team: number; at: number } | null = null;
  banner = ''; think = 0; pressers: number[][] = [[], []]; pressAt = 0; poss = 0;
  ko: boolean; talkDone = [false, false]; scorers: Result['scorers'] = []; injured: number[] = []; cards: Record<number, string> = {};
  lastSub = [0, 0]; humanWait = false;

  constructor(init: MatchInit) {
    this.r = rngOf(init.seed); this.teams = [init.home, init.away]; this.ko = init.ko;
    this.bench = [init.home.bench.slice(), init.away.bench.slice()];
    this.teams.forEach((tm, team) => {
      const spots = FORMS[tm.tac.form] ?? FORMS['4-3-3'];
      tm.xi.forEach((p, slot) => {
        const [role, sx, sy] = spots[slot];
        this.ps.push({ ...p, team, slot, role, sx, sy, x: team ? W - sx * 0.6 : sx * 0.6, y: team ? H - sy : sy, vx: 0, vy: 0, sta: 1, on: true, yel: 0, rate: 6, cool: 0, ox: 0, oy: 0, hurt: false });
        this.used[team].push(p.id);
      });
    });
    this.setDead('kickoff', 0, W / 2, H / 2, 1.5);
  }

  // --- utilidades ---
  private tx(team: number, x: number) { return team ? W - x : x; }               // a coordenadas del equipo (ataca hacia +x)
  private ty(team: number, y: number) { return team ? H - y : y; }
  private at(p: MP, k: number) {                                                   // atributo efectivo
    const tm = this.teams[p.team];
    return p.six[k] * fit(p.pos, p.role) * (0.8 + 0.2 * p.sta) * tm.boost * (p.hurt ? 0.7 : 1);
  }
  private name(team: number) { return this.teams[team].name; }
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
    this.restart = { type, team, at: this.t + delay }; this.poss = team;
    const label: Record<string, string> = { kickoff: 'Saque del medio', corner: 'Córner', fk: 'Tiro libre', throw: 'Lateral', goalkick: 'Saque de arco', penalty: 'Penal' };
    this.banner = `${label[type]} · ${this.name(team)}`;
  }
  private doRestart() {
    const { type, team } = this.restart!; this.restart = null; this.banner = '';
    const b = this.ball, mates = this.mates(team).filter(p => p.role !== 'POR' || type === 'goalkick');
    let taker: MP;
    if (type === 'goalkick') taker = this.gk(team) ?? mates[0];
    else if (type === 'penalty') taker = mates.find(p => p.id === this.teams[team].pk) ?? mates.slice().sort((a, c) => c.six[TIR] - a.six[TIR])[0];
    else if (type === 'corner' || type === 'fk') taker = mates.slice().sort((a, c) => (c.six[PAS] - dist(c.x, c.y, b.x, b.y) * 0.6) - (a.six[PAS] - dist(a.x, a.y, b.x, b.y) * 0.6))[0];
    else taker = mates.slice().sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))[0];
    if (!taker) return;
    taker.x = b.x; taker.y = b.y; b.owner = this.ps.indexOf(taker); b.last = b.owner; b.state = 'held';
    const gx = this.tx(team, b.x), dGoal = dist(gx, this.ty(team, b.y), W, H / 2);
    if (type === 'penalty') { this.shoot(taker, 0.76 + (this.at(taker, TIR) - 70) / 400, true); return; }
    if (type === 'corner' || (type === 'fk' && dGoal < 42 && dGoal > 24)) { this.cross(taker); return; }
    if (type === 'fk' && dGoal <= 24) { this.shoot(taker, 0.05 + this.at(taker, TIR) / 1400, false); return; }
    if (type === 'goalkick' && this.r() < 0.45) { this.longBall(taker); return; }
    this.think = 0.2;
  }

  // --- acciones con pelota ---
  private pass(from: MP, to: MP, air = false) {
    const b = this.ball, d = dist(from.x, from.y, to.x, to.y), pas = this.at(from, PAS);
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
    const team = from.team, box = this.mates(team).filter(p => p !== from && p.role !== 'POR').sort((a, c) => this.tx(team, c.x) - this.tx(team, a.x)).slice(0, 4);
    const target = box[Math.floor(this.r() * box.length)]; if (!target) { this.think = 0.1; return; }
    this.pass(from, target, true);
    // El centro va al área: se corrige el destino hacia la zona de remate.
    const b = this.ball, gx = team ? 9 + this.r() * 6 : W - 9 - this.r() * 6, gy = H / 2 + (this.r() - 0.5) * 16;
    b.tx = gx; b.ty = gy; const dd = dist(b.x, b.y, gx, gy) || 1; b.vx = ((gx - b.x) / dd) * 17; b.vy = ((gy - b.y) / dd) * 17; b.dur = dd / 17;
  }
  private longBall(from: MP) {
    const team = from.team, fwd = this.mates(team).filter(p => LINE[p.role] !== 'POR' && this.tx(team, p.x) > this.tx(team, from.x) + 18);
    const to = fwd[Math.floor(this.r() * fwd.length)]; if (to) this.pass(from, to, true); else this.think = 0.1;
  }
  private shoot(p: MP, xg: number, set: boolean) {
    const b = this.ball, team = p.team, keeper = this.gk(1 - team);
    const d = dist(this.tx(team, p.x), this.ty(team, p.y), W, H / 2), press = set ? 9 : this.nearestOpp(p);
    this.stats[1][team]++;
    const blocked = !set && press < 1.6 && this.r() < 0.24;
    const onT = clamp(0.36 + this.at(p, TIR) / 260 - d / 130 - (press < 2 ? 0.08 : 0), 0.12, 0.92);
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
    if (c.role === 'POR') { if (this.r() < 0.35) this.longBall(c); else { const m = this.bestPass(c, true); if (m) this.pass(c, m.m, m.air); else this.longBall(c); } return; }
    let shootV = -1, xg = 0;
    if (dGoal < 30) {
      const ang = Math.abs(Math.atan2(H / 2 + 3.66 - cy, W - cx) - Math.atan2(H / 2 - 3.66 - cy, W - cx));
      xg = clamp(0.52 * Math.exp(-dGoal / 8.2) * clamp(ang / 0.55, 0.25, 1.15) * (0.55 + this.at(c, TIR) / 140) * (press < 1.8 ? 0.6 : press < 3.5 ? 0.82 : 1), 0.008, 0.62);
      shootV = xg * 5.2 + (dGoal < 11 ? 0.45 : 0) + (tm.tac.ment - 2) * 0.04;
    }
    const wide = Math.abs(cy - H / 2) > 15;
    if (cx > 86 && wide && this.r() < 0.75) { this.cross(c); return; }
    const best = this.bestPass(c, false);
    // Conducir: cuánto espacio hay por delante.
    let space = 14;
    for (const o of this.ps) if (o.on && o.team !== team) { const ox = this.tx(team, o.x) - cx, oy = Math.abs(this.ty(team, o.y) - cy); if (ox > -1 && ox < 14 && oy < 5) space = Math.min(space, Math.hypot(ox, oy)); }
    const carryV = 0.26 + (Math.min(space, 12) / 12) * 0.32 + this.at(c, REG) / 420 - (press < 2 ? 0.22 : 0) + (cx > 70 ? 0.06 : 0);
    const passV = best ? best.v : -1;
    if (shootV >= passV && shootV >= carryV && shootV > 0.2) { this.shoot(c, xg, false); return; }
    if (best && passV >= carryV) { this.pass(c, best.m, best.air); return; }
    this.think = 0.35 + this.r() * 0.3 + (2 - tm.tac.ritmo) * 0.12;           // sigue conduciendo
  }
  private bestPass(c: MP, safe: boolean): { m: MP; v: number; air: boolean } | null {
    const team = c.team, tm = this.teams[team], cx = this.tx(team, c.x), line = this.offsideLine(team);
    let best: { m: MP; v: number; air: boolean } | null = null;
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
      let v = 0.3 + prog * (0.011 + tm.tac.ritmo * 0.003) + open * 0.36 - (air ? 0.18 + (1 - this.at(c, PAS) / 99) * 0.3 : lane * 0.45) + (inBox ? 0.25 : 0) + this.r() * 0.25;
      if (safe) v = open - Math.abs(prog) * 0.004 - lane;
      if (mx < 25 && cx > 40) v -= 0.25;
      if (!best || v > best.v) best = { m, v, air };
    }
    return best;
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
      const L = clamp(bx - (att ? 30 : 14) + (tac.linea - 1) * 5 + (att ? (tac.ment - 2) * 3 : 0), 10, 60);
      const line = att ? this.offsideLine(team) : 0;
      const width = (0.88 + tac.ancho * 0.12) * (att ? 1 : 0.78);
      for (let i = 0; i < this.ps.length; i++) {
        const p = this.ps[i]; if (p.team !== team || !p.on) continue;
        let gx: number, gy: number;                                                // destino en coordenadas del equipo
        if (kick) { gx = p.sx * 0.6 + 2; gy = p.sy; }
        else if (p.role === 'POR') {
          const d = dist(bx, by, 0, H / 2), out = clamp(d * 0.09, 1.2, 9);
          gx = (bx / (d || 1)) * out; gy = H / 2 + ((by - H / 2) / (d || 1)) * out;
          if (b.state === 'loose' && bx < 16 && Math.abs(by - H / 2) < 20 && dist(p.x, p.y, b.x, b.y) < 12) { gx = bx; gy = by; }
          if (b.state === 'fly' && b.shot) { gx = 1; gy = clamp(this.ty(team, b.ty), H / 2 - 3.4, H / 2 + 3.4); }
        } else {
          const fwd = LINE[p.role] === 'DEL';
          gx = L + (p.sx - 22) * (att ? 0.95 : 0.62);
          gy = H / 2 + (p.sy - H / 2) * width + (by - H / 2) * (att ? 0.18 : 0.32);
          if (att) { gx = Math.min(gx + p.ox, line - 0.4, 101); gy += p.oy; }
          else gx = Math.min(gx, bx + (fwd ? 16 : 4));
          gx = clamp(gx, 3, 102); gy = clamp(gy, 2, H - 2);
          if (!att && !fwd) {                                                      // marca: se arrima al rival más cercano, del lado del arco
            let near: MP | null = null, nd = 9;
            for (const o of this.ps) if (o.on && o.team !== team) { const d = dist(this.tx(team, o.x), this.ty(team, o.y), gx, gy); if (d < nd) { nd = d; near = o; } }
            if (near) { gx = gx * 0.55 + (this.tx(team, near.x) - 1.5) * 0.45; gy = gy * 0.55 + this.ty(team, near.y) * 0.45; }
          }
        }
        let wx = this.tx(team, gx), wy = this.ty(team, gy), sprint = 0.72;
        if (b.owner === i) continue;                                               // el que lleva la pelota se mueve en held()
        if (b.state === 'dead' && this.restart && this.restart.type !== 'kickoff' && p.role !== 'POR') {
          const d = dist(wx, wy, b.x, b.y), min = this.restart.team === team ? 2 : 9.15;
          if (d < min) { wx = b.x + ((wx - b.x) / (d || 1)) * min; wy = b.y + ((wy - b.y) / (d || 1)) * min; }
        } else if (this.pressers[team].includes(i) && b.state !== 'dead' && (b.state !== 'held' || !att)) { wx = b.x + b.vx * 0.25; wy = b.y + b.vy * 0.25; sprint = 1; }
        else if (b.state === 'fly' && b.to === i) { wx = b.tx; wy = b.ty; sprint = 1; }
        else if (b.state === 'fly' && b.air && !b.shot && p.role !== 'POR' && dist(p.x, p.y, b.tx, b.ty) < 9) { wx = b.tx; wy = b.ty; sprint = 0.95; }
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
    p.sta = Math.max(0.25, p.sta - (0.00028 + effort * effort * 0.00075) * (1.25 - p.six[FIS] / 200) * this.teams[p.team].drain * (1 + this.teams[p.team].tac.pres * 0.07));
    if (p.cool > 0) p.cool -= DT;
  }

  private held() {
    const b = this.ball, c = this.ps[b.owner]; if (!c || !c.on) { b.state = 'loose'; return; }
    const team = c.team; this.poss = team;
    // Conduce hacia el arco, abriéndose o cerrándose según por dónde venga.
    const cx = this.tx(team, c.x), cy = this.ty(team, c.y);
    const goalY = Math.abs(cy - H / 2) > 14 && cx < 84 ? cy : H / 2 + (cy - H / 2) * 0.5;
    if (c.role !== 'POR') this.run(c, this.tx(team, Math.min(cx + 10, 100)), this.ty(team, goalY), 0.84);
    b.x = c.x + (team ? -0.6 : 0.6); b.y = c.y; b.z = 0;
    // Quite: el rival más cercano intenta robar.
    for (const o of this.ps) {
      if (c.role === 'POR') break;
      if (!o.on || o.team === team || o.cool > 0 || o.role === 'POR' && dist(o.x, o.y, c.x, c.y) > 1.2) continue;
      if (dist(o.x, o.y, c.x, c.y) > 1.5) continue;
      o.cool = 0.9;
      const win = clamp(0.3 + (this.at(o, DEF) - this.at(c, REG)) / 230, 0.12, 0.55);
      const roll = this.r();
      if (roll < win) { b.owner = this.ps.indexOf(o); b.last = b.owner; this.poss = o.team; o.rate += 0.1; c.rate -= 0.04; this.think = 0.5; return; }
      if (roll < win + 0.085 + this.teams[o.team].tac.pres * 0.012) { this.foul(o, c); return; }
      c.rate += 0.03; this.think = Math.min(this.think, 0.25);
    }
    this.think -= DT;
    if (this.think <= 0 || (this.nearestOpp(c) < 1.9 && this.think < 0.5)) { this.think = 0.6 + this.r() * 0.5 + (2 - this.teams[team].tac.ritmo) * 0.15; this.decide(c); }
  }
  private foul(o: MP, c: MP) {
    const team = c.team, cx = this.tx(team, c.x), cy = this.ty(team, c.y);
    this.stats[4][o.team]++; o.rate -= 0.08;
    const inBox = cx > 88.5 && Math.abs(cy - H / 2) < 20.15;
    const card = this.r();
    if (card < 0.012 || (card < 0.2 && o.yel === 1)) { o.on = false; o.rate -= 1.2; this.cards[o.id] = 'r'; this.ev('roja', o.team, `Roja para ${o.n}`, o.id); }
    else if (card < 0.2) { o.yel = 1; o.rate -= 0.3; this.cards[o.id] = 'y'; this.ev('amarilla', o.team, `Amarilla para ${o.n}`, o.id); }
    if (this.r() < 0.02) { c.hurt = true; this.injured.push(c.id); this.ev('lesion', team, `${c.n} quedó sentido`, c.id); if (!this.teams[team].ai) this.humanWait = true; }
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
    if (b.air && near.length > 1) {                                                // disputa aérea
      const own = near.find(c => c.p.team === passer?.team), opp = near.find(c => c.p.team !== passer?.team);
      if (own && opp) who = this.r() < clamp(0.5 + (this.at(own.p, FIS) - this.at(opp.p, FIS)) / 160 - (own.d - opp.d) * 0.12, 0.15, 0.85) ? own.p : opp.p;
    }
    if (passer && who.team === passer.team) {
      this.stats[6][passer.team]++; passer.rate += 0.02;
      const team = who.team, wx = this.tx(team, who.x), wy = this.ty(team, who.y);
      if (b.air && wx > 88 && Math.abs(wy - H / 2) < 14 && who.role !== 'POR') {   // cabezazo o remate de primera
        this.take(who); passer.rate += 0.1;
        this.shoot(who, clamp(0.07 + this.at(who, TIR) / 900 + this.at(who, FIS) / 1400 - (this.nearestOpp(who) < 1.5 ? 0.04 : 0), 0.03, 0.3), false); return;
      }
      this.take(who); this.think = 0.35 + this.r() * 0.3;
    } else {
      if (passer) passer.rate -= 0.03;
      if (b.air && who.role !== 'POR' && this.tx(who.team, who.x) < 22) {          // despeje
        if (passer && this.r() < 0.3) { this.stats[3][passer.team]++; this.setDead('corner', passer.team, passer.team ? 0.5 : W - 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); return; }
        this.take(who); const up = this.mates(who.team).filter(p => LINE[p.role] !== 'POR' && LINE[p.role] !== 'DEF');
        const to = up[Math.floor(this.r() * up.length)]; if (to) this.pass(who, to, true); return;
      }
      this.take(who); who.rate += 0.06;
    }
  }
  private take(p: MP) { const b = this.ball; b.state = 'held'; b.owner = this.ps.indexOf(p); b.last = b.owner; b.shot = null; b.to = -1; b.vx = b.vy = 0; this.poss = p.team; this.think = 0.45; }

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
      if (this.r() < 0.3 && this.tx(team, b.x) > 86) { this.stats[3][team]++; this.setDead('corner', team, team ? 0.5 : W - 0.5, b.y < H / 2 ? 0.5 : H - 0.5, 3.2); return; }
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
  aiManage() {
    for (let team = 0; team < 2; team++) {
      if (!this.teams[team].ai || this.subs[team] >= 5 || this.t - this.lastSub[team] < 55) continue;
      const hurt = this.ps.find(p => p.on && p.team === team && p.hurt);
      const tired = this.ps.filter(p => p.on && p.team === team && p.role !== 'POR').sort((a, c) => a.sta - c.sta)[0];
      const out = hurt ?? (this.t > 340 && tired && tired.sta < 0.62 ? tired : null);
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
      Object.assign(out, { id: inn.id, n: inn.n, pos: inn.pos, ovr: inn.ovr, six: inn.six, sta: 1, yel: 0, rate: 6, hurt: false });
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
      pos: this.ps.flatMap(p => (p.on ? [p.x, p.y] : [-9, -9])), sta: this.ps.map(p => p.sta),
    };
  }
  roster() { return this.ps.map(p => ({ id: p.id, n: p.n, team: p.team, role: p.role, on: p.on, yel: p.yel, hurt: p.hurt, rate: Math.round(clamp(p.rate, 3, 10) * 10) / 10, sta: p.sta })); }
  result(): Result {
    const rating: Record<number, number> = {};
    for (const p of this.ps) rating[p.id] = Math.round(clamp(p.rate + (p.role === 'POR' && this.score[1 - p.team] === 0 ? 0.6 : 0), 3, 10) * 10) / 10;
    const tot = this.stats[0][0] + this.stats[0][1] || 1;
    const stats = this.stats.map((s, i) => (i === 0 ? [Math.round((s[0] / tot) * 100), 100 - Math.round((s[0] / tot) * 100)] : s.slice()));
    return { gh: this.score[0], ga: this.score[1], pens: this.pens, events: this.events, rating, stats, played: [...this.used[0], ...this.used[1]], injured: this.injured, cards: this.cards, scorers: this.scorers };
  }
  /** Juega hasta el final sin pausas (para simular o saltar). */
  finish() {
    let guard = 0;
    while (this.phase !== 'fin' && guard++ < 200000) {
      if (this.phase === 'ht' || this.humanWait) this.cmd({ type: 'resume' });
      this.step(); if (guard % 50 === 0) this.aiManage();
    }
    return this.result();
  }
}
