# Tema visual — Yuyito

El objetivo de este sistema es que cambiar la identidad visual del DOM no obligue a buscar colores, tamaños o sombras sueltas por los componentes.

## Dónde vive el tema

| Archivo | Responsabilidad |
| --- | --- |
| `src/styles/theme.css` | **Fuente de verdad**: paleta, tipografías, escala de texto, bordes, sombras, movimiento y tokens semánticos de tarjetas, botones, progreso, avisos y zoom. |
| `src/index.css` | Puente con Tailwind (`@theme`), estilos base y clases de componentes que consumen los tokens. |
| `src/main.tsx` | Importa las fuentes de `@fontsource`. Si cambiás de familia, actualizá estos imports. |

La regla práctica: **los valores se cambian en `theme.css`; los componentes no llevan hex, tamaños de fuente ni sombras propias.**

## Cómo está organizado

### 1. Paleta

`theme.css` define los colores base con el prefijo `--palette-*`:

```css
--palette-ink: #203f3b;
--palette-primary: #3a684f;
--palette-background: #e9edd0;
```

`index.css` los registra en Tailwind para que existan utilidades como `bg-background`, `text-ink` o `border-bark`:

```css
@theme {
  --color-ink: var(--palette-ink);
  --color-background: var(--palette-background);
}
```

Si agregás un color nuevo:

1. Agregá el valor `--palette-*` en `theme.css`.
2. Registralo como `--color-*` en el bloque `@theme` de `index.css`.
3. Usalo desde una clase de componente o un token semántico. No lo escribas como hex en un `.tsx`.

### 2. Tarjetas

Todas las tarjetas usan `.card`:

```tsx
<section className="card">...</section>
```

Variantes de espacio:

- `.card` — padding normal.
- `.card--compact` — avisos y controles.
- `.card--roomy` — diálogos.

Los tokens `--card-*` controlan fondo, texto, borde, radio, sombra y padding. Si querés tarjetas con otra forma, cambiá esos tokens y todas las tarjetas acompañan.

`.card--session` es la tarjeta del árbol: usa el fondo verde muy claro de `--card-bg-session`.

### 3. Tipografía

Las familias viven en `--theme-font-sans` (Nunito, textos y números) y `--theme-font-button` (Quicksand, botones y controles). Los tamaños viven en `--type-*`.

Clases disponibles:

- `.app-title` — título de la app en Nunito.
- `.eyebrow` — etiqueta corta en mayúsculas (SESIÓN, ENFOQUE, ESTADÍSTICAS).
- `.type-title` — títulos de tarjeta y diálogo.
- `.type-title-lg` — título de la vista de estadísticas.
- `.type-timer` — reloj grande, con números tabulares.
- `.type-stat` — número grande de estadística.
- `.type-body` — texto normal.
- `.type-caption` — texto secundario chico.
- `.type-micro` — etiquetas y datos mínimos (pie del anillo, filas de la tarjeta).
- `.type-muted` — color de texto secundario.

No uses `text-[9px]`, `text-5xl` o `font-button` directamente en un componente nuevo si ya existe una clase para ese rol. Así un cambio de escala se hace en un solo lugar.

### 4. Botones

Base: `.btn`. Variantes: `.btn-primary`, `.btn-secondary`, `.btn-ghost-danger`, `.btn-danger`. Tamaño chico: `.btn--sm`.

Los tokens `--button-*` controlan borde, padding, radio, sombra y colores. Los estados hover/active también salen de tokens.

`.btn-ghost-danger` es la acción destructiva tranquila: se ve neutra y toma el tinte terracota recién al hover. `.btn-danger` es la confirmación sólida del diálogo.

### 5. Otros elementos

