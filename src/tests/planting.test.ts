import { describe, expect, it } from 'vitest'
import {
  planBudget,
  projectPlanting,
  suggestPlanting,
  totalPlantingCost,
  validatePlanting,
} from '@/logic/planting'
import type { SessionPlan, TreeSpecies } from '@/state/types'

function plan(
  focusMin: number,
  targetPomodoros: number,
  species: readonly TreeSpecies[],
): Pick<SessionPlan, 'focusMin' | 'targetPomodoros' | 'planting'> {
  return {
    focusMin,
    targetPomodoros,
    planting: species.map((item, index) => ({
      species: item,
      cell: { col: index, row: 0 },
      treeId: null,
    })),
  }
}

describe('planBudget', () => {
  it('multiplica el enfoque por la cantidad de bloques', () => {
    expect(planBudget({ focusMin: 25, targetPomodoros: 3 })).toBe(75)
    expect(planBudget({ focusMin: 30, targetPomodoros: 3 })).toBe(90)
  })
})

describe('totalPlantingCost', () => {
  it('suma el costo fijo de cada especie', () => {
    expect(totalPlantingCost([{ species: 'pino' }, { species: 'ceibo' }])).toBe(115)
  })
})

describe('projectPlanting', () => {
  it('reparte de a un árbol y deja parcial al último', () => {
    const projection = projectPlanting(plan(25, 3, ['pino', 'ceibo']), 75)

    expect(projection.budget).toBe(75)
    expect(projection.totalCost).toBe(115)
    expect(projection.completedCount).toBe(1)
    expect(projection.currentIndex).toBe(1)
    expect(projection.current?.species).toBe('ceibo')
    expect(projection.current?.creditedMin).toBe(50)
    expect(projection.current?.partial).toBe(true)
    expect(projection.current?.complete).toBe(false)
    expect(projection.current?.stage).toBe(4)
    expect(projection.shortfallMin).toBe(40)
    expect(projection.leftoverMin).toBe(0)
    expect(projection.willPartial).toBe(true)
  })

  it('completa toda la cola cuando el presupuesto alcanza', () => {
    const projection = projectPlanting(plan(30, 3, ['ceibo']), 90)

    expect(projection.currentIndex).toBeNull()
    expect(projection.current).toBeNull()
    expect(projection.completedCount).toBe(1)
    expect(projection.shortfallMin).toBe(0)
    expect(projection.leftoverMin).toBe(0)
  })

  it('calcula los minutos sobrantes', () => {
    const projection = projectPlanting(plan(25, 3, ['pino', 'pino']), 75)

    expect(projection.leftoverMin).toBe(25)
    expect(projection.shortfallMin).toBe(0)
    expect(projection.unstartedCount).toBe(0)
  })
})

describe('validatePlanting', () => {
  it('acepta una cola que usa exactamente el presupuesto', () => {
    const validation = validatePlanting({
      focusMin: 25,
      targetPomodoros: 3,
      planting: ['pino', 'pino', 'pino'],
    })

    expect(validation.ok).toBe(true)
    expect(validation.errors).toEqual([])
    expect(validation.warnings).toEqual([])
  })

  it('avisa cuando sobran minutos pero deja empezar', () => {
    const validation = validatePlanting({
      focusMin: 25,
      targetPomodoros: 3,
      planting: ['pino', 'pino'],
    })

    expect(validation.ok).toBe(true)
    expect(validation.errors).toEqual([])
    expect(validation.warnings[0]).toContain('Sobran 25 min')
  })

  it('rechaza una cola que no alcanza a iniciar el último árbol', () => {
    const validation = validatePlanting({
      focusMin: 25,
      targetPomodoros: 1,
      planting: ['pino', 'pino', 'pino'],
    })

    expect(validation.ok).toBe(false)
    expect(validation.errors).toContain('El presupuesto no alcanza para iniciar el último árbol.')
  })

  it('avisa cuando el último árbol queda parcial', () => {
    const validation = validatePlanting({
      focusMin: 25,
      targetPomodoros: 3,
      planting: ['ceibo'],
    })

    expect(validation.ok).toBe(true)
    expect(validation.warnings[0]).toContain('83%')
    expect(validation.warnings[0]).toContain('75/90 min')
  })

  it('rechaza una cola vacía', () => {
    const validation = validatePlanting({
      focusMin: 25,
      targetPomodoros: 3,
      planting: [],
    })

    expect(validation.ok).toBe(false)
    expect(validation.errors).toContain('Agregá al menos un árbol a la sesión.')
  })
})

describe('suggestPlanting', () => {
  it('elige la combinación más ajustada al presupuesto', () => {
    expect(suggestPlanting(75)).toEqual(['pino', 'pino', 'pino'])
    expect([...suggestPlanting(85)].sort()).toEqual(['pino', 'roble'])
    expect(suggestPlanting(90)).toEqual(['ceibo'])
  })

  it('prefiere menos árboles cuando la suma empata', () => {
    const suggestion = suggestPlanting(90)

    expect(suggestion).toHaveLength(1)
    expect(suggestion).toEqual(['ceibo'])
  })

  it('devuelve una cola vacía para presupuesto cero', () => {
    expect(suggestPlanting(0)).toEqual([])
  })
})
