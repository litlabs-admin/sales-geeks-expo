import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand:    "rgb(var(--brand-primary) / <alpha-value>)",
        ink:      "rgb(var(--brand-ink) / <alpha-value>)",
        "sg-yellow": "rgb(var(--sg-yellow) / <alpha-value>)",
        "sg-black":  "rgb(var(--sg-black)  / <alpha-value>)",
        "sg-dark":   "rgb(var(--sg-dark)   / <alpha-value>)",
      }
    }
  },
  plugins: []
};

export default config;
