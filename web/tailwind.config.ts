import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Retinted neutral scale: a cool, slightly blue-grey chrome instead of
        // pure grey, so every gray-* surface/border across the site reads as
        // "Luna window chrome" in light mode and "OS-dark navy" in dark mode
        // without having to touch each component's markup.
        gray: {
          50: "#f6f8fc",
          100: "#ebf1fa",
          200: "#d7e3f3",
          300: "#b9cce8",
          400: "#8aa4c7",
          500: "#63799d",
          600: "#485b7a",
          700: "#344360",
          800: "#202c46",
          900: "#131b30",
          950: "#0a0f1e",
        },
        // The site's one accent scale, retinted from neon cyan to Luna blue.
        cyan: {
          50: "#eaf2fe",
          100: "#d3e6fd",
          200: "#a8cdfb",
          300: "#75adf6",
          400: "#3f8cf3",
          500: "#2f7fd6",
          600: "#1c5cd6",
          700: "#163f8f",
          800: "#102c66",
          900: "#0a1d47",
        },
      },
      fontFamily: {
        sans: ["Verdana", "Tahoma", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
