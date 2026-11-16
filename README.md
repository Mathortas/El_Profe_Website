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
- `data/pipeline/build_world.py` — arma `app/src/data/world.json` desde `data/raw/transfermarkt-datasets.zip` (no se sube al repositorio).
- `design/` — maquetas y notas de diseño.

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

Los jugadores salen de [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets), con corte al 6 de julio de 2026. Las ligas que ese conjunto no cubre (por ejemplo, la peruana) no traen club ni minutos.
