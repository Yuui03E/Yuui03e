/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        border: "var(--border)",
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        yuui: {
          bg: "var(--background)",
          surface: "var(--surface)",
          panel: "var(--surface-elevated)",
          border: "var(--border)",
          text: "var(--foreground)",
          muted: "var(--muted-foreground)",
          accent: "var(--accent)",
          accent2: "#7c5cff",
          accent3: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(255,95,162,0.45)",
        glow2: "0 0 60px -15px rgba(124,92,255,0.5)",
        card: "0 20px 60px -20px rgba(0,0,0,0.8)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        pulseGlow: "pulseGlow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
