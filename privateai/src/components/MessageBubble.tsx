import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  message: Message;
  isDark: boolean;
}

export function MessageBubble({ message, isDark }: Props) {
  const theme = isDark ? colors.dark : colors.light;
  const isUser = message.role === 'user';

  const handleLongPress = () => {
    Clipboard.setStringAsync(message.content);
  };

  return (
    <Pressable onLongPress={handleLongPress} style={styles.wrapper}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.userBubble : theme.assistantBubble,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isUser ? '#FFFFFF' : theme.text },
          ]}
        >
          {message.content}
        </Text>
        {message.tokens && (
          <Text style={[styles.meta, { color: isUser ? 'rgba(255,255,255,0.6)' : theme.textSecondary }]}>
            {message.tokens} tokens
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function StreamingBubble({ content, isDark }: { content: string; isDark: boolean }) {
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: theme.assistantBubble,
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: theme.text }]}>
        {content}
        <Text style={{ color: theme.accent }}>|</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.lg,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    fontSize: 11,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
