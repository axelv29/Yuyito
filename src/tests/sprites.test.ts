import { describe, expect, it, vi } from 'vitest'
import { atlasFrameBounds, drawAtlasFrame, treeFrameName } from '@/render/sprites'
import type { Atlas } from '@/render/sprites'
import type { TreeStage } from '@/state/types'

describe('treeFrameName', () => {
  it('asigna un frame vivo y uno marchito a cada etapa del abedul', () => {
    for (const stage of [1, 2, 3, 4, 5] as TreeStage[]) {
      expect(treeFrameName('abedul', stage, 'mature')).toBe(`abedul.${stage}.mature`)
      expect(treeFrameName('abedul', stage, 'withered')).toBe(`abedul.${stage}.withered`)
    }
  })

  it('asigna un frame vivo y uno marchito a cada etapa del pino', () => {
    for (const stage of [1, 2, 3, 4] as TreeStage[]) {
      expect(treeFrameName('pino', stage, 'mature')).toBe(`pino.${stage}.mature`)
      expect(treeFrameName('pino', stage, 'withered')).toBe(`pino.${stage}.withered`)
    }
  })

  it('asigna un frame vivo y uno marchito a cada etapa del roble', () => {
    for (const stage of [1, 2, 3, 4, 5, 6, 7] as TreeStage[]) {
      expect(treeFrameName('roble', stage, 'mature')).toBe(`roble.${stage}.mature`)
      expect(treeFrameName('roble', stage, 'withered')).toBe(`roble.${stage}.withered`)
    }
  })

  it('asigna un frame vivo y uno marchito a cada etapa del ceibo', () => {
    for (const stage of [1, 2, 3, 4, 5, 6, 7] as TreeStage[]) {
      expect(treeFrameName('ceibo', stage, 'mature')).toBe(`ceibo.${stage}.mature`)
      expect(treeFrameName('ceibo', stage, 'withered')).toBe(`ceibo.${stage}.withered`)
    }
  })

  it('usa cinco frames marchitos distintos para el abedul', () => {
    const names = new Set(
      ([1, 2, 3, 4, 5] as TreeStage[]).map((stage) => treeFrameName('abedul', stage, 'withered')),
    )
    expect(names.size).toBe(5)
  })
})

describe('atlasFrameBounds', () => {
  const atlas: Atlas = {
    images: {},
    frames: {
      'pino.1.mature': {
        x: 0,
        y: 0,
        w: 10,
        h: 20,
        anchorX: 4,
        anchorY: 20,
        sheet: 'pino',
      },
    },
  }

  it('no espeja el rectángulo cuando flipX es falso', () => {
    const bounds = atlasFrameBounds(atlas, 'pino.1.mature', 100, 50)

    expect(bounds).toEqual({ left: 96, top: 30, right: 106, bottom: 50 })
  })

  it('espeja el rectángulo sobre el ancla cuando flipX es verdadero', () => {
    const bounds = atlasFrameBounds(atlas, 'pino.1.mature', 100, 50, 1, true)

    // El ancla (tronco) sigue en x=100, pero la imagen se reparte del otro
    // lado: ahora 6 px a la izquierda y 4 a la derecha del punto de apoyo.
    expect(bounds).toEqual({ left: 94, top: 30, right: 104, bottom: 50 })
  })
})

describe('drawAtlasFrame', () => {
  const image = {} as HTMLImageElement
  const atlas: Atlas = {
    images: { pino: image },
    frames: {
      'pino.1.mature': {
        x: 12,
        y: 34,
        w: 10,
        h: 20,
        anchorX: 4,
        anchorY: 20,
        sheet: 'pino',
      },
    },
  }

  function mockCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  }

  it('dibuja el frame normal con coordenadas de atlas como fuente', () => {
    const ctx = mockCtx()

    const drawn = drawAtlasFrame(ctx, atlas, 'pino.1.mature', 100, 50)

    expect(drawn).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 12, 34, 10, 20, 96, 30, 10, 20)
    expect(ctx.save).not.toHaveBeenCalled()
  })

  it('al espejar usa la fuente del atlas y refleja sobre la base', () => {
    const ctx = mockCtx()

    const drawn = drawAtlasFrame(ctx, atlas, 'pino.1.mature', 100, 50, 1, true)

    expect(drawn).toBe(true)
    expect(ctx.save).toHaveBeenCalledOnce()
    expect(ctx.translate).toHaveBeenNthCalledWith(1, 100, 0)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(ctx.translate).toHaveBeenNthCalledWith(2, -100, 0)
    // La fuente debe ser el frame del atlas, no coordenadas de escena.
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 12, 34, 10, 20, 96, 30, 10, 20)
    expect(ctx.restore).toHaveBeenCalledOnce()
  })
})
