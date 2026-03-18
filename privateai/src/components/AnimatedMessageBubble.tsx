import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  message: Message;
  isDark: boolean;
  index: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedMessageBubble({ message, isDark, index }: Props) {
  const theme = isDark ? colors.dark : colors.light;
  const isUser = message.role === 'user';

  const handleLongPress = () => {
    Clipboard.setStringAsync(message.content);
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 30).duration(300).springify()}
      onLongPress={handleLongPress}
      style={styles.wrapper}
    >
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
          style={[styles.text, { color: isUser ? '#FFFFFF' : theme.text }]}
          selectable
        >
          {message.content}
        </Text>
        {message.tokens != null && (
          <Text
            style={[
              styles.meta,
              { color: isUser ? 'rgba(255,255,255,0.6)' : theme.textSecondary },
            ]}
          >
            {message.tokens} tokens
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

export function AnimatedStreamingBubble({
  content,
  isDark,
}: {
  content: string;
  isDark: boolean;
}) {
  const theme = isDark ? colors.dark : colors.light;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={[
        styles.bubble,
        {
          backgroundColor: theme.assistantBubble,
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: theme.border,
          marginHorizontal: spacing.lg,
        },
      ]}
    >
      <Text style={[styles.text, { color: theme.text }]} selectable>
        {content}
        <Text style={{ color: theme.accent }}>|</Text>
      </Text>
    </Animated.View>
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
