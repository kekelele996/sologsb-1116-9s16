import { HABITAT_WINDOW_MS, type HabitatObservation, type HabitatSnapshot } from '@/types'

/** Date → 本地时间字符串（YYYY-MM-DDTHH:mm），供 datetime-picker 使用 */
export function toLocalInput(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** YYYY-MM-DDTHH:mm → 展示用（YYYY-MM-DD HH:mm） */
export function formatDateTime(value: string): string {
  if (!value) return '—'
  return value.replace('T', ' ')
}

/** 解析本地时间字符串；无效返回 null */
function parseLocal(value: string): Date | null {
  if (!value) return null
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? null : new Date(ts)
}

/**
 * 同一采集点、观测时间落在「参考时刻前 6 小时」窗口内的观测，
 * 按观测时间倒序（最新在前）。未来时间（设备时钟误差）不计入。
 */
export function observationsWithinWindow(
  observations: HabitatObservation[],
  pointId: string,
  reference: Date = new Date()
): HabitatObservation[] {
  const refMs = reference.getTime()
  return observations
    .filter((item) => {
      const time = parseLocal(item.observedAt)
      if (!time || item.pointId !== pointId) return false
      return time.getTime() <= refMs && refMs - time.getTime() <= HABITAT_WINDOW_MS
    })
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
}

/** 某采集点最近一次观测（无则 null） */
export function latestObservationOf(
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

/** 观测与参考时刻相差的分钟数（观测在前为正）；无法解析返回 null */
export function minutesAgo(observedAt: string, reference: Date = new Date()): number | null {
  const time = parseLocal(observedAt)
  if (!time) return null
  return Math.round((reference.getTime() - time.getTime()) / 60000)
}

/** 保存条目时把观测台账记录复制成留痕快照 */
export function toSnapshot(
  observation: HabitatObservation,
  revoked = false
): HabitatSnapshot {
  return {
    observationId: observation.id,
    observedAt: observation.observedAt,
    weather: observation.weather,
    temperature: observation.temperature,
    humidity: observation.humidity,
    revoked
  }
}
