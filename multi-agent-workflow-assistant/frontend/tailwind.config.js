/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Control-room palette: a dark instrument panel you watch agents run on.
        ink: "#0B1220", // base background
        panel: "#141E33", // raised surfaces
        "panel-2": "#1B2740", // hover / nested surfaces
        hairline: "#25324D", // borders, rails
        muted: "#7C8AA5", // secondary text
        soft: "#A9B6CE", // body text on dark
        azure: "#4C8DFF", // primary accent (the active signal)
        working: "#F4B740", // amber — an agent is running
        approve: "#3DD68C", // emerald — critic approved
        revise: "#FF7597", // rose — critic sent it back
        paper: "#F7F5EF", // the printed report surface
        "paper-ink": "#1A1A17", // text on paper
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        report: ['"Newsreader"', "Georgia", "serif"],
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
        "flow-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s ease-in-out infinite",
        "flow-down": "flow-down 1.4s ease-in-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        blink: "blink 1s step-end infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
