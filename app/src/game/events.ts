// Momentos: situaciones cortas con dos o tres salidas. Cada opción dice lo que cuesta antes de elegir.
import { type Game, type P, type Pending, type Rng, ageOf, clamp, rngFor } from './core.ts';
import { homeAltitude } from './data.ts';
import { available, poolOf } from './players.ts';

type At = 'entre' | 'lista' | 'concentracion' | 'post';
interface Ctx { p?: P; rival?: string; r: Rng }
interface Opt { t: string; hint: string; run: (g: Game, c: Ctx) => string }
export interface Ev { id: string; at: At; place: string; title: (c: Ctx) => string; text: (g: Game, c: Ctx) => string; cond: (g: Game) => boolean; who?: (g: Game) => P | undefined; once?: boolean; opts: Opt[] }

const M = (g: Game, d: Partial<Game['meters']>) => { for (const k in d) { const key = k as keyof Game['meters']; const v = Math.round(d[key]!); g.meters[key] = clamp(g.meters[key] + v, 0, 100); g.delta[key] = (g.delta[key] ?? 0) + v; } };
const stop = (g: Game) => g.stops[g.stop];
const squad = (g: Game) => g.squad.map(id => g.players.find(p => p.id === id)!).filter(Boolean);
const pool = (g: Game) => poolOf(g, g.me).filter(available);
const star = (g: Game) => [...(squad(g).length ? squad(g) : pool(g))].sort((a, b) => b.ovr - a.ovr)[0];
const veteran = (g: Game) => pool(g).filter(p => ageOf(p, stop(g).y) >= 32 && p.caps >= 20).sort((a, b) => b.caps - a.caps)[0];
const kid = (g: Game) => pool(g).filter(p => ageOf(p, stop(g).y) <= 21).sort((a, b) => b.pot - a.pot)[0];
const dual = (g: Game) => pool(g).filter(p => p.nat2 && !p.tied && ageOf(p, stop(g).y) <= 23).sort((a, b) => b.pot - a.pot)[0];
const rebel = (g: Game) => [...squad(g)].sort((a, b) => a.per[2] - b.per[2])[0];
const unused = (g: Game) => squad(g).filter(p => !g.log.slice(0, g.fx.length).some(l => l.rating[p.id] !== undefined)).sort((a, b) => b.ovr - a.ovr)[0];
const left = (g: Game) => pool(g).sort((a, b) => b.ovr - a.ovr).slice(0, 9).find(p => !g.squad.includes(p.id));
const lastLog = (g: Game) => g.log[0];
const awayHigh = (g: Game) => g.fx.find(f => f.a === g.me && !f.neutral && homeAltitude(f.h) >= 2500);
const rel = (p: P | undefined, d: number) => { if (p) p.rel = clamp(p.rel + d, 0, 100); };

