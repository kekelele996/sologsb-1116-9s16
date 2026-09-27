/** 天气情况 */
export const WEATHER_TYPES = ['晴', '多云', '阴', '小雨', '中雨', '阵雨', '雾', '雨后初晴'] as const
export type Weather = (typeof WEATHER_TYPES)[number]

/** 采集时固化到条目上的生境数值（事后不随观测改动） */
export interface HabitatSnapshot {
  /** 取值来源的观测 ID（观测被删后仍保留原值） */
  observationId: string
  /** 观测时间，ISO 字符串 */
  observedAt: string
  weather: Weather
  /** 温度（℃） */
  temperature: number
  /** 相对湿度（%） */
  humidity: number
}

/** HabitatObservation 生境观测台账 */
export interface HabitatObservation {
  id: string
  pointId: string
  /** 观测时间，ISO 字符串 */
  observedAt: string
  weather: Weather
  /** 温度（℃） */
  temperature: number
  /** 相对湿度（%） */
  humidity: number
}
