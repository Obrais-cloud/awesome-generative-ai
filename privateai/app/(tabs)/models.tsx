import React, { useEffect } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/stores/chatStore';
import { useModelStore } from '../../src/stores/modelStore';
import { ModelCard } from '../../src/components/ModelCard';
import { colors, spacing } from '../../src/constants/theme';

export default function ModelsScreen() {
  const theme = useChatStore((s) => s.theme);
  const setModel = useChatStore((s) => s.setModel);
  const selectedModelId = useChatStore((s) => s.selectedModelId);
  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;

  const {
    models,
    downloadedModelIds,
    downloadProgress,
    activeModelId,
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: t.textSecondary }]}>
          Models run entirely on your device. Larger models produce better responses but use more storage and may be slower.
        </Text>
      </View>

      <FlatList
        data={models}
        renderItem={({ item }) => (
          <ModelCard
            model={item}
            isDownloaded={isModelDownloaded(item.id)}
            isActive={selectedModelId === item.id}
            downloadProgress={downloadProgress[item.id]}
            isDark={isDark}
            onSelect={() => handleSelect(item.id)}
            onDownload={() => downloadModel(item.id)}
            onDelete={() => deleteModel(item.id)}
          />
        )}
        keyExtractor={(item) => item.id}
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
});
