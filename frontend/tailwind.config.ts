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
        vellum: "#EDE6D6",
        ink: "#2B2A25",
        walnut: "#8B6F47",
        moss: "#3D5A4C",
        wax: "#B23A2E",
        pencil: "#A8A092",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
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
        full: "0",
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
