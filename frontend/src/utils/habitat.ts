import type { HabitatObservation, HabitatSnapshot } from '@/types'

/** 6 小时窗口（毫秒） */
export const OBSERVATION_WINDOW_MS = 6 * 3600_000

/** ISO 时间 → 「YYYY-MM-DD HH:mm」，台账与条目共用同一口径 */
export function formatObservedAt(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Date → el-date-picker datetime 使用的本地时间字符串「YYYY-MM-DDTHH:mm」 */
export function toLocalInputValue(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * 同一采集点、以基准时间（默认现在）往前 6 小时内的观测，按时间倒序。
 * 恰好落在 6 小时边界上的观测计入窗口。
 */
export function recentObservations(
  observations: HabitatObservation[],
  pointId: string,
  baseTime: number = Date.now()
): HabitatObservation[] {
  const earliest = baseTime - OBSERVATION_WINDOW_MS
  return observations
    .filter((item) => {
      if (item.pointId !== pointId) return false
      const time = new Date(item.observedAt).getTime()
      return !Number.isNaN(time) && time >= earliest && time <= baseTime
    })
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
}

/** 采集点最近一次观测（按观测时间） */
export function latestObservation(
  observations: HabitatObservation[],
  pointId: string
): HabitatObservation | null {
  let latest: HabitatObservation | null = null
  for (const item of observations) {
    if (item.pointId !== pointId) continue
    if (!latest || item.observedAt > latest.observedAt) latest = item
  }
  return latest
}

/** 生境数值一行摘要：天气 · 温度 · 湿度 */
export function habitatBrief(values: { weather: string; temperature: number; humidity: number }): string {
  return `${values.weather} · ${values.temperature}℃ · ${values.humidity}%RH`
}

/** 条目上固化的生境快照摘要（不依赖观测是否仍存在） */
export function snapshotBrief(snapshot: HabitatSnapshot): string {
  return habitatBrief(snapshot)
}
