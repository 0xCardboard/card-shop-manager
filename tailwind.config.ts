import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3b6cf6",
          600: "#2b54d4",
          700: "#1f3fa6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
