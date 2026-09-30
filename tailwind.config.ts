import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Agricultural green scale (brand). Use sparingly: accents, CTAs, key figures.
        leaf: { 50: "#f1f8f2", 100: "#dcefe0", 200: "#b9dfc1", 300: "#8ac79a", 400: "#55a86d", 500: "#2f8a4d", 600: "#1f7039", 700: "#195a2f", 800: "#154927", 900: "#0e3319" },
        // Deep green for institutional surfaces (hero, footer, headings)
        forest: { 800: "#0f2a1a", 900: "#0a1f13", 950: "#06140c" },
        ink: { DEFAULT: "#15201a", soft: "#3d4a42", muted: "#65726a" },
        paper: { DEFAULT: "#ffffff", warm: "#f7f8f5", line: "#e3e7e1" },
        warn: { bg: "#fff7e6", fg: "#7a4b00", line: "#f1d29a" },
        danger: { bg: "#fdecec", fg: "#8e1b1b", line: "#f0b9b9" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: { "display-xl": ["clamp(2.25rem, 4.4vw, 3.5rem)", { lineHeight: "1.04", letterSpacing: "-0.02em" }] },
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
