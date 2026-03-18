import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message, GenerationConfig, ThemeMode } from '../types';
import { DEFAULT_MODEL_ID, DEFAULT_SYSTEM_PROMPT } from '../constants/models';
import * as db from '../db/database';
import { generateCompletion, getContext, loadModel, releaseModel } from '../engine/inference';
import { useModelStore } from './modelStore';

let stopFn: (() => Promise<void>) | null = null;

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isGenerating: boolean;
  streamingContent: string;
  selectedModelId: string;
  theme: ThemeMode;
  generationConfig: GenerationConfig;
  modelLoadProgress: number;
  isModelReady: boolean;

  loadConversations: () => Promise<void>;
  createNewConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  setModel: (modelId: string) => void;
  setTheme: (theme: ThemeMode) => void;
  updateGenerationConfig: (config: Partial<GenerationConfig>) => void;
  searchConversations: (query: string) => Promise<Conversation[]>;
  clearAllData: () => Promise<void>;
  initModel: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isGenerating: false,
  streamingContent: '',
  selectedModelId: DEFAULT_MODEL_ID,
  theme: 'dark',
  generationConfig: {
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  modelLoadProgress: 0,
  isModelReady: false,

  loadConversations: async () => {
    const conversations = await db.getAllConversations();
    set({ conversations });
  },

  initModel: async () => {
    const modelStore = useModelStore.getState();
    const modelPath = modelStore.getModelPath(get().selectedModelId);
    if (!modelPath) return;

    set({ modelLoadProgress: 0, isModelReady: false });
    try {
      await loadModel(modelPath, (progress) => {
        set({ modelLoadProgress: progress });
      });
      set({ isModelReady: true, modelLoadProgress: 1 });
    } catch {
      // Model failed to load — fall back to demo mode
      set({ isModelReady: false, modelLoadProgress: 0 });
    }
  },

  createNewConversation: async () => {
    const id = uuidv4();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      modelId: get().selectedModelId,
    };
    await db.createConversation(conversation);
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      messages: [],
      streamingContent: '',
    }));
    return id;
  },

  selectConversation: async (id: string) => {
    const messages = await db.getMessages(id);
    set({ currentConversationId: id, messages, streamingContent: '' });
  },

  deleteConversation: async (id: string) => {
    await db.deleteConversation(id);
    const state = get();
    const conversations = state.conversations.filter((c) => c.id !== id);
    const updates: Partial<ChatState> = { conversations };
    if (state.currentConversationId === id) {
      updates.currentConversationId = null;
      updates.messages = [];
      updates.streamingContent = '';
    }
    set(updates);
  },

  sendMessage: async (content: string) => {
    const state = get();
    let conversationId = state.currentConversationId;

    if (!conversationId) {
      conversationId = await get().createNewConversation();
    }

    const userMessage: Message = {
      id: uuidv4(),
      conversationId,
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    await db.addMessage(userMessage);
    set((s) => ({ messages: [...s.messages, userMessage] }));

    // Update conversation title from first message
    const currentMessages = get().messages;
    if (currentMessages.length === 1) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      await db.updateConversationTitle(conversationId, title);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, title, updatedAt: Date.now() } : c
        ),
      }));
    }

    set({ isGenerating: true, streamingContent: '' });

    // Build message history for the model
    const allMessages = get().messages;
    const chatMessages = [
      { role: 'system', content: get().generationConfig.systemPrompt },
      ...allMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const ctx = getContext();
    if (ctx) {
      // Real llama.rn inference
      const finalConvId = conversationId;
      stopFn = await generateCompletion(
        chatMessages,
        {
          temperature: get().generationConfig.temperature,
          maxTokens: get().generationConfig.maxTokens,
          topP: get().generationConfig.topP,
        },
        {
          onToken: (_token, accumulated) => {
            set({ streamingContent: accumulated });
          },
          onComplete: async (result) => {
            const responseContent = result.content || result.text;
            const assistantMessage: Message = {
              id: uuidv4(),
              conversationId: finalConvId,
              role: 'assistant',
              content: responseContent,
              createdAt: Date.now(),
              tokens: result.tokens_predicted,
            };
            await db.addMessage(assistantMessage);
            set((s) => ({
              messages: [...s.messages, assistantMessage],
              isGenerating: false,
              streamingContent: '',
            }));
            stopFn = null;
          },
          onError: async (error) => {
            // On error, save partial content if any
            const partial = get().streamingContent;
            if (partial) {
              const assistantMessage: Message = {
                id: uuidv4(),
                conversationId: finalConvId,
                role: 'assistant',
                content: partial + '\n\n[Generation stopped: ' + error.message + ']',
                createdAt: Date.now(),
              };
              await db.addMessage(assistantMessage);
              set((s) => ({
                messages: [...s.messages, assistantMessage],
                isGenerating: false,
                streamingContent: '',
              }));
            } else {
              set({ isGenerating: false, streamingContent: '' });
            }
            stopFn = null;
          },
        }
      );
    } else {
      // Demo mode fallback when no model is loaded
      const simulatedResponse = generateSimulatedResponse(content);
      let accumulated = '';

      for (const char of simulatedResponse) {
        if (!get().isGenerating) break;
        accumulated += char;
        set({ streamingContent: accumulated });
        await new Promise((r) => setTimeout(r, 15));
      }

      if (get().isGenerating) {
        const assistantMessage: Message = {
          id: uuidv4(),
          conversationId,
          role: 'assistant',
          content: accumulated,
          createdAt: Date.now(),
          tokens: accumulated.split(/\s+/).length,
        };
        await db.addMessage(assistantMessage);
        set((s) => ({
          messages: [...s.messages, assistantMessage],
          isGenerating: false,
          streamingContent: '',
        }));
      }
    }
  },

  stopGeneration: async () => {
    if (stopFn) {
      await stopFn();
      stopFn = null;
    }
    set({ isGenerating: false });
  },

  setModel: (modelId: string) => {
    set({ selectedModelId: modelId });
  },

  setTheme: (theme: ThemeMode) => {
    set({ theme });
  },

  updateGenerationConfig: (config: Partial<GenerationConfig>) => {
    set((s) => ({
      generationConfig: { ...s.generationConfig, ...config },
    }));
  },

  searchConversations: async (query: string) => {
    return db.searchConversations(query);
  },

  clearAllData: async () => {
    await db.deleteAllData();
    set({
      conversations: [],
      currentConversationId: null,
      messages: [],
      streamingContent: '',
    });
  },
}));

function generateSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) {
    return "Hello! I'm PrivateAI, your on-device AI assistant. Everything we discuss stays right here on your device — no cloud, no data collection, no tracking. How can I help you today?";
  }
  if (lower.includes('privacy') || lower.includes('data')) {
    return 'Great question! PrivateAI runs entirely on your device using an optimized language model. Your conversations are stored locally in an encrypted database and are never sent to any server. You can delete all your data at any time from Settings > Privacy Dashboard.';
  }
  if (lower.includes('model') || lower.includes('llama')) {
    return "I'm currently running on a Llama 3.2 1B model, quantized to Q4_K_M format for efficient on-device performance. This means I can generate about 10-20 tokens per second on modern devices. You can download larger models (3B or 3.8B parameters) from the Models tab for better quality responses.";
  }
  return `I understand you're asking about: "${input.slice(0, 80)}". As an on-device AI, I process everything locally on your device. In the full release, I'll use the Llama language model for high-quality responses. Right now, I'm running in demo mode to showcase the interface. Try exploring the History, Models, and Settings tabs!`;
}
