import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayNumberOf,
  daysInMonth,
  isSameLocalDay,
  localDayKey,
  localDayNumber,
  startOfWeek,
  weekdayIndex,
} from '@/logic/day'

describe('localDayKey', () => {
  it('usa el día local y no UTC', () => {
    const late = new Date(2026, 10, 3, 23, 59, 59).getTime()
    const early = new Date(2026, 10, 4, 0, 0, 1).getTime()

    expect(localDayKey(late)).toBe('2026-11-03')
    expect(localDayKey(early)).toBe('2026-11-04')
  })

  it('compara días locales', () => {
    const morning = new Date(2026, 10, 3, 8, 0, 0).getTime()
    const night = new Date(2026, 10, 3, 23, 0, 0).getTime()

    expect(isSameLocalDay(morning, night)).toBe(true)
    expect(isSameLocalDay(morning, night + 2 * 60 * 60 * 1000)).toBe(false)
  })
})

describe('ordinales de día', () => {
  it('cuenta días locales desde 1970-01-01', () => {
    const late = new Date(2026, 10, 3, 23, 59, 59).getTime()
    const early = new Date(2026, 10, 4, 0, 0, 1).getTime()

    expect(dayNumberOf(1970, 0, 1)).toBe(0)
    expect(localDayNumber(early) - localDayNumber(late)).toBe(1)
  })

  it('ubica la semana desde el lunes', () => {
    const tuesday = dayNumberOf(2026, 10, 3)

    expect(weekdayIndex(tuesday)).toBe(1)
    expect(startOfWeek(tuesday)).toBe(dayNumberOf(2026, 10, 2))
    expect(weekdayIndex(dayNumberOf(2026, 10, 2))).toBe(0)
    expect(weekdayIndex(dayNumberOf(2026, 10, 8))).toBe(6)
  })

  it('conoce los días de cada mes', () => {
    expect(daysInMonth(2026, 10)).toBe(30)
    expect(daysInMonth(2026, 1)).toBe(28)
    expect(daysInMonth(2024, 1)).toBe(29)
  })

  it('corre días de calendario conservando la hora local', () => {
    const base = new Date(2026, 11, 31, 22, 30, 0).getTime()

    expect(addDays(base, 0)).toBe(base)
    expect(localDayKey(addDays(base, 1))).toBe('2027-01-01')
    expect(new Date(addDays(base, 1)).getHours()).toBe(22)
    expect(localDayKey(addDays(base, -31))).toBe('2026-11-30')
  })
})
