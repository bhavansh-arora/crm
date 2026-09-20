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
      },
    },
  },
  plugins: [],
};
export default config;
