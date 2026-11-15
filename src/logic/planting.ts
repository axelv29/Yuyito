import { SESSION_MAX_TREES } from '@/config/session'
import { speciesConfig } from '@/config/species'
import type { Cell, PlantingItem, SessionPlan, TreeSpecies, TreeStage } from '@/state/types'
import { stageForMinutes } from './growth'

/** Un árbol ya proyectado contra el presupuesto de enfoque de la sesión. */
export interface PlantingProjectionItem {
  index: number
  species: TreeSpecies
  cell: Cell
  treeId: string | null
  requiredMin: number
  creditedMin: number
  stage: TreeStage
  complete: boolean
  partial: boolean
  started: boolean
}

export interface PlantingProjection {
  budget: number
  totalCost: number
  focusMin: number
  items: PlantingProjectionItem[]
  completedCount: number
  currentIndex: number | null
  current: PlantingProjectionItem | null
  /** Minutos que sobran cuando la cola cuesta menos que el presupuesto. */
  leftoverMin: number
  /** Minutos que faltan para completar la cola. */
  shortfallMin: number
  willPartial: boolean
  unstartedCount: number
}

export interface PlantingValidationInput {
  focusMin: number
  targetPomodoros: number
  planting: readonly TreeSpecies[]
}

export interface PlantingValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
  budget: number
  totalCost: number
  projection: PlantingProjection
}

type PlanRhythm = Pick<SessionPlan, 'focusMin' | 'targetPomodoros'>

/** Presupuesto total de enfoque de una sesión. */
export function planBudget(plan: PlanRhythm): number {
  return Math.max(0, plan.focusMin) * Math.max(1, plan.targetPomodoros)
}

/** Costo total de una cola de especies. */
export function totalPlantingCost(planting: readonly { species: TreeSpecies }[]): number {
  return planting.reduce((sum, item) => sum + speciesConfig(item.species).minutes, 0)
}

/** Etapa que alcanza un árbol con los minutos acumulados. */
export function stageForTreeProgress(species: TreeSpecies, accumulatedMin: number): TreeStage {
  return stageForMinutes(species, Math.max(0, accumulatedMin), speciesConfig(species).minutes)
}

/**
 * Reparte los minutos de enfoque de forma secuencial: cada árbol consume su
 * costo completo y el último puede quedar parcial. No hay reparto libre.
 */
export function projectPlanting(
  plan: Pick<SessionPlan, 'focusMin' | 'targetPomodoros' | 'planting'>,
  focusMin = 0,
): PlantingProjection {
  const budget = planBudget(plan)
  const totalCost = totalPlantingCost(plan.planting)
  const clampedFocus = Math.max(0, focusMin)
  let remaining = clampedFocus

  const items: PlantingProjectionItem[] = plan.planting.map((item, index) => {
    const requiredMin = speciesConfig(item.species).minutes
    const creditedMin = Math.min(remaining, requiredMin)
    remaining = Math.max(0, remaining - creditedMin)
    const complete = requiredMin > 0 && creditedMin >= requiredMin
    const partial = creditedMin > 0 && !complete

    return {
      index,
      species: item.species,
      cell: item.cell,
      treeId: item.treeId,
      requiredMin,
      creditedMin,
      stage: stageForTreeProgress(item.species, creditedMin),
      complete,
      partial,
      started: creditedMin > 0,
    }
  })

  const currentIndex = items.findIndex((item) => !item.complete)
  const resolvedIndex = currentIndex === -1 ? null : currentIndex

  return {
    budget,
    totalCost,
    focusMin: clampedFocus,
    items,
    completedCount: items.filter((item) => item.complete).length,
    currentIndex: resolvedIndex,
    current: resolvedIndex === null ? null : items[resolvedIndex],
    leftoverMin: Math.max(0, budget - totalCost),
    shortfallMin: Math.max(0, totalCost - budget),
    willPartial: totalCost > budget,
    unstartedCount: items.filter((item) => !item.started).length,
  }
}

function fakePlanting(planting: readonly TreeSpecies[]): PlantingItem[] {
  return planting.map((species) => ({
    species,
    cell: { col: 0, row: 0 },
    treeId: null,
  }))
}

