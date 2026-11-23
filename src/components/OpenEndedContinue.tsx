import { useState } from 'react'
import { finalStage, speciesConfig, speciesFittingFocus } from '@/config/species'
import type { SessionPlan, TreeSpecies } from '@/state/types'
import { TreePreview } from './TreePreview'

interface OpenEndedContinueProps {
  plan: SessionPlan
  onContinue: (species: TreeSpecies) => void
  onEnd: () => void
}

export function OpenEndedContinue({ plan, onContinue, onEnd }: OpenEndedContinueProps) {
  const [selected, setSelected] = useState<TreeSpecies | null>(null)
  const allowedSpecies = speciesFittingFocus(plan.focusMin)

  return (
    <div className="open-ended">
      <p className="type-micro type-muted">Bloque {plan.completedPomodoros + 1}</p>
      <div className="open-ended__grid">
        {allowedSpecies.map((species) => {
          const config = speciesConfig(species)
          const fitting = config.minutes <= plan.focusMin

          return (
            <button
              key={species}
              type="button"
              className={`open-ended__option${selected === species ? ' open-ended__option--active' : ''}`}
              onClick={() => setSelected(species)}
              disabled={!fitting}
              aria-pressed={selected === species}
            >
              <span className="open-ended__tree">
                <TreePreview species={species} stage={finalStage(species)} />
              </span>
              <span className="open-ended__name">{config.name}</span>
              <span className="open-ended__cost">{config.minutes} min</span>
            </button>
          )
        })}
      </div>

      <div className="open-ended__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!selected}
          onClick={() => selected && onContinue(selected)}
        >
          Continuar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onEnd}>
          Terminar
        </button>
      </div>
    </div>
  )
}
