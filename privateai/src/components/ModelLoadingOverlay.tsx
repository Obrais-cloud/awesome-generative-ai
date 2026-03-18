import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  progress: number;
  isDark: boolean;
}

export function ModelLoadingOverlay({ progress, isDark }: Props) {
  const theme = isDark ? colors.dark : colors.light;
  const pct = Math.round(progress * 100);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.5, { duration: 1000 }), -1, true),
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: theme.background + 'EE' }]}
    >
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Animated.Text style={[styles.icon, pulseStyle, { color: theme.accent }]}>
          Loading Model
        </Animated.Text>
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.accent, width: `${pct}%` },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {pct}% — Preparing on-device inference
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  card: {
    width: '80%',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.lg,
  },
  icon: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
