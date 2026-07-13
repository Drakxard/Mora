// store/models.ts
import { atom } from "nanostores"
import type { GroqModel } from "../utils/groqModels"

export interface ModelStore {
  transcription: GroqModel[]
  chat: GroqModel[]
  vision: GroqModel[]
  tts: GroqModel[]
  isLoading: boolean
  lastUpdated: number | null
}

export const models = atom<ModelStore>({
  transcription: [],
  chat: [],
  vision: [],
  tts: [],
  isLoading: false,
  lastUpdated: null,
})

export type ModelType = "transcription" | "chat" | "tts"

export const selectedModels = atom<{
  transcription: string
  chat: string
  tts: string
}>({
  transcription: "",
  chat: "",
  tts: "",
})

// Funciones helper
export function setModels(newModels: Partial<ModelStore>) {
  models.set({
    ...models.get(),
    ...newModels,
  })
}

export function setSelectedModel(type: ModelType, modelId: string) {
  selectedModels.set({
    ...selectedModels.get(),
    [type]: modelId,
  })
}

export function getSelectedModel(type: ModelType): string {
  return selectedModels.get()[type]
}
