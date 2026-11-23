import { ORIGIN_X, TILE_HEIGHT, TILE_WIDTH } from '@/config/grid'
import type { Atlas, AtlasFrame } from './sprites'

/**
 * Prueba visual: sombra proyectada de cada árbol.
 *
 * La silueta sale del mismo frame del atlas (alfa duro, sin la sombra horneada
 * del sprite). Se acuesta en diagonal sobre el pasto y se recorta al rombo del
 * bosque. Se dibuja debajo de los árboles, así el follaje tapa la parte que
 * pasaría por encima de un vecino.
 */
export const TREE_SHADOWS_ENABLED = true

/** Dirección de la sombra en grados de pantalla (290° = diagonal atrás-derecha, cerca de las 2). */
export const SHADOW_ANGLE_DEG = 290
/** Opacidad del negro de la sombra. */
export const SHADOW_OPACITY = 0.3
/** Deformación: largo y ancho respecto de la silueta del árbol. */
export const SHADOW_LENGTH_SCALE = 0.9
export const SHADOW_WIDTH_SCALE = 0.95

/** Debajo de este alfa se descarta el píxel: saca la sombra horneada del sprite. */
const SILHOUETTE_ALPHA_THRESHOLD = 128
/**
 * En la base del sprite las raíces se abren a los costados y, acostadas,
 * forman un manchón raro. Se recorta esa franja dejando solo el tronco.
 */
const ROOT_TRIM_HEIGHT = 14
const ROOT_TRIM_HALF_WIDTH = 5
/** Difuminado suave del borde de la sombra. */
const SHADOW_BLUR_PX = 1.5
const SHADOW_BLUR_PAD = Math.ceil(SHADOW_BLUR_PX * 2)

export interface ShadowMatrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface ShadowClip {
  /** Y de escena del vértice trasero del rombo de pasto. */
  meadowTop: number
  /** Lado del bosque en celdas. */
  size: number
}

type ScratchCanvas = OffscreenCanvas | HTMLCanvasElement
type ScratchContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/**
 * Matriz que acuesta la silueta sobre el pasto. El eje vertical del sprite
 * (hacia arriba) pasa a apuntar en la dirección de la sombra y el horizontal
 * queda perpendicular, con un escalado distinto en cada eje para que la sombra
 * no sea una copia exacta del árbol.
 */
export function shadowMatrix(
  baseX: number,
  baseY: number,
  angleDeg: number = SHADOW_ANGLE_DEG,
  lengthScale: number = SHADOW_LENGTH_SCALE,
  widthScale: number = SHADOW_WIDTH_SCALE,
): ShadowMatrix {
  const angle = (angleDeg * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  // Perpendicular (+90°): el ancho del árbol sobre el pasto.
  const vx = -uy
  const vy = ux

  return {
    a: vx * widthScale,
    b: vy * widthScale,
    c: -ux * lengthScale,
    d: -uy * lengthScale,
    e: baseX,
    f: baseY,
  }
}

interface BlurredSilhouette {
  canvas: ScratchCanvas
  pad: number
}

const silhouettes = new WeakMap<AtlasFrame, BlurredSilhouette | null>()

function createScratchCanvas(width: number, height: number): ScratchCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }

  // Sin canvas (tests en node) no hay sombra: el render sigue igual.
  return null
}

/**
 * Silueta negra y opaca del frame, cacheada por frame. El umbral de alfa saca
 * los píxeles semitransparentes de la sombra que ya trae el arte del árbol.
 * Se pre-difumina una vez para evitar el costo de `ctx.filter` en cada draw.
 */
