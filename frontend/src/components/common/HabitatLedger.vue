<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WEATHER_TYPES, type HabitatObservation, type WeatherType } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { habitatStore } from '@/stores/habitatStore'
import { formatDateTime, minutesAgo, toLocalInput } from '@/utils/habitat'
import { uid } from '@/utils/id'

const props = defineProps<{
  modelValue: boolean
  pointId: string
  pointName: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const habitatState = useStore(habitatStore)

const list = computed<HabitatObservation[]>(() =>
  habitatState.observations
    .filter((item) => item.pointId === props.pointId)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
)

const form = reactive<{
  id: string
  observedAt: string
  weather: WeatherType
  temperature: number
  humidity: number
  note: string
}>({
  id: '',
  observedAt: toLocalInput(new Date()),
  weather: '晴',
  temperature: 18,
  humidity: 70,
  note: ''
})

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) resetForm()
  }
)

function resetForm(): void {
  form.id = ''
  form.observedAt = toLocalInput(new Date())
  form.weather = '晴'
  form.temperature = 18
  form.humidity = 70
  form.note = ''
}

function edit(observation: HabitatObservation): void {
  form.id = observation.id
  form.observedAt = observation.observedAt
  form.weather = observation.weather
  form.temperature = observation.temperature
  form.humidity = observation.humidity
  form.note = observation.note
}

async function submit(): Promise<void> {
  if (!props.pointId) {
    ElMessage.warning('采集点信息缺失')
    return
  }
  if (!form.observedAt) {
    ElMessage.warning('请选择观测时间')
    return
  }
  if (!Number.isFinite(Number(form.temperature))) {
    ElMessage.warning('温度必须是数字')
    return
  }
  const humidity = Number(form.humidity)
  if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    ElMessage.warning('相对湿度必须是 0 ~ 100 之间的数字')
    return
  }
  const row: HabitatObservation = {
    id: form.id || uid('obs'),
    pointId: props.pointId,
    observedAt: form.observedAt,
    weather: form.weather,
    temperature: Number(form.temperature),
    humidity,
    note: form.note.trim()
  }
  await habitatStore.getState().save(row)
  ElMessage.success(form.id ? '生境观测已更新' : '生境观测已登记')
  resetForm()
}

async function remove(observation: HabitatObservation): Promise<void> {
  await ElMessageBox.confirm(
    `确认撤掉 ${formatDateTime(observation.observedAt)} 的生境观测？已经关联该观测的条目仍按原值显示，不受影响。`,
    '撤销观测',
    { type: 'warning', confirmButtonText: '撤销观测', cancelButtonText: '再想想' }
  )
  await habitatStore.getState().remove(observation.id)
  if (form.id === observation.id) resetForm()
  ElMessage.success('观测已撤销，已关联条目保留原值')
}

function ageLabel(observedAt: string): string {
  const minutes = minutesAgo(observedAt)
  if (minutes === null) return ''
  if (minutes < 0) return `${Math.abs(minutes)} 分钟后（请核对设备时间）`
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} 小时前`
  return `${Math.floor(minutes / (60 * 24))} 天前`
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`生境观测台账 · ${pointName}`"
    width="780px"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <el-card shadow="never" class="ledger-form">
      <template #header>{{ form.id ? '编辑观测' : '登记新观测' }}</template>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="观测时间" required>
              <el-date-picker
                v-model="form.observedAt"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm"
                :clearable="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="天气">
              <el-select v-model="form.weather" style="width: 100%">
                <el-option v-for="item in WEATHER_TYPES" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="温度(℃)">
              <el-input-number v-model="form.temperature" :min="-40" :max="60" :step="0.1" :precision="1" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="相对湿度(%)">
              <el-input-number v-model="form.humidity" :min="0" :max="100" :step="1" :precision="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.note" placeholder="如 晨雾未散，落叶层偏湿" />
        </el-form-item>
        <div class="ledger-actions">
          <el-button type="primary" @click="submit">{{ form.id ? '保存修改' : '登记观测' }}</el-button>
          <el-button v-if="form.id" @click="resetForm">放弃编辑</el-button>
        </div>
      </el-form>
    </el-card>

    <h4 class="ledger-title">历史观测（{{ list.length }}）</h4>
    <el-table :data="list" border stripe size="small">
      <el-table-column label="观测时间" width="180">
        <template #default="{ row }: { row: HabitatObservation }">
          <div>{{ formatDateTime(row.observedAt) }}</div>
          <div class="age">{{ ageLabel(row.observedAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="weather" label="天气" width="80" />
      <el-table-column label="温度" width="90">
        <template #default="{ row }: { row: HabitatObservation }">{{ row.temperature }} ℃</template>
      </el-table-column>
      <el-table-column label="湿度" width="90">
        <template #default="{ row }: { row: HabitatObservation }">{{ row.humidity }} %</template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="140">
        <template #default="{ row }: { row: HabitatObservation }">{{ row.note || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130">
        <template #default="{ row }: { row: HabitatObservation }">
          <el-button link type="primary" size="small" @click="edit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">撤销</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="list.length === 0" description="暂无观测，先登记一条" :image-size="60" />
    <p class="ledger-tip">新建条目时只能关联同一采集点 6 小时内的观测；观测事后修改或撤销，已关联条目仍按原值显示。</p>
  </el-dialog>
</template>

<style scoped>
.ledger-form {
  margin-bottom: 14px;
}
.ledger-actions {
  padding-left: 92px;
}
.ledger-title {
  margin: 4px 0 8px;
  font-size: 13px;
  color: #3c4b57;
}
.age {
  font-size: 11px;
  color: #8a97a3;
}
.ledger-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: #8a97a3;
  line-height: 1.6;
}
</style>
