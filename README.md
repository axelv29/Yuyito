# 🌱 Yuyito

**Un pomodoro que planta árboles.**

Cada bloque de enfoque se convierte en un árbol: nace cuando empezás, crece mientras trabajás y queda marchito si lo abandonás. Sin cuentas, sin servidores y sin distracciones: tu bosque vive en tu navegador.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)

## Qué es

Yuyito es una app de enfoque con pomodoro y descansos configurables. En lugar de mostrar solo un cronómetro, te deja ver el resultado de tu trabajo: una pradera isométrica que se llena de árboles a medida que completás tus sesiones.

Cada **bosque** representa un objetivo: una materia, un semestre, un examen. Adentro hay árboles de cuatro especies, y cada una cuesta una cantidad fija de minutos de enfoque:

| Especie | Minutos de enfoque | Etapas |
| --- | ---: | ---: |
| 🌲 Pino | 25 | 4 |
| 🌳 Abedul | 45 | 5 |
| 🌳 Roble | 60 | 7 |
| 🌺 Ceibo | 90 | 7 |

## Cómo funciona

1. **Elegís un bosque** y creás una sesión: cuánto querés enfocar, cuánto descansar, cuántos bloques y qué árboles querés plantar.
2. **La app reserva las celdas** de esos árboles en la pradera y planta el primero.
3. **Mientras el tiempo corre, el árbol crece** con los minutos reales de enfoque. Las pausas no cuentan.
4. **Al terminar el bloque**, el árbol queda adulto y arranca el descanso. Si abandonás, queda marchito.
5. **Si cerrás la pestaña**, al volver todo sigue donde lo dejaste: la app recalcula el tiempo con la hora real, no con un contador.

## Funcionalidades

**Enfoque**

- Pomodoro de 5 a 120 minutos (en pasos de 5) y descansos de 1 a 30.
- Modo con descansos o continuo, pausas largas cada cierta cantidad de ciclos y pausa estricta.
- Alarma con tres tonos y notificación del navegador cuando termina un bloque.
- Pausar, reanudar, abandonar y continuar una serie aunque recargues la página.

**Bosques**

- Varios bosques a la vez, de 4×4 a 8×8 celdas, con descripción opcional.
- Fecha límite con contador de días y meta de horas de enfoque.
- Nombre y contador que se pueden ocultar.

**Árboles**

- Cuatro especies con etapas de crecimiento propias y una versión marchita para cada una.
- Un árbol completado queda adulto; uno abandonado queda marchito en la etapa que alcanzó.
- Orientación espejada por árbol y luz según la profundidad, para que la pradera no se vea repetida.

**Sesiones e historial**

- Título, descripción y objetivos con tres estados: pendiente, logrado y no logrado.
- Series de hasta 8 bloques, que se pueden retomar o cerrar antes de terminar.
- Historial por bosque con filtros (todas, hoy, esta semana, series, marchitas), detalle de cada sesión y resaltado de sus árboles en la pradera.

**Estadísticas**

- Enfoque de hoy, total acumulado, racha actual y promedio de los últimos 30 días.
- Mapa de calor de las últimas 53 semanas, barras por semana o por mes y dos anillos: completados contra abandonados y reparto de minutos por bosque.
- Vista por bosque o global, con bosque favorito y ranking.
- Racha diaria: un día cuenta cuando suma al menos 25 minutos reales de enfoque, aunque el árbol haya quedado marchito.

**Pradera**

- Zoom pixel-perfect de 0.5× a 2× y arrastre acotado para recorrer el bosque.
- Doble clic en un árbol o una celda para ver la sesión a la que pertenece.
- Tarjeta del temporizador que se puede ocultar y queda como botón flotante.

## 🚀 Empezar

Requisitos: Node.js LTS (probado con Node 24) y npm.

```bash
npm install
npm run dev
```

En Windows, si PowerShell bloquea `npm.ps1`, usá `npm.cmd` (`npm.cmd install`, `npm.cmd run dev`).

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Chequeo de tipos y build de producción |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | oxlint |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest en modo watch |
| `npm run format` | Prettier |

El build es estático: se publica en Vercel con el preset de Vite (build `npm run build`, salida `dist`), sin variables de entorno ni servidor propio.

## 🛠️ Stack y arquitectura

- **React 19 + TypeScript 7 (strict)** sobre **Vite 8**.
- **Tailwind CSS v4** en modo CSS-first: los tokens viven en `src/styles/theme.css`.
- **Zustand** con `persist` para el estado y el guardado local versionado.
- **Canvas 2D** para la pradera, sin librería de juegos.
- **Vitest** para la lógica pura, **oxlint** y **Prettier** para el código.

La regla que ordena el proyecto es simple: la lógica no sabe dibujar y el dibujo no sabe calcular. `config` no importa nada; `logic` importa `config`; `state` importa `logic`; `render` y `components` consumen todo lo anterior. Por eso el timer, el crecimiento y las estadísticas se prueban sin navegador.

## Estructura

```
docs/          plan, contexto, alcance, tema y recuperación
public/        sprites, tilesets y favicon
src/
  config/      grilla, duraciones, especies, umbrales y límites
  state/       tipos, store, persistencia y migraciones
  logic/       timer, crecimiento, sesiones, estadísticas, racha y dibujo lógico
  render/      isometría, atlas, luz, orientación y dibujo del canvas
  styles/      tokens del tema visual
  hooks/       enlaces entre React y la lógica
  components/  interfaz
  tests/       pruebas de la lógica
```

## 📚 Documentación

| Documento | Para qué sirve |
| --- | --- |
| [`docs/plan.md`](./docs/plan.md) | Plan de producto, decisiones y guía de estilo. |
| [`docs/scope-v0.1.md`](./docs/scope-v0.1.md) | Alcance y criterios de aceptación de la primera versión. |
| [`docs/scope-v2.md`](./docs/scope-v2.md) | Alcance de la segunda versión. |
| [`docs/theming.md`](./docs/theming.md) | Paleta, tipografías, tarjetas y botones. |
| [`docs/context.md`](./docs/context.md) | Reglas para trabajar en el repositorio. |
| [`docs/recovery.md`](./docs/recovery.md) | Cómo recuperar un guardado dañado. |
| [`LICENSES.md`](./LICENSES.md) | Licencias de fuentes y arte. |
| [`public/sprites/README.md`](./public/sprites/README.md) | Formato de los atlas de sprites. |

## Hoja de ruta

- **v0.2** — economía y semillas, edición del jardín y parcelas por desbloquear.
- **v0.3** — cuentas y sincronización, versión instalable (PWA).
- **v0.4 y v0.5** — álbum de bosques y bosques compartidos.
- **v1.0** — aldea, estructuras y estaciones.

La versión para celular está planificada para después de la v0.3; hoy la app está pensada para escritorio y no se rompe en pantallas de 360 px.

## Desarrollo

Antes de cada commit, los tres comandos tienen que estar en verde:

```bash
npm run lint
npm test
npm run build
```

Las reglas de tiempo, crecimiento, datos e interfaz están en [`docs/context.md`](./docs/context.md); leelas antes de tocar el código.

## 📄 Licencia

**Propietaria.** Todos los derechos reservados; ver [`LICENSE`](./LICENSE). El código fuente, el arte y la documentación son propiedad de su autor.

Las fuentes y los recursos de terceros conservan sus licencias originales: ver [`LICENSES.md`](./LICENSES.md).
