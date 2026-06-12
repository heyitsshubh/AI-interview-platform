// Design System — Color Palette
export const Colors = {
  // Backgrounds
  background: '#0f0f1a',
  surface: '#1a1a2e',
  card: '#16213e',
  cardElevated: '#1e2a4a',
  overlay: 'rgba(15, 15, 26, 0.85)',

  // Brand Colors
  accent: '#e94560',
  accentDark: '#c0392b',
  teal: '#64ffda',
  tealDark: '#00b894',

  // Text
  textPrimary: '#ccd6f6',
  textSecondary: '#8892b0',
  textMuted: '#4a4a6a',
  textWhite: '#ffffff',

  // Status
  success: '#2ecc71',
  successDark: '#27ae60',
  warning: '#f39c12',
  warningDark: '#e67e22',
  danger: '#e74c3c',
  dangerDark: '#c0392b',
  info: '#3498db',

  // Borders
  border: '#2d2d4e',
  borderLight: '#3a3a5c',

  // Gradients
  gradientPrimary: ['#1a1a2e', '#16213e', '#0f3460'] as const,
  gradientAccent: ['#e94560', '#c0392b'] as const,
  gradientTeal: ['#64ffda', '#00b894'] as const,
  gradientCard: ['#1e2a4a', '#16213e'] as const,
  gradientDark: ['#0f0f1a', '#1a1a2e'] as const,

  // Recommendation Colors
  strongHire: '#2ecc71',
  hire: '#27ae60',
  maybe: '#f39c12',
  reject: '#e74c3c',

  // Transparent
  transparent: 'transparent',
  semiTransparent: 'rgba(255,255,255,0.05)',
  semiTransparentDark: 'rgba(0,0,0,0.3)',
};

export type ColorKey = keyof typeof Colors;