function silhouetteFor(atlas: Atlas, frame: AtlasFrame): BlurredSilhouette | null {
  const cached = silhouettes.get(frame)
  if (cached !== undefined) {
    return cached
  }

  const image = atlas.images[frame.sheet]
  if (!image) {
    silhouettes.set(frame, null)
    return null
  }

  const canvas = createScratchCanvas(frame.w, frame.h)
  const context = canvas?.getContext('2d') as ScratchContext | null
  if (!canvas || !context) {
    silhouettes.set(frame, null)
    return null
  }

  try {
    context.clearRect(0, 0, frame.w, frame.h)
    context.imageSmoothingEnabled = false
    context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h)

    const data = context.getImageData(0, 0, frame.w, frame.h)
    const pixels = data.data
    const rootStart = frame.anchorY - ROOT_TRIM_HEIGHT
    for (let index = 0; index < pixels.length; index += 4) {
      const pixel = index / 4
      const x = pixel % frame.w
      const y = Math.floor(pixel / frame.w)
      if (pixels[index + 3] >= SILHOUETTE_ALPHA_THRESHOLD) {
        pixels[index] = 0
        pixels[index + 1] = 0
        pixels[index + 2] = 0
        pixels[index + 3] = 255
        if (y >= rootStart && Math.abs(x - frame.anchorX) > ROOT_TRIM_HALF_WIDTH) {
          pixels[index + 3] = 0
        }
      } else {
        pixels[index + 3] = 0
      }
    }
    context.putImageData(data, 0, 0)
  } catch {
    silhouettes.set(frame, null)
    return null
  }

  const pad = SHADOW_BLUR_PAD
  const blurredCanvas = createScratchCanvas(frame.w + pad * 2, frame.h + pad * 2)
  const blurredContext = blurredCanvas?.getContext('2d') as ScratchContext | null
  if (!blurredCanvas || !blurredContext) {
    silhouettes.set(frame, null)
    return null
  }

  try {
    blurredContext.clearRect(0, 0, blurredCanvas.width, blurredCanvas.height)
    blurredContext.filter = `blur(${SHADOW_BLUR_PX}px)`
    blurredContext.drawImage(canvas as CanvasImageSource, pad, pad)
    blurredContext.filter = 'none'
  } catch {
    silhouettes.set(frame, null)
    return null
  }

  const blurred = { canvas: blurredCanvas, pad }
  silhouettes.set(frame, blurred)
  return blurred
}

/** Recorta el dibujo al rombo de pasto del bosque activo. */
function clipMeadow(context: CanvasRenderingContext2D, clip: ShadowClip): void {
  const halfWidth = (clip.size * TILE_WIDTH) / 2
  const halfHeight = (clip.size * TILE_HEIGHT) / 2

  context.beginPath()
  context.moveTo(ORIGIN_X, clip.meadowTop)
  context.lineTo(ORIGIN_X + halfWidth, clip.meadowTop + halfHeight)
  context.lineTo(ORIGIN_X, clip.meadowTop + clip.size * TILE_HEIGHT)
  context.lineTo(ORIGIN_X - halfWidth, clip.meadowTop + halfHeight)
  context.closePath()
  context.clip()
}

/**
 * Dibuja la sombra de un frame. `scale`, `flipX` y el ancla siguen las mismas
 * reglas que `drawAtlasFrame`, para que la sombra acompañe exactamente al árbol.
 */
export function drawTreeShadow(
  context: CanvasRenderingContext2D,
  atlas: Atlas,
  name: string,
  baseX: number,
  baseY: number,
  scale = 1,
  flipX = false,
  clip: ShadowClip | null = null,
): boolean {
  if (!TREE_SHADOWS_ENABLED) {
    return false
  }

  const frame = atlas.frames[name]
  if (!frame) {
    return false
  }

  const silhouette = silhouetteFor(atlas, frame)
  if (!silhouette) {
    return false
  }

  const matrix = shadowMatrix(baseX, baseY)

  context.save()
  if (clip) {
    clipMeadow(context, clip)
  }
  context.transform(
    matrix.a * scale,
    matrix.b * scale,
    matrix.c * scale,
    matrix.d * scale,
    matrix.e,
    matrix.f,
  )
  if (flipX) {
    context.scale(-1, 1)
  }
  // Multiplica el alfa actual para respetar el atenuado de la selección.
  context.globalAlpha *= SHADOW_OPACITY
  context.imageSmoothingEnabled = false
  context.drawImage(
    silhouette.canvas as CanvasImageSource,
    -frame.anchorX - silhouette.pad,
    -frame.anchorY - silhouette.pad,
  )
  context.restore()

  return true
}


