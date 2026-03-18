import { ModelInfo } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    filename: 'llama-3.2-1b-q4_k_m.gguf',
    sizeBytes: 734_003_200,
    description: 'Fast and efficient. Great for quick questions and simple tasks.',
    bundled: true,
    quantization: 'Q4_K_M',
    parameters: '1B',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    filename: 'llama-3.2-3b-q4_k_m.gguf',
    sizeBytes: 1_900_000_000,
    description: 'Better quality responses. Good balance of speed and capability.',
    bundled: false,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    parameters: '3B',
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    filename: 'phi-3-mini-4k-instruct-q4_k_m.gguf',
    sizeBytes: 2_200_000_000,
    description: 'Highest quality. Best for complex reasoning and detailed answers.',
    bundled: false,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    parameters: '3.8B',
  },
];

export const DEFAULT_MODEL_ID = 'llama-3.2-1b';

export const DEFAULT_SYSTEM_PROMPT =
  'You are PrivateAI, a helpful, harmless, and honest AI assistant running entirely on the user\'s device. You are private by design — no data ever leaves this device. Be concise and helpful.';
