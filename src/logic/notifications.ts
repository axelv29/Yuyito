export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Las notificaciones creadas con el constructor pueden cerrarse si el objeto
 * se recolecta. Se retienen hasta que el navegador avise que se cerraron.
 */
const openNotifications = new Set<Notification>()

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported'
  }
  return Notification.permission as NotificationPermissionState
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported'
  }
  if (Notification.permission !== 'default') {
    return getNotificationPermission()
  }
  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermissionState
  } catch {
    return getNotificationPermission()
  }
}

/**
 * Muestra una notificación del navegador. Devuelve false si el navegador no
 * la soporta o si el permiso todavía no está concedido; en ese caso la alarma
 * suena igual y la app avisa que el permiso falta.
 */
export function sendNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false
  }
  if (Notification.permission !== 'granted') {
    return false
  }
  try {
    // Sin `tag`: Windows trata una notificación que reemplaza a otra con el
    // mismo tag como una actualización. La deja en el centro de notificaciones
    // pero no muestra el banner. Cada aviso se crea nuevo y se cierran los
    // anteriores para no acumular toasts viejos.
    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
    })
    for (const previous of openNotifications) {
      try {
        previous.close()
      } catch {
        // El navegador pudo haberla cerrado antes.
      }
    }
    openNotifications.clear()
    openNotifications.add(notification)
    const forget = () => openNotifications.delete(notification)
    notification.onclose = forget
    notification.onerror = forget
    notification.onclick = () => {
      window.focus()
      notification.close()
      forget()
    }
    return true
  } catch {
    return false
  }
}