export const EVENTS: Ev[] = [
  { id: 'club-descanso', at: 'entre', place: 'Llamada del club', who: star, cond: g => g.fx.length >= 4, title: c => `El club de ${c.p!.n} pide cuidarlo`,
    text: (_, c) => `${c.p!.club || 'Su club'} viene de una racha de partidos y su técnico pide que ${c.p!.n} no juegue los cuatro de la fecha.`,
    opts: [
      { t: 'Aceptar: jugará dos como máximo', hint: 'Mejora el trato con los clubes. Lo tendrás menos.', run: (g, c) => { M(g, { clubes: 6 }); rel(c.p, 2); return `Quedó acordado. El club agradeció el gesto y ${c.p!.n} llega más fresco.`; } },
      { t: 'Negarse: el reglamento te respalda', hint: 'Lo usas cuando quieras. El club queda molesto.', run: (g, c) => { M(g, { clubes: -7 }); if (c.r() < 0.3) { c.p!.form = Math.max(-2, c.p!.form - 1); return `El club lo hizo jugar 90 minutos tres días antes del viaje. ${c.p!.n} llega cargado.`; } return 'El club aceptó de mala gana. No hubo más llamadas.'; } },
    ] },
  { id: 'dual-tentado', at: 'entre', place: 'Desde el exterior', who: dual, once: true, cond: g => !!dual(g), title: c => `Otra federación busca a ${c.p!.n}`,
    text: (_, c) => `Le ofrecieron a ${c.p!.n} un lugar fijo en su otra selección. Todavía puede cambiar: no tiene partidos suficientes con nosotros.`,
    opts: [
      { t: 'Viajar a hablar con él y su familia', hint: 'Gastas una acción de esta fecha. Suele funcionar.', run: (g, c) => { g.actsLeft = Math.max(0, g.actsLeft - 1); rel(c.p, 18); if (c.r() < 0.8) return `${c.p!.n} agradeció la visita y confirmó que quiere jugar con nosotros.`; c.p!.ret = 1; return `Escuchó con respeto, pero ya había dado su palabra. ${c.p!.n} jugará por su otra selección.`; } },
      { t: 'Prometerle minutos en esta fecha', hint: 'Queda comprometido si cumples. Si no juega, se va.', run: (g, c) => { g.promises.push({ who: c.p!.id, what: 'minutos', by: g.stop }); rel(c.p, 8); return `${c.p!.n} espera jugar en esta fecha. Si no lo haces entrar, lo tomará como una respuesta.`; } },
      { t: 'No intervenir', hint: 'Sin costo hoy. Puede que lo pierdas.', run: (_, c) => { if (c.r() < 0.5) { c.p!.ret = 1; return `${c.p!.n} aceptó la oferta de su otra selección.`; } return `${c.p!.n} decidió esperar. El tema sigue abierto.`; } },
    ] },
  { id: 'veterano-retiro', at: 'entre', place: 'Mensaje privado', who: veteran, once: true, cond: g => !!veteran(g), title: c => `${c.p!.n} piensa en dejar la selección`,
    text: (g, c) => `Con ${ageOf(c.p!, stop(g).y)} años y ${c.p!.caps} partidos, ${c.p!.n} te escribe: siente que es momento de dar un paso al costado.`,
    opts: [
      { t: 'Pedirle que se quede un ciclo más', hint: 'Conservas su liderazgo. Le quitas lugar a un joven.', run: (g, c) => { rel(c.p, 12); M(g, { vestuario: 4 }); return `Aceptó seguir. "Si usted me necesita, estoy", respondió.`; } },
      { t: 'Agradecerle y organizar su despedida', hint: 'El grupo lo siente. La gente lo valora.', run: (g, c) => { c.p!.ret = 1; M(g, { hinchas: 5, vestuario: -4, prensa: 3 }); return `${c.p!.n} se despidió con una carta pública. La federación prepara un homenaje.`; } },
    ] },
  { id: 'amistoso-taquilla', at: 'entre', place: 'Oficina de la federación', cond: g => stop(g).comp === 'AM' && g.fx.some(f => f.h === g.me), title: () => 'Proponen mudar un amistoso al extranjero',
    text: () => 'Un promotor paga bien por jugar uno de los amistosos de local en Estados Unidos. La federación lo ve con buenos ojos.',
    opts: [
      { t: 'Aceptar el viaje', hint: 'La federación gana dinero. Pierdes la localía y sumas cansancio.', run: g => { const f = g.fx.find(x => x.h === g.me && x.gh === undefined); if (f) f.neutral = true; M(g, { fed: 5, hinchas: -4 }); return 'El partido se jugará en cancha neutral. La federación quedó conforme.'; } },
      { t: 'Insistir en jugar en casa', hint: 'Mantienes la localía. La federación deja de ganar.', run: g => { M(g, { fed: -3, hinchas: 4 }); return 'Se juega en casa. Las entradas se agotaron en dos días.'; } },
    ] },
  { id: 'prensa-columna', at: 'entre', place: 'En los diarios', cond: g => g.meters.prensa < 45, title: () => 'Una columna pide cambios',
    text: () => 'Un periodista con llegada escribe que el equipo no tiene una idea clara y pide una reunión con usted.',
    opts: [
      { t: 'Recibirlo y explicarle el plan', hint: 'Suele bajar la presión. Expones tu idea.', run: (g, c) => { if (c.r() < 0.75) { M(g, { prensa: 6 }); return 'La nota siguiente fue más medida: destacó que hay un plan de trabajo.'; } M(g, { prensa: -3 }); return 'Publicó la charla fuera de contexto. Fue peor.'; } },
      { t: 'No responder', hint: 'No arriesgas nada. La crítica sigue.', run: g => { M(g, { prensa: -2 }); return 'El tema siguió unos días más en los programas.'; } },
    ] },
  { id: 'representante', at: 'entre', place: 'Llamada', who: kid, cond: g => !!kid(g) && !g.squad.includes(kid(g)!.id), title: c => `El representante de ${c.p!.n} insiste`,
    text: (_, c) => `Dice que ${c.p!.n} está listo y que una convocatoria ahora le cambiaría la carrera.`,
    opts: [
      { t: 'Decirle que lo estás siguiendo', hint: 'Sin compromiso. El chico se entusiasma un poco.', run: (_, c) => { rel(c.p, 4); c.p!.seen = Math.min(1, c.p!.seen + 0.2); return 'Pediste videos de sus últimos partidos. Ahora lo conoces mejor.'; } },
      { t: 'Cortar el tema: las listas no se negocian', hint: 'Marcas distancia. El entorno del jugador se enfría.', run: (_, c) => { rel(c.p, -5); return 'El representante entendió el mensaje. No volvió a llamar.'; } },
    ] },
  { id: 'excluido-habla', at: 'lista', place: 'Zona mixta', who: left, cond: g => !!left(g), title: c => `${c.p!.n} habló de su ausencia`,
    text: (_, c) => `"Nadie me llamó para explicarme", dijo ${c.p!.n} al salir de su club.`,
    opts: [
      { t: 'Llamarlo esta noche', hint: 'Recuperas la relación. Reconoces que faltó una explicación.', run: (_, c) => { rel(c.p, 10); return `Hablaron veinte minutos. ${c.p!.n} agradeció la llamada y dijo que seguirá trabajando.`; } },
      { t: 'Responder en conferencia', hint: 'Marcas autoridad. La relación se resiente.', run: (g, c) => { rel(c.p, -8); M(g, { prensa: 2 }); return 'Dijiste que las listas se arman por rendimiento. El tema quedó cerrado para la prensa.'; } },
    ] },
  { id: 'llegan-tarde', at: 'concentracion', place: 'En la concentración', cond: g => squad(g).filter(p => p.lg).length >= 6 && g.md === 0, title: () => 'Tres titulares llegan la noche anterior',
    text: () => 'Jugaron el domingo en Europa y aterrizan menos de 24 horas antes del primer partido.',
    opts: [
      { t: 'Ponerlos igual', hint: 'Juegan tus mejores. Llegan con menos piernas.', run: g => { squad(g).filter(p => p.lg).sort((a, b) => b.ovr - a.ovr).slice(0, 3).forEach(p => (p.form = Math.max(-2, p.form - 1))); return 'Entrenaron liviano y dijeron estar listos. Se les nota el viaje.'; } },
      { t: 'Darles descanso en el primero', hint: 'Los cuidas. El primer partido lo juegan otros.', run: g => { M(g, { clubes: 3, vestuario: 2 }); return 'Los tres agradecieron el descanso. El grupo lo tomó como una señal de confianza para el resto.'; } },
    ] },
  { id: 'dos-grupos', at: 'concentracion', place: 'En el comedor', cond: g => g.meters.vestuario < 62 && squad(g).filter(p => p.lg).length >= 5, title: () => 'Dos mesas que no se mezclan',
    text: () => 'Los que juegan afuera comen por un lado y los del torneo local por otro. Nadie discute, pero se nota.',
    opts: [
      { t: 'Mezclar las habitaciones', hint: 'Integra al grupo. Algunos referentes pierden su rutina.', run: (g, c) => { if (c.r() < 0.7) { M(g, { vestuario: 6, quimica: 3 }); return 'Al tercer día ya había apodos nuevos y una mesa larga.'; } M(g, { vestuario: -2 }); return 'Un par de referentes lo tomaron a mal. El clima quedó raro.'; } },
      { t: 'Hablar con los capitanes', hint: 'Efecto más lento y más seguro.', run: g => { M(g, { vestuario: 3 }); return 'Los referentes organizaron una cena. Fue un primer paso.'; } },
    ] },
  { id: 'premios', at: 'concentracion', place: 'Reunión de plantel', once: true, cond: g => stop(g).comp !== 'AM' && g.meters.fed < 70, title: () => 'El plantel reclama los premios',
    text: () => 'Los referentes piden que la federación cierre los premios antes de jugar. La dirigencia quiere dejarlo para después.',
    opts: [
      { t: 'Respaldar a los jugadores', hint: 'El grupo te sigue. La federación se incomoda.', run: g => { M(g, { vestuario: 7, fed: -5 }); return 'La federación firmó esa misma tarde. En el vestuario te lo agradecieron.'; } },
      { t: 'Pedir que se resuelva después de la fecha', hint: 'Cuidas a la federación. El plantel juega con la cabeza en otra cosa.', run: g => { M(g, { vestuario: -6, fed: 3 }); return 'Aceptaron esperar, sin entusiasmo.'; } },
    ] },
  { id: 'altura', at: 'concentracion', place: 'Plan de viaje', cond: g => !!awayHigh(g) && homeAltitude(g.me) < 2000, title: () => 'Cómo subir a la altura',
    text: g => `El partido de visita es a más de ${Math.floor(homeAltitude(awayHigh(g)!.h) / 100) * 100} metros. El cuerpo médico propone dos planes.`,
    opts: [
      { t: 'Llegar el mismo día del partido', hint: 'El cuerpo aún no siente la altura. Sin margen si el vuelo falla.', run: (g, c) => { if (c.r() < 0.85) { M(g, { quimica: 2 }); return 'El plan salió bien: llegaron tres horas antes y jugaron sin ahogos fuertes.'; } M(g, { vestuario: -4 }); return 'El vuelo se demoró. Llegaron al estadio con el tiempo justo.'; } },
      { t: 'Subir una semana antes', hint: 'Se adaptan mejor. Los clubes ceden menos días y algunos llegan tarde.', run: g => { M(g, { clubes: -4, vestuario: 2 }); return 'Los locales se adaptaron bien. Los de afuera se sumaron sobre la hora.'; } },
    ] },
  { id: 'indisciplina', at: 'concentracion', place: 'En el hotel', who: rebel, cond: g => !!rebel(g) && rebel(g)!.per[2] <= 7, title: c => `${c.p!.n} llegó tarde a la cena`,
    text: (_, c) => `No avisó y no es la primera vez. El grupo espera a ver qué hace usted con ${c.p!.n}.`,
    opts: [
      { t: 'Dejarlo fuera del próximo partido', hint: 'El grupo ve que hay reglas. Pierdes al jugador un partido.', run: (g, c) => { c.p!.sus = Math.max(c.p!.sus, 1); rel(c.p, -10); M(g, { vestuario: 4 }); return `${c.p!.n} no estará disponible en el próximo partido. Nadie más llegó tarde.`; } },
      { t: 'Hablarlo en privado', hint: 'No lo pierdes. Algunos lo leen como blandura.', run: (g, c) => { rel(c.p, 3); M(g, { vestuario: -3 }); return 'Pidió disculpas. En el grupo quedaron comentarios.'; } },
    ] },
  { id: 'debutante', at: 'concentracion', place: 'En el entrenamiento', who: g => squad(g).filter(p => p.caps === 0).sort((a, b) => b.ovr - a.ovr)[0], cond: g => squad(g).some(p => p.caps === 0), title: c => `${c.p!.n} espera su debut`,
    text: (_, c) => `Es su primera convocatoria. ${c.p!.n} entrena bien, pero se lo ve tenso.`,
    opts: [
      { t: 'Pedirle a un referente que lo acompañe', hint: 'Se suelta. El referente dedica tiempo a otra cosa.', run: (g, c) => { c.p!.form = Math.min(2, c.p!.form + 1); rel(c.p, 6); M(g, { vestuario: 1 }); return `Compartieron habitación. ${c.p!.n} terminó la semana entrenando con otra cara.`; } },
      { t: 'Dejar que se acomode solo', hint: 'Sin costo. Puede tardar en soltarse.', run: () => 'Siguió la semana con normalidad.' },
    ] },
  { id: 'derrota-prensa', at: 'post', place: 'Conferencia de prensa', cond: g => !!lastLog(g) && lastLog(g).my < lastLog(g).their && lastLog(g).fx.comp !== 'AM', title: () => 'Preguntas duras después de perder',
    text: () => 'La primera pregunta es directa: ¿quién es responsable de lo que pasó hoy?',
    opts: [
      { t: 'Asumir la responsabilidad', hint: 'Proteges al plantel. La prensa apunta a usted.', run: g => { M(g, { vestuario: 5, prensa: -3 }); return 'Los jugadores lo valoraron en privado. Los titulares del día siguiente llevan su nombre.'; } },
      { t: 'Pedir más de los jugadores', hint: 'La prensa lo compra. El vestuario no.', run: g => { M(g, { vestuario: -6, prensa: 3 }); return 'La frase recorrió todos los programas. En el vestuario cayó mal.'; } },
      { t: 'Hablar solo del próximo partido', hint: 'Neutral. No calma a nadie.', run: g => { M(g, { prensa: -1 }); return 'Respondió corto y se levantó. Mañana habrá más preguntas.'; } },
    ] },
  { id: 'euforia', at: 'post', place: 'En el vestuario', cond: g => !!lastLog(g) && lastLog(g).my - lastLog(g).their >= 2 && g.md < g.fx.length - 1, title: () => 'Festejo después de la goleada',
    text: () => 'El plantel pide la noche libre. En tres días se juega otra vez.',
    opts: [
      { t: 'Dar la noche libre', hint: 'Sube el ánimo. Riesgo de llegar cansados.', run: (g, c) => { M(g, { vestuario: 4 }); if (c.r() < 0.3) { M(g, { quimica: -2 }); return 'Volvieron tarde. La práctica del día siguiente fue floja.'; } return 'Volvieron a horario y de buen ánimo.'; } },
      { t: 'Cena en el hotel y a descansar', hint: 'Llegan frescos. Algún gesto de fastidio.', run: g => { M(g, { vestuario: -1, quimica: 1 }); return 'Hubo alguna cara larga, pero al otro día entrenaron bien.'; } },
    ] },
  { id: 'suplente', at: 'post', place: 'Pasillo del hotel', who: unused, cond: g => g.md === g.fx.length - 1 && !!unused(g) && unused(g)!.ovr >= star(g).ovr - 6, title: c => `${c.p!.n} no jugó ni un minuto`,
    text: (_, c) => `Viajó desde lejos y se va sin entrar. ${c.p!.n} pide una charla antes de volver a su club.`,
    opts: [
      { t: 'Explicarle su lugar en el plan', hint: 'Mantienes la relación. Te comprometes a tenerlo en cuenta.', run: (_, c) => { rel(c.p, 7); return `${c.p!.n} se fue conforme con la explicación.`; } },
      { t: 'Decirle que el lugar se gana', hint: 'Sin promesas. Puede enfriarse.', run: (_, c) => { rel(c.p, -6); return `${c.p!.n} escuchó en silencio y se fue al aeropuerto.`; } },
    ] },
];

