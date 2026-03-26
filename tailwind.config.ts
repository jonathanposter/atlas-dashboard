import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          bg: "#0c0e14",
          surface: "#1e2130",
          border: "rgba(100,116,139,0.12)",
          purple: "#7c3aed",
          blue: "#3b82f6",
          text: "#e2e8f0",
          muted: "#64748b",
          dim: "#475569",
          green: "#22c55e",
          amber: "#fbbf24",
          red: "#f87171",
          "purple-light": "#c4b5fd",
          "purple-soft": "#a78bfa",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "SF Pro Display", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        pulse: "pulse 2s ease-in-out infinite",
        bounce3: "bounce3 1.2s ease-in-out infinite",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        bounce3: {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
