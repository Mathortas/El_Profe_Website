import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeftRight, ArrowUpDown, BriefcaseBusiness, CalendarDays, CloudRain, Dumbbell, GripVertical, HeartPulse,
  Landmark, Languages, LayoutDashboard, Megaphone, MessagesSquare, Moon, Mountain, Newspaper, Plane, Search,
  Shield, Shirt, Stethoscope, Sun, Swords, Telescope, Trophy, Users, UsersRound, Zap, Hourglass, MoveVertical,
  Crosshair, Repeat, MapPin, Hotel, Mic, RotateCcw,
} from 'lucide-react';
import {
  AttrValue, AttributeList, Button, Chip, Fixture, Flag, FormArrow, Formation, FORMATIONS, IconButton, Message,
  Meter, NATIONS, OptionGrid, Panel, Phone, PlayerCard, PositionChip, Rating, Segmented, SortableTable, StaffTip,
  StatDuel, Tag, Task, applyMode, applyNation, initialMode, money, nationByCode, saveMode, POS_ORDER, posRank, PhoneDock, Crest,
  type Column, type Mode, type Owner, type Player,
} from '../design';
import { ATTRS, PLAYERS } from './sample';
import './styleguide.css';

const SECTIONS = [
  ['principios', 'Principios'], ['color', 'Color'], ['tipografia', 'Tipografía'], ['espacios', 'Espacios y bordes'],
  ['iconos', 'Íconos'], ['controles', 'Controles'], ['futbol', 'Datos de fútbol'], ['tablas', 'Tablas'],
  ['jugador', 'Jugador'], ['tactica', 'Táctica'], ['gestion', 'Gestión'], ['tono', 'Tono de los textos'], ['responsive', 'Responsive'],
] as const;

export default function Styleguide() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [nation, setNation] = useState('PER');
  useEffect(() => { applyMode(mode); saveMode(mode); }, [mode]);
  useEffect(() => { applyNation(nationByCode(nation)); }, [nation]);

  return (
    <div className="sg">
      <header className="sg-top">
        <div className="sg-brand">
          <span className="sg-logo num">EP</span>
          <div><b className="head">El Profe</b><span className="t3">Sistema de diseño, versión 0.1</span></div>
        </div>
        <div className="sg-controls">
          <label className="sg-select">
            <span className="t3">Selección</span>
            <span className={`fi fi-${nationByCode(nation).flag}`} aria-hidden />
            <select value={nation} onChange={e => setNation(e.target.value)} aria-label="Selección para el acento">
              {NATIONS.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}
            </select>
          </label>
          <IconButton label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}>
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </div>
      </header>

      <div className="sg-layout">
        <nav className="sg-nav" aria-label="Secciones">
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <main className="sg-main">
          <Principles />
          <Colors mode={mode} nation={nation} />
          <Typography />
          <Spacing />
          <Icons />
          <Controls />
          <FootballData nation={nation} />
          <Tables />
          <PlayerSection />
          <Tactics />
          <Management />
          <Voice />
          <Responsive />
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="sg-section">
      <h2 className="head">{title}</h2>
      <p className="sg-lead">{lead}</p>
      {children}
    </section>
  );
}

/* ---------- Principios ---------- */
function Principles() {
  const items = [
    ['Datos como en Football Manager, lectura como en FIFA', 'Mostramos todo lo que importa para decidir, pero cada número tiene su lugar y se entiende de un vistazo.'],
    ['Una decisión, un lugar', 'Cada tarea vive en una sola pantalla. Si algo se puede delegar, se delega ahí mismo.'],
    ['El color dice algo', 'El acento es la camiseta de tu selección. Los demás colores marcan nivel, forma o estado; nunca decoran.'],
    ['Interacciones directas', 'Ordenar tocando la columna, comparar con doble clic, cambiar jugadores arrastrando.'],
    ['Rápido siempre', 'Nada bloquea la pantalla. Las animaciones solo responden a lo que haces.'],
  ];
  return (
    <Section id="principios" title="Principios" lead="Cinco reglas para decidir cuando una pantalla no está clara.">
      <ol className="sg-principles">
        {items.map(([t, d]) => <li key={t}><b>{t}</b><span className="t2">{d}</span></li>)}
      </ol>
    </Section>
  );
}

