export const tokens = {
  colors: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    kol: '#FF4500',
    darkBg: '#0f172a',
    cardBg: '#1e293b',
    primary: '#3b82f6',
    destructive: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    textPrimary: '#f3f4f6',
    textSecondary: '#9ca3af',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
} as const;

export type TokenColors = typeof tokens.colors;
export type TokenSpacing = typeof tokens.spacing;
export type TokenBorderRadius = typeof tokens.borderRadius;
