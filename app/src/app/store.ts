// Estado de la aplicación: la partida vive en memoria y se guarda sola en el navegador (IndexedDB).
import { useSyncExternalStore } from 'react';
import type { Game } from '../game/core.ts';
import type { RawWorld } from '../game/players.ts';
import { newGame, setWorld } from '../game/flow.ts';
import { migrate } from '../game/save.ts';
import { kitOf } from '../game/data.ts';
import { applyNation } from '../design/theme';

export type View = 'despacho' | 'entre' | 'lista' | 'fecha' | 'torneos' | 'oficina';
interface State { g: Game | null; raw: RawWorld | null; ready: boolean; view: View; player: number; compare: number[]; ver: number; hasSave: boolean }
let state: State = { g: null, raw: null, ready: false, view: 'despacho', player: 0, compare: [], ver: 0, hasSave: false };
const subs = new Set<() => void>();
const emit = () => { state = { ...state, ver: state.ver + 1 }; subs.forEach(f => f()); };
export const useStore = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);
export const getGame = () => state.g!;

// --- Guardado ---
const DB = 'el-profe', STORE = 'kv';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const rq = fn(d.transaction(STORE, mode).objectStore(STORE)); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { if (state.g) idb('readwrite', s => s.put(JSON.stringify(state.g), 'save')).catch(() => {}); }, 400);
}

function accent(code: string) {
  const [a, b] = kitOf(code);
  const sat = (c: string) => { const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bl = n & 255; return Math.max(r, g, bl) - Math.min(r, g, bl); };
  const [primary, secondary] = sat(a) >= sat(b) ? [a, b] : [b, a];
  applyNation({ code, name: code, flag: '', primary, secondary });
}

export async function boot() {
  const raw = (await import('../data/world.json')).default as unknown as RawWorld;
  setWorld(raw);
  let g: Game | null = null;
  try { const s = await idb<string | undefined>('readonly', st => st.get('save')); if (s) g = migrate(JSON.parse(s)); } catch { /* sin guardado */ }
  state = { ...state, raw, ready: true, hasSave: !!g, g: null };
  (window as unknown as { __save?: Game | null }).__save = g;
  emit();
}
export function resume() { const g = (window as unknown as { __save?: Game | null }).__save; if (g) { state.g = g; accent(g.me); state.view = viewFor(g); emit(); } }
export function start(me: string, dt: string) {
  const g = newGame(state.raw!, me, dt || 'Profe', Math.floor(Math.random() * 2 ** 31));
  state.g = g; state.view = 'despacho'; accent(me); save(); emit();
}
export function wipe() { state.g = null; state.hasSave = false; idb('readwrite', s => s.delete('save')).catch(() => {}); emit(); }
/** Cambia la partida y avisa a la interfaz. */
export function act(fn: (g: Game) => void) { if (!state.g) return; fn(state.g); save(); emit(); }
export function go(view: View) { state.view = view; emit(); }
export function openPlayer(id: number) { state.player = id; emit(); }
export function compare(ids: number[]) { state.compare = ids; emit(); }
export const viewFor = (g: Game): View => (g.ph === 'entre' ? 'entre' : g.ph === 'lista' ? 'lista' : 'fecha');
