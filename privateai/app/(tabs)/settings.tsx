import React from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/stores/chatStore';
import { colors, spacing, radius } from '../../src/constants/theme';
import { ThemeMode } from '../../src/types';

function SettingsSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  const t = isDark ? colors.dark : colors.light;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: t.surface, borderColor: t.border }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  isDark,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  isDark: boolean;
  danger?: boolean;
}) {
  const t = isDark ? colors.dark : colors.light;
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: t.border }]} disabled={!onPress}>
      <Text style={[styles.rowLabel, { color: danger ? t.error : t.text }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: t.textSecondary }]}>{value}</Text>}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme, setTheme, generationConfig, updateGenerationConfig, clearAllData } = useChatStore();
  const isDark = theme === 'dark' || theme === 'system';
  const t = isDark ? colors.dark : colors.light;

  const cycleTheme = () => {
    const order: ThemeMode[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const cycleTemperature = () => {
    const temps = [0.3, 0.5, 0.7, 0.9, 1.0];
    const currentIdx = temps.indexOf(generationConfig.temperature);
    const next = temps[(currentIdx + 1) % temps.length];
    updateGenerationConfig({ temperature: next });
  };

  const cycleMaxTokens = () => {
    const options = [256, 512, 1024, 2048];
    const currentIdx = options.indexOf(generationConfig.maxTokens);
    const next = options[(currentIdx + 1) % options.length];
    updateGenerationConfig({ maxTokens: next });
  };

  const handleClearData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all conversations and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: clearAllData,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['bottom']}>
      <ScrollView>
        <SettingsSection title="APPEARANCE" isDark={isDark}>
          <SettingsRow label="Theme" value={theme.charAt(0).toUpperCase() + theme.slice(1)} onPress={cycleTheme} isDark={isDark} />
        </SettingsSection>

        <SettingsSection title="GENERATION" isDark={isDark}>
          <SettingsRow
            label="Temperature"
            value={generationConfig.temperature.toFixed(1)}
            onPress={cycleTemperature}
            isDark={isDark}
          />
          <SettingsRow
            label="Max Tokens"
            value={generationConfig.maxTokens.toString()}
            onPress={cycleMaxTokens}
            isDark={isDark}
          />
        </SettingsSection>

        <SettingsSection title="PRIVACY" isDark={isDark}>
          <SettingsRow label="Data Storage" value="On-device only" isDark={isDark} />
          <SettingsRow label="Network Access" value="None (offline)" isDark={isDark} />
          <SettingsRow label="Analytics" value="Disabled" isDark={isDark} />
          <SettingsRow label="Delete All Data" onPress={handleClearData} isDark={isDark} danger />
        </SettingsSection>

        <SettingsSection title="ABOUT" isDark={isDark}>
          <SettingsRow label="Version" value="1.0.0 (MVP)" isDark={isDark} />
          <SettingsRow label="Engine" value="llama.cpp" isDark={isDark} />
          <SettingsRow label="License" value="MIT" isDark={isDark} />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.textSecondary }]}>
            PrivateAI — Your AI. Your device. Your data.
          </Text>
          <Text style={[styles.footerText, { color: t.textSecondary }]}>
            No data ever leaves this device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 12,
  },
});
