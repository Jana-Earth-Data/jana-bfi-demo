import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0b1220",
        panel: "#111827",
        panelAlt: "#0f172a",
        line: "#243244",
        muted: "#93a4b8",
        accent: "#7dd3fc",
        success: "#86efac",
        warning: "#fcd34d",
      },
    },
  },
  plugins: [],
} satisfies Config;
