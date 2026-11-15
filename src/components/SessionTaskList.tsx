import { TASK_STATUS_LABEL } from '@/logic/session'
import { useStore } from '@/state/store'
import type { SessionTask, TaskStatus } from '@/state/types'
import { SquareCheckIcon, SquareIcon, SquareXIcon } from './icons'

interface SessionTaskListProps {
  /** Plan de la sesión o registro suelto donde vive el estado. */
  entryKey: string
  tasks: readonly SessionTask[]
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') {
    return <SquareCheckIcon className="session-task__icon" />
  }

  if (status === 'missed') {
    return <SquareXIcon className="session-task__icon" />
  }

  return <SquareIcon className="session-task__icon" />
}

/**
 * Objetivos con estado propio. Cada toque cicla entre neutral, completado y
 * no completado; el estado se guarda en el plan (o en el registro viejo).
 */
export function SessionTaskList({ entryKey, tasks }: SessionTaskListProps) {
  const cycleTaskStatus = useStore((state) => state.cycleTaskStatus)

  if (tasks.length === 0) {
    return null
  }

  return (
    <ul className="session-tasks" aria-label="Objetivos de la sesión">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            role="checkbox"
            aria-checked={
              task.status === 'done' ? true : task.status === 'missed' ? false : 'mixed'
            }
            className={`session-task session-task--${task.status}`}
            title={`${TASK_STATUS_LABEL[task.status]} · tocá para cambiar`}
            onClick={() => cycleTaskStatus(entryKey, task.id)}
          >
            <TaskStatusIcon status={task.status} />
            <span className="session-task__text">{task.text}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
