<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CollectPoint, HabitatObservation, Weather } from '@/types'
import { WEATHER_TYPES } from '@/types'
import GeoPointForm from '@/components/common/GeoPointForm.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { pointStore } from '@/stores/pointStore'
import { recordStore } from '@/stores/recordStore'
import { habitatStore } from '@/stores/habitatStore'
import { uid } from '@/utils/id'
import { formatObservedAt, habitatBrief, latestObservation, toLocalInputValue } from '@/utils/habitat'

const pointState = useStore(pointStore)
const recordState = useStore(recordStore)
const habitatState = useStore(habitatStore)

const editingId = ref<string | null>(null)
const draft = reactive<CollectPoint>({
  id: '',
  name: '',
  longitude: 116.4,
  latitude: 39.9,
  altitude: 800,
  vegetation: '针阔混交林',
  substrate: '落叶层',
  companionTrees: '',
  collectDate: new Date().toISOString().slice(0, 10),
  collector: ''
})

const coordError = computed<string | null>(() => {
  const { longitude, latitude } = draft
  if (longitude < -180 || longitude > 180) return '经度必须在 -180 ~ 180 之间'
  if (latitude < -90 || latitude > 90) return '纬度必须在 -90 ~ 90 之间'
  if (longitude === 0 && latitude === 0) return '经纬度不能同时为 0'
  return null
})

watch(
  () => pointState.loaded,
  () => {
    if (!editingId.value && !draft.name && pointState.points.length > 0) {
      draft.name = ''
    }
  }
)

function resetDraft(): void {
  editingId.value = null
  draft.id = ''
  draft.name = ''
  draft.longitude = 116.4
  draft.latitude = 39.9
  draft.altitude = 800
  draft.vegetation = '针阔混交林'
  draft.substrate = '落叶层'
  draft.companionTrees = ''
  draft.collector = ''
  draft.collectDate = new Date().toISOString().slice(0, 10)
}

function edit(point: CollectPoint): void {
  editingId.value = point.id
  Object.assign(draft, point)
}

async function submit(): Promise<void> {
  if (!draft.name.trim()) {
    ElMessage.warning('请填写采集点名称')
    return
  }
  if (coordError.value) {
    ElMessage.warning(coordError.value)
    return
  }
  const row: CollectPoint = {
    ...draft,
    id: editingId.value ?? uid('pt'),
    name: draft.name.trim(),
    companionTrees: draft.companionTrees.trim(),
    collector: draft.collector.trim()
  }
  await pointStore.getState().save(row)
  ElMessage.success(editingId.value ? '采集点已更新' : '采集点已建立')
  resetDraft()
}

function recordsOf(pointId: string): number {
  return recordState.records.filter((record) => record.pointId === pointId).length
}

/** 主要基物：该采集点下条目最常见的基物（采集点自身基物优先） */
function mainSubstrate(point: CollectPoint): string {
  const list = recordState.records.filter((record) => record.pointId === point.id)
  if (list.length === 0) return point.substrate
  return point.substrate
}

async function remove(point: CollectPoint): Promise<void> {
  const count = recordsOf(point.id)
  if (count > 0) {
    ElMessage.error(`「${point.name}」下仍有 ${count} 条菌物条目，请先清理条目`)
    return
  }
  await ElMessageBox.confirm(`确认删除采集点「${point.name}」？该点的生境观测台账一并删除`, '删除确认', {
    type: 'warning'
  })
  await habitatStore.getState().removeByPoint(point.id)
  await pointStore.getState().remove(point.id)
  ElMessage.success('采集点已删除')
}

/* ---------- 生境观测台账 ---------- */
const obsEditingId = ref<string | null>(null)
const obsForm = reactive({
  pointId: '',
  observedAt: toLocalInputValue(),
  weather: '晴' as Weather,
  temperature: 20,
  humidity: 60
})

watch(
  () => pointState.points.length,
  () => {
    if (!obsForm.pointId && pointState.points.length > 0) {
      obsForm.pointId = pointState.points[0].id
    }
  },
  { immediate: true }
)

