import React, { useRef, useEffect } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/stores/chatStore';
import { MessageBubble, StreamingBubble } from '../../src/components/MessageBubble';
import { ChatInput } from '../../src/components/ChatInput';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Message } from '../../src/types';

export default function ChatScreen() {
  const {
    messages,
    isGenerating,
    streamingContent,
    currentConversationId,
    sendMessage,
    stopGeneration,
    createNewConversation,
    theme,
    selectedModelId,
  } = useChatStore();

  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, streamingContent]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} isDark={isDark} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: t.text }]}>PrivateAI</Text>
      <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
        Your AI. Your device. Your data.
      </Text>
      <View style={[styles.badge, { backgroundColor: t.accentSecondary + '22' }]}>
        <Text style={[styles.badgeText, { color: t.accentSecondary }]}>
          100% on-device · No cloud · No tracking
        </Text>
      </View>
      <View style={styles.suggestions}>
        {[
          'What can you help me with?',
          'How does privacy work here?',
          'Tell me about the model you use',
        ].map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => sendMessage(suggestion)}
            style={[styles.suggestionChip, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={[styles.suggestionText, { color: t.text }]}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!streamingContent) return null;
    return (
      <View style={{ marginVertical: spacing.xs, marginHorizontal: spacing.lg }}>
        <StreamingBubble content={streamingContent} isDark={isDark} />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      <View style={[styles.modelBar, { borderBottomColor: t.border }]}>
        <Text style={[styles.modelLabel, { color: t.textSecondary }]}>
          Model: {selectedModelId}
        </Text>
        {currentConversationId && (
          <Pressable onPress={createNewConversation}>
            <Text style={[styles.newChat, { color: t.accent }]}>+ New Chat</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messageList}
        />
        <ChatInput
          onSend={sendMessage}
          onStop={stopGeneration}
          isGenerating={isGenerating}
          isDark={isDark}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  modelBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  modelLabel: {
    fontSize: 12,
  },
  newChat: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    width: '100%',
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  suggestionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
