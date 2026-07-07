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
        // "Daylight brief" — a printed dossier on a desk, not an ops cave
        paper: "#F0E6CF",          // page background — manila folder
        surface: "#F7F1E1",        // lighter sheets resting on the folder
        "surface-raised": "#FBF7EB",
        ink: "#232936",            // primary text — navy ink
        muted: "#66707F",          // secondary text
        amber: "#A8791B",          // accent — highlighter on the document
        "amber-dim": "#8A6516",    // deeper amber for small text/links
        "field-green": "#4A5C3A",
        urgent: "#B23A2E",
        line: "#D8CCAD",           // hairline borders on manila
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
