import { useStore } from '@/state/store'

export function BreakPrompt() {
  const pending = useStore((state) => state.pendingBreak)
  const settings = useStore((state) => state.settings)
  const plans = useStore((state) => state.plans)
  const activePlanId = useStore((state) => state.activePlanId)
  const startBreak = useStore((state) => state.startBreak)
  const dismiss = useStore((state) => state.dismissBreak)
  const endOpenPlan = useStore((state) => state.endOpenPlan)
  const openPlan = plans.find((plan) => plan.id === activePlanId && plan.finishedAt === null)
  const breakMin = openPlan?.breakMin ?? settings.breakMin ?? 5

  if (!pending || openPlan?.mode === 'continuous') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,34rem)] -translate-x-1/2">
      <div className="card break-prompt flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-title">¿Un descanso de {breakMin} minutos?</p>
          <p className="type-body type-muted">
            {openPlan ? 'El bloque terminó. La cosecha sigue en la cola.' : 'El bloque terminó.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-primary" onClick={() => startBreak(Date.now())}>
            Descansar
          </button>
          <button type="button" className="btn btn-secondary" onClick={dismiss}>
            Saltar
          </button>
          {openPlan?.openEnded && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => endOpenPlan(Date.now())}
            >
              Terminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