/* ---------- Color ---------- */
const SURFACE_TOKENS = ['--bg', '--surface-1', '--surface-2', '--surface-3', '--line', '--line-strong', '--text', '--text-2', '--text-3'];
const SEMANTIC = [
  ['Nivel', ['--tier-bronze', '--tier-silver', '--tier-gold']],
  ['Forma', ['--form-2', '--form-1', '--form-0', '--form-m1', '--form-m2']],
  ['Estado', ['--good', '--warn', '--bad', '--info']],
  ['Línea del campo', ['--line-gk', '--line-def', '--line-mid', '--line-att']],
] as const;
function Colors({ mode, nation }: { mode: Mode; nation: string }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const all = [...SURFACE_TOKENS, '--accent', '--accent-2', '--on-accent', ...SEMANTIC.flatMap(([, t]) => t)];
    setVals(Object.fromEntries(all.map(t => [t, cs.getPropertyValue(t).trim()])));
  }, [mode, nation]);
  const sw = (t: string, label?: string) => (
    <div className="sg-swatch" key={t}>
      <i style={{ background: `var(${t})` }} />
      <b>{label ?? t.replace('--', '')}</b>
      <code className="t3">{vals[t]}</code>
    </div>
  );
  return (
    <Section id="color" title="Color" lead="Superficies en escalones con bordes visibles, para que en modo oscuro nada se pierda. El acento cambia con la selección que diriges.">
      <h3 className="sg-h3">Superficies y texto ({mode === 'dark' ? 'modo oscuro' : 'modo claro'})</h3>
      <div className="sg-swatches">{SURFACE_TOKENS.map(t => sw(t))}</div>
      <h3 className="sg-h3">Acento de {nationByCode(nation).name}</h3>
      <div className="sg-swatches">{sw('--accent', 'acento')}{sw('--accent-2', 'acento 2')}{sw('--on-accent', 'texto sobre acento')}</div>
      {SEMANTIC.map(([title, tokens]) => (
        <div key={title}>
          <h3 className="sg-h3">{title}</h3>
          <div className="sg-swatches">{tokens.map(t => sw(t))}</div>
        </div>
      ))}
    </Section>
  );
}

/* ---------- Tipografía ---------- */
function Typography() {
  return (
    <Section id="tipografia" title="Tipografía" lead="Una sola familia, Archivo, con eje de ancho: condensada para números y marcadores, normal para leer. Así el marcador tiene carácter sin sumar otra fuente.">
      <div className="sg-type">
        <div><span className="num" style={{ fontSize: 64, lineHeight: 1 }}>2 – 1</span><code className="t3">Marcador, 64, ancho 72 %</code></div>
        <div><span className="num" style={{ fontSize: 48, lineHeight: 1 }}>74</span><code className="t3">Media en la ficha, 48</code></div>
        <div><span className="head" style={{ fontSize: 34 }}>Convocatoria de marzo</span><code className="t3">Título de pantalla, 34, ancho 88 %</code></div>
        <div><span className="head" style={{ fontSize: 20 }}>Perú contra Chile</span><code className="t3">Título de panel, 20</code></div>
        <div><span style={{ fontSize: 16 }}>Chile presiona alto los primeros veinte minutos.</span><code className="t3">Texto destacado, 16</code></div>
        <div><span style={{ fontSize: 14 }}>Sonne no juega en Burnley desde hace un mes. El informe completo está listo.</span><code className="t3">Texto, 14 (mínimo para leer)</code></div>
        <div><span className="t2" style={{ fontSize: 12 }}>Universitario, 25 años</span><code className="t3">Dato secundario, 12</code></div>
      </div>
      <h3 className="sg-h3">El mismo texto en tres anchos</h3>
      <div className="sg-widths">
        <span style={{ fontStretch: '72%', fontWeight: 700 }}>Eliminatorias 2027</span>
        <span style={{ fontStretch: '88%', fontWeight: 650 }}>Eliminatorias 2027</span>
        <span style={{ fontStretch: '100%' }}>Eliminatorias 2027</span>
      </div>
    </Section>
  );
}