- `.timer-ring`, `.timer-ring__track`, `.timer-ring__fill`, `.timer-ring__tip`, `.timer-ring__pomo`, `.timer-ring__time`, `.timer-ring__caption` — anillo del temporizador. `.timer-ring__pomo` muestra la posición de la serie (por ejemplo `3/5`) arriba del reloj. Su degradado verde es el único degradado sancionado del tema.
- `.view-switch`, `.view-switch__button` — selector Bosque / Estadísticas / Bosques; se deshabilita durante una sesión activa.
- `.timer-history-button` — botón discreto del historial en la tarjeta del timer; se marca con `aria-pressed` cuando la ventana está abierta.
- `.forest-switcher`, `.forest-switcher__list`, `.forest-switcher__create`, `.forest-row`, `.forest-row__name`, `.forest-row__description`, `.forest-row__meta`, `.forest-switcher__empty` — listado de bosques.
- `.stage-track` y sus modificadores `--done`, `--current`, `--upcoming` — línea de etapas de la tarjeta de sesión. `--detail` la ajusta en el detalle del historial.
- `.session-details`, `.session-details__toggle`, `.session-details__label`, `.session-details__chevron` — bloque plegable “Más datos” (arranca plegado) que envuelve a `.session-data` y sus filas; los objetivos y las etapas no se pliegan.
- `.session-resume`, `.session-resume__title` — serie pendiente en el panel del timer.
- `.session-card__description`, `.session-tasks`, `.session-task` (`--neutral`, `--done`, `--missed`), `.session-task__icon`, `.session-task__text` — descripción y objetivos con estado de la sesión activa; la misma lista se reutiliza en el detalle del historial.
- `.session-objectives`, `.session-objective`, `.session-add-task` — lista editable de objetivos del diálogo de sesión; Enter en un objetivo escrito agrega otro.
- `.session-dialog .field-textarea` — descripción con alto fijo (4.8rem), sin tirador de resize y con scrollbar fina transparente que solo muestra el pulgar con el puntero o el foco, como los menús.
- `.session-times`, `.session-times__title` — sección Tiempos del diálogo de sesión: título propio (misma escala que `.type-title`) y 10 px de separación entre bloques; ocupa el ancho útil de la card.
- `.session-rhythm`, `.session-rhythm__option` (estado con `aria-checked`), `.session-rhythm__icon` — control segmentado de ritmos 25/5, 50/10, 90/20 y **Otro**; es un `radiogroup` navegable con flechas e Inicio/Fin. El segmento activo usa el verde del botón primario. Segmentos de 34 px y texto de 12 px, a la escala de los botones de la card.
- `.session-settings`, `.session-setting` (`--sub`), `.session-setting__label` — card blanca de ajustes con filas de 44 px separadas por una línea fina; `--sub` es una fila secundaria para los detalles de pausas largas.
- `.session-switch-control`, `.session-switch-control__knob` (estado con `aria-checked`) — switches de 36×20 px de **Repetir en ciclos**, **Pausas largas** y **Pausa estricta**; el área táctil llega a 44 px sin agrandar el switch.
- `.session-stepper`, `.session-stepper__btn`, `.session-stepper__value` — contador de ciclos − N + sobre una pastilla verde clara, con botones de 32×32 px y zona táctil de 44 px, y límites de 1 a 8.
- `.num-field`, `.num-field__btn`, `.num-field__value`, `.num-field__input`, `.num-field__unit` — número editable a mano con botones −/+ discretos; el input se ajusta a los límites al salir.
- `.time-fields`, `.time-field`, `.time-field__label` — campos de enfoque y descanso que revela **Otro**, en dos columnas.
- `.session-summary-card`, `__top`, `__legend`, `__legend-row`, `__dot--focus`, `__dot--break`, `__dot--long-break`, `__total` — resumen de la sesión con rueda, leyenda de enfoque, descansos cortos y pausas largas (la fila "Pausa larga" solo aparece cuando hay alguna) y duración total.
- `.session-wheel`, `__svg`, `__track`, `__arc--enfoque`, `__arc--descanso`, `__arc--descansoLargo`, `__center`, `__total`, `__unit` — rueda SVG de 72 px construida con `stroke-dasharray`/`stroke-dashoffset`; el SVG rota −90° y el total vive en un div superpuesto (17 px, peso 700). Los tramos comparten dos colores por tipo desde tokens: `--session-focus-bar` y `--session-break-bar`/`--session-long-break-bar`, ambos tonos pastel; los botones siguen usando `--button-primary-bg`.
- `.session-timeline`, `__segment--enfoque`, `__segment--descanso`, `__segment--descansoLargo`, `__value` — línea de tiempo proporcional de 22 px con 2 px de separación; el número se oculta en tramos menores al 6 % y el conjunto lleva `role="img"` con la secuencia (la pausa larga se nombra "pausa larga").
- `.stepper__btn` — botones −/+ del contador de las cards de árbol.
- `.alloc`, `.alloc__bar`, `.alloc__fill`, `.alloc__fill--over`, `.alloc__meta`, `.alloc__state` — barra de asignación; `.alloc__state` lleva el tooltip que explica los minutos sobrantes.
- `.tree-grid`, `.tree-card`, `.tree-card--active`, `.tree-card__main`, `.tree-card__tree`, `.tree-card__name`, `.tree-card__cost`, `.tree-card__counter`, `.tree-card__count` — cuadrícula de 4 especies con ícono, nombre, costo y contador de cuántos sumás.
- `.session-messages`, `.session-message`, `.session-message--error`, `.session-message--warning` — validación del diálogo (los minutos sobrantes se explican en el tooltip de `.alloc__state`).
- `.session-dialog__body` — planificador de sesión: una sola columna, secciones apiladas y scroll propio.
- `.session-card__edit` — botón de edición del nombre en la tarjeta de sesión (activa o del historial).
- `.session-detail` y sus partes (`__head`, `__tree`, `__description`, `__trees`, `__tree-chip`, `__back`) — tarjeta de una sesión pasada; usa `.card--session` y la misma gramática que la tarjeta activa. `--with-timer-mini` corre el cierre a la izquierda cuando el botón flotante del timer se superpone en la columna derecha.
- `.garden-left-rail`, `.garden-right-rail`, `.history-panel`, `.history-panel__head`, `.history-panel__title`, `.history-panel__close`, `.history-panel__summary`, `.history-panel__list`, `.history-filters`, `.history-filter` (estado con `aria-pressed`), `.history-list`, `.history-row` (estado `.is-selected`), `.history-empty` — columnas flotantes del jardín: en desktop se anclan al alto visible de `main` (16 px de margen), la izquierda mide `clamp(250px, 24vw, 340px)` y la derecha, el timer, `clamp(350px, 20vw, 420px)`. La columna izquierda corta el historial al alto de la pantalla y solo `.history-list` scrollea; el detalle de una sesión pasada scrollea dentro de la card si hace falta.
- `.stats-pills`, `.stats-pill` (estado con `aria-pressed`) — alcance de Estadísticas (*Este bosque / Todos*) y período del gráfico (*Día / Semana / Mes*), con la misma píldora suave de los presets de sesión.
- `.stats-chart__tip*` — tooltip compartido por el mapa de calor y las barras; se posiciona por hover y no intercepta el puntero. `.stats-nav__button` son las flechas redondeadas para moverse entre semanas y meses.
- `.stats-heatmap*` — mapa de calor de 53 semanas (`.stats-heatmap__scroll` permite desplazarlo en pantallas angostas). `.stats-heatmap__cell--l0…--l4` son los niveles, `--future` atenúa los días que todavía no llegaron y `--today` marca el día actual; la leyenda usa los mismos niveles como muestra.
- `.stats-bars*` — barras de los días del período: `__head` con total y navegación, `__track` con el alto de `--chart-bars-height`, `__bar` con `--today`/`--future` y `__label` con la misma distinción. `.stats-bars__empty` cubre los períodos sin enfoques.
- `.stats-donut*` — anillos de completados/abandonados y reparto por bosque; siguen el lenguaje del anillo de sesión (`__track`, `__arc--1…6`, centro con total, leyenda con puntos y tooltip al hover/focus).
- `.stats-ranking*` — ranking de bosques del bosque favorito, con mini-barras y el primer puesto en el verde principal.
- Los tokens de los gráficos viven en `theme.css`: `--chart-heat-*` (escala de calor), `--chart-bar*` (barras), `--chart-series-1…6` (porciones y ranking), `--chart-tip-bg` y `--chart-grid-line`. La escala de calor se calcula relativa al día con más minutos del rango visible.
- `.edge-scrollbar` (más `is-scrollbar-visible`, que agrega `useEdgeScrollbar`) — barra de scroll compartida por el panel de ajustes y la lista del historial: fina, redondeada y transparente hasta que el puntero se acerca al borde derecho.
- `.toast--success`, `.toast--warning`, `.toast--info` — tono de los avisos. El tono se elige en `CompletionToast.tsx` solo por nombre de clase.
- `.dialog-backdrop` — fondo del diálogo de confirmación y del diálogo de creación de bosque.
- `.forest-header`, `.forest-header__name`, `.forest-countdown` (`--active`, `--past`), `.forest-countdown__button`, `.forest-countdown__tip`, `.forest-countdown__bubble` — nombre del bosque y calendario discreto de días restantes (toggle al click/tap, tooltip al hover/focus).
- `.forest-welcome`, `.forest-welcome__icon`, `.forest-welcome__copy` — tarjeta de bienvenida para crear un bosque cuando no queda ninguno.
- `.forest-dialog` y sus partes, `.forest-field`, `.field-input`, `.field-textarea`, `.forest-check`, `.forest-date-row`, `.forest-goal`, `.forest-form__error` — formulario de creación.
- `.forest-preview` y sus partes, `.forest-preview-canvas` — vista previa con el atlas real. Se dibuja 1:1 al recorte nativo (`src/render/previewFrame.ts`) con `image-rendering: pixelated` y `crisp-edges`; sin reescaling interno.
- `.date-field` y `.date-popover` con `.date-day` (`--selected`, `--today`, `--disabled`, `--blank`) — calendario propio, no el control nativo.
- `.btn:disabled` — estado deshabilitado de los botones.
- `.zoom-control`, `.zoom-button` — tres botones flotantes (acercar, alejar, restablecer); no hay slider ni porcentaje visible. En mobile (≤767 px) `.zoom-control` no se ve.
- `.streak-chip` (con `--empty` cuando la racha es 0), `.streak-card` y sus partes (`__leaf`, `__count` con `--empty`, `__unit`, `__message`, `__close`), `.streak-strip`, `.streak-day` (modificadores `--planted`, `--today`) con `__leaf` y `__label` — racha diaria: píldora flotante en la esquina superior derecha, a la altura del encabezado y con su borde derecho a `1rem` (alineado con la cápsula del temporizador y con la de zoom) en todos los tamaños, y card del nuevo día; las animaciones propias son `streak-chip-in` y `streak-leaf-drop`.
- `.timer-mini`, `.timer-mini__button`, `.timer-mini__svg`, `.timer-mini__track`, `.timer-mini__fill` (modificador `--paused` atenúa el arco), `.timer-mini__icon` (ícono de reloj en reposo), `.timer-mini__tip` (tooltip tipo pill oscuro, a la izquierda del botón) — botón flotante que reemplaza a la card del temporizador cuando el usuario la oculta; en sesión muestra solo la rueda mínima (`.timer-mini--short-break` / `--long-break` tintan el arco con `--ring-*-to`, el arco en curso usa `--ring-to`) y en reposo un ícono de reloj. `.timer-mini` es un **botón redondo** que usa los mismos tokens que la cápsula de `.zoom-control` (`--zoom-bg`, `--zoom-border-color`, `--zoom-border-width`, `--zoom-shadow`, `--zoom-padding`, pero con `border-radius: 50%`) y su `__button` es un botón plano como `.zoom-button` (hover `rgba(32, 63, 59, 0.07)`, sin borde propio). Arriba a la derecha en desktop (`top: 4.25rem`); abajo a la derecha en mobile (≤767 px), donde vivía el zoom-control.
- `.timer-hide-button` — botón discreto junto al engranaje de la tarjeta del timer para ocultarla; es un `.icon-button` posicionado a la izquierda de `.timer-settings-button` en `.timer-phase-row`.