export function drawEvents(g: Game, at: At, r: Rng): Pending[] {
  const max = at === 'entre' ? 2 : 1, out: Pending[] = [];
  const cands = EVENTS.filter(e => e.at === at && !(e.once && g.seenEv.includes(e.id)) && !g.pending.some(p => p.ev === e.id) && g.seenEv.slice(-4).indexOf(e.id) < 0 && e.cond(g));
  while (out.length < max && cands.length && r() < (at === 'entre' ? 0.75 : 0.55)) {
    const e = cands.splice(Math.floor(r() * cands.length), 1)[0], who = e.who?.(g);
    if (e.who && !who) continue;
    out.push({ ev: e.id, who: who?.id });
  }
  return out;
}
export function eventView(g: Game, pd: Pending) {
  const e = EVENTS.find(x => x.id === pd.ev)!, c: Ctx = { p: g.players.find(p => p.id === pd.who), r: rngFor(g, `ev:${pd.ev}:${g.stop}:${g.md}`) };
  return { e, c, title: e.title(c), text: e.text(g, c) };
}
export function resolveEvent(g: Game, i: number, opt: number): string {
  const pd = g.pending[i], { e, c } = eventView(g, pd);
  const txt = e.opts[opt].run(g, c);
  g.pending.splice(i, 1); g.seenEv.push(e.id); if (g.seenEv.length > 40) g.seenEv.shift();
  return txt;
}
/** Promesas de minutos: si el jugador no entró en la fecha, se va con su otra selección. */
export function checkPromises(g: Game): string[] {
  const out: string[] = [];
  g.promises = g.promises.filter(pr => {
    if (pr.by !== g.stop) return true;
    const p = g.players.find(x => x.id === pr.who); if (!p) return false;
    const played = g.log.slice(0, g.fx.length).some(l => l.rating[p.id] !== undefined);
    if (!played) { p.ret = 1; out.push(`${p.n} no tuvo los minutos prometidos y aceptó jugar por su otra selección.`); }
    else out.push(`${p.n} tuvo sus minutos. Queda más cerca de nosotros.`);
    return false;
  });
  return out;
}
