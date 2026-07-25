import type { Config } from "tailwindcss";

// mobile first, marcus is on a phone at midnight. brand ink + a single teal accent so
// the important things (quote number, phone number, provenance badge) can shout later.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        accent: {
          DEFAULT: "#0d9488",
          dark: "#0f766e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
