<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CollectPoint } from '@/types'
import GeoPointForm from '@/components/common/GeoPointForm.vue'
import HabitatLedger from '@/components/common/HabitatLedger.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { pointStore } from '@/stores/pointStore'
import { recordStore } from '@/stores/recordStore'
import { habitatStore } from '@/stores/habitatStore'
import { latestObservationOf } from '@/utils/habitat'
import { uid } from '@/utils/id'

const pointState = useStore(pointStore)
const recordState = useStore(recordStore)
const habitatState = useStore(habitatStore)

/** 当前打开生境台账的采集点 */
const ledgerPoint = ref<CollectPoint | null>(null)
const ledgerVisible = computed<boolean>({
  get: () => ledgerPoint.value !== null,
  set: (visible) => {
    if (!visible) ledgerPoint.value = null
  }
})

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

function observationsOf(pointId: string): number {
  return habitatState.observations.filter((item) => item.pointId === pointId).length
}

/** 采集点卡片展示最近一次生境观测 */
function latestOf(pointId: string) {
  return latestObservationOf(habitatState.observations, pointId)
}

function openLedger(point: CollectPoint): void {
  ledgerPoint.value = point
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
  await ElMessageBox.confirm(`确认删除采集点「${point.name}」？其生境观测台账将一并删除`, '删除确认', { type: 'warning' })
  await habitatStore.getState().removeByPoint(point.id)
  await pointStore.getState().remove(point.id)
  if (ledgerPoint.value?.id === point.id) ledgerPoint.value = null
  ElMessage.success('采集点已删除')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">采集点管理</h2>
        <p class="page-sub">
          经纬度与海拔表单带格式校验；每个采集点展示条目数与主要基物，删除前校验下级条目数。
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
        </el-descriptions>
        <div class="habitat-strip" :class="{ empty: !latestOf(point.id) }">
          <template v-if="latestOf(point.id)">
            <div class="habitat-line">
              <span class="habitat-label">最近观测</span>
              <span class="habitat-time">{{ latestOf(point.id)?.observedAt.replace('T', ' ') }}</span>
            </div>
            <div class="habitat-line">
              <el-tag size="small" effect="plain">{{ latestOf(point.id)?.weather }}</el-tag>
              <el-tag size="small" effect="plain">{{ latestOf(point.id)?.temperature }} ℃</el-tag>
              <el-tag size="small" effect="plain">湿度 {{ latestOf(point.id)?.humidity }}%</el-tag>
              <span class="muted habitat-count">共 {{ observationsOf(point.id) }} 条观测</span>
            </div>
          </template>
          <span v-else class="muted">尚无生境观测，新条目将无法关联 6 小时内的现场天气与温湿度</span>
        </div>
        <div class="point-actions">
          <el-button size="small" @click="edit(point)">编辑</el-button>
          <el-button size="small" type="primary" plain @click="openLedger(point)">生境观测台账</el-button>
          <el-button size="small" type="danger" plain @click="remove(point)">删除</el-button>
        </div>
      </el-card>
      <el-empty v-if="pointState.points.length === 0" description="暂无采集点" />
    </div>

    <HabitatLedger
      v-if="ledgerPoint"
      v-model="ledgerVisible"
      :point-id="ledgerPoint.id"
      :point-name="ledgerPoint.name"
    />
  </div>
</template>

<style scoped>
.form-card {
  border-radius: 12px;
}
.actions {
  margin-top: 12px;
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
.habitat-strip {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f3f8f4;
  border: 1px solid #dcece1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.habitat-strip.empty {
  background: #f7f5f0;
  border-color: #ece4d6;
}
.habitat-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.habitat-label {
  font-weight: 600;
  color: #3c5a46;
}
.habitat-time {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #4b5b50;
}
.habitat-count {
  margin-left: auto;
}
</style>
