import { TILE_HEIGHT } from '@/config/grid'

/**
 * Luz de sol frontal sobre todo el bosque: el borde de atrás queda en sombra y
 * el de adelante iluminado. Es un único degradado para la escena entera, no un
 * tinte por árbol, así se lee como luz global y no como diferencia entre
 * árboles vecinos.
 */
const SUN_BACK = [26, 52, 48] as const
const SUN_FRONT = [246, 250, 224] as const
const SUN_BACK_ALPHA = 0.28
const SUN_FRONT_ALPHA = 0.22

export interface SunlightStop {
  /** 0 = borde de atrás del rombo, 1 = borde de adelante. */
  offset: number
  color: readonly [number, number, number]
  alpha: number
}

export interface SunlightOptions {
  width: number
  height: number
  /** Y en píxeles de canvas del vértice trasero del rombo. */
  backY: number
  /** Y en píxeles de canvas del vértice delantero del rombo. */
  frontY: number
}

/** Paradas del degradado, de la sombra del fondo al sol del frente. */
export function sunlightStops(): readonly SunlightStop[] {
  return [
    { offset: 0, color: SUN_BACK, alpha: SUN_BACK_ALPHA },
    { offset: 0.6, color: SUN_BACK, alpha: 0 },
    { offset: 0.6, color: SUN_FRONT, alpha: 0 },
    { offset: 1, color: SUN_FRONT, alpha: SUN_FRONT_ALPHA },
  ]
}

/**
 * Rango vertical del rombo en coordenadas de escena. Los bosques más chicos se
 * anclan abajo, así que el vértice delantero siempre cae en la misma fila.
 */
export function sunlightRange(meadowTop: number, size: number): { backY: number; frontY: number } {
  return { backY: meadowTop, frontY: meadowTop + size * TILE_HEIGHT }
}

/**
 * Tiñe todo lo ya dibujado con la luz del bosque. `source-atop` respeta el alfa
 * existente: el pasto, los árboles y sus sombras reciben la misma luz y el
 * fondo transparente queda intacto.
 */
export function drawSunlight(ctx: CanvasRenderingContext2D, options: SunlightOptions): void {
  const { width, height, backY, frontY } = options
  if (frontY <= backY) {
    return
  }

  const gradient = ctx.createLinearGradient(0, backY, 0, frontY)
  for (const stop of sunlightStops()) {
    const [r, g, b] = stop.color
    gradient.addColorStop(stop.offset, `rgba(${r}, ${g}, ${b}, ${stop.alpha})`)
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
