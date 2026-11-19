/**
 * Clave de día local (YYYY-MM-DD).
 *
 * No usar `toISOString()`: convierte a UTC y corre el día en zonas como
 * Argentina, sobre todo cerca de la medianoche.
 */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isSameLocalDay(a: number, b: number): boolean {
  return localDayKey(a) === localDayKey(b)
}

const DAY_MS = 86_400_000

/**
 * Ordinal de día local: 1970-01-01 = 0.
 *
 * Sirve para hacer aritmética de días (rachas, semanas, meses) sin caer en
 * los saltos de una hora del horario de verano.
 */
export function localDayNumber(timestamp: number): number {
  const date = new Date(timestamp)
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(day: number): number {
  return (((day + 3) % 7) + 7) % 7
}

/** Lunes de la semana del día dado. */
export function startOfWeek(day: number): number {
  return day - weekdayIndex(day)
}

/** Ordinal del día calendario indicado. */
export function dayNumberOf(year: number, monthIndex: number, dayOfMonth: number): number {
  return Math.floor(Date.UTC(year, monthIndex, dayOfMonth) / DAY_MS)
}

/** Cantidad de días del mes (monthIndex empieza en 0). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Corre un timestamp la cantidad de días calendario indicada, conservando la
 * hora local (a diferencia de sumar milisegundos, que se corre una hora en
 * los cambios de horario de verano). Lo usa el simulador de días del panel dev.
 */
export function addDays(timestamp: number, days: number): number {
  if (days === 0) {
    return timestamp
  }

  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)

  return date.getTime()
}
