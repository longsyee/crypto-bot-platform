export const tokens = {
  colors: {
    // Surfaces (deep slate hierarchy)
    bgBase: "#0f1117",
    bgElevated: "#13161f",
    bgCard: "#1a1d29",
    bgOverlay: "#151825",
    bgHover: "#1e2130",
    bgPressed: "#252a3c",

    // Primary accents (electric blue)
    primary: "#3b82f6",
    primaryMuted: "#2563eb",
    primaryBright: "#60a5fa",
    primaryGlow: "rgba(59, 130, 246, 0.4)",

    // Semantic
    success: "#10b981",
    successMuted: "#059669",
    successGlow: "rgba(16, 185, 129, 0.35)",
    danger: "#ef4444",
    dangerMuted: "#dc2626",
    dangerGlow: "rgba(239, 68, 68, 0.35)",
    warning: "#f59e0b",
    warningMuted: "#d97706",
    warningGlow: "rgba(245, 158, 11, 0.35)",
    info: "#06b6d4",
    infoMuted: "#0891b2",

    // Text
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textInverse: "#0f1117",

    // Border
    borderSubtle: "rgba(148, 163, 184, 0.08)",
    borderDefault: "rgba(148, 163, 184, 0.12)",
    borderFocus: "rgba(59, 130, 246, 0.5)",
    borderActive: "#3b82f6",

    // Tier / misc
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
    kol: "#FF4500",
  },

  spacing: {
    xs: "0.25rem",   // 4px
    sm: "0.5rem",    // 8px
    md: "1rem",      // 16px
    lg: "1.5rem",    // 24px
    xl: "2rem",      // 32px
    "2xl": "3rem",   // 48px
    "3xl": "4rem",   // 64px
    "4xl": "6rem",   // 96px
  },

  borderRadius: {
    sm: "0.375rem",   // 6px
    md: "0.5rem",     // 8px
    lg: "0.75rem",    // 12px
    xl: "1rem",       // 16px
    "2xl": "1.25rem", // 20px
    full: "9999px",
  },

  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
    glow: "0 0 20px rgba(59, 130, 246, 0.25)",
    glowSuccess: "0 0 20px rgba(16, 185, 129, 0.25)",
    glowDanger: "0 0 20px rgba(239, 68, 68, 0.25)",
    inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)",
    glass: "0 8px 32px 0 rgba(0, 0, 0, 0.36)",
  },

  typography: {
    fontFamily: {
      sans: ['"Inter"', '"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      "5xl": ["3rem", { lineHeight: "1.15" }],
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    letterSpacing: {
      tight: "-0.025em",
      normal: "0em",
      wide: "0.025em",
      wider: "0.05em",
    },
  },

  zIndex: {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },

  transitions: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    default: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    glow: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  },

  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
} as const;

export type TokenColors = typeof tokens.colors;
export type TokenSpacing = typeof tokens.spacing;
export type TokenBorderRadius = typeof tokens.borderRadius;
export type TokenShadows = typeof tokens.shadows;
export type TokenTypography = typeof tokens.typography;
export type TokenZIndex = typeof tokens.zIndex;
export type TokenTransitions = typeof tokens.transitions;
export type TokenBreakpoints = typeof tokens.breakpoints;
