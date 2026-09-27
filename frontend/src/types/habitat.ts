/** 天气状况 */
export const WEATHER_TYPES = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雾', '雪'] as const
export type WeatherType = (typeof WEATHER_TYPES)[number]

/** 观测可被新条目引用的时间窗（毫秒，6 小时） */
export const HABITAT_WINDOW_MS = 6 * 60 * 60 * 1000

/** HabitatObservation 生境观测台账：按采集点记录当时的天气与温湿度 */
export interface HabitatObservation {
  id: string
  pointId: string
  /** 观测时间（本地时间 YYYY-MM-DDTHH:mm） */
  observedAt: string
  weather: WeatherType
  /** 温度（℃） */
  temperature: number
  /** 相对湿度（%） */
  humidity: number
  note: string
}

/**
 * HabitatSnapshot 生境快照：条目保存时从观测台账复制的数值。
 * 属于留痕数据，事后观测被修改或撤销，条目仍按此快照显示。
 */
export interface HabitatSnapshot {
  observationId: string
  /** 观测时间快照 */
  observedAt: string
  weather: WeatherType
  /** 温度快照（℃） */
  temperature: number
  /** 相对湿度快照（%） */
  humidity: number
  /** 对应观测是否已撤销（快照数值仍保留） */
  revoked: boolean
}
