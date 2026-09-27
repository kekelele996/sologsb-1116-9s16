import { onUnmounted, reactive } from 'vue'
import type { StoreApi } from 'zustand/vanilla'
import Dexie, { type Table } from 'dexie'
import type { CollectPoint, FungusRecord, HabitatObservation, IdentifyLog, SporePrint } from '@/types'
import { toLocalInput, toSnapshot } from '@/utils/habitat'

/** IndexedDB 数据结构版本号 */
export const SCHEMA_VERSION = 3

export interface MetaRow {
  key: string
  value: number
}

/** Dexie 封装：条目 / 孢子印 / 采集点 / 鉴定结论 / 生境观测 五张表 + 元数据表 */
class FungiGuideDb extends Dexie {
  records!: Table<FungusRecord, string>
  spores!: Table<SporePrint, string>
  points!: Table<CollectPoint, string>
  identifies!: Table<IdentifyLog, string>
  habitats!: Table<HabitatObservation, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('gbfungiguide')
    this.version(1).stores({
      records: 'id, code, pointId, attachment',
      spores: 'id, recordId, color',
      points: 'id, name, substrate',
      identifies: 'id, recordId, conclusion',
      meta: 'key'
    })
    // v2：新增「菌肉变色反应」字段，迁移时为历史条目补齐默认值（不变色）
    this.version(SCHEMA_VERSION)
      .stores({
        records: 'id, code, pointId, attachment, capShape',
        spores: 'id, recordId, color, observeDate',
        points: 'id, name, substrate, vegetation',
        identifies: 'id, recordId, conclusion, date',
        meta: 'key'
      })
      .upgrade(async (tx) => {
        await tx
          .table<FungusRecord, string>('records')
          .toCollection()
          .modify((record) => {
            if (!record.fleshReaction) {
              record.fleshReaction = '不变色'
            }
          })
      })
    // v3：新增「生境观测台账」表；条目新增 habitat 快照字段，历史条目补 null
    this.version(SCHEMA_VERSION)
      .stores({
        records: 'id, code, pointId, attachment, capShape',
        spores: 'id, recordId, color, observeDate',
        points: 'id, name, substrate, vegetation',
        identifies: 'id, recordId, conclusion, date',
        habitats: 'id, pointId, observedAt',
        meta: 'key'
      })
      .upgrade(async (tx) => {
        await tx
          .table<FungusRecord, string>('records')
          .toCollection()
          .modify((record) => {
            if (record.habitat === undefined) {
              record.habitat = null
            }
          })
      })
  }
}

export const db = new FungiGuideDb()

/** 写入当前数据结构版本号 */
export async function stampDbVersion(): Promise<void> {
  await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION })
}

/** 读取整表 */
export async function syncAll<T extends object>(table: Table<T, string>): Promise<T[]> {
  return table.toArray()
}

/** 写入一条记录 */
export async function syncPut<T extends object>(table: Table<T, string>, row: T): Promise<void> {
  await table.put(row)
}

/** 删除一条记录 */
export async function syncDelete<T extends object>(table: Table<T, string>, id: string): Promise<void> {
  await table.delete(id)
}

/** 把 Zustand vanilla store 桥接到 Vue 响应式状态 */
export function useStore<T extends object>(store: StoreApi<T>): T {
  const state = reactive({ ...store.getState() }) as T
  const unsubscribe = store.subscribe((next: T) => {
    Object.assign(state, next)
  })
  onUnmounted(() => unsubscribe())
  return state
}

