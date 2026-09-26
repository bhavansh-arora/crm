import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b6cf5",
          600: "#2f56d1",
          700: "#2745a8",
        },
        ink: {
          950: "#070b14",
          900: "#0b1220",
          800: "#131c2e",
          700: "#1d2940",
          600: "#2b3a57",
        },
        gold: {
          50: "#fbf7ee",
          100: "#f4ead3",
          300: "#e0c78f",
          400: "#d4b26e",
          500: "#c8a15a",
          600: "#a9833f",
          700: "#836430",
        },
        ivory: "#faf8f3",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
