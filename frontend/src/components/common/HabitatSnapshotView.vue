<script setup lang="ts">
import { computed } from 'vue'
import type { HabitatObservation, HabitatSnapshot } from '@/types'
import { formatDateTime, minutesAgo } from '@/utils/habitat'

const props = withDefaults(
  defineProps<{
    habitat: HabitatSnapshot | null
    /** 台账中的对应观测（存在即未撤销）；缺省则按快照自身的 revoked 标记显示 */
    current?: HabitatObservation | null
    /** 紧凑模式：只输出一行小标签（图谱卡片用） */
    compact?: boolean
  }>(),
  { compact: false, current: null }
)

/** 观测已撤销：快照标记或台账中已找不到对应记录 */
const revoked = computed(() => props.habitat?.revoked === true || (!!props.habitat && !props.current))

/** 观测事后被改过：台账数值与快照原值不一致 */
const drifted = computed(() => {
  if (!props.habitat || !props.current || revoked.value) return false
  return (
    props.current.weather !== props.habitat.weather ||
    props.current.temperature !== props.habitat.temperature ||
    props.current.humidity !== props.habitat.humidity ||
    props.current.observedAt !== props.habitat.observedAt
  )
})

const ageText = computed(() => {
  const minutes = minutesAgo(props.habitat?.observedAt ?? '')
  if (minutes === null || minutes < 0) return ''
  if (minutes < 60) return `${minutes} 分钟前观测`
  return `${Math.floor(minutes / 60)} 小时前观测`
})
</script>

<template>
  <div v-if="habitat" class="habitat" :class="{ compact }">
    <template v-if="compact">
      <el-tag size="small" effect="plain">{{ habitat.weather }}</el-tag>
      <el-tag size="small" effect="plain">{{ habitat.temperature }}℃ / {{ habitat.humidity }}%</el-tag>
      <el-tag v-if="revoked" size="small" type="info" effect="plain">观测已撤销·按原值显示</el-tag>
      <el-tag v-else-if="drifted" size="small" type="warning" effect="plain">观测已改·按原值显示</el-tag>
    </template>
    <template v-else>
      <el-descriptions :column="2" size="small" border>
        <el-descriptions-item label="观测时间">{{ formatDateTime(habitat.observedAt) }}</el-descriptions-item>
        <el-descriptions-item label="距今">{{ ageText || '—' }}</el-descriptions-item>
        <el-descriptions-item label="天气">{{ habitat.weather }}</el-descriptions-item>
        <el-descriptions-item label="温度 / 湿度">{{ habitat.temperature }} ℃ / {{ habitat.humidity }} %</el-descriptions-item>
        <el-descriptions-item label="留痕状态" :span="2">
          <el-tag v-if="revoked" type="info" size="small" effect="plain">
            该观测事后已撤销，以下数值为建条目时的原值
          </el-tag>
          <el-tag v-else-if="drifted" type="warning" size="small" effect="plain">
            该观测事后已修改，以下仍为建条目时的原值
          </el-tag>
          <el-tag v-else type="success" size="small" effect="plain">建条目时保存的观测原值</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </div>
  <div v-else-if="!compact" class="habitat-empty">
    该条目建立时未关联生境观测（当时同采集点 6 小时内可能没有观测记录）。
  </div>
</template>

<style scoped>
.habitat {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.habitat-empty {
  font-size: 13px;
  color: #7f8d82;
}
</style>
