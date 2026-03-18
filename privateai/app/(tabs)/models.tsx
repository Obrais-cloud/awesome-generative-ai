import React, { useEffect } from 'react';
import { View, FlatList, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useChatStore } from '../../src/stores/chatStore';
import { useModelStore } from '../../src/stores/modelStore';
import { ModelCard } from '../../src/components/ModelCard';
import { colors, spacing, radius } from '../../src/constants/theme';

export default function ModelsScreen() {
  const theme = useChatStore((s) => s.theme);
  const setModel = useChatStore((s) => s.setModel);
  const selectedModelId = useChatStore((s) => s.selectedModelId);
  const initModel = useChatStore((s) => s.initModel);
  const isModelReady = useChatStore((s) => s.isModelReady);
  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;

  const {
    models,
    downloadProgress,
    initialize,
    downloadModel,
    deleteModel,
    selectModel,
    isModelDownloaded,
  } = useModelStore();

  useEffect(() => {
    initialize();
  }, []);

  const handleSelect = (modelId: string) => {
    selectModel(modelId);
    setModel(modelId);
  };

  const handleLoadModel = async () => {
    Alert.alert(
      'Load Model',
      `Load "${selectedModelId}" for on-device inference? This may take a moment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: async () => {
            try {
              await initModel();
              Alert.alert('Model Loaded', 'On-device AI inference is now active!');
            } catch {
              Alert.alert('Load Failed', 'Could not load the model. Make sure it is downloaded.');
            }
          },
        },
      ]
    );
  };

  const handleDownload = async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    Alert.alert(
      'Download Model',
      `Download ${model.name}? This will use approximately ${(model.sizeBytes / 1_000_000_000).toFixed(1)} GB of storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => downloadModel(modelId),
        },
      ]
    );
  };

  const handleDelete = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    Alert.alert(
      'Delete Model',
      `Delete ${model.name}? You can re-download it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteModel(modelId),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: t.textSecondary }]}>
          Models run entirely on your device. Larger models produce better responses but use more storage and may be slower.
        </Text>
      </View>

      <FlatList
        data={models}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
            <ModelCard
              model={item}
              isDownloaded={isModelDownloaded(item.id)}
              isActive={selectedModelId === item.id}
              downloadProgress={downloadProgress[item.id]}
              isDark={isDark}
              onSelect={() => handleSelect(item.id)}
              onDownload={() => handleDownload(item.id)}
              onDelete={() => handleDelete(item.id)}
            />
          </Animated.View>
        )}
        keyExtractor={(item) => item.id}
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable
              onPress={handleLoadModel}
              style={[
                styles.loadButton,
                {
                  backgroundColor: isModelReady ? t.accentSecondary : t.accent,
                },
              ]}
            >
              <Text style={styles.loadButtonText}>
                {isModelReady ? 'Model Active — Reload' : 'Load Model for Inference'}
              </Text>
            </Pressable>
            <Text style={[styles.footerText, { color: t.textSecondary }]}>
              {isModelReady
                ? 'Real on-device AI inference is active'
                : 'Tap to enable real on-device AI inference'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  loadButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  footerText: {
    fontSize: 12,
  },
});
