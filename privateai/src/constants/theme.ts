export const colors = {
  dark: {
    background: '#0F0F0F',
    surface: '#1A1A1A',
    surfaceHighlight: '#252525',
    text: '#E8E8E8',
    textSecondary: '#999999',
    accent: '#6C63FF',
    accentSecondary: '#00D9A3',
    border: '#2A2A2A',
    error: '#FF6B6B',
    userBubble: '#6C63FF',
    assistantBubble: '#1A1A1A',
    inputBackground: '#1A1A1A',
  },
  light: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceHighlight: '#F0F0F0',
    text: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#6C63FF',
    accentSecondary: '#00D9A3',
    border: '#E0E0E0',
    error: '#FF4444',
    userBubble: '#6C63FF',
    assistantBubble: '#FFFFFF',
    inputBackground: '#FFFFFF',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;
