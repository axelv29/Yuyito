interface NotificationNoticeProps {
  message: string
  onDismiss: () => void
}

export function NotificationNotice({ message, onDismiss }: NotificationNoticeProps) {
  return (
    <div className="relative z-30 mx-auto w-full max-w-3xl px-4 pb-2">
      <div
        className="card card--compact toast toast--warning type-body flex items-start gap-3"
        role="status"
        aria-live="polite"
      >
        <p className="flex-1">{message}</p>
        <button type="button" className="btn btn-secondary btn--sm shrink-0" onClick={onDismiss}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
