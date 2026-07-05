import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        opsblack: "#0A0E1A",
        surface: "#0F1624",
        "surface-raised": "#151E30",
        amber: "#E8A838",
        "amber-dim": "#A87820",
        "field-green": "#4A5C3A",
        urgent: "#C0392B",
        parchment: "#D4CEBC",
        muted: "#6B7280",
        line: "#2A3445",
      },
      fontFamily: {
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-ibm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0",
        none: "0",
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        full: "9999px", // exception: the pulsing status dot only
      },
      boxShadow: {
        DEFAULT: "none",
        sm: "none",
        md: "none",
        lg: "none",
        xl: "none",
      },
      lineHeight: {
        reading: "1.7",
      },
    },
  },
  plugins: [],
};
export default config;