/* ---------- Espacios ---------- */
function Spacing() {
  return (
    <Section id="espacios" title="Espacios y bordes" lead="Todo se mide en múltiplos de 4. Los bordes crecen con el tamaño del elemento: etiqueta 4, control 8, panel 12.">
      <div className="sg-spaces">
        {[4, 8, 12, 16, 20, 24, 32, 40].map(s => <div key={s}><i style={{ width: s, height: s }} /><code className="t3">{s}</code></div>)}
      </div>
      <div className="sg-radii">
        {[['Etiqueta', 4], ['Control', 8], ['Panel', 12], ['Píldora', 999]].map(([l, r]) => (
          <div key={l}><i style={{ borderRadius: Number(r) }} /><span>{l}</span><code className="t3">{r === 999 ? 'completo' : `${r}px`}</code></div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Íconos ---------- */
function Icons() {
  const list: [ComponentType<{ size?: number }>, string][] = [
    [LayoutDashboard, 'Despacho'], [Users, 'Convocatoria'], [CalendarDays, 'Fecha FIFA'], [Swords, 'Partido'], [Trophy, 'Torneos'],
    [Landmark, 'Federación'], [Newspaper, 'Prensa'], [Megaphone, 'Hinchas'], [UsersRound, 'Vestuario'], [Stethoscope, 'Médico'],
    [Telescope, 'Ojeador'], [Plane, 'Viaje'], [Mountain, 'Altura'], [CloudRain, 'Clima'], [MapPin, 'Sede'], [Hotel, 'Concentración'],
    [Dumbbell, 'Entrenamiento'], [HeartPulse, 'Físico'], [Languages, 'Doble nacionalidad'], [ArrowLeftRight, 'Comparar'],
    [ArrowUpDown, 'Ordenar'], [GripVertical, 'Arrastrar'], [Repeat, 'Cambio'], [Shield, 'Defensa'], [Crosshair, 'Ataque'],
    [Zap, 'Presión'], [Hourglass, 'Ritmo'], [MoveVertical, 'Altura de la línea'], [Shirt, 'Equipo'], [BriefcaseBusiness, 'Oficina'],
    [MessagesSquare, 'Redes'], [Search, 'Buscar'],
  ];
  return (
    <Section id="iconos" title="Íconos" lead="Lucide, trazo de 2 px, tamaño 18 en controles y 16 dentro de texto. Siempre acompañan un texto o tienen etiqueta accesible.">
      <div className="sg-icons">
        {list.map(([I, l]) => <div key={l}><I size={22} /><span>{l}</span></div>)}
      </div>
    </Section>
  );
}

/* ---------- Controles ---------- */
function Controls() {
  const [chips, setChips] = useState({ dual: true, eu: false });
  const [view, setView] = useState<'tv' | 'top'>('tv');
  return (
    <Section id="controles" title="Controles" lead="Botones con la acción escrita tal cual. Un solo botón principal por panel.">
      <div className="sg-row">
        <Button variant="primary" icon={<CalendarDays size={16} />}>Preparar la fecha</Button>
        <Button icon={<Users size={16} />}>Ir a la convocatoria</Button>
        <Button variant="ghost">Después</Button>
        <Button variant="danger">Sacar de la lista</Button>
        <Button variant="primary" size="sm">Confirmar</Button>
        <Button size="sm" disabled>No disponible</Button>
      </div>
      <div className="sg-row">
        <Chip pressed={chips.dual} onToggle={() => setChips(c => ({ ...c, dual: !c.dual }))}><Languages size={14} />Doble nacionalidad</Chip>
        <Chip pressed={chips.eu} onToggle={() => setChips(c => ({ ...c, eu: !c.eu }))}>Juegan en Europa</Chip>
        <Segmented label="Cámara" value={view} onChange={setView} options={[{ value: 'tv', label: 'Vista TV' }, { value: 'top', label: 'Desde arriba' }]} />
      </div>
      <div className="sg-row">
        <Tag>Informe listo</Tag><Tag tone="good">Hecho</Tag><Tag tone="warn">Pendiente</Tag><Tag tone="bad">Lesionado</Tag><Tag tone="info">Nuevo</Tag>
      </div>
    </Section>
  );
}

/* ---------- Datos de fútbol ---------- */
function FootballData({ nation }: { nation: string }) {
  const iso = nationByCode(nation).flag;
  return (
    <Section id="futbol" title="Datos de fútbol" lead="Media del 1 al 100 con los niveles de FIFA: bronce hasta 64, plata de 65 a 74, oro desde 75. Forma con las flechas de PES.">
      <div className="sg-grid-2">
        <Panel title="Media">
          <div className="sg-row"><Rating value={58} /><Rating value={64} /><Rating value={68} /><Rating value={74} /><Rating value={79} /><Rating value={88} /></div>
          <div className="sg-row"><Rating value={72} size="sm" /><Rating value={72} /><Rating value={72} size="lg" /></div>
          <div className="sg-row t2">Atributos sueltos: <AttrValue value={61} /> <AttrValue value={70} /> <AttrValue value={83} /></div>
        </Panel>
        <Panel title="Forma">
          <div className="sg-col">{([2, 1, 0, -1, -2] as const).map(f => <FormArrow key={f} form={f} withLabel />)}</div>
        </Panel>
        <Panel title="Posición">
          <div className="sg-row">{POS_ORDER.map(p => <PositionChip key={p} pos={p} />)}</div>
        </Panel>
        <Panel title="Banderas">
          <div className="sg-row">{NATIONS.slice(0, 8).map(n => <Flag key={n.code} iso={n.flag} name={n.name} />)}</div>
        </Panel>
        <Panel title="Medidores">
          <div className="sg-row" style={{ gap: 20 }}>
            <Meter icon={<Crest iso={iso} />} label="Federación" value={62} delta={4} />
            <Meter icon={<Shirt />} label="Vestuario" value={48} delta={-3} />
            <Meter icon={<Mic />} label="Prensa" value={71} />
            <Meter icon={<Users />} label="Hinchas" value={28} delta={-9} />
          </div>
        </Panel>
        <Panel title="Estadísticas del partido">
          <StatDuel label="Posesión" home={54} away={46} suffix="%" />
          <StatDuel label="xG" home={1.32} away={0.61} />
          <StatDuel label="Remates" home={11} away={6} />
        </Panel>
      </div>
      <Panel title="Partidos de la fecha" icon={<CalendarDays size={18} />} flush>
        <Fixture home={{ iso: 'pe', code: 'PER', sub: 'Local' }} away={{ iso: 'cl', code: 'CHI', sub: 'Nivel 71' }} date="Jue 25 mar, 20:30" place="Estadio Nacional, Lima" />
        <div style={{ borderTop: '1px solid var(--line)' }} />
        <Fixture home={{ iso: 'uy', code: 'URU', sub: 'Nivel 75' }} away={{ iso: 'pe', code: 'PER', sub: 'Visitante' }} date="Mar 30 mar, 19:00" place="Centenario, Montevideo" />
      </Panel>
    </Section>
  );
}

/* ---------- Tablas ---------- */
function Tables() {
  const [cmp, setCmp] = useState<number[]>([5, 6]);
  const cols: Column<Player>[] = [
    { key: 'name', label: 'Jugador', sortValue: p => p.name, render: p => <div className="ep-who"><b>{p.name}</b><span>{p.club}, {p.age} años{p.dual ? `, también ${p.dual}` : ''}</span></div> },
    { key: 'pos', label: 'Pos', sortValue: p => posRank(p.pos), render: p => <PositionChip pos={p.pos} /> },
    { key: 'ovr', label: 'Media', num: true, sortValue: p => p.ovr, render: p => <Rating value={p.ovr} /> },
    { key: 'form', label: 'Forma', sortValue: p => p.form, render: p => <FormArrow form={p.form} /> },
    { key: 'min', label: 'Minutos', num: true, sortValue: p => p.minutes, render: p => `${p.minutes}'` },
    { key: 'val', label: 'Valor', num: true, sortValue: p => p.value, render: p => money(p.value) },
    { key: 'league', label: 'Liga', sortValue: p => p.league, render: p => <span className="t2">{p.league}</span> },
    { key: 'alerts', label: 'Avisos', render: p => p.alerts?.length ? <Tag tone="warn">{p.alerts.length} {p.alerts.length > 1 ? 'avisos' : 'aviso'}</Tag> : null },
  ];
  const pick = (p: Player) => setCmp(c => (c.includes(p.id) ? c : [c[1], p.id]));
  return (
    <Section id="tablas" title="Tablas" lead="Toca un encabezado para ordenar; tócalo otra vez para invertir. Doble clic en una fila la manda al comparador.">
      <Panel title="Candidatos" icon={<Users size={18} />} flush actions={<span className="t3" style={{ fontSize: 12 }}>Comparando {cmp.length} jugadores</span>}>
        <SortableTable columns={cols} rows={PLAYERS} initialSort={{ key: 'pos', dir: 'asc' }} selected={cmp} onRowDoubleClick={pick} />
      </Panel>
    </Section>
  );
}

/* ---------- Jugador ---------- */
function PlayerSection() {
  const [id, setId] = useState(5);
  const p = PLAYERS.find(x => x.id === id)!;
  return (
    <Section id="jugador" title="Jugador" lead="La tarjeta resume; los atributos detallan. La barra y el número usan el mismo color de nivel.">
      <div className="sg-row" style={{ marginBottom: 12 }}>
        {[5, 7, 11, 22].map(i => <Chip key={i} pressed={id === i} onToggle={() => setId(i)}>{PLAYERS.find(x => x.id === i)!.name}</Chip>)}
      </div>
      <div className="sg-grid-2">
        <PlayerCard p={p} />
        <Panel title="Para tener en cuenta">
          {(p.alerts ?? ['Sin avisos para esta fecha']).map(a => <p key={a} style={{ margin: '4px 0' }}>{a}.</p>)}
        </Panel>
      </div>
      <Panel title="Atributos" className="sg-mt"><AttributeList groups={ATTRS(p)} /></Panel>
    </Section>
  );
}

/* ---------- Táctica ---------- */
function Tactics() {
  const [f, setF] = useState('4-3-3');
  const [reset, setReset] = useState(0);
  const [press, setPress] = useState('contra');
  const [block, setBlock] = useState('medio');
  return (
    <Section id="tactica" title="Táctica" lead="Opciones con nombre en lugar de sliders. En la pizarra se arrastran los jugadores y el puesto se ajusta a la zona.">
      <div className="sg-grid-2">
        <Panel title="Pizarra" actions={<div className="sg-row" style={{ margin: 0 }}>
          <Segmented label="Formación" value={f} onChange={setF} options={Object.keys(FORMATIONS).map(k => ({ value: k, label: k }))} />
          <IconButton label="Volver a la formación base" onClick={() => setReset(r => r + 1)}><RotateCcw size={16} /></IconButton>
        </div>}>
          <Formation name={f} editable resetKey={reset} />
        </Panel>
        <div className="sg-col" style={{ gap: 16 }}>
          <Panel title="Sin pelota: presión">
            <OptionGrid label="Presión" value={press} onChange={setPress} options={[
              { id: 'contra', icon: <Zap size={16} />, title: 'Contrapresión', desc: 'Presionar apenas se pierde la pelota.' },
              { id: 'alta', icon: <Crosshair size={16} />, title: 'Presión alta', desc: 'Presionar la salida rival desde el arquero.' },
              { id: 'esperar', icon: <Shield size={16} />, title: 'Esperar y cerrar', desc: 'Replegarse y presionar en campo propio.' },
            ]} />
          </Panel>
          <Panel title="Sin pelota: bloque">
            <OptionGrid label="Bloque" value={block} onChange={setBlock} options={[
              { id: 'alto', title: 'Bloque alto', desc: 'Línea cerca del medio campo.' },
              { id: 'medio', title: 'Bloque medio', desc: 'Defender desde la mitad.' },
              { id: 'bajo', title: 'Bloque bajo', desc: 'Defender cerca del área propia.' },
            ]} />
          </Panel>
        </div>
      </div>
    </Section>
  );
}

/* ---------- Gestión ---------- */
function Management() {
  const [owners, setOwners] = useState<Record<string, Owner>>({ lista: 'me', sede: 'me', conc: 'staff' });
  const set = (k: string) => (o: Owner) => setOwners(s => ({ ...s, [k]: o }));
  return (
    <Section id="gestion" title="Gestión" lead="Los pendientes llegan al celular, que se abre con el botón de abajo a la derecha. Cada tarea de la fecha se delega por separado.">
      <PhoneDock count={4}>
        <Phone title="Pendientes" count={4} filters={<><Chip pressed onToggle={() => {}}>Todos</Chip><Chip pressed={false} onToggle={() => {}}>Para decidir</Chip></>}>
          <Message unread icon={<Landmark size={18} />} from="Federación" time="Hoy" text="Estimado profesor: necesitamos confirmar la sede del partido con Chile antes del 15 de marzo." actions={<><Button size="sm">Elegir sede</Button><Button size="sm" variant="ghost">Después</Button></>} />
          <Message unread icon={<Shirt size={18} />} from="Alianza Lima" time="Hoy" text="Jonathan García terminó cargado el fin de semana. Pedimos que no juegue los dos partidos completos." actions={<><Button size="sm">Aceptar</Button><Button size="sm" variant="ghost">Responder</Button></>} />
          <Message icon={<Newspaper size={18} />} from="Prensa" time="Ayer" text="En la conferencia del jueves van a preguntar por Gallese." actions={<Button size="sm">Preparar respuesta</Button>} />
          <Message icon={<Stethoscope size={18} />} from="Cuerpo médico" time="Ayer" text="Barco salió con una molestia en el aductor. Lo revisamos el lunes." />
        </Phone>
      </PhoneDock>
      <div className="sg-col" style={{ gap: 16, maxWidth: 900 }}>
          <Panel title="Fecha FIFA de marzo" icon={<CalendarDays size={18} />} flush>
            <Task icon={<Users size={18} />} title="Lista de convocados" sub="19 de 26, cierra el 18 de marzo" owner={owners.lista} onOwner={set('lista')} />
            <Task icon={<MapPin size={18} />} title="Sede contra Chile" sub="Lima, Arequipa o Cusco" owner={owners.sede} onOwner={set('sede')} />
            <Task icon={<Hotel size={18} />} title="Concentración" sub={owners.conc === 'staff' ? 'La arma el cuerpo técnico' : 'Sin armar'} owner={owners.conc} onOwner={set('conc')} />
            <Task icon={<Newspaper size={18} />} title="Conferencia de prensa" sub="Jueves 11:00" owner="me" onOwner={() => {}} done />
          </Panel>
          <StaffTip who="Preparador físico">
            Con cuatro días de concentración, los que llegan de Europa recuperan bien. Con tres, conviene dejar a Sonne en el banco contra Chile.
          </StaffTip>
      </div>
    </Section>
  );
}

/* ---------- Tono ---------- */
function Voice() {
  const rows = [
    ['¡Excelente decisión! Tu equipo está listo para conquistar la fecha.', 'Lista confirmada: 26 jugadores.'],
    ['La prensa está ansiosa por conocer tus planes.', 'La conferencia es el jueves a las 11:00.'],
    ['Sumérgete en el análisis profundo del rival.', 'Ver el informe de Chile'],
    ['Ups, algo salió mal.', 'No se pudo guardar la partida. Libera espacio y vuelve a intentar.'],
    ['El vestuario vibra con energía positiva.', 'Vestuario: 64, sube 4 desde la última fecha.'],
  ];
  return (
    <Section id="tono" title="Tono de los textos" lead="Natural y directo, como lo diría una persona normal. Nada de frases hechas, exageraciones ni regionalismos.">
      <ul className="sg-rules">
        <li>Decir el hecho y el número; el jugador saca sus conclusiones.</li>
        <li>Los botones dicen lo que pasa al tocarlos: "Confirmar lista", no "Continuar".</li>
        <li>Cada personaje te habla en su registro: la federación es formal ("Estimado profesor"), el médico es preciso, el club es cordial. Sin caricatura.</li>
        <li>Nada de explicar lo obvio: si la etiqueta dice "Bloque bajo", no hace falta un párrafo.</li>
        <li>Los errores dicen qué pasó y cómo seguir, sin disculpas.</li>
      </ul>
      <div className="ep-table-wrap">
        <table className="ep-table sg-voice">
          <thead><tr><th style={{ padding: '8px 10px' }}>Así no</th><th style={{ padding: '8px 10px' }}>Así sí</th></tr></thead>
          <tbody>{rows.map(([a, b]) => <tr key={a}><td className="t3"><s>{a}</s></td><td>{b}</td></tr>)}</tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------- Responsive ---------- */
function Responsive() {
  const rows = [
    ['Celular', 'hasta 640 px', 'Una columna. La barra de pantallas pasa abajo. Las tablas muestran nombre, media y forma; el resto en la ficha.'],
    ['Tablet', '641 a 1024 px', 'Dos columnas. El partido ocupa todo el ancho y los datos pasan debajo.'],
    ['Escritorio', '1025 a 1599 px', 'El diseño base: partido 80/20, convocatoria en tres columnas.'],
    ['Pantalla ancha', 'desde 1600 px', 'Más aire, no más columnas. El contenido se limita a 1600 px de ancho.'],
  ];
  return (
    <Section id="responsive" title="Responsive" lead="Las mismas piezas en todos los tamaños; lo que cambia es cuántas columnas entran.">
      <div className="ep-table-wrap">
        <table className="ep-table">
          <thead><tr><th style={{ padding: '8px 10px' }}>Tamaño</th><th style={{ padding: '8px 10px' }}>Ancho</th><th style={{ padding: '8px 10px' }}>Qué cambia</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r[0]}><td><b>{r[0]}</b></td><td className="t2">{r[1]}</td><td style={{ whiteSpace: 'normal' }}>{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
    </Section>
  );
}
