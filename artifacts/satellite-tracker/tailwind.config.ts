import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          50: "#f0f4ff",
          100: "#dce8ff",
          200: "#b9d3ff",
          300: "#85b4ff",
          400: "#4a8cff",
          500: "#1a6aff",
          600: "#0047f5",
          700: "#0036e2",
          800: "#002eb7",
          900: "#002090",
          950: "#000e4a",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