const obsError = computed<string | null>(() => {
  if (!obsForm.pointId) return '请选择采集点'
  if (!obsForm.observedAt) return '请选择观测时间'
  if (Number.isNaN(Number(obsForm.temperature))) return '请填写温度数值'
  if (obsForm.temperature < -40 || obsForm.temperature > 60) return '温度应在 -40℃ ~ 60℃ 之间'
  if (Number.isNaN(Number(obsForm.humidity))) return '请填写湿度数值'
  if (obsForm.humidity < 0 || obsForm.humidity > 100) return '湿度应在 0% ~ 100% 之间'
  return null
})

function resetObsForm(): void {
  obsEditingId.value = null
  obsForm.pointId = pointState.points[0]?.id ?? ''
  obsForm.observedAt = toLocalInputValue()
  obsForm.weather = '晴'
  obsForm.temperature = 20
  obsForm.humidity = 60
}

function editObservation(observation: HabitatObservation): void {
  obsEditingId.value = observation.id
  obsForm.pointId = observation.pointId
  obsForm.observedAt = toLocalInputValue(new Date(observation.observedAt))
  obsForm.weather = observation.weather
  obsForm.temperature = observation.temperature
  obsForm.humidity = observation.humidity
}

async function submitObservation(): Promise<void> {
  if (obsError.value) {
    ElMessage.warning(obsError.value)
    return
  }
  const row: HabitatObservation = {
    id: obsEditingId.value ?? uid('obs'),
    pointId: obsForm.pointId,
    observedAt: new Date(obsForm.observedAt).toISOString(),
    weather: obsForm.weather,
    temperature: Number(obsForm.temperature),
    humidity: Number(obsForm.humidity)
  }
  await habitatStore.getState().save(row)
  ElMessage.success(obsEditingId.value ? '生境观测已更新' : '生境观测已登记')
  resetObsForm()
}

async function removeObservation(observation: HabitatObservation): Promise<void> {
  const linked = recordState.records.filter((record) => record.habitat?.observationId === observation.id).length
  const hint = linked > 0 ? `\n已有 ${linked} 个条目引用该观测，删除后这些条目仍按原快照值显示。` : ''
  await ElMessageBox.confirm(`确认撤掉 ${formatObservedAt(observation.observedAt)} 的这次观测？${hint}`, '撤销确认', {
    type: 'warning'
  })
  await habitatStore.getState().remove(observation.id)
  ElMessage.success('生境观测已撤销')
}

const ledgerFilter = ref<string>('')

interface LedgerRow extends HabitatObservation {
  pointName: string
}

/** 台账行（可按采集点过滤），观测时间倒序 */
const ledgerRows = computed<LedgerRow[]>(() =>
  habitatState.observations
    .filter((item) => !ledgerFilter.value || item.pointId === ledgerFilter.value)
    .map((item) => ({
      ...item,
      pointName: pointState.points.find((point) => point.id === item.pointId)?.name ?? '采集点已删除'
    }))
)

