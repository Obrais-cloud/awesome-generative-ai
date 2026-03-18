import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useChatStore } from '../src/stores/chatStore';
import { useModelStore } from '../src/stores/modelStore';

export default function RootLayout() {
  const theme = useChatStore((s) => s.theme);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const initializeModels = useModelStore((s) => s.initialize);
  const isDark = theme === 'dark' || theme === 'system';

  useEffect(() => {
    loadConversations();
    initializeModels();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
