export interface FileItem {
  name: string;
  isDirectory: boolean;
  type: string;
  url?: string;
  path: string;
  size?: number;
  lastModified?: number;
}

export interface DirectoryState {
  currentPath: string[];
  history: string[][];
  historyIndex: number;
}

export interface AudioFile extends FileItem {
  duration?: number;
}

export interface TranscriptionResponse {
  text: string;
  error?: string;
}

export interface ChatResponse {
  message: string;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp?: Date
  isError?: boolean
}

export interface FileItem {
  id: string
  name: string
  size: number
  type: string
  path: string
  lastModified: Date
}


export interface SummaryResponse {
  summary: string;
  metadata: {
    fileName: string;
    transcription: string;
  }[];
  error?: string;
}