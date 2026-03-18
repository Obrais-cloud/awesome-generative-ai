import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useChatStore } from '../../src/stores/chatStore';
import { colors } from '../../src/constants/theme';

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text style={[styles.icon, { color, opacity: focused ? 1 : 0.5 }]}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const theme = useChatStore((s) => s.theme);
  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.background },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: t.background,
          borderTopColor: t.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          headerTitle: 'PrivateAI',
          tabBarIcon: ({ color, focused }) => <TabIcon label="chat" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => <TabIcon label="hist" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: 'Models',
          tabBarIcon: ({ color, focused }) => <TabIcon label="mod" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <TabIcon label="set" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