/** Revisa que la cola use el presupuesto y avisa si el último árbol queda parcial. */
export function validatePlanting(input: PlantingValidationInput): PlantingValidation {
  const budget = Math.max(0, input.focusMin) * Math.max(1, input.targetPomodoros)
  const planting = fakePlanting(input.planting)
  const projection = projectPlanting(
    {
      focusMin: input.focusMin,
      targetPomodoros: input.targetPomodoros,
      planting,
    },
    budget,
  )
  const errors: string[] = []
  const warnings: string[] = []

  if (input.planting.length === 0) {
    errors.push('Agregá al menos un árbol a la sesión.')
  }

  if (input.planting.length > SESSION_MAX_TREES) {
    errors.push(`Máximo ${SESSION_MAX_TREES} árboles por sesión.`)
  }

  if (input.planting.length > 0 && projection.leftoverMin > 0) {
    warnings.push(
      `Sobran ${projection.leftoverMin} min de enfoque: quedan sin plantar, pero podés empezar igual. Si abandonás antes de tiempo, el último árbol se marchita.`,
    )
  }

  if (input.planting.length > 0 && projection.shortfallMin > 0) {
    const last = projection.items[projection.items.length - 1]
    if (!last || last.creditedMin <= 0) {
      errors.push('El presupuesto no alcanza para iniciar el último árbol.')
    } else {
      const percent = Math.round((last.creditedMin / last.requiredMin) * 100)
      warnings.push(
        `El último árbol quedará al ${percent}% (${last.creditedMin}/${last.requiredMin} min). Ajustá el tiempo o aceptá que no madure.`,
      )
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    budget,
    totalCost: projection.totalCost,
    projection,
  }
}

const SUGGEST_COSTS: readonly TreeSpecies[] = ['pino', 'abedul', 'roble', 'ceibo']

function distinctCount(combo: readonly TreeSpecies[]): number {
  return new Set(combo).size
}

function isBetterCombo(
  candidate: readonly TreeSpecies[],
  current: readonly TreeSpecies[] | undefined,
): boolean {
  if (!current) {
    return true
  }
  if (candidate.length !== current.length) {
    return candidate.length < current.length
  }
  return distinctCount(candidate) > distinctCount(current)
}

/**
 * Busca una cola que cubra el presupuesto con la menor suma posible y, en
 * empate, con menos árboles y más variedad.
 */
export function suggestPlanting(budget: number, maxTrees = SESSION_MAX_TREES): TreeSpecies[] {
  const target = Math.max(0, Math.round(budget))
  if (target === 0) {
    return []
  }

  const maxCost = Math.max(...SUGGEST_COSTS.map((species) => speciesConfig(species).minutes))
  const limit = target + maxCost
  const best: Array<TreeSpecies[] | undefined> = Array.from({ length: limit + 1 })
  best[0] = []

  for (let count = 0; count < maxTrees; count += 1) {
    for (let sum = 0; sum <= limit; sum += 1) {
      const current = best[sum]
      if (!current) {
        continue
      }

      for (const species of SUGGEST_COSTS) {
        const nextSum = sum + speciesConfig(species).minutes
        if (nextSum > limit) {
          continue
        }
        const candidate = [...current, species]
        if (candidate.length > maxTrees) {
          continue
        }
        if (isBetterCombo(candidate, best[nextSum])) {
          best[nextSum] = candidate
        }
      }
    }
  }

  let chosen: TreeSpecies[] | undefined
  for (let sum = target; sum <= limit; sum += 1) {
    const combo = best[sum]
    if (!combo) {
      continue
    }
    // La suma manda: la primera suma que cubre el presupuesto es la más
    // ajustada. Dentro de esa suma, preferimos menos árboles y más variedad.
    if (!chosen || isBetterCombo(combo, chosen)) {
      chosen = combo
    }
    break
  }

  if (chosen) {
    return chosen
  }

  // Presupuesto mayor que el máximo plantable: devolver la cola más grande.
  return Array.from({ length: maxTrees }, () => 'ceibo')
}

/** Minutos de enfoque que lleva el plan incluyendo el bloque en curso. */
export function livePlanFocus(plan: SessionPlan, elapsedMs: number): number {
  return plan.focusElapsedMin + Math.max(0, elapsedMs) / 60_000
}
