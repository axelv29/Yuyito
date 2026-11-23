import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { finalStage, speciesConfig, speciesFittingFocus } from '@/config/species'
import {
  SESSION_DESCRIPTION_MAX_LENGTH,
  SESSION_LEFTOVER_WARN_MIN,
  SESSION_MAX_BREAK_MIN,
  SESSION_MAX_FOCUS_MIN,
  SESSION_MAX_LONG_BREAK_MIN,
  SESSION_MAX_POMODOROS,
  SESSION_MAX_TASKS,
  SESSION_MAX_TREES,
  SESSION_MIN_BREAK_MIN,
  SESSION_MIN_FOCUS_MIN,
  SESSION_MIN_LONG_BREAK_MIN,
  SESSION_TASK_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
} from '@/config/session'
import { useEdgeScrollbar } from '@/hooks/useEdgeScrollbar'
import { suggestPlanting, validateOpenPlanting, validatePlanting } from '@/logic/planting'
import { newSessionDefaults } from '@/logic/session'
import { useStore } from '@/state/store'
import type { NewSessionInput, SessionMode, TreeSpecies } from '@/state/types'
import { CloseIcon, MinusIcon, PineIcon, PlusIcon } from './icons'
import { InfoTip } from './InfoTip'
import { LeftoverWarning } from './LeftoverWarning'
import { SessionTimes } from './SessionTimes'
import { TreePreview } from './TreePreview'

interface SessionCreateDialogProps {
  open: boolean
  forestName: string
  onClose: () => void
  onStart: (input: NewSessionInput) => void
}

