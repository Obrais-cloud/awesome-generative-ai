import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  isDark: boolean;
}

export function ChatInput({ onSend, onStop, isGenerating, isDark }: Props) {
  const [text, setText] = useState('');
  const theme = isDark ? colors.dark : colors.light;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBackground,
            color: theme.text,
            borderColor: theme.border,
          },
        ]}
        placeholder="Message PrivateAI..."
        placeholderTextColor={theme.textSecondary}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={4000}
        editable={!isGenerating}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <Pressable
        onPress={isGenerating ? onStop : handleSend}
        style={[
          styles.sendButton,
          {
            backgroundColor: isGenerating ? theme.error : theme.accent,
            opacity: !isGenerating && !text.trim() ? 0.4 : 1,
          },
        ]}
        disabled={!isGenerating && !text.trim()}
      >
        <View style={isGenerating ? styles.stopIcon : styles.sendIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  stopIcon: {
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
