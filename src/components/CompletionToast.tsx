import { useEffect } from 'react'
import { useStore, type NoticeKind } from '@/state/store'

const TONE: Record<NoticeKind, string> = {
  success: 'toast--success',
  warning: 'toast--warning',
  danger: 'toast--danger',
  info: 'toast--info',
}

export function CompletionToast() {
  const notice = useStore((state) => state.notice)
  const dismiss = useStore((state) => state.dismissNotice)

  useEffect(() => {
    if (!notice) {
      return
    }

    let timeout: number | undefined
    const start = () => {
      timeout = window.setTimeout(dismiss, 4500)
    }

    // Con la pestaña en segundo plano el aviso se descartaría sin que nadie lo
    // vea. Se espera a que vuelva a estar visible para empezar a contarlo.
    if (document.visibilityState === 'visible') {
      start()
      return () => window.clearTimeout(timeout)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
      start()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(timeout)
    }
  }, [notice, dismiss])

  if (!notice) {
    return null
  }

  return (
    <div
      className="fixed left-1/2 top-3 z-50 w-[min(92vw,30rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className={`card card--compact toast type-body font-medium ${TONE[notice.kind]}`}>
        {notice.text}
      </div>
    </div>
  )
}