/** 首次打开写入示例数据，保证各页面进入即有事可做 */
export async function seedDemoData(): Promise<void> {
  const count = await db.points.count()
  if (count > 0) return

  const today = new Date().toISOString().slice(0, 10)

  /** 生境观测演示台账：百花山有早、午两次且均在 6 小时窗口内；云龙山一条在窗口内。obsYlsOld 已撤销，仅作为 rec_003 的留痕快照 */
  const now = new Date()
  const tMorning = new Date(now.getTime() - 3.5 * 60 * 60 * 1000)
  const tNoon = new Date(now.getTime() - 50 * 60 * 1000)
  const tYls = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const tYlsOld = new Date(now.getTime() - 20 * 60 * 60 * 1000)

  const obsBhsMorning: HabitatObservation = {
    id: 'obs_bhs_morning',
    pointId: 'pt_bhs',
    observedAt: toLocalInput(tMorning),
    weather: '多云',
    temperature: 14.5,
    humidity: 78,
    note: '晨雾未散，落叶层偏湿'
  }
  const obsBhsNoon: HabitatObservation = {
    id: 'obs_bhs_noon',
    pointId: 'pt_bhs',
    observedAt: toLocalInput(tNoon),
    weather: '晴',
    temperature: 21.2,
    humidity: 52,
    note: '午间转晴，林窗下升温明显'
  }
  const obsYls: HabitatObservation = {
    id: 'obs_yls',
    pointId: 'pt_yls',
    observedAt: toLocalInput(tYls),
    weather: '阴',
    temperature: 18.6,
    humidity: 86,
    note: '沟内闷热，腐木表面有水膜'
  }
  const obsYlsOld: HabitatObservation = {
    id: 'obs_yls_old',
    pointId: 'pt_yls',
    observedAt: toLocalInput(tYlsOld),
    weather: '小雨',
    temperature: 12.1,
    humidity: 95,
    note: '昨日降雨后记录'
  }

  await db.habitats.bulkPut([obsBhsMorning, obsBhsNoon, obsYls])

  await db.points.bulkPut([
    {
      id: 'pt_bhs',
      name: '百花山栎树林样线',
      longitude: 115.6218,
      latitude: 39.8152,
      altitude: 1420,
      vegetation: '针阔混交林',
      substrate: '落叶层',
      companionTrees: '辽东栎、油松',
      collectDate: today,
      collector: '沈禾'
    },
    {
      id: 'pt_yls',
      name: '云龙山腐木沟',
      longitude: 117.2841,
      latitude: 34.2615,
      altitude: 260,
      vegetation: '常绿阔叶林',
      substrate: '腐木',
      companionTrees: '麻栎、枫香',
      collectDate: today,
      collector: '沈禾'
    }
  ])

  await db.records.bulkPut([
    {
      id: 'rec_001',
      code: 'BHS-2026-001',
      tempName: '橙黄牛肝菌（暂定）',
      fruitBodyCount: 3,
      pointId: 'pt_bhs',
      capDiameter: 9.5,
      capShape: '半球形',
      capMargin: '全缘',
      capTexture: '绒状',
      fleshThickness: 2.1,
      fleshReaction: '缓慢变蓝',
      attachment: '直生',
      gillDensity: '中等',
      stipeLength: 7.4,
      stipeDiameter: 2.2,
      ring: '膜质菌环',
      volva: '无菌托',
      odor: '淡淡坚果味',
      hostTree: '辽东栎',
      collectDate: today,
      collector: '沈禾',
      habitat: toSnapshot(obsBhsMorning),
      note: '菌管层易剥离，仅作形态记录'
    },
    {
      id: 'rec_002',
      code: 'BHS-2026-002',
      tempName: '灰紫小伞（暂定）',
      fruitBodyCount: 6,
      pointId: 'pt_bhs',
      capDiameter: 4.2,
      capShape: '平展',
      capMargin: '波状',
      capTexture: '光滑',
      fleshThickness: 0.6,
      fleshReaction: '不变色',
      attachment: '离生',
      gillDensity: '密集',
      stipeLength: 6.8,
      stipeDiameter: 0.8,
      ring: '无菌环',
      volva: '无菌托',
      odor: '无明显气味',
      hostTree: '油松',
      collectDate: today,
      collector: '沈禾',
      habitat: toSnapshot(obsBhsNoon),
      note: '菌褶边缘略带紫晕'
    },
    {
      id: 'rec_003',
      code: 'YLS-2026-001',
      tempName: '褐褶韧革菌（暂定）',
      fruitBodyCount: 2,
      pointId: 'pt_yls',
      capDiameter: 12.6,
      capShape: '漏斗形',
      capMargin: '内卷',
      capTexture: '鳞片状',
      fleshThickness: 1.4,
      fleshReaction: '变褐',
      attachment: '延生',
      gillDensity: '稀疏',
      stipeLength: 3.2,
      stipeDiameter: 3.6,
      ring: '无菌环',
      volva: '无菌托',
      odor: '土腥味',
      hostTree: '麻栎',
      collectDate: today,
      collector: '祁野',
      habitat: toSnapshot(obsYlsOld, true),
      note: '生于倒木侧面，质地木栓化'
    }
  ])

  await db.spores.bulkPut([
    {
      id: 'spo_001',
      recordId: 'rec_001',
      color: '淡黄',
      shape: '圆形印痕，边缘略散',
      hours: 12,
      observeDate: today,
      moisture: '子实体偏干，印痕较薄'
    },
    {
      id: 'spo_002',
      recordId: 'rec_002',
      color: '白色',
      shape: '圆形印痕，中心致密',
      hours: 8,
      observeDate: today,
      moisture: '新鲜子实体，印痕厚实'
    },
    {
      id: 'spo_003',
      recordId: 'rec_003',
      color: '粉褐',
      shape: '不规则印痕',
      hours: 24,
      observeDate: today,
      moisture: '木质化样本，印痕浅'
    }
  ])

  await db.identifies.bulkPut([
    {
      id: 'idf_001',
      recordId: 'rec_001',
      conclusion: 'Boletus sp.',
      basis: '形态特征',
      referenceBook: '《中国大型真菌》',
      referencePage: 'P.312',
      confidence: '低',
      needReview: true,
      reviewer: '祁野',
      date: today
    },
    {
      id: 'idf_002',
      recordId: 'rec_002',
      conclusion: 'Lepista sordida',
      basis: '孢子印',
      referenceBook: '《菌物图鉴》',
      referencePage: 'P.145',
      confidence: '中',
      needReview: false,
      reviewer: '祁野',
      date: today
    }
  ])
}
