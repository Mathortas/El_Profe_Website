import type { ReactNode } from 'react';
import { Activity, Building2, Landmark, Mic, Shirt, Users, Handshake } from 'lucide-react';
import { type Game, type P, LINE, ageOf } from '../game/core.ts';
import { curStop, nat, LEAGUES } from '../game/flow.ts';
import { seenRange } from '../game/players.ts';
import { Flag, Meter, Rating, type Player as CardPlayer, type Form } from '../design';

export const year = (g: Game) => curStop(g).y;
export const age = (g: Game, p: P) => ageOf(p, year(g));
export const clubOf = (g: Game, p: P) => p.club || (p.lg ? '—' : `Liga de ${nat(g, p.nat).n}`);
export const leagueOf = (p: P) => (p.lg ? LEAGUES[p.lg]?.[0] ?? 'Otra liga' : 'Liga local');
export const money = (k: number) => (k >= 1000 ? `€${(k / 1000).toFixed(k >= 10000 ? 0 : 1)} M` : `€${k} mil`);
export const known = (p: P) => !p.gen || p.seen >= 0.95;
export const ovrText = (p: P) => (known(p) ? String(p.ovr) : seenRange(p, 'ovr').join('–'));
export const potText = (p: P) => (known(p) ? String(p.pot) : seenRange(p, 'pot').join('–'));
export const status = (p: P) => (p.inj ? `Lesionado (${p.inj} ${p.inj === 1 ? 'fecha' : 'fechas'})` : p.sus ? 'Suspendido' : p.ret ? 'No disponible' : '');

export function toCard(g: Game, p: P): CardPlayer {
  return {
    id: p.id, name: p.n, pos: p.pos, line: LINE[p.pos], club: clubOf(g, p), league: leagueOf(p), age: age(g, p), ovr: p.ovr, pot: p.pot, form: p.form as Form,
    minutes: Math.round(p.mins * 360), value: p.val / 1000, six: p.six as CardPlayer['six'], dual: p.nat2 ? nat(g, p.nat2).n : undefined,
    caps: p.caps, yellows: p.yel, last5: p.last, injury: p.inj ? p.injWhat ?? 'Lesión' : undefined,
  };
}
export function Nat({ g, c, short }: { g: Game; c: string; short?: boolean }) {
  const n = nat(g, c);
  return <span className="nat"><Flag iso={n.iso} />{short ? n.c : n.n}</span>;
}
export function Lvl({ p }: { p: P }) {
  return known(p) ? <Rating value={p.ovr} size="sm" /> : <span className="range num">{ovrText(p)}</span>;
}
export function Meters({ g, all }: { g: Game; all?: boolean }) {
  const m = g.meters, d = g.delta;
  return (
    <div className="meters">
      <Meter label="Federación" value={m.fed} delta={d.fed} icon={<Landmark size={15} />} />
      <Meter label="Prensa" value={m.prensa} delta={d.prensa} icon={<Mic size={15} />} />
      <Meter label="Hinchas" value={m.hinchas} delta={d.hinchas} icon={<Users size={15} />} />
      <Meter label="Vestuario" value={m.vestuario} delta={d.vestuario} icon={<Shirt size={15} />} />
      {all && <Meter label="Clubes" value={m.clubes} delta={d.clubes} icon={<Building2 size={15} />} />}
      {all && <Meter label="Entendimiento" value={m.quimica} delta={d.quimica} icon={<Handshake size={15} />} />}
    </div>
  );
}
export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return <div className="stat"><span className="stat__l">{icon ?? <Activity size={14} />}{label}</span><b className="num">{value}</b></div>;
}
export const score = (gh?: number, ga?: number, pens?: [number, number]) => (gh === undefined ? '–' : `${gh}–${ga}${pens ? ` (${pens[0]}–${pens[1]} pen.)` : ''}`);
