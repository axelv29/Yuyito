import { useState } from 'react'
import { History } from 'lucide-react'
import { FOCUS_MINUTES } from '@/config/timer'
import type { View } from '@/config/views'
import { elapsedMs, remainingMs } from '@/logic/timer'
import { selectActiveForest, selectStats } from '@/state/selectors'
import { useStore } from '@/state/store'
import { CloseIcon, EyeOffIcon, GearIcon, PauseIcon, PlayIcon } from './icons'
import { OpenEndedContinue } from './OpenEndedContinue'
import { SettingsPanel } from './SettingsPanel'
import { TimerRing } from './TimerRing'
import { ViewSwitch } from './ViewSwitch'

interface TimerPanelProps {
  now: number
  view: View
  onChangeView: (view: View) => void
  onAbandonRequest: () => void
  onStartSession: () => void
  onContinueSession: () => void
  historyOpen: boolean
  onToggleHistory: () => void
  onHide: () => void
}

export function TimerPanel({
  now,
  view,
  onChangeView,
  onAbandonRequest,
  onStartSession,
  onContinueSession,
  historyOpen,
  onToggleHistory,
  onHide,
}: TimerPanelProps) {
  const active = useStore((state) => state.active)
  const sessions = useStore((state) => state.sessions)
  const trees = useStore((state) => state.trees)
  const forests = useStore((state) => state.forests)
  const activeForestId = useStore((state) => state.activeForestId)
  const activePlanId = useStore((state) => state.activePlanId)
  const plans = useStore((state) => state.plans)
  const settings = useStore((state) => state.settings)
  const pause = useStore((state) => state.pause)
  const resume = useStore((state) => state.resume)
  const skipBreak = useStore((state) => state.skipBreak)
  const updateSettings = useStore((state) => state.updateSettings)
  const continueOpenPlan = useStore((state) => state.continueOpenPlan)
  const endOpenPlan = useStore((state) => state.endOpenPlan)
  const forestId = active?.kind === 'focus' ? active.forestId : activeForestId
  const activeForest = selectActiveForest(forests, forestId)
  const stats = selectStats(sessions, trees, now, activeForest?.id)
  const openPlan = plans.find((plan) => plan.id === activePlanId && plan.finishedAt === null)
  const planForest = openPlan ? selectActiveForest(forests, openPlan.forestId) : null
  const [showSettings, setShowSettings] = useState(false)

  const isPaused = active?.pausedAt !== null && active?.pausedAt !== undefined
  const focusMin = openPlan?.focusMin ?? settings.focusMin ?? FOCUS_MINUTES
  const remaining = active ? remainingMs(active, now) : focusMin * 60_000
  const duration = active ? active.durationMin * 60_000 : focusMin * 60_000
  const progress = active ? Math.min(1, elapsedMs(active, now) / duration) : 0
  const phase = active ? (active.kind === 'focus' ? 'Enfoque' : 'Descanso') : 'Listo'
  const ringVariant =
    !active || active.kind === 'focus' ? 'focus' : active.longBreak ? 'longBreak' : 'shortBreak'
  const toleranceMs = (active?.pauseToleranceMin ?? 0) * 60_000
  const toleranceRemainingMs =
    active && isPaused && toleranceMs > 0
      ? Math.max(0, toleranceMs - (active.pausedMs + (now - (active.pausedAt ?? now))))
      : null
  const pomoProgress =
    active?.pomoIndex && active.pomoTotal
      ? { index: active.pomoIndex, total: active.pomoTotal }
      : openPlan && !openPlan.openEnded
        ? { index: openPlan.completedPomodoros + 1, total: openPlan.targetPomodoros }
        : null
  const strictPause = active?.strictPause ?? openPlan?.strictPause ?? settings.strictPause

  const handlePause = () => {
    if (isPaused) {
      resume(now)
      return
    }

    pause(now)
  }

  return (
    <section className="card w-full" aria-label="Temporizador">
      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          onBack={() => setShowSettings(false)}
        />
      ) : (
        <>
          <ViewSwitch view={view} onChange={onChangeView} disabled={active !== null} />

          <div className="timer-phase-row">
            <p className="eyebrow timer-phase">{phase}</p>
            <button
              type="button"
              className="icon-button timer-hide-button"
              onClick={onHide}
              aria-label="Ocultar temporizador"
              title="Ocultar temporizador"
            >
              <EyeOffIcon />
            </button>
            <button
              type="button"
              className="icon-button timer-settings-button"
              onClick={() => setShowSettings(true)}
              aria-label="Abrir ajustes predeterminados"
              title="Ajustes predeterminados"
            >
              <GearIcon />
            </button>
          </div>

          <TimerRing
            variant={ringVariant}
            progress={progress}
            remainingMs={remaining}
            durationMin={active?.durationMin ?? focusMin}
            paused={isPaused}
            toleranceRemainingMs={toleranceRemainingMs}
            pomoProgress={pomoProgress}
          />

          <div className="timer-today">
            <span>
              Pomodoros hoy <strong>{stats.todayPomodoros}</strong>
            </span>
            <button
              type="button"
              className="icon-button timer-history-button"
              onClick={onToggleHistory}
              aria-label={historyOpen ? 'Cerrar historial' : 'Abrir historial'}
              aria-pressed={historyOpen}
              title="Historial"
            >
              <History />
            </button>
          </div>

          {!active && openPlan && (
            <div className="session-resume">
              <p className="eyebrow">
                {openPlan.openEnded ? 'Sesión indefinida' : 'Sesión pendiente'}
              </p>
              <p className="type-title session-resume__title">{openPlan.title}</p>
              <p className="type-micro type-muted">
                {openPlan.openEnded
                  ? `${openPlan.completedPomodoros} ${openPlan.completedPomodoros === 1 ? 'pomodoro' : 'pomodoros'} · ${openPlan.planting.length} ${openPlan.planting.length === 1 ? 'árbol' : 'árboles'} en la cosecha`
                  : `${openPlan.completedPomodoros} de ${openPlan.targetPomodoros} pomodoros`}
                {planForest ? ` · ${planForest.name}` : ''}
              </p>
              <p className="type-micro type-muted">
                {openPlan.mode === 'continuous' ? 'Sin descansos' : 'Con descansos'} ·{' '}
                {openPlan.planting.length} {openPlan.planting.length === 1 ? 'árbol' : 'árboles'} en
                la cosecha
              </p>

              {openPlan.openEnded && (
                <OpenEndedContinue
                  key={`${openPlan.id}-${openPlan.completedPomodoros}`}
                  plan={openPlan}
                  onContinue={(species) => continueOpenPlan(species, now)}
                  onEnd={() => endOpenPlan(now)}
                />
              )}
            </div>
          )}

          <div className="timer-actions">
            {!active && (
              <button
                type="button"
                className={openPlan ? 'btn btn-secondary' : 'btn btn-primary'}
                onClick={onStartSession}
              >
                <PlayIcon />
                {openPlan ? 'Nueva sesión' : 'Iniciar'}
              </button>
            )}

            {!active && openPlan && !openPlan.openEnded && (
              <button type="button" className="btn btn-primary" onClick={onContinueSession}>
                <PlayIcon />
                Continuar
              </button>
            )}

            {active && !strictPause && (
              <button type="button" className="btn btn-primary" onClick={handlePause}>
                {isPaused ? <PlayIcon /> : <PauseIcon />}
                {isPaused ? 'Reanudar' : 'Pausar'}
              </button>
            )}

            {active && (
              <>
                {active.kind === 'break' ? (
                  <button type="button" className="btn btn-secondary" onClick={skipBreak}>
                    Saltar
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost-danger" onClick={onAbandonRequest}>
                    <CloseIcon />
                    Abandonar
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
