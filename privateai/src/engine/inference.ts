import { initLlama, LlamaContext, type TokenData, type NativeCompletionResult } from 'llama.rn';
import { useModelStore } from '../stores/modelStore';

let context: LlamaContext | null = null;
let isLoading = false;

export async function loadModel(modelPath: string, onProgress?: (progress: number) => void): Promise<LlamaContext> {
  if (context) {
    await context.release();
    context = null;
  }

  isLoading = true;
  try {
    context = await initLlama(
      {
        model: modelPath,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        n_gpu_layers: 0, // Start with CPU; enable GPU on supported devices
        use_mlock: true,
        use_mmap: true,
      },
      onProgress
    );
    isLoading = false;
    return context;
  } catch (error) {
    isLoading = false;
    throw error;
  }
}

export function getContext(): LlamaContext | null {
  return context;
}

export function isModelLoading(): boolean {
  return isLoading;
}

export interface CompletionCallbacks {
  onToken: (token: string, accumulated: string) => void;
  onComplete: (result: NativeCompletionResult) => void;
  onError: (error: Error) => void;
}

export async function generateCompletion(
  messages: Array<{ role: string; content: string }>,
  config: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stop?: string[];
  },
  callbacks: CompletionCallbacks
): Promise<() => Promise<void>> {
  if (!context) {
    callbacks.onError(new Error('Model not loaded. Please load a model first.'));
    return async () => {};
  }

  let accumulated = '';

  try {
    const resultPromise = context.completion(
      {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature ?? 0.7,
        top_p: config.topP ?? 0.9,
        n_predict: config.maxTokens ?? 1024,
        stop: config.stop ?? [],
      },
      (data: TokenData) => {
        if (data.token) {
          accumulated += data.token;
          callbacks.onToken(data.token, accumulated);
        }
      }
    );

    const result = await resultPromise;
    callbacks.onComplete(result);
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }

  return async () => {
    if (context) {
      await context.stopCompletion();
    }
  };
}

export async function releaseModel(): Promise<void> {
  if (context) {
    await context.release();
    context = null;
  }
}
