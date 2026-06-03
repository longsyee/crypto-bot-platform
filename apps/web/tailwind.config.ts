import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bgBase: "var(--bg-base)",
        bgElevated: "var(--bg-elevated)",
        bgCard: "var(--bg-card)",
        bgOverlay: "var(--bg-overlay)",
        bgHover: "var(--bg-hover)",
        bgPressed: "var(--bg-pressed)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        textMuted: "var(--text-muted)",
        borderSubtle: "var(--border-subtle)",
        borderDefault: "var(--border-default)",
        primary: {
          DEFAULT: "var(--primary)",
          glow: "var(--primary-glow)",
        },
        success: {
          DEFAULT: "var(--success)",
          glow: "var(--success-glow)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          glow: "var(--danger-glow)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          glow: "var(--warning-glow)",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        display: ['"Space Grotesk"', "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px var(--primary-glow)",
        "glow-success": "0 0 20px var(--success-glow)",
        "glow-danger": "0 0 20px var(--danger-glow)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.36)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        banner: "1200",
        overlay: "1300",
        modal: "1400",
        popover: "1500",
        toast: "1700",
        tooltip: "1800",
      },
    },
  },
  plugins: [],
};

export default config;