/** 采集点卡片上展示的最近一次观测 */
function latestOf(pointId: string): HabitatObservation | null {
  return latestObservation(habitatState.observations, pointId)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">采集点管理</h2>
        <p class="page-sub">
          经纬度与海拔表单带格式校验；每个采集点展示条目数、主要基物与最近一次生境观测，删除前校验下级条目数。
        </p>
      </div>
      <el-button @click="resetDraft">清空表单</el-button>
    </div>

    <el-card shadow="never" class="form-card">
      <template #header>{{ editingId ? '编辑采集点' : '新增采集点' }}</template>
      <GeoPointForm v-model="draft" with-meta />
      <div class="actions">
        <el-button type="primary" @click="submit">{{ editingId ? '保存修改' : '新增采集点' }}</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="obs-head">
          <span>{{ obsEditingId ? '编辑生境观测' : '登记生境观测' }}</span>
          <span class="muted">同一采集点早中晚差异大，记录观测时间、天气、温度与湿度，供新建条目时取值</span>
        </div>
      </template>
      <el-form label-width="88px">
        <el-row :gutter="12">
          <el-col :span="6">
            <el-form-item label="采集点" required>
              <el-select v-model="obsForm.pointId" style="width: 100%" :disabled="pointState.points.length === 0">
                <el-option v-for="point in pointState.points" :key="point.id" :label="point.name" :value="point.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="观测时间" required>
              <el-date-picker
                v-model="obsForm.observedAt"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm"
                :clearable="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="天气" required>
              <el-select v-model="obsForm.weather" style="width: 100%">
                <el-option v-for="item in WEATHER_TYPES" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="温度(℃)" required>
              <el-input-number v-model="obsForm.temperature" :min="-40" :max="60" :step="0.5" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="湿度(%)" required>
              <el-input-number v-model="obsForm.humidity" :min="0" :max="100" :step="1" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <div class="actions">
        <el-button type="primary" @click="submitObservation">{{ obsEditingId ? '保存修改' : '登记观测' }}</el-button>
        <el-button v-if="obsEditingId" @click="resetObsForm">放弃编辑</el-button>
      </div>
    </el-card>

    <h3 class="section-title">采集点清单（{{ pointState.points.length }}）</h3>
    <div class="card-grid">
      <el-card v-for="point in pointState.points" :key="point.id" shadow="hover" class="point-card">
        <div class="point-head">
          <div>
            <div class="point-name">{{ point.name }}</div>
            <div class="muted">
              {{ point.longitude.toFixed(4) }}, {{ point.latitude.toFixed(4) }} · {{ point.altitude }} m
            </div>
          </div>
          <el-tag effect="plain" size="small">条目 {{ recordsOf(point.id) }}</el-tag>
        </div>
        <el-descriptions :column="1" size="small" border class="desc">
          <el-descriptions-item label="植被类型">{{ point.vegetation }}</el-descriptions-item>
          <el-descriptions-item label="主要基物">{{ mainSubstrate(point) }}</el-descriptions-item>
          <el-descriptions-item label="伴生树种">{{ point.companionTrees || '—' }}</el-descriptions-item>
          <el-descriptions-item label="采集日期">{{ point.collectDate }}</el-descriptions-item>
          <el-descriptions-item label="采集人">{{ point.collector || '—' }}</el-descriptions-item>
          <el-descriptions-item label="最近观测">
            <template v-if="latestOf(point.id)">
              <div>{{ formatObservedAt(latestOf(point.id)!.observedAt) }}</div>
              <div class="muted">{{ habitatBrief(latestOf(point.id)!) }}</div>
            </template>
            <span v-else class="muted">尚无观测</span>
          </el-descriptions-item>
        </el-descriptions>
        <div class="point-actions">
          <el-button size="small" @click="edit(point)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(point)">删除</el-button>
        </div>
      </el-card>
      <el-empty v-if="pointState.points.length === 0" description="暂无采集点" />
    </div>

    <div class="ledger-head">
      <h3 class="section-title">生境观测台账（{{ ledgerRows.length }}）</h3>
      <el-select v-model="ledgerFilter" placeholder="全部采集点" clearable size="small" style="width: 220px">
        <el-option v-for="point in pointState.points" :key="point.id" :label="point.name" :value="point.id" />
      </el-select>
    </div>
    <el-table :data="ledgerRows" border stripe>
      <el-table-column label="观测时间" width="170">
        <template #default="{ row }: { row: LedgerRow }">{{ formatObservedAt(row.observedAt) }}</template>
      </el-table-column>
      <el-table-column prop="pointName" label="采集点" min-width="160" />
      <el-table-column label="天气" width="100">
        <template #default="{ row }: { row: LedgerRow }">
          <el-tag size="small" effect="plain">{{ row.weather }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="温度" width="90">
        <template #default="{ row }: { row: LedgerRow }">{{ row.temperature }} ℃</template>
      </el-table-column>
      <el-table-column label="湿度" width="90">
        <template #default="{ row }: { row: LedgerRow }">{{ row.humidity }} %RH</template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }: { row: LedgerRow }">
          <el-button size="small" link type="primary" @click="editObservation(row)">修改</el-button>
          <el-button size="small" link type="danger" @click="removeObservation(row)">撤销</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.form-card {
  border-radius: 12px;
}
.actions {
  margin-top: 12px;
}
.obs-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.point-card {
  border-radius: 12px;
}
.point-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.point-name {
  font-size: 15px;
  font-weight: 600;
}
.desc {
  margin-bottom: 10px;
}
.point-actions {
  display: flex;
  gap: 8px;
}
.ledger-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}
</style>
