# svg-probe

Repo temporal para medir qué acepta GitHub en un README. Se borra al terminar
el hito `#spike` del plan `profile-readme`.

## Ruta relativa

![probe 50 KB, relativa](out/probe-50.svg)
![probe 150 KB, relativa](out/probe-150.svg)
![probe 400 KB, relativa](out/probe-400.svg)
![probe 1000 KB, relativa](out/probe-1000.svg)

## raw.githubusercontent.com, rama main

![probe 400 KB, raw](https://raw.githubusercontent.com/TheSOV/svg-probe/main/out/probe-400.svg)

## Rama output (como snk)

![probe 400 KB, output](https://raw.githubusercontent.com/TheSOV/svg-probe/output/probe-400.svg)
![probe 1000 KB, output](https://raw.githubusercontent.com/TheSOV/svg-probe/output/probe-1000.svg)

## GIF grande (alternativa)

![probe gif](out/probe.gif)

## Qué mirar en cada imagen

- **Cuadro de la esquina** que alterna verde y rojo cada medio segundo: si
  cambia, la animación CSS corre.
- **Mancha de colores** que avanza hacia la derecha cambiando de forma: los
  cuadros con `steps()` y una pista de keyframes larga.
- **Barra magenta** junto al cuadro: solo aparece si el sistema pide movimiento
  reducido, y entonces nada debe moverse.

## Resultados

| imagen | peso | ruta | Chrome | Firefox | Safari | app móvil | content-type camo | Cache-Control camo |
|---|---|---|---|---|---|---|---|---|
| probe-50 | 71 261 B | relativa | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-150 | 205 427 B | relativa | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-400 | 472 230 B | relativa | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-1000 | 1 070 982 B | relativa | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-400 | 472 230 B | raw main | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-400 | 472 230 B | rama output | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe-1000 | 1 070 982 B | rama output | anima | ok | ok | ok | image/svg+xml | max-age=300 |
| probe.gif | 1 225 929 B | relativa | se ve | ok | ok | ok | image/gif | max-age=300 |

Medido el 2026-11-01, Chrome de escritorio, sobre https://github.com/TheSOV/svg-probe:

- **No hay camo para imágenes del propio GitHub.** La ruta relativa se reescribe a
  `github.com/TheSOV/svg-probe/raw/main/...` y la absoluta queda en
  `raw.githubusercontent.com`; las dos sirven `image/svg+xml` con
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, que
  permite el `<style>` interno y nada externo. El sha256 de cada descarga es igual
  al del archivo local.
- **1 MB pasa.** Ningún límite en 50 KB: las 9 imágenes cargan
  (`naturalWidth > 0`) y dos capturas de página completa separadas unos
  segundos son distintas (`cmp` → DIFFER).
- **Caché: `max-age=300`.** Un cambio en el SVG tarda hasta ~5 min en verse.
  Basta para un nivel diario; `?v=` no hace falta.
- **Contribuciones:** el perfil anónimo (`/users/TheSOV/contributions`) muestra
  «6,264 contributions in the last year»; GraphQL da `totalContributions: 6264`,
  `restrictedContributionsCount: 6246`, 291 días con actividad. La opción de
  contribuciones privadas está activada y la vista pública las cuenta, así que el
  nivel no saldrá vacío. Que el `GITHUB_TOKEN` de la Action vea lo mismo se
  confirma en la primera ejecución de `#level`.
- **Firefox, Safari y la app móvil de GitHub: bien en todos** (la persona lo abrió en cada uno el
  2026-11-01 y respondió «bien en todos»).
- Commit de la prueba: `f78c960` (main), `dd08ef5` (output) en TheSOV/svg-probe.
