import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf8",
          100: "#d5faf0",
          200: "#abf4df",
          300: "#72e8c6",
          400: "#3ad3a5",
          500: "#19b388",
          600: "#118a6b",
          700: "#0f6f57",
          800: "#0f5946",
          900: "#0c493a",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(25, 179, 136, 0.15), 0 16px 40px rgba(6, 23, 18, 0.16)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}

export default config
