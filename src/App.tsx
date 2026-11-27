import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BreakPrompt } from '@/components/BreakPrompt'
import { CompletionToast } from '@/components/CompletionToast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevPanel } from '@/components/DevPanel'
import { ForestCountdown } from '@/components/ForestCountdown'
import { ForestCreateDialog } from '@/components/ForestCreateDialog'
import { ForestSwitcher } from '@/components/ForestSwitcher'
import { GardenCanvas } from '@/components/GardenCanvas'
import { HistoryPanel } from '@/components/HistoryPanel'
import { NotificationNotice } from '@/components/NotificationNotice'
import { SessionCard } from '@/components/SessionCard'
import { SessionCreateDialog } from '@/components/SessionCreateDialog'
import { SessionDetailCard } from '@/components/SessionDetailCard'
import { SessionMiniButton } from '@/components/SessionMiniButton'
import { StatsPanel } from '@/components/StatsPanel'
import { StorageNotice } from '@/components/StorageNotice'
import { StreakOverlay } from '@/components/StreakOverlay'
import { TimerMiniButton } from '@/components/TimerMiniButton'
import { TimerPanel } from '@/components/TimerPanel'
import type { View } from '@/config/views'
import { useCountdown } from '@/hooks/useCountdown'
import { useKeyboardFocus } from '@/hooks/useKeyboardFocus'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { stageForElapsedMs } from '@/logic/growth'
import { livePlanFocus, projectOpenPlanting, projectPlanting } from '@/logic/planting'
import { elapsedMs, isExpired } from '@/logic/timer'
import { playTone } from '@/logic/alarm'
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from '@/logic/notifications'
import { buildHistory } from '@/logic/history'
import { useStore } from '@/state/store'
import { speciesForFocusMin } from '@/config/species'
import { describeForestCountdown } from '@/logic/forest'
import { selectActiveForest } from '@/state/selectors'
import { useStorageStatus } from '@/state/storageStatus'
import type { Forest, NewForestInput, NewSessionInput, Tree } from '@/state/types'

type ConfirmMode = 'abandon' | 'newSession'

interface ConfirmRequest {
  mode: ConfirmMode
  id?: string
}

const EMPTY_SELECTED_IDS: ReadonlySet<string> = new Set()

