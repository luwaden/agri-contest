import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── DESIGN TOKENS (single source of truth; never hard-code hex elsewhere) ──
        // Primary identity #005937, supporting yellow #EEFF00, light green #62FF50, blue #0872B9, white.
        primary: { DEFAULT: "#005937", 50: "#eef8f2", 100: "#d5efe0", 200: "#aadfc2", 300: "#6fc79c", 400: "#2fa874", 500: "#0b8052", 600: "#00704a", 700: "#005937", 800: "#004a2e", 900: "#003a24", 950: "#02281a" },
        sun: "#EEFF00",      // yellow cards: dates, key stats, calls to action
        lime: "#62FF50",     // light-green cards: benefits, success, supporting information
        azure: { DEFAULT: "#0872B9", dark: "#065b94" },   // blue cards: highlights, partners, secondary blocks
        night: "#0c1a13",    // near-black text on yellow / light green
        ink: { DEFAULT: "#15201a", soft: "#3d4a42", muted: "#5a6860" },
        paper: { DEFAULT: "#ffffff", warm: "#f5f8f4", line: "#dfe7de" },
        warn: { bg: "#fff7e6", fg: "#7a4b00", line: "#f1d29a" },
        danger: { bg: "#fdecec", fg: "#8e1b1b", line: "#f0b9b9" },
        // Legacy aliases kept so existing admin/form components keep working (same values as above).
        leaf: { 50: "#eef8f2", 100: "#d5efe0", 200: "#aadfc2", 300: "#6fc79c", 400: "#2fa874", 500: "#0b8052", 600: "#00704a", 700: "#005937", 800: "#004a2e", 900: "#003a24" },
        forest: { 800: "#06402b", 900: "#04301f", 950: "#02281a" },
        brand: { blue: "#0872B9", lime: "#62FF50", neon: "#EEFF00", grey: "#919191" },
      },
      fontFamily: {
        // Elza first (brand typeface, licensed file supplied by the client), Inter as the guide's fallback.
        sans: ['"Elza"', '"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        display: ['"Elza"', '"Inter Variable"', "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-2xl": ["clamp(1.65rem, 6vw, 2.6rem)", { lineHeight: "1.04", letterSpacing: "-0.045em" }],
        "display-xl": ["clamp(1.6rem, 3.4vw, 2.25rem)", { lineHeight: "1.02", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(1.35rem, 2.5vw, 1.85rem)", { lineHeight: "1.05", letterSpacing: "-0.035em" }],
      },
      borderRadius: { card: "1.5rem", tile: "1.125rem" },
      boxShadow: { card: "0 1px 0 rgba(0,0,0,.04), 0 18px 40px -22px rgba(0,57,36,.35)", lift: "0 24px 50px -24px rgba(0,57,36,.45)" },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { rise: "rise .45s cubic-bezier(.2,.7,.2,1) both", fade: "fade .3s ease both" },
    },
  },
  plugins: [],
};
export default config;
