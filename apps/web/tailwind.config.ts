import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bgBase: "#0f1117",
        bgElevated: "#13161f",
        bgCard: "#1a1d29",
        bgOverlay: "#151825",
        bgHover: "#1e2130",
        bgPressed: "#252a3c",
        primary: {
          DEFAULT: "#3b82f6",
          muted: "#2563eb",
          bright: "#60a5fa",
        },
        success: {
          DEFAULT: "#10b981",
          muted: "#059669",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "#dc2626",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "#d97706",
        },
        info: {
          DEFAULT: "#06b6d4",
          muted: "#0891b2",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(59, 130, 246, 0.25)",
        "glow-success": "0 0 20px rgba(16, 185, 129, 0.25)",
        "glow-danger": "0 0 20px rgba(239, 68, 68, 0.25)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.36)",
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