const SPECIES_ORDER: readonly TreeSpecies[] = ['pino', 'abedul', 'roble', 'ceibo']

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function SessionCreateDialog({
  open,
  forestName,
  onClose,
  onStart,
}: SessionCreateDialogProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const taskRefs = useRef<Array<HTMLInputElement | null>>([])
  const bodyScrollbar = useEdgeScrollbar<HTMLFormElement>()
  const treesRef = useRef<HTMLElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const settings = useStore((state) => state.settings)
  const plans = useStore((state) => state.plans)
  // El diálogo se monta solo cuando abre (render condicional en App), así que
  // el estado inicial nace de los datos y no hace falta resetear: repite el
  // ritmo de la última sesión o, sin historial, los ajustes sin ciclos.
  const defaults = useMemo(() => newSessionDefaults(plans, settings), [plans, settings])
  const initialFocus = clamp(defaults.focusMin, SESSION_MIN_FOCUS_MIN, SESSION_MAX_FOCUS_MIN)
  const initialBreak = clamp(defaults.breakMin, SESSION_MIN_BREAK_MIN, SESSION_MAX_BREAK_MIN)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [mode, setMode] = useState<SessionMode>(defaults.mode)
  const [focusMin, setFocusMin] = useState(initialFocus)
  const [breakMin, setBreakMin] = useState(initialBreak)
  // Sin ciclos la sesión es un solo bloque, aunque el plan guardado diga otra cosa.
  const [targetPomodoros, setTargetPomodoros] = useState(
    defaults.mode === 'breaks' ? defaults.targetPomodoros : 1,
  )
  const [longBreaks, setLongBreaks] = useState(defaults.longBreaks)
  const [strictPause, setStrictPause] = useState(defaults.strictPause)
  const [longBreakEvery, setLongBreakEvery] = useState(() =>
    clamp(defaults.longBreakEvery, 1, SESSION_MAX_POMODOROS),
  )
  const [longBreakMin, setLongBreakMin] = useState(() =>
    clamp(defaults.longBreakMin, SESSION_MIN_LONG_BREAK_MIN, SESSION_MAX_LONG_BREAK_MIN),
  )
  const [openEnded, setOpenEnded] = useState(false)
  // Los árboles no se heredan: cada sesión se planta a mano.
  const [queue, setQueue] = useState<TreeSpecies[]>([])
  // Cambia con cada intento de empezar sin árboles: reinicia la burbuja de aviso.
  const [warningId, setWarningId] = useState(0)
  // El aviso de tiempo sobrante vive en una card encima del diálogo.
  const [leftoverOpen, setLeftoverOpen] = useState(false)

  useEffect(() => {
    if (warningId === 0) {
      return
    }
    const timer = window.setTimeout(() => setWarningId(0), 4000)
    return () => window.clearTimeout(timer)
  }, [warningId])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const closeLeftover = useCallback(() => {
    setLeftoverOpen(false)
    // El foco vuelve al botón que abrió el aviso.
    window.requestAnimationFrame(() => startRef.current?.focus())
  }, [])

  const adjustPlanting = useCallback(() => {
    closeLeftover()
    treesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [closeLeftover])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      // Con el aviso de tiempo sobrante arriba, Escape cierra solo el aviso.
      if (leftoverOpen) {
        closeLeftover()
        return
      }
      handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeLeftover, handleClose, leftoverOpen])

  const budget = openEnded ? focusMin : focusMin * targetPomodoros
  const rhythm = useMemo(
    () => ({
      focusMin,
      breakMin: mode === 'breaks' ? breakMin : 0,
      cycles: targetPomodoros,
      longBreakMin: mode === 'breaks' && longBreaks ? longBreakMin : 0,
      longBreakEvery: mode === 'breaks' && longBreaks ? longBreakEvery : 0,
    }),
    [breakMin, focusMin, longBreakEvery, longBreakMin, longBreaks, mode, targetPomodoros],
  )

  const totalCost = useMemo(
    () => queue.reduce((sum, species) => sum + speciesConfig(species).minutes, 0),
    [queue],
  )
  const allowedSpecies = useMemo(
    () => (openEnded ? speciesFittingFocus(focusMin) : SPECIES_ORDER),
    [openEnded, focusMin],
  )
  const openValidation = useMemo(() => validateOpenPlanting(focusMin, queue), [focusMin, queue])
  const validation = useMemo(
    () =>
      openEnded
        ? openValidation
        : validatePlanting({
            focusMin,
            targetPomodoros,
            planting: queue,
          }),
    [openEnded, openValidation, focusMin, queue, targetPomodoros],
  )

  const sobra = openEnded ? 0 : Math.max(0, budget - totalCost)
  const falta = Math.max(0, totalCost - budget)
  const barPct = budget > 0 ? Math.min(1, totalCost / budget) : 0
  const noTrees = openEnded ? queue.length !== 1 : queue.length === 0
  const overBudget = openEnded ? false : totalCost > budget
  const canStart = openEnded ? queue.length === 1 && openValidation.ok : !noTrees && !overBudget
  // El botón queda inerte solo cuando los árboles no entran en el presupuesto;
  // sin árboles tiene que responder para explicar qué falta.
  const startDisabled = openEnded ? !openValidation.ok : overBudget
  const showTreeWarning = warningId > 0 && (openEnded ? queue.length !== 1 : noTrees)
  let allocLabel = 'Justo'
  if (noTrees) {
    allocLabel = 'Sin árboles'
  } else if (falta > 0) {
    allocLabel = `Faltan ${falta} min`
  } else if (sobra > 0) {
    allocLabel = `Sobran ${sobra} min`
  }
  // El sobrante no se repite como mensaje fijo: vive en el tooltip de la barra
  // y en la card que se muestra al empezar.
  const messages = openValidation.warnings.filter((warning) => !warning.startsWith('Sobran '))

  if (!open) {
    return null
  }

  const updateTask = (index: number, value: string) => {
    setTasks((current) => current.map((task, itemIndex) => (itemIndex === index ? value : task)))
  }

  const addTask = () => {
    setTasks((current) => (current.length >= SESSION_MAX_TASKS ? current : [...current, '']))
  }

  const removeTask = (index: number) => {
    setTasks((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const addSpecies = (species: TreeSpecies) => {
    if (openEnded) {
      setQueue((current) => (current[0] === species ? current : [species]))
      return
    }

    const cost = speciesConfig(species).minutes
    if (queue.length >= SESSION_MAX_TREES || totalCost + cost > budget) {
      return
    }
    setQueue((current) => [...current, species])
  }

  const removeSpecies = (species: TreeSpecies) => {
    if (openEnded) {
      return
    }

    setQueue((current) => {
      const index = current.lastIndexOf(species)
      if (index === -1) {
        return current
      }
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleCyclesToggle = (enabled: boolean) => {
    setOpenEnded(false)
    setMode(enabled ? 'breaks' : 'continuous')
    setTargetPomodoros(enabled ? 3 : 1)
  }

  const handleOpenEndedChange = (enabled: boolean) => {
    setOpenEnded(enabled)
    if (enabled) {
      const firstAllowed = speciesFittingFocus(focusMin)[0]
      setQueue(firstAllowed ? [firstAllowed] : [])
      setMode('breaks')
      setTargetPomodoros(1)
    }
  }

  const handleFocusChange = (value: number) => {
    setFocusMin(value)
    if (openEnded) {
      const allowed = speciesFittingFocus(value)
      setQueue(allowed.length > 0 ? [allowed[0]] : [])
    }
  }

  const handlePreset = (preset: { focus: number; brk: number }) => {
    setOpenEnded(false)
    setFocusMin(preset.focus)
    setBreakMin(preset.brk)
  }

  const startSession = () => {
    onStart({
      title: title.trim() || undefined,
      description: description.trim() || null,
      tasks: tasks.map((task) => task.trim()).filter(Boolean),
      focusMin,
      breakMin,
      longBreakMin,
      longBreakEvery: mode === 'breaks' && longBreaks ? longBreakEvery : 0,
      strictPause,
      targetPomodoros,
      mode,
      planting: openEnded ? (queue.length > 0 ? [queue[0]] : []) : queue,
      openEnded,
    })
    handleClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (noTrees) {
      setWarningId((value) => value + 1)
      treesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    if (!canStart) {
      return
    }
    // Con mucho enfoque sin plantar, primero se avisa qué pasa al abandonar.
    if (!openEnded && sobra >= SESSION_LEFTOVER_WARN_MIN) {
      setLeftoverOpen(true)
      return
    }

    startSession()
  }

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="card card--roomy forest-dialog session-dialog my-auto w-full max-w-[30rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
        inert={leftoverOpen}
      >
        <div className="forest-dialog__head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="session-icon forest-dialog__icon">
              <PineIcon />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{forestName}</p>
              <h2 id="session-dialog-title" className="type-title-lg">
                Nueva sesión
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button forest-dialog__close"
            onClick={handleClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          id="session-form"
          className={`session-dialog__body edge-scrollbar${bodyScrollbar.nearEdge ? ' is-scrollbar-visible' : ''}`}
          onSubmit={handleSubmit}
          onPointerMove={bodyScrollbar.onPointerMove}
          onPointerLeave={bodyScrollbar.onPointerLeave}
        >
          <section className="session-section" aria-label="Datos de la sesión">
            <div className="forest-field">
              <label className="settings-label" htmlFor="session-title">
                <span className="type-body">Nombre de la sesión</span>
              </label>
              <input
                ref={titleRef}
                id="session-title"
                className="field-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={SESSION_TITLE_MAX_LENGTH}
                placeholder="Terminar el TP, estudiar para el final…"
                autoComplete="off"
              />
            </div>

            <div className="forest-field">
              <div className="forest-field__label-row">
                <label className="settings-label" htmlFor="session-description">
                  <span className="type-body">Descripción</span>
                </label>
                <span className="type-micro type-muted">
                  {description.length}/{SESSION_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="session-description"
                className="field-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={SESSION_DESCRIPTION_MAX_LENGTH}
                placeholder="Qué querés tener claro al terminar."
              />
            </div>

            <div className="forest-field">
              <span className="settings-label">
                <span className="type-body">Objetivos</span>
              </span>

              {tasks.length > 0 && (
                <ul className="session-objectives">
                  {tasks.map((task, index) => (
                    <li key={`objective-${index}`} className="session-objective">
                      <span className="session-objective__mark" aria-hidden="true" />
                      <input
                        ref={(element) => {
                          taskRefs.current[index] = element
                        }}
                        className="field-input session-objective__input"
                        value={task}
                        onChange={(event) => updateTask(index, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') {
                            return
                          }
                          // Mientras se escribe un objetivo, Enter agrega otro
                          // en vez de empezar la sesión; sin texto escrito el
                          // comportamiento sigue siendo el de siempre.
                          if (tasks[index].trim().length === 0) {
                            return
                          }
                          event.preventDefault()
                          if (tasks.length >= SESSION_MAX_TASKS) {
                            return
                          }
                          const nextIndex = tasks.length
                          setTasks((current) => [...current, ''])
                          window.requestAnimationFrame(() => taskRefs.current[nextIndex]?.focus())
                        }}
                        maxLength={SESSION_TASK_MAX_LENGTH}
                        placeholder="Un paso concreto"
                        aria-label={`Objetivo ${index + 1}`}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="icon-button session-objective__remove"
                        onClick={() => removeTask(index)}
                        aria-label={`Quitar objetivo ${index + 1}`}
                      >
                        <CloseIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {tasks.length < SESSION_MAX_TASKS && (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm session-add-task"
                  onClick={addTask}
                >
                  <PlusIcon />
                  Agregar objetivo
                </button>
              )}
            </div>
          </section>

          <SessionTimes
            focusMin={focusMin}
            breakMin={breakMin}
            rhythm={rhythm}
            cyclesActive={mode === 'breaks'}
            cycles={targetPomodoros}
            longBreaks={longBreaks}
            longBreakEvery={longBreakEvery}
            longBreakMin={longBreakMin}
            strictPause={strictPause}
            openEnded={openEnded}
            onOpenEndedChange={handleOpenEndedChange}
            onPreset={handlePreset}
            onFocusChange={handleFocusChange}
            onBreakChange={setBreakMin}
            onCyclesToggle={handleCyclesToggle}
            onCyclesChange={setTargetPomodoros}
            onLongBreaksToggle={setLongBreaks}
            onLongBreakEveryChange={setLongBreakEvery}
            onLongBreakMinChange={setLongBreakMin}
            onStrictPauseToggle={setStrictPause}
          />

          <section ref={treesRef} className="session-section" aria-label="Árboles">
            <div className="session-section__head">
              <h3 className="type-title">Árboles</h3>
              {!openEnded && (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  onClick={() => setQueue(suggestPlanting(budget))}
                  disabled={budget <= 0}
                >
                  Sugerir
                </button>
              )}
            </div>

            {openEnded ? (
              <div className="tree-grid">
                {allowedSpecies.map((species) => {
                  const config = speciesConfig(species)
                  const cost = config.minutes
                  const selected = queue[0] === species
                  const blocked = cost > focusMin
                  return (
                    <div
                      key={species}
                      className={`tree-card${selected ? ' tree-card--active' : ''}`}
                    >
                      <button
                        type="button"
                        className="tree-card__main"
                        onClick={() => addSpecies(species)}
                        disabled={blocked}
                      >
                        <span className="tree-card__tree">
                          <TreePreview species={species} stage={finalStage(species)} />
                        </span>
                        <span className="tree-card__name">{config.name}</span>
                        <span className="tree-card__cost">{cost} min</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="tree-grid">
                {SPECIES_ORDER.map((species) => {
                  const config = speciesConfig(species)
                  const count = queue.filter((item) => item === species).length
                  const cost = config.minutes
                  const blocked = totalCost + cost > budget || queue.length >= SESSION_MAX_TREES
                  return (
                    <div
                      key={species}
                      className={`tree-card${count > 0 ? ' tree-card--active' : ''}`}
                    >
                      <button
                        type="button"
                        className="tree-card__main"
                        onClick={() => addSpecies(species)}
                        disabled={blocked}
                      >
                        <span className="tree-card__tree">
                          <TreePreview species={species} stage={finalStage(species)} />
                        </span>
                        <span className="tree-card__name">{config.name}</span>
                        <span className="tree-card__cost">{cost} min</span>
                      </button>
                      <div className="tree-card__counter">
                        <button
                          type="button"
                          className="stepper__btn"
                          onClick={() => removeSpecies(species)}
                          disabled={count === 0}
                          aria-label={`Quitar ${config.name}`}
                        >
                          <MinusIcon />
                        </button>
                        <span className="tree-card__count">{count}</span>
                        <button
                          type="button"
                          className="stepper__btn"
                          onClick={() => addSpecies(species)}
                          disabled={blocked}
                          aria-label={`Agregar ${config.name}`}
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!openEnded && (
              <div className="alloc">
                <div className="alloc__bar" aria-hidden="true">
                  <div
                    className={`alloc__fill${falta > 0 ? ' alloc__fill--over' : ''}`}
                    style={{ width: `${barPct * 100}%` }}
                  />
                </div>
                <div className="alloc__meta">
                  <span>
                    <strong>{totalCost}</strong> / {budget} min
                  </span>
                  <span className="alloc__state">
                    {allocLabel}
                    {sobra > 0 && !noTrees && (
                      <InfoTip
                        label="Más información sobre los minutos que sobran"
                        text={`Quedan ${sobra} min de enfoque sin plantar. Podés empezar igual; si abandonás antes de tiempo, el último árbol se marchita.`}
                      />
                    )}
                  </span>
                </div>
              </div>
            )}

            {openEnded && queue[0] && (
              <p className="session-message">
                {speciesConfig(queue[0]).minutes < focusMin
                  ? `Sobran ${focusMin - speciesConfig(queue[0]).minutes} min en este ciclo: ${speciesConfig(queue[0]).name} completa antes de que termine el bloque.`
                  : 'Elegí el siguiente árbol cuando quieras continuar.'}
              </p>
            )}

            <div className="session-messages">
              {!noTrees &&
                validation.errors.map((error) => (
                  <p key={error} className="session-message session-message--error">
                    {error}
                  </p>
                ))}
              {messages.map((warning) => (
                <p key={warning} className="session-message session-message--warning">
                  {warning}
                </p>
              ))}
            </div>
          </section>
        </form>

        <div className="forest-dialog__actions">
          {showTreeWarning && (
            <span className="start-hint" role="status">
              Elegí al menos un árbol para plantar.
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancelar
          </button>
          <button
            ref={startRef}
            type="submit"
            form="session-form"
            className="btn btn-primary"
            disabled={startDisabled}
            aria-disabled={!canStart}
          >
            Plantar y empezar
          </button>
        </div>
      </div>

      {leftoverOpen && (
        <LeftoverWarning
          leftoverMin={sobra}
          totalCost={totalCost}
          budget={budget}
          onAdjust={adjustPlanting}
          onStart={startSession}
        />
      )}
    </div>
  )
}
