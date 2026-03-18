import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Conversation } from '../types';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  isDark: boolean;
  onPress: () => void;
  onDelete: () => void;
}

export function ConversationItem({ conversation, isActive, isDark, onPress, onDelete }: Props) {
  const theme = isDark ? colors.dark : colors.light;
  const date = new Date(conversation.updatedAt);
  const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={[
        styles.container,
        {
          backgroundColor: isActive ? theme.surfaceHighlight : theme.surface,
          borderColor: isActive ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {conversation.title}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {timeStr} · {conversation.modelId}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  content: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    fontSize: 12,
  },
});