## Cambiar el tema completo

Para una variante visual, duplicá los tokens de `:root` en `theme.css` bajo un selector de tema, por ejemplo:

```css
[data-theme='otono'] {
  --palette-background: #efe2c8;
  --palette-primary: #7a4b2a;
  --palette-cream: #fff4dc;
}
```

Después alcanza con poner `data-theme="otono"` en `<html>`: los tokens de `:root` se resuelven en ese mismo elemento. Los componentes y las utilidades de Tailwind siguen apuntando a los mismos tokens, así que no hay que tocar el TSX.

La app de la v0.1 no tiene selector de temas ni modo oscuro; esto es la base para agregarlos sin desordenar los componentes.

## Qué no entra en este tema

La isla y el césped del canvas siguen siendo arte placeholder. Los árboles ya usan el atlas de sprites y no forman parte de `theme.css`; no hace falta migrar esos colores al tema.

## Checklist antes de cerrar un cambio visual

- [ ] Los valores nuevos están en `theme.css`, no en los `.tsx`.
- [ ] Las tarjetas usan `.card` y sus variantes.
- [ ] Los textos usan `.type-*` o `.eyebrow`.
- [ ] Los botones usan `.btn` y una variante.
- [ ] `npm run lint`, `npm test` y `npm run build` pasan.
- [x] Se revisó el layout a 1366×768, 1440×900 y a 360 px.
- [ ] El contraste de textos sobre fondos sigue siendo legible.
