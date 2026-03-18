import { create } from 'zustand';
import { File, Directory, Paths } from 'expo-file-system';
import { ModelInfo } from '../types';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../constants/models';

interface ModelState {
  models: ModelInfo[];
  downloadedModelIds: Set<string>;
  downloadProgress: Record<string, number>;
  activeModelId: string;
  isModelLoaded: boolean;

  initialize: () => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  selectModel: (modelId: string) => void;
  getModelPath: (modelId: string) => string;
  isModelDownloaded: (modelId: string) => boolean;
}

const modelsDir = new Directory(Paths.document, 'models');

export const useModelStore = create<ModelState>((set, get) => ({
  models: AVAILABLE_MODELS,
  downloadedModelIds: new Set<string>(),
  downloadProgress: {},
  activeModelId: DEFAULT_MODEL_ID,
  isModelLoaded: false,

  initialize: async () => {
    if (!modelsDir.exists) {
      modelsDir.create();
    }

    const downloaded = new Set<string>();
    for (const model of AVAILABLE_MODELS) {
      if (model.bundled) {
        downloaded.add(model.id);
        continue;
      }
      const file = new File(modelsDir, model.filename);
      if (file.exists) {
        downloaded.add(model.id);
      }
    }

    set({ downloadedModelIds: downloaded, isModelLoaded: true });
  },

  downloadModel: async (modelId: string) => {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model || !model.downloadUrl) return;

    set((s) => ({
      downloadProgress: { ...s.downloadProgress, [modelId]: 0 },
    }));

    try {
      const destination = new File(modelsDir, model.filename);
      await File.downloadFileAsync(model.downloadUrl, destination);

      set((s) => {
        const newDownloaded = new Set(s.downloadedModelIds);
        newDownloaded.add(modelId);
        const { [modelId]: _, ...rest } = s.downloadProgress;
        return { downloadedModelIds: newDownloaded, downloadProgress: rest };
      });
    } catch (error) {
      set((s) => {
        const { [modelId]: _, ...rest } = s.downloadProgress;
        return { downloadProgress: rest };
      });
      throw error;
    }
  },

  deleteModel: async (modelId: string) => {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model || model.bundled) return;

    const file = new File(modelsDir, model.filename);
    if (file.exists) {
      file.delete();
    }

    set((s) => {
      const newDownloaded = new Set(s.downloadedModelIds);
      newDownloaded.delete(modelId);
      const updates: Partial<ModelState> = { downloadedModelIds: newDownloaded };
      if (s.activeModelId === modelId) {
        updates.activeModelId = DEFAULT_MODEL_ID;
      }
      return updates;
    });
  },

  selectModel: (modelId: string) => {
    set({ activeModelId: modelId });
  },

  getModelPath: (modelId: string) => {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model) return '';
    const file = new File(modelsDir, model.filename);
    return file.uri;
  },

  isModelDownloaded: (modelId: string) => {
    return get().downloadedModelIds.has(modelId);
  },
}));
