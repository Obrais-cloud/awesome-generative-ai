import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useChatStore } from '../src/stores/chatStore';
import { useModelStore } from '../src/stores/modelStore';

export default function RootLayout() {
  const theme = useChatStore((s) => s.theme);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const initModel = useChatStore((s) => s.initModel);
  const initializeModels = useModelStore((s) => s.initialize);
  const isDark = theme === 'dark' || theme === 'system';

  useEffect(() => {
    const boot = async () => {
      await loadConversations();
      await initializeModels();
      // Attempt to load the selected model on startup
      initModel().catch(() => {
        // Model may not be available — that's OK, demo mode is fine
      });
    };
    boot();
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
