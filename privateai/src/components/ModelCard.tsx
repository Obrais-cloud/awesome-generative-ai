import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ModelInfo } from '../types';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  model: ModelInfo;
  isDownloaded: boolean;
  isActive: boolean;
  downloadProgress?: number;
  isDark: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

export function ModelCard({
  model,
  isDownloaded,
  isActive,
  downloadProgress,
  isDark,
  onSelect,
  onDownload,
  onDelete,
}: Props) {
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isActive ? theme.accent : theme.border,
          borderWidth: isActive ? 2 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: theme.text }]}>{model.name}</Text>
          {model.bundled && (
            <View style={[styles.badge, { backgroundColor: theme.accentSecondary + '22' }]}>
              <Text style={[styles.badgeText, { color: theme.accentSecondary }]}>Bundled</Text>
            </View>
          )}
        </View>
        <Text style={[styles.specs, { color: theme.textSecondary }]}>
          {model.parameters} params · {model.quantization} · {formatSize(model.sizeBytes)}
        </Text>
      </View>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {model.description}
      </Text>

      <View style={styles.actions}>
        {isDownloaded ? (
          <>
            <Pressable
              onPress={onSelect}
              style={[
                styles.button,
                {
                  backgroundColor: isActive ? theme.accent : 'transparent',
                  borderColor: theme.accent,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={{ color: isActive ? '#FFFFFF' : theme.accent, fontWeight: '600', fontSize: 13 }}>
                {isActive ? 'Active' : 'Use Model'}
              </Text>
            </Pressable>
            {!model.bundled && (
              <Pressable onPress={onDelete} style={[styles.button, { borderColor: theme.error, borderWidth: 1 }]}>
                <Text style={{ color: theme.error, fontWeight: '600', fontSize: 13 }}>Delete</Text>
              </Pressable>
            )}
          </>
        ) : downloadProgress !== undefined ? (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.accent, width: `${Math.round(downloadProgress * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onDownload}
            style={[styles.button, { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
              Download ({formatSize(model.sizeBytes)})
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  specs: {
    fontSize: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
