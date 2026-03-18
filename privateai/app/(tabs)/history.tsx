import React, { useState } from 'react';
import { View, FlatList, TextInput, Text, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useChatStore } from '../../src/stores/chatStore';
import { ConversationItem } from '../../src/components/ConversationItem';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Conversation } from '../../src/types';

export default function HistoryScreen() {
  const {
    conversations,
    currentConversationId,
    selectConversation,
    deleteConversation,
    searchConversations: searchFn,
    theme,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const router = useRouter();
  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;

  const displayedConversations = searchResults ?? conversations;

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await searchFn(query.trim());
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  const handleSelect = async (id: string) => {
    await selectConversation(id);
    router.push('/(tabs)');
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Conversation', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteConversation(id),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: t.inputBackground,
            color: t.text,
            borderColor: t.border,
          },
        ]}
        placeholder="Search conversations..."
        placeholderTextColor={t.textSecondary}
        value={searchQuery}
        onChangeText={handleSearch}
      />

      <FlatList
        data={displayedConversations}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            isActive={item.id === currentConversationId}
            isDark={isDark}
            onPress={() => handleSelect(item.id)}
            onDelete={() => handleDelete(item.id, item.title)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={displayedConversations.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: t.textSecondary }]}>
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </Text>
            <Text style={[styles.emptyHint, { color: t.textSecondary }]}>
              Start chatting in the Chat tab
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
  searchInput: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    fontSize: 15,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
  },
});
