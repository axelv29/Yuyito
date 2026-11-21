import { describe, expect, it } from 'vitest'
import { treeFlipped } from '@/render/orientation'

describe('treeFlipped', () => {
  it('es estable para el mismo id', () => {
    for (const id of ['tree-1', 'a1b2c3', 'preview-0', crypto.randomUUID()]) {
      expect(treeFlipped(id)).toBe(treeFlipped(id))
    }
  })

  it('reparte las dos orientaciones entre árboles distintos', () => {
    const ids = [
      '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      '0f8fad5b-d9cb-469f-a165-70867728950e',
      '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
      '9b2c3d4e-5f60-4712-8345-617283945061',
      'preview-0',
      'preview-1',
      'preview-2',
      'preview-3',
      'tree-1',
      'tree-2',
      'tree-3',
      'tree-4',
    ]
    const flipped = ids.filter((id) => treeFlipped(id))
    const normal = ids.filter((id) => !treeFlipped(id))

    expect(flipped.length).toBeGreaterThan(0)
    expect(normal.length).toBeGreaterThan(0)
  })

  it('no depende de la etapa ni de la celda, solo del id', () => {
    // La orientación se calcula una vez por árbol al dibujar, así que dos
    // árboles con el mismo id comparten lado aunque cambien de etapa.
    expect(treeFlipped('tree-1')).toBe(treeFlipped('tree-1'))
  })
})
