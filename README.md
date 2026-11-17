# El Profe

Juego de director técnico de selecciones. Diriges una selección sudamericana durante el ciclo 2026–2030: amistosos, eliminatorias, Copa América y Mundial, con jugadores reales y un partido que se ve en 2D.

## Cómo correrlo

```
cd app
npm install
npm run dev
```

Abre la dirección que muestra la terminal. La partida se guarda sola en el navegador.

## Qué hay en cada carpeta

- `app/` — la aplicación (Vite, React y TypeScript).
  - `src/design/` — sistema de diseño: colores, tipografía y componentes. Se ve en `/#guia`.
  - `src/game/` — la lógica del juego, sin interfaz:
    - `players.ts` — nivel de cada jugador a partir de su valor de mercado, crecimiento por edad y juveniles nuevos cada año.
    - `world.ts` — calendario del ciclo, eliminatorias, torneos y ranking FIFA.
    - `flow.ts` — el recorrido: entre fechas, convocatoria, partidos y cierre.
    - `events.ts` — los momentos de decisión.
    - `engine.ts` y `worker.ts` — el motor de partido 2D, que corre en un hilo aparte.
  - `src/app/` — las pantallas.
  - `scripts/` — pruebas sin interfaz: `sim.ts` calibra el motor y `cycle.ts` juega ciclos completos.
- `data/pipeline/build_world.py` — arma `app/src/data/world.json` desde los archivos de `data/raw/` (no se suben al repositorio).
- `design/` — maquetas y notas de diseño.

## Pruebas automáticas

```
cd app
npm test
```

Juegan partidos y ciclos completos sin interfaz y revisan que los promedios del motor sean razonables, que el guardado se pueda cargar y actualizar, y que el planteo cambie el partido. GitHub las corre solas en cada push (`.github/workflows/pruebas.yml`).

## Pruebas rápidas

```
cd app
node --experimental-strip-types scripts/sim.ts PER-CHI,ARG-BOL 60
node --experimental-strip-types scripts/cycle.ts PER 2
```

## Ramas

- `main` — lo estable y jugable.
- `develop` — donde se integra el trabajo.
- `feature/...` — una por área: `motor-partido`, `datos`, `pantallas`.

## Datos

Todo sale de `data/raw/`, que no se sube al repositorio:

- `transfermarkt-datasets.zip` — la base: jugadores, valores de mercado y partidos de selección de [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets), con corte al 6 de julio de 2026.
- `elprofe_fbref_2026.csv` — club, partidos y minutos de la temporada 2026 en once ligas sudamericanas, leídos de FBref el 16 de noviembre de 2026. Completa a los jugadores que ya estaban y suma a los que solo jugaron en su liga local. A estos últimos el valor se les estima con la liga, los minutos, la edad y los goles; el puesto fino (lateral, extremo, volante) se reparte a partir del puesto general.
- `elprofe_wikidata_ciudadanias.csv` — ciudadanías por jugador, de Wikidata, para saber quién puede jugar por dos selecciones. Wikidata tiene errores sueltos; cuando no hay dato se usa el país de nacimiento.

Los dos CSV son opcionales: si faltan, el mundo se arma solo con Transfermarkt.

```
pip install pandas pycountry numpy
python data/pipeline/build_world.py
```
