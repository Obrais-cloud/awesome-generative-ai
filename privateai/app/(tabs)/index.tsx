import React, { useRef, useEffect } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useChatStore } from '../../src/stores/chatStore';
import { AnimatedMessageBubble, AnimatedStreamingBubble } from '../../src/components/AnimatedMessageBubble';
import { ChatInput } from '../../src/components/ChatInput';
import { ModelLoadingOverlay } from '../../src/components/ModelLoadingOverlay';
import { colors, spacing, radius } from '../../src/constants/theme';
import { exportConversation, exportConversationAsMarkdown } from '../../src/utils/export';
import { Message, Conversation } from '../../src/types';

export default function ChatScreen() {
  const {
    messages,
    isGenerating,
    streamingContent,
    currentConversationId,
    conversations,
    sendMessage,
    stopGeneration,
    createNewConversation,
    theme,
    selectedModelId,
    modelLoadProgress,
    isModelReady,
  } = useChatStore();

  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;
  const flatListRef = useRef<FlatList>(null);
  const isLoadingModel = modelLoadProgress > 0 && modelLoadProgress < 1;

  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, streamingContent]);

  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  const handleExport = () => {
    if (!currentConversation || messages.length === 0) return;
    Alert.alert('Export Conversation', 'Choose export format:', [
      {
        text: 'Text (.txt)',
        onPress: () => exportConversation(currentConversation, messages),
      },
      {
        text: 'Markdown (.md)',
        onPress: () => exportConversationAsMarkdown(currentConversation, messages),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <AnimatedMessageBubble message={item} isDark={isDark} index={index} />
  );

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.duration(500)} style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: t.text }]}>PrivateAI</Text>
      <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
        Your AI. Your device. Your data.
      </Text>
      <View style={[styles.badge, { backgroundColor: t.accentSecondary + '22' }]}>
        <Text style={[styles.badgeText, { color: t.accentSecondary }]}>
          100% on-device · No cloud · No tracking
        </Text>
      </View>
      {!isModelReady && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[styles.demoBanner, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.demoBannerText, { color: t.textSecondary }]}>
            Running in demo mode. Load a model from the Models tab for real AI inference.
          </Text>
        </Animated.View>
      )}
      <View style={styles.suggestions}>
        {[
          'What can you help me with?',
          'How does privacy work here?',
          'Tell me about the model you use',
        ].map((suggestion, i) => (
          <Animated.View key={suggestion} entering={FadeInDown.delay(400 + i * 100).duration(400)}>
            <Pressable
              onPress={() => sendMessage(suggestion)}
              style={[styles.suggestionChip, { borderColor: t.border, backgroundColor: t.surface }]}
            >
              <Text style={[styles.suggestionText, { color: t.text }]}>{suggestion}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

  const renderFooter = () => {
    if (!streamingContent) return null;
    return (
      <View style={{ marginVertical: spacing.xs }}>
        <AnimatedStreamingBubble content={streamingContent} isDark={isDark} />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      {isLoadingModel && <ModelLoadingOverlay progress={modelLoadProgress} isDark={isDark} />}

      <View style={[styles.modelBar, { borderBottomColor: t.border }]}>
        <View style={styles.modelBarLeft}>
          <View style={[styles.statusDot, { backgroundColor: isModelReady ? t.accentSecondary : '#FF9500' }]} />
          <Text style={[styles.modelLabel, { color: t.textSecondary }]}>
            {selectedModelId}{isModelReady ? '' : ' (demo)'}
          </Text>
        </View>
        <View style={styles.modelBarRight}>
          {currentConversationId && messages.length > 0 && (
            <Pressable onPress={handleExport}>
              <Text style={[styles.barAction, { color: t.textSecondary }]}>Export</Text>
            </Pressable>
          )}
          {currentConversationId && (
            <Pressable onPress={createNewConversation}>
              <Text style={[styles.barAction, { color: t.accent }]}>+ New</Text>
            </Pressable>
          )}
        </View>
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
  modelBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modelBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelLabel: {
    fontSize: 12,
  },
  barAction: {
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
  demoBanner: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  demoBannerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
