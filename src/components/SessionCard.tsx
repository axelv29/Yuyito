import { useState, type FocusEvent } from 'react'
import { speciesConfig, speciesForFocusMin, stageMinuteMark } from '@/config/species'
import { stageForElapsedMs, stageLabel } from '@/logic/growth'
import { livePlanFocus, projectPlanting } from '@/logic/planting'
import { formatSessionStart, sessionName } from '@/logic/session'
import { elapsedMs } from '@/logic/timer'
import { selectActiveForest, selectStats } from '@/state/selectors'
import { useStore } from '@/state/store'
import { SESSION_TITLE_MAX_LENGTH } from '@/config/session'
import { SessionDetails } from './SessionDetails'
import { SessionTaskList } from './SessionTaskList'
import { TreePreview } from './TreePreview'

export function SessionCard({ now }: { now: number }) {
  const active = useStore((state) => state.active)
  const sessions = useStore((state) => state.sessions)
  const trees = useStore((state) => state.trees)
  const forests = useStore((state) => state.forests)
  const plans = useStore((state) => state.plans)
  const renamePlanTitle = useStore((state) => state.renamePlanTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const forestId = active?.kind === 'focus' ? active.forestId : null
  const activeForest = selectActiveForest(forests, forestId)
  const stats = selectStats(sessions, trees, now, activeForest?.id)

  if (active?.kind !== 'focus') {
    return null
  }

  const plan = active.planId ? plans.find((item) => item.id === active.planId) : undefined
  const projection = plan
    ? projectPlanting(plan, livePlanFocus(plan, elapsedMs(active, now)))
    : null
  const current = projection
    ? (projection.current ?? projection.items[projection.items.length - 1])
    : null
  const species = current?.species ?? speciesForFocusMin(active.durationMin)
  const config = speciesConfig(species)
  const stage =
    current?.stage ?? stageForElapsedMs(species, elapsedMs(active, now), active.durationMin)
  const requiredMin = current?.requiredMin ?? active.durationMin
  const treeIndex = current ? current.index + 1 : 1
  const treeTotal = projection?.items.length ?? 1
  const name = active.title?.trim() || sessionName('focus', stats.todayPomodoros)
  const started = formatSessionStart(active.startedAt)
  const title = active.title?.trim() || `${config.name} · ${stageLabel(species, stage)}`
  const treeDetail = treeTotal > 1 ? ` · Árbol ${treeIndex} de ${treeTotal}` : ''
  const detail =
    active.pomoIndex && active.pomoTotal && active.pomoTotal > 1
      ? `Pomodoro ${active.pomoIndex} de ${active.pomoTotal}${treeDetail}`
      : `Etapa ${stage} de ${config.stages.length} · ${requiredMin} min`
  const creditedMin = current ? Math.min(requiredMin, Math.floor(current.creditedMin)) : 0
  const speciesDetail = current?.partial
    ? `${config.name} · ${creditedMin}/${requiredMin} min`
    : `${config.name} · ${stageLabel(species, stage)}`

  const beginEditTitle = (event: FocusEvent<HTMLInputElement>) => {
    if (!plan) {
      event.currentTarget.blur()
      return
    }

    setTitleDraft(active.title?.trim() || plan.title || '')
    setEditingTitle(true)
  }

  const saveTitle = () => {
    if (!editingTitle) {
      return
    }

    const next = titleDraft.trim()
    if (plan && next) {
      renamePlanTitle(plan.id, next)
    }
    setEditingTitle(false)
  }

  return (
    <section className="card card--session w-full" aria-label="Sesión actual">
      <p className="eyebrow">Sesión en curso</p>

      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="session-icon">
          <TreePreview species={species} stage={stage} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="type-title">
            <input
              className="session-title-input"
              value={editingTitle ? titleDraft : title}
              onFocus={beginEditTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
                if (event.key === 'Escape') {
                  setTitleDraft(active.title?.trim() || plan?.title || '')
                  setEditingTitle(false)
                  event.currentTarget.blur()
                }
              }}
              maxLength={SESSION_TITLE_MAX_LENGTH}
              aria-label="Nombre de la sesión"
              readOnly={!plan}
            />
          </h2>
          <p className="type-micro type-muted mt-0.5">{detail}</p>
          {active.title?.trim() && (
            <p className="type-micro type-muted mt-0.5">{speciesDetail}</p>
          )}
        </div>
      </div>

      {active.description?.trim() && (
        <p className="session-card__description type-caption">{active.description}</p>
      )}

      {plan && plan.tasks.length > 0 && <SessionTaskList entryKey={plan.id} tasks={plan.tasks} />}

      <ol className="stage-track" aria-label="Etapas de crecimiento">
        {config.stages.map((item) => {
          const state = item.stage < stage ? 'done' : item.stage === stage ? 'current' : 'upcoming'
          const minutes = stageMinuteMark(species, item.stage, requiredMin)

          return (
            <li key={item.stage} className={`stage-track__item stage-track__item--${state}`}>
              <span className="stage-track__dot" aria-hidden="true" />
              <span className="stage-track__label">{minutes}</span>
            </li>
          )
        })}
      </ol>

      <SessionDetails>
        <div className="session-data__row">
          <dt className="session-data__label">Sesión</dt>
          <dd className="session-data__value">{name}</dd>
        </div>
        <div className="session-data__row">
          <dt className="session-data__label">Comenzó</dt>
          <dd className="session-data__value session-data__value--strong">{started}</dd>
        </div>
        <div className="session-data__row">
          <dt className="session-data__label">Bosque</dt>
          <dd className="session-data__value">{activeForest?.name ?? 'Sin bosque'}</dd>
        </div>
      </SessionDetails>
    </section>
  )
}