function App() {
  const now = useCountdown()
  useKeyboardFocus()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const active = useStore((state) => state.active)
  const trees = useStore((state) => state.trees)
  const sessions = useStore((state) => state.sessions)
  const plans = useStore((state) => state.plans)
  const activePlanId = useStore((state) => state.activePlanId)
  const forests = useStore((state) => state.forests)
  const activeForestId = useStore((state) => state.activeForestId)
  const display = useStore((state) => state.display)
  const updateDisplay = useStore((state) => state.updateDisplay)
  const notice = useStore((state) => state.notice)
  const storageIssue = useStorageStatus((state) => state.issue)
  const pendingBreak = useStore((state) => state.pendingBreak)
  const pendingOpenContinue = useStore((state) => state.pendingOpenContinue)
  const startBreak = useStore((state) => state.startBreak)
  const startFocus = useStore((state) => state.startFocus)
  const startSession = useStore((state) => state.startSession)
  const continuePlan = useStore((state) => state.continuePlan)
  const abandon = useStore((state) => state.abandon)
  const createForest = useStore((state) => state.createForest)
  const updateForest = useStore((state) => state.updateForest)
  const selectForest = useStore((state) => state.selectForest)
  const [view, setView] = useState<View>('garden')
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [forestDialogOpen, setForestDialogOpen] = useState(false)
  const [editingForest, setEditingForest] = useState<Forest | null>(null)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [pendingSessionAfterForest, setPendingSessionAfterForest] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [timerPeek, setTimerPeek] = useState(false)
  const [streakMenuOpen, setStreakMenuOpen] = useState(false)
  const [notificationHint, setNotificationHint] = useState<string | null>(null)

  const currentForestId = active?.kind === 'focus' ? active.forestId : activeForestId
  const activeForest = selectActiveForest(forests, currentForestId)
  const forestTrees = useMemo(
    () => (activeForest ? trees.filter((tree) => tree.forestId === activeForest.id) : []),
    [activeForest, trees],
  )
  const countdown = activeForest ? describeForestCountdown(activeForest.endsOn, now) : null

  const activePlan = active?.planId ? plans.find((plan) => plan.id === active.planId) : undefined
  const pendingPlan =
    activePlanId === null
      ? null
      : (plans.find((plan) => plan.id === activePlanId && plan.finishedAt === null) ?? null)
  const activePreview = useMemo(() => {
    if (active?.kind !== 'focus' || !active.cell) {
      return null
    }

    if (activePlan) {
      const projection = activePlan.openEnded
        ? projectOpenPlanting(activePlan, elapsedMs(active, now) / 60_000)
        : projectPlanting(activePlan, livePlanFocus(activePlan, elapsedMs(active, now)))
      const item = projection.current ?? projection.items[projection.items.length - 1]
      if (item) {
        return {
          cell: item.cell,
          species: item.species,
          stage: item.stage,
          treeId: active.treeId ?? null,
          sessionId: active.id,
        }
      }
    }

    const species = speciesForFocusMin(active.durationMin)
    const stage = stageForElapsedMs(species, elapsedMs(active, now), active.durationMin)
    return {
      cell: active.cell,
      species,
      stage,
      treeId: active.treeId ?? null,
      sessionId: active.id,
    }
  }, [active, activePlan, now])

  const selectedEntry = useMemo(() => {
    if (!selectedKey || !activeForest) {
      return null
    }

    return (
      buildHistory(sessions, plans, trees, activeForest.id, 'all', now, active).find(
        (entry) => entry.key === selectedKey,
      ) ?? null
    )
  }, [selectedKey, activeForest, sessions, plans, trees, now, active])
  const selectedRecordKey = selectedEntry?.records.map((record) => record.id).join('|') ?? ''
  const selectedIds = useMemo(
    () => (selectedRecordKey ? new Set(selectedRecordKey.split('|')) : EMPTY_SELECTED_IDS),
    [selectedRecordKey],
  )

  useEffect(() => {
    if (!selectedKey) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sessionDialogOpen && !forestDialogOpen) {
        setSelectedKey(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedKey, sessionDialogOpen, forestDialogOpen])

  const closeConfirm = useCallback(() => setConfirmRequest(null), [])
  const confirmAbandon = useCallback(() => {
    abandon(Date.now())
    setConfirmRequest(null)
  }, [abandon])
  const requestAbandon = useCallback(() => {
    if (active) {
      setConfirmRequest({ id: active.id, mode: 'abandon' })
    }
  }, [active])

  const openForestDialog = useCallback(() => setForestDialogOpen(true), [])
  const closeForestDialog = useCallback(() => {
    setForestDialogOpen(false)
    setEditingForest(null)
    setPendingSessionAfterForest(false)
  }, [])
  const openEditForest = useCallback((forest: Forest) => {
    setEditingForest(forest)
    setForestDialogOpen(true)
  }, [])
  const handleCreateForest = useCallback(
    (input: NewForestInput, forestId?: string) => {
      if (forestId) {
        updateForest(forestId, input)
        return forestId
      }

      const created = createForest(input, Date.now())
      if (created) {
        setView('garden')
        if (pendingSessionAfterForest) {
          setPendingSessionAfterForest(false)
          setSessionDialogOpen(true)
        }
      }
      return created
    },
    [createForest, updateForest, pendingSessionAfterForest],
  )

  const handleSelectForest = useCallback(
    (id: string) => {
      selectForest(id)
      setView('garden')
      setSelectedKey(null)
    },
    [selectForest],
  )

  const handleOpenHistory = useCallback(
    (id: string) => {
      selectForest(id)
      setView('garden')
      setHistoryOpen(true)
      setSelectedKey(null)
    },
    [selectForest],
  )

  const openSessionFlow = useCallback(() => {
    if (!activeForest) {
      setPendingSessionAfterForest(true)
      setForestDialogOpen(true)
      return
    }

    setSelectedKey(null)
    setSessionDialogOpen(true)
  }, [activeForest])

  const openSessionDialog = useCallback(() => {
    if (pendingPlan) {
      setConfirmRequest({ mode: 'newSession', id: pendingPlan.id })
      return
    }

    openSessionFlow()
  }, [openSessionFlow, pendingPlan])

  const closeSessionDialog = useCallback(() => setSessionDialogOpen(false), [])

  // Iniciar una sesión es un gesto del usuario: aprovechamos para pedir el
  // permiso si la opción está encendida y el navegador todavía no preguntó.
  const requestNotificationIfNeeded = useCallback(() => {
    const { notification } = useStore.getState().settings
    if (!notification) {
      return
    }
    const permission = getNotificationPermission()
    if (permission === 'granted') {
      // Si el usuario ya lo habilitó, el aviso viejo dejó de tener sentido.
      setNotificationHint(null)
      return
    }
    if (permission === 'default') {
      void requestNotificationPermission().then((result) => {
        if (result === 'granted') {
          setNotificationHint(null)
        }
      })
    }
  }, [])

  const handleStartSession = useCallback(
    (input: NewSessionInput) => {
      requestNotificationIfNeeded()
      startSession(input, Date.now())
      setSelectedKey(null)
      setView('garden')
    },
    [requestNotificationIfNeeded, startSession],
  )

  const handleContinueSession = useCallback(() => {
    requestNotificationIfNeeded()
    continuePlan(Date.now())
    setSelectedKey(null)
    setView('garden')
  }, [continuePlan, requestNotificationIfNeeded])

  const confirmNewSession = useCallback(() => {
    setConfirmRequest(null)
    openSessionFlow()
  }, [openSessionFlow])

  const handleSelectTree = useCallback(
    (tree: Tree | null) => {
      if (!tree) {
        setSelectedKey(null)
        return
      }

      const record = sessions.find((session) => session.id === tree.sessionId)
      const runningKey =
        active?.kind === 'focus' && tree.sessionId === active.id
          ? (active.planId ?? active.id)
          : null
      setSelectedKey(tree.planId ?? record?.planId ?? record?.id ?? runningKey)
    },
    [active, sessions],
  )

  const settings = useStore((state) => state.settings)
  const devGardenSize = useStore((state) => state.devGardenSize)
  const devTreeShadows = useStore((state) => state.devTreeShadows)
  const prevActiveRef = useRef(active)
  const withered = forestTrees.filter((tree) => tree.state === 'withered').length

  // Alarma al completar un enfoque o un descanso. Si el navegador no puede
  // mostrar la notificación, la app avisa que falta el permiso.
  useEffect(() => {
    const prev = prevActiveRef.current
    const notify = (body: string) => {
      if (sendNotification('Yuyito', body)) {
        setNotificationHint(null)
        return
      }
      const permission = getNotificationPermission()
      setNotificationHint(
        permission === 'denied' || permission === 'unsupported'
          ? 'La alarma sonó, pero el navegador tiene bloqueadas las notificaciones de Yuyito. Podés habilitarlas desde el candado de la barra de direcciones.'
          : 'La alarma sonó, pero falta el permiso de notificaciones. Activalo en Ajustes para que el navegador también avise.',
      )
    }

    if (active === null && prev?.kind === 'focus') {
      playTone(settings.alarmTone, settings.alarmVolume)
      if (settings.notification) {
        const record = useStore.getState().sessions.find((session) => session.id === prev.id)
        const completedPlan = prev.planId
          ? plans.find((item) => item.id === prev.planId)
          : undefined
        if (record?.status === 'abandoned') {
          notify('El árbol se marchitó. Podés empezar otro cuando quieras.')
        } else if (completedPlan?.openEnded) {
          notify(`Bloque ${prev.pomoIndex ?? 1} completado. Podés continuar o terminar la sesión.`)
        } else {
          const index = prev.pomoIndex ?? 1
          const total = prev.pomoTotal ?? 1
          const isSeries = total > 1
          const isLast = index >= total
          let body: string
          if (isSeries) {
            if (isLast) {
              body = `Bloque ${index}/${total} completado. ¡Sesión terminada!`
            } else if (prev.mode === 'continuous') {
              body = `Bloque ${index}/${total} completado. Sigue el siguiente bloque.`
            } else {
              body = `Bloque ${index}/${total} completado. Tomá un descanso.`
            }
          } else {
            body = '¡Pomodoro completado! El árbol quedó en la pradera.'
          }
          notify(body)
        }
      }
    }
    // En una sesión indefinida el descanso encadena el bloque siguiente en el
    // mismo tick, así que `active` no llega a pasar por null: miramos si el
    // descanso anterior venció en lugar de esperar esa transición.
    if (
      prev?.kind === 'break' &&
      isExpired(prev, now) &&
      (active === null || active.kind === 'focus')
    ) {
      playTone(settings.alarmTone, settings.alarmVolume)
      if (settings.notification) {
        notify('Descanso terminado.')
      }
    }
    prevActiveRef.current = active
  }, [active, plans, now, settings.alarmTone, settings.alarmVolume, settings.notification])

  // Cierre de página con sesión activa ≈ abandono.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (active) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])

  // Auto-iniciar descanso.
  useEffect(() => {
    if (pendingBreak && settings.autoStartBreak) {
      startBreak(Date.now())
    }
  }, [pendingBreak, settings.autoStartBreak, startBreak])

  // Auto-iniciar pomodoro tras descanso.
  useEffect(() => {
    if (
      active === null &&
      !pendingBreak &&
      activeForest !== null &&
      settings.autoStartFocus &&
      prevActiveRef.current?.kind === 'break' &&
      (!pendingPlan?.openEnded || pendingOpenContinue)
    ) {
      startFocus(Date.now())
    }
  }, [
    active,
    activeForest,
    pendingBreak,
    pendingOpenContinue,
    pendingPlan,
    settings.autoStartFocus,
    startFocus,
  ])
  const label = activeForest
    ? `Bosque ${activeForest.name}: ${forestTrees.length} árboles y ${withered} marchitos.`
    : 'Pradera de bienvenida con 8 por 8 celdas.'
  const inSession = active !== null
  const showConfirm =
    confirmRequest?.mode === 'newSession' ||
    (active !== null && active.kind === 'focus' && confirmRequest?.id === active.id)
  const confirmMode = confirmRequest?.mode ?? 'abandon'

  const scrollableView = !inSession && (view === 'forests' || view === 'stats')

  // Alguna vista flotante (avisos, diálogos, paneles extra) tiene la prioridad sobre la card del temporizador en móvil.
  const breakPromptOpen = pendingBreak === true && pendingPlan?.mode !== 'continuous'
  const anyFloatingMenuOpen =
    notice !== null ||
    storageIssue !== null ||
    breakPromptOpen ||
    showConfirm ||
    historyOpen ||
    selectedEntry !== null ||
    streakMenuOpen ||
    sessionDialogOpen ||
    forestDialogOpen
  const autoHide = isMobile && anyFloatingMenuOpen && !timerPeek
  const timerCardHidden = display.hideTimerCard || autoHide
  const sessionCardHidden = display.hideSessionCard
  const showSessionCard = !timerCardHidden && !sessionCardHidden && active?.kind === 'focus'
  const showSessionMini = sessionCardHidden && !timerCardHidden && active?.kind === 'focus'
  // Al elegir la sesión que ya se ve en «Sesión en curso», no hace falta abrir
  // otra card con los mismos datos: alcanza con resaltar sus árboles.
  const activeFocusId = active?.kind === 'focus' ? active.id : null
  const selectedEntryIsRunning =
    activeFocusId !== null &&
    (selectedEntry?.records.some((record) => record.id === activeFocusId) ?? false)
  // Con un pomodoro en curso, el detalle de una sesión pasada comparte la
  // columna derecha con el timer. Le cedemos todo el alto: el timer queda
  // oculto (con su botón flotante en el lugar de siempre) y vuelve solo al
  // cerrar el detalle.
  const detailTakesTimerRail =
    active !== null && selectedEntry !== null && !(showSessionCard && selectedEntryIsRunning)
  const showTimerPanel = !timerCardHidden && !detailTakesTimerRail
  const showRightRail = showTimerPanel || detailTakesTimerRail
  const showTimerMini = timerCardHidden || detailTakesTimerRail

  // Ajuste en render (patrón oficial de React): al cerrarse el último menú, soltamos el "peek".
  const [wasMenuOpen, setWasMenuOpen] = useState(anyFloatingMenuOpen)
  if (wasMenuOpen !== anyFloatingMenuOpen) {
    setWasMenuOpen(anyFloatingMenuOpen)
    if (!anyFloatingMenuOpen && timerPeek) {
      setTimerPeek(false)
    }
  }

  const hideTimer = useCallback(() => updateDisplay({ hideTimerCard: true }), [updateDisplay])
  const restoreTimer = useCallback(() => {
    // Si el detalle de una sesión pasada ocupa la columna, mostrar el timer
    // implica cerrarlo: los dos no caben juntos.
    setSelectedKey(null)
    updateDisplay({ hideTimerCard: false })
    // El "peek" solo aplica con un menú abierto: sin menú, autoHide ya es falso.
    // Fijarlo fuera de un menú lo dejaba pegado para siempre.
    if (anyFloatingMenuOpen) {
      setTimerPeek(true)
    }
  }, [updateDisplay, anyFloatingMenuOpen])
  const hideSessionCard = useCallback(
    () => updateDisplay({ hideSessionCard: true }),
    [updateDisplay],
  )
  const restoreSessionCard = useCallback(
    () => updateDisplay({ hideSessionCard: false }),
    [updateDisplay],
  )

  return (
    <div
      className={
        scrollableView
          ? 'min-h-dvh overflow-x-hidden bg-background text-ink'
          : 'h-dvh overflow-hidden bg-background text-ink flex flex-col'
      }
    >
      <header className="relative z-30 flex w-full shrink-0 items-center gap-3 px-4 py-3">
        <div className="brand">
          <h1 className="app-title">Yuyito</h1>
        </div>
        {activeForest && (display.showForestName || (display.showCountdown && countdown)) && (
          <div className="forest-header">
            {display.showForestName && (
              <span className="forest-header__name" title={activeForest.name}>
                {activeForest.name}
              </span>
            )}
            {display.showCountdown && countdown && <ForestCountdown countdown={countdown} />}
          </div>
        )}
      </header>

      <StorageNotice />
      {notificationHint && (
        <NotificationNotice
          message={notificationHint}
          onDismiss={() => setNotificationHint(null)}
        />
      )}

      <main
        className={
          scrollableView
            ? 'pb-12'
            : 'min-h-0 flex-1 max-[767px]:overflow-y-auto max-[767px]:overflow-x-hidden min-[768px]:relative min-[768px]:overflow-hidden'
        }
      >
        {view === 'forests' ? (
          <ForestSwitcher
            now={now}
            view={view}
            onChangeView={setView}
            onSelect={handleSelectForest}
            onHistoryForest={handleOpenHistory}
            onCreateForest={openForestDialog}
            onEditForest={openEditForest}
          />
        ) : view === 'garden' || inSession ? (
          <div className="flex min-h-full w-full flex-col md:h-full">
            <div className="relative mx-auto aspect-[6/5] w-full max-w-[1024px] shrink-0 md:aspect-auto md:h-full">
              <GardenCanvas
                trees={forestTrees}
                active={activePreview}
                label={label}
                gardenSize={activeForest?.size ?? devGardenSize}
                hasForest={activeForest !== null}
                treeShadows={devTreeShadows}
                selectedSessionIds={selectedIds}
                selectionKey={active ? null : selectedKey}
                onSelectTree={handleSelectTree}
              />
            </div>

            <div className="garden-left-rail z-10">
              {showSessionCard && <SessionCard now={now} onHide={hideSessionCard} />}

              {!active && selectedEntry && activeForest && (
                <SessionDetailCard
                  entry={selectedEntry}
                  forestName={activeForest.name}
                  onClose={() => setSelectedKey(null)}
                />
              )}

              {historyOpen && activeForest && (
                <HistoryPanel
                  now={now}
                  selectedEntry={selectedEntry}
                  onSelectKey={setSelectedKey}
                  onClose={() => setHistoryOpen(false)}
                />
              )}
            </div>

            {showRightRail && (
              <div
                className={
                  detailTakesTimerRail
                    ? 'garden-right-rail garden-right-rail--below-timer-mini z-10'
                    : 'garden-right-rail z-10'
                }
              >
                {showTimerPanel && (
                  <TimerPanel
                    now={now}
                    view={view}
                    onChangeView={setView}
                    onAbandonRequest={requestAbandon}
                    onStartSession={openSessionDialog}
                    onContinueSession={handleContinueSession}
                    historyOpen={historyOpen}
                    onToggleHistory={() => setHistoryOpen((open) => !open)}
                    onHide={hideTimer}
                  />
                )}

                {detailTakesTimerRail && activeForest && (
                  <SessionDetailCard
                    entry={selectedEntry}
                    forestName={activeForest.name}
                    onClose={() => setSelectedKey(null)}
                  />
                )}
              </div>
            )}
            {showTimerMini && <TimerMiniButton now={now} onRestore={restoreTimer} />}
            {showSessionMini && <SessionMiniButton now={now} onRestore={restoreSessionCard} />}
          </div>
        ) : (
          <StatsPanel now={now} view={view} onChangeView={setView} />
        )}
      </main>

      {import.meta.env.DEV && <DevPanel now={now} />}

      <StreakOverlay now={now} onOpenChange={setStreakMenuOpen} />
      <CompletionToast />
      <BreakPrompt />
      <ConfirmDialog
        open={showConfirm}
        title={
          confirmMode === 'newSession' ? '¿Empezar una nueva sesión?' : '¿Abandonar la sesión?'
        }
        message={
          confirmMode === 'newSession'
            ? 'La sesión anterior queda sin terminar: no cuenta como árbol marchito, sino como una sesión no terminada. ¿Querés empezar una nueva sesión de todas formas?'
            : 'El árbol va a quedar marchito y la sesión no va a sumar minutos. Podés empezar otro pomodoro cuando quieras.'
        }
        confirmLabel={confirmMode === 'newSession' ? 'Empezar nueva sesión' : 'Abandonar'}
        onConfirm={confirmMode === 'newSession' ? confirmNewSession : confirmAbandon}
        onCancel={closeConfirm}
      />
      <ForestCreateDialog
        open={forestDialogOpen}
        onClose={closeForestDialog}
        onCreate={handleCreateForest}
        forest={editingForest}
      />
      {sessionDialogOpen && (
        <SessionCreateDialog
          open={sessionDialogOpen}
          forestName={activeForest?.name ?? 'Nuevo bosque'}
          onClose={closeSessionDialog}
          onStart={handleStartSession}
        />
      )}
    </div>
  )
}

export default App
