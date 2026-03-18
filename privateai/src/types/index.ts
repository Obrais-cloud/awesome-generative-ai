export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  tokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  description: string;
  bundled: boolean;
  downloadUrl?: string;
  quantization: string;
  parameters: string;
}

export interface GenerationConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
