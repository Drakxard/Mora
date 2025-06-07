// store/models.ts
import { atom } from "nanostores"
import type { GroqModel } from "../utils/groqModels"

export interface ModelStore {
  transcription: GroqModel[]
  chat: GroqModel[]
  vision: GroqModel[]
  isLoading: boolean
  lastUpdated: number | null
}

export const models = atom<ModelStore>({
  transcription: [],
  chat: [],
  vision: [],
  isLoading: false,
  lastUpdated: null,
})

export const selectedModels = atom<{
  transcription: string
  chat: string
}>({
  transcription: "",
  chat: "",
})

// Funciones helper
export function setModels(newModels: Partial<ModelStore>) {
  models.set({
    ...models.get(),
    ...newModels,
  })
}

export function setSelectedModel(type: "transcription" | "chat", modelId: string) {
  selectedModels.set({
    ...selectedModels.get(),
    [type]: modelId,
  })
}

export function getSelectedModel(type: "transcription" | "chat"): string {
  return selectedModels.get()[type]
}
