import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jugarCiclo, jugarParada, nueva } from './ayuda.ts';
import { migrate, SAVE_V } from '../src/game/save.ts';

for (const me of ['PER', 'ARG', 'BOL']) {
  test(`un ciclo completo con ${me} termina sin errores`, () => {
    const g = nueva(me, 7), n = jugarCiclo(g);
    assert.ok(n >= 30, `se jugaron ${n} partidos`);
    assert.equal(g.record.pj, n);
    assert.ok(g.history.length > 0, 'el ciclo deja historia');
    assert.ok(g.players.every(p => Number.isFinite(p.ovr) && p.ovr >= 30 && p.ovr <= 99 && p.six.every(Number.isFinite)));
    for (const k of Object.values(g.meters)) assert.ok(k >= 0 && k <= 100);
  });
}

test('una partida guardada y vuelta a cargar sigue igual', () => {
  const a = nueva('PER', 11); jugarParada(a); jugarParada(a);
  const b = migrate(JSON.parse(JSON.stringify(a)))!;
  jugarParada(a); jugarParada(b);
  assert.deepEqual(b.record, a.record);
  assert.deepEqual(b.meters, a.meters);
});

test('una partida de la versión anterior se actualiza y se puede seguir jugando', () => {
  const g = nueva('CHI', 3); jugarParada(g);
  const vieja = JSON.parse(JSON.stringify(g));
  vieja.v = 1; delete vieja.lineup.tac.estilo; delete vieja.lineup.tac.ord; delete vieja.lineup.tac.corner; delete vieja.lineup.fk; delete vieja.lineup.ck;
  for (const p of vieja.players) delete p.fat;
  const m = migrate(vieja);
  assert.ok(m); assert.equal(m.v, SAVE_V); assert.equal(m.lineup.tac.estilo, 0);
  assert.ok(jugarParada(m) > 0);
});

test('un guardado roto o de una versión más nueva no se carga', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate({ v: 1 }), null);
  const g = JSON.parse(JSON.stringify(nueva('PER', 1))); g.v = SAVE_V + 1;
  assert.equal(migrate(g), null);
});
