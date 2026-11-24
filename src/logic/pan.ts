/**
 * Límites del arrastre global de la pradera.
 *
 * El recorrido se mide simétricamente desde el centro de la isla. En lugar de
 * usar píxeles fijos, se toma una fracción del trayecto máximo: el que haría
 * falta para que la isla salga por completo de la pantalla (media pantalla más
 * media isla ya escalada). Así la misma posición relativa se siente igual en
 * cualquier tamaño de ventana y de zoom; en una pantalla chica se recorren
 * menos píxeles. Nunca queda menos de MIN_ISLAND_VISIBLE de la isla asomando.
 */

/** Fracción del trayecto máximo que se puede recorrer desde el centro. */
export const PAN_TRAVEL_RATIO = 0.8

/** Mínimo de isla que debe seguir asomando por la pantalla, en px CSS. */
const MIN_ISLAND_VISIBLE = 48

export interface PanOffset {
  x: number
  y: number
}

export interface PanLimit {
  x: number
  y: number
}

function safeSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Recorrido de un eje: 80 % del trayecto máximo, con la isla a la vista. */
function axisLimit(containerSize: number, islandHalf: number): number {
  const maxTravel = safeSize(containerSize) / 2 + safeSize(islandHalf)
  if (maxTravel <= 0) {
    return 0
  }

  const limit = Math.min(maxTravel * PAN_TRAVEL_RATIO, maxTravel - MIN_ISLAND_VISIBLE)
  return Math.max(0, Math.round(limit))
}

/**
 * Límite simétrico del arrastre. El contenedor y las mitades de la isla se
 * pasan en px CSS, ya con el zoom aplicado, para que las cuentas sean
 * proporcionales al área visible y a la isla escalada.
 */
export function panLimit(
  containerWidth: number,
  containerHeight: number,
  islandHalfWidth: number,
  islandHalfHeight: number,
): PanLimit {
  return {
    x: axisLimit(containerWidth, islandHalfWidth),
    y: axisLimit(containerHeight, islandHalfHeight),
  }
}

/** Mantiene el desplazamiento dentro del límite, en píxeles enteros. */
export function clampPan(offset: PanOffset, limit: PanLimit): PanOffset {
  const x = Number.isFinite(offset.x) ? offset.x : 0
  const y = Number.isFinite(offset.y) ? offset.y : 0

  return {
    x: Math.round(Math.min(limit.x, Math.max(-limit.x, x))),
    y: Math.round(Math.min(limit.y, Math.max(-limit.y, y))),
  }
}
