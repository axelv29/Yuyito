import { speciesForFocusMin } from '@/config/species'
import { stageForElapsedMs } from '@/logic/growth'
import { livePlanFocus, projectOpenPlanting, projectPlanting } from '@/logic/planting'
import { sessionName } from '@/logic/session'
import { elapsedMs } from '@/logic/timer'
import { selectStats } from '@/state/selectors'
import { useStore } from '@/state/store'
import { Sprout } from 'lucide-react'

interface SessionMiniButtonProps {
  now: number
  onRestore: () => void
}

/**
 * Botón flotante para cuando la card de sesión actual está minimizada. Muestra
 * un ícono de planta y, al hacer hover/foco, un resumen corto de la sesión.
 */
export function SessionMiniButton({ now, onRestore }: SessionMiniButtonProps) {
  const active = useStore((state) => state.active)
  const sessions = useStore((state) => state.sessions)
  const trees = useStore((state) => state.trees)
  const plans = useStore((state) => state.plans)

  if (active?.kind !== 'focus') {
    return null
  }

  const stats = selectStats(sessions, trees, now, active.forestId ?? undefined)
  const plan = active.planId ? plans.find((item) => item.id === active.planId) : undefined
  const projection = plan
    ? plan.openEnded
      ? projectOpenPlanting(plan, elapsedMs(active, now) / 60_000)
      : projectPlanting(plan, livePlanFocus(plan, elapsedMs(active, now)))
    : null
  const current = projection
    ? (projection.current ?? projection.items[projection.items.length - 1])
    : null
  const species = current?.species ?? speciesForFocusMin(active.durationMin)
  const stage =
    current?.stage ?? stageForElapsedMs(species, elapsedMs(active, now), active.durationMin)
  const treeIndex = current ? current.index + 1 : 1
  const treeTotal = projection?.items.length ?? 1
  const title = active.title?.trim() || sessionName('focus', stats.todayPomodoros)

  const tooltip = `Árbol ${treeIndex}/${treeTotal} · Etapa ${stage} · ${title}`

  return (
    <div className="session-mini">
      <button
        type="button"
        className="session-mini__button"
        onClick={onRestore}
        aria-label="Mostrar sesión actual"
      >
        <Sprout className="session-mini__icon" />
      </button>
      <span className="session-mini__tip" role="tooltip">
        {tooltip}
      </span>
    </div>
  )
}
