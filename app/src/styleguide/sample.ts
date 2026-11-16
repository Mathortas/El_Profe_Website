import type { Player } from '../design/types';

// Datos de ejemplo para la guía. No son datos reales.
export const PLAYERS: Player[] = [
  { id: 1, caps: 129, last5: [6.8, 7.0, 6.5, 7.4, 6.9], name: 'Pedro Gallese', pos: 'POR', line: 'POR', club: 'Deportivo Cali', league: 'Colombia', age: 37, ovr: 74, pot: 74, form: 0, minutes: 270, value: 0.3, six: [45, 30, 58, 40, 36, 60], alerts: ['Si queda afuera otra vez, puede renunciar a la selección'] },
  { id: 2, name: 'Diego Romero', pos: 'POR', line: 'POR', club: 'Universitario', league: 'Perú', age: 25, ovr: 69, pot: 75, form: 1, minutes: 360, value: 1.2, six: [48, 25, 52, 38, 30, 62] },
  { id: 4, name: 'Renzo Garcés', pos: 'DFC', line: 'DEF', club: 'Alianza Lima', league: 'Perú', age: 31, ovr: 72, pot: 72, form: 1, minutes: 360, value: 1.3, six: [62, 38, 58, 52, 74, 76] },
  { id: 5, caps: 18, yellows: 2, last5: [6.1, 6.0, 6.4], name: 'Oliver Sonne', pos: 'LD', line: 'DEF', club: 'Burnley', league: 'Inglaterra', age: 26, ovr: 74, pot: 77, form: -2, minutes: 0, value: 4.6, six: [80, 55, 68, 66, 70, 72], dual: 'Dinamarca', alerts: ['Sin minutos en su club en el último mes', '13 horas de viaje hasta Lima'] },
  { id: 6, caps: 2, last5: [7.6, 7.9, 7.1, 8.0, 7.4], name: 'Jonathan García', pos: 'LD', line: 'DEF', club: 'Alianza Lima', league: 'Perú', age: 20, ovr: 70, pot: 80, form: 2, minutes: 360, value: 0.1, six: [77, 40, 61, 64, 66, 63], alerts: ['Su club pide que no juegue los dos partidos completos'] },
  { id: 7, caps: 31, yellows: 1, last5: [7.0, 6.9, 7.3, 7.1, 6.8], name: 'Marcos López', pos: 'LI', line: 'DEF', club: 'Copenhague', league: 'Dinamarca', age: 27, ovr: 75, pot: 76, form: 1, minutes: 270, value: 4.4, six: [79, 52, 70, 71, 69, 70] },
  { id: 10, caps: 22, last5: [6.9, 7.2, 6.2], injury: 'Molestia en el aductor', name: 'Alfonso Barco', pos: 'MC', line: 'MED', club: 'Rijeka', league: 'Croacia', age: 25, ovr: 73, pot: 78, form: -1, minutes: 200, value: 1.0, six: [66, 64, 74, 72, 62, 66], alerts: ['Molestia en el aductor, se revisa el lunes'] },
  { id: 11, caps: 14, last5: [7.3, 7.0, 7.5, 6.9, 7.2], name: 'Erick Noriega', pos: 'MCD', line: 'MED', club: 'Grêmio', league: 'Brasil', age: 25, ovr: 74, pot: 79, form: 1, minutes: 360, value: 5.9, six: [64, 55, 72, 68, 73, 74] },
  { id: 14, name: 'André Carrillo', pos: 'ED', line: 'MED', club: 'Corinthians', league: 'Brasil', age: 36, ovr: 71, pot: 71, form: 1, minutes: 240, value: 0.7, six: [70, 66, 74, 79, 32, 58] },
  { id: 18, name: 'Adrián Ugarriza', pos: 'DC', line: 'DEL', club: 'Hapoel Beer Sheva', league: 'Israel', age: 28, ovr: 72, pot: 73, form: 2, minutes: 360, value: 1.6, six: [74, 73, 58, 68, 30, 72] },
  { id: 19, name: 'Gianluca Lapadula', pos: 'DC', line: 'DEL', club: 'Universitario', league: 'Perú', age: 37, ovr: 71, pot: 71, form: -1, minutes: 150, value: 0.3, six: [55, 74, 62, 64, 38, 72], dual: 'Italia' },
  { id: 22, caps: 9, last5: [6.4, 6.6, 6.9, 6.3, 6.7], name: 'Bryan Reyna', pos: 'EI', line: 'DEL', club: 'Belgrano', league: 'Argentina', age: 27, ovr: 64, pot: 68, form: 0, minutes: 220, value: 1.4, six: [84, 62, 60, 74, 30, 58] },
];

export const ATTRS = (p: Player) => {
  const [rit, tir, pas, reg, def, fis] = p.six;
  const j = (v: number, d: number) => Math.max(20, Math.min(97, v + d));
  return [
    { title: 'Ataque', items: [['Definición', j(tir, 2)], ['Remate de lejos', j(tir, -6)], ['Desmarque', j(rit, 4)]] as [string, number][] },
    { title: 'Técnica', items: [['Pase corto', j(pas, 3)], ['Pase largo', j(pas, -4)], ['Regate', reg], ['Control', j(reg, -3)], ['Centros', j(pas, 1)]] as [string, number][] },
    { title: 'Defensa', items: [['Marca', def], ['Entrada', j(def, -2)], ['Anticipación', j(def, -5)], ['Cabezazo', j(fis, 4)]] as [string, number][] },
    { title: 'Físico', items: [['Velocidad', j(rit, 2)], ['Aceleración', j(rit, 3)], ['Resistencia', j(fis, 2)], ['Fuerza', j(fis, -4)]] as [string, number][] },
    { title: 'Mental', items: [['Visión', j(pas, 1)], ['Compostura', j(p.ovr, 0)], ['Liderazgo', j(p.ovr, p.age > 30 ? 6 : -8)], ['Sacrificio', j(def, 3)]] as [string, number][] },
  ];
};
