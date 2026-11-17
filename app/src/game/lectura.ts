// Lo que ve el ayudante: lee los números del partido y dice qué está pasando y por qué.
// Sirve durante el partido (con lo jugado hasta el minuto) y en el resumen.
import type { Tactics } from './core.ts';

export interface Lectura { tono: 'bien' | 'ojo' | 'dato'; texto: string; peso: number }
export interface Datos {
  my: number; min: number;
  stats: number[][];   // posesión, tiros, al arco, córners, faltas, pases, pases buenos, fueras de juego
  tact: number[][];    // al espacio, llegaron, recuperaciones altas, tiros de contra, centros, pelotazos
  fisico?: number;     // promedio de los once que están en la cancha, 0..1
  fisicoRival?: number;
  tac: Tactics;
}

/** Hasta `max` observaciones, las más importantes primero. Antes del minuto 10 no hay de qué hablar. */
export function leer(d: Datos, max = 3): Lectura[] {
  const { my, min, stats: s, tact: t, tac } = d, op = 1 - my;
  if (min < 15 || !s.length || !t.length) return [];
  const k = Math.min(1, min / 90), n = (base: number) => Math.max(3, Math.round(base * k));
  const out: Lectura[] = [], add = (tono: Lectura['tono'], peso: number, texto: string) => out.push({ tono, texto, peso });
  const pos = s[0][my], tiros = s[1][my], tirosR = s[1][op];

  if (t[1][op] >= n(4)) add('ojo', 9, `Nos pican a la espalda: ${t[1][op]} pases al espacio del rival llegaron a destino.${tac.linea === 2 ? ' Con la línea adelantada es lo que más duele.' : tac.linea === 1 ? ' Retrasar la línea cierra ese hueco.' : ''}`);
  if (t[3][op] >= n(5)) add('ojo', 8, `Nos agarran mal parados: ${t[3][op]} remates de contraataque.${tac.ment >= 3 ? ' Vamos con mucha gente arriba.' : ''}`);
  if (t[2][op] >= n(9)) add('ojo', 7, `Nos roban en salida: ${t[2][op]} recuperaciones del rival en nuestro campo.${(tac.estilo ?? 0) === 2 ? ' Salir jugando corto nos está costando.' : ' Un pase más largo saca la pelota de esa zona.'}`);
  if (d.fisico !== undefined && d.fisicoRival !== undefined && d.fisico < d.fisicoRival - 0.08) add('ojo', 7, `Tenemos menos piernas que el rival: ${Math.round(d.fisico * 100)} % contra ${Math.round(d.fisicoRival * 100)} %.${tac.pres === 2 ? ' La presión alta se paga.' : ''}`);
  else if (d.fisico !== undefined && d.fisico < 0.5 && min < 75) add('ojo', 8, `El equipo está fundido: le queda ${Math.round(d.fisico * 100)} % de piernas.${tac.pres === 2 ? ' La presión alta se paga.' : ' Hacen falta cambios.'}`);
  else if (d.fisico !== undefined && tac.pres === 2 && d.fisico < 0.62 && min < 70) add('ojo', 6, `La presión alta está gastando al equipo antes de tiempo (${Math.round(d.fisico * 100)} % de piernas).`);
  if (min >= 30 && s[4][my] >= Math.max(8, n(16))) add('ojo', 4, `Hacemos muchas faltas (${s[4][my]}). Con amarillas encima conviene marcar con más cuidado.`);
  if (pos >= 58 && tiros <= tirosR) add('ojo', 6, `Tenemos la pelota (${pos} %) pero no lastimamos: ${tiros} remates contra ${tirosR}.`);
  if (pos <= 40 && (tac.estilo ?? 0) !== 1) add('ojo', 5, `El rival nos maneja la pelota (${100 - pos} %).${tac.pres === 0 ? ' Esperando atrás se la dejamos.' : ''}`);

  if (t[1][my] >= n(4)) add('bien', 7, `Encontramos espacio a la espalda: ${t[1][my]} pases al espacio llegaron.`);
  if (t[3][my] >= n(5)) add('bien', 6, `El contraataque funciona: ${t[3][my]} remates saliendo rápido.`);
  if (t[2][my] >= n(9)) add('bien', 6, `La presión rinde: ${t[2][my]} pelotas recuperadas en campo rival.`);
  if (pos <= 42 && (tac.estilo ?? 0) === 1 && tiros >= tirosR) add('bien', 5, `Les dejamos la pelota y llegamos igual: ${tiros} remates contra ${tirosR}.`);
  if (pos >= 58 && tiros > tirosR + 2) add('bien', 5, `Dominamos: ${pos} % de posesión y ${tiros} remates.`);
  if ((tac.estilo ?? 0) === 3 && t[4][my] >= n(14) && s[2][my] <= n(3)) add('ojo', 5, `Tiramos ${t[4][my]} centros y casi ninguno termina en el arco. Falta alguien que gane arriba.`);
  if ((tac.estilo ?? 0) === 4 && t[5][my] >= n(20) && pos < 45) add('dato', 3, `Juego directo: ${t[5][my]} pelotazos. Se pierde la pelota seguido, es el precio.`);
  if (s[7][op] >= n(4)) add('bien', 3, `La línea los deja en fuera de juego seguido (${s[7][op]} veces).`);
  if (s[7][my] >= n(4)) add('dato', 3, `Caemos mucho en fuera de juego (${s[7][my]}): los de arriba arrancan antes de tiempo.`);

  return out.sort((a, b) => b.peso - a.peso).slice(0, max);
}
