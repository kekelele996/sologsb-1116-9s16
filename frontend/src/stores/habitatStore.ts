import { createStore } from 'zustand/vanilla'
import type { HabitatObservation } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'

export interface HabitatState {
  observations: HabitatObservation[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (observation: HabitatObservation) => Promise<void>
  remove: (id: string) => Promise<void>
  removeByPoint: (pointId: string) => Promise<void>
}

export const habitatStore = createStore<HabitatState>((set, get) => ({
  observations: [],
  loaded: false,
  hydrate: async () => {
    const observations = await syncAll<HabitatObservation>(db.observations)
    observations.sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    set({ observations, loaded: true })
  },
  save: async (observation) => {
    await syncPut<HabitatObservation>(db.observations, observation)
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<HabitatObservation>(db.observations, id)
    await get().hydrate()
  },
  removeByPoint: async (pointId) => {
    const targets = get().observations.filter((item) => item.pointId === pointId)
    await Promise.all(targets.map((item) => syncDelete<HabitatObservation>(db.observations, item.id)))
    await get().hydrate()
  }
}))
