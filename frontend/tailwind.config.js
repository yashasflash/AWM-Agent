/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        municipal: {
          bg: "#F5F8F5",
          forest: "#103D35",
          forestHover: "#0C2E28",
          emerald: "#16836A",
          emeraldHover: "#126B57",
          emeraldLight: "#E8F5F1",
          white: "#FFFFFF",
          border: "#DCE8E2",
          borderDark: "#B8D1C4",
          coral: "#FF6848",
          coralHover: "#E65334",
          coralLight: "#FFF0ED",
          highPriority: "#E76F51",
          highPriorityLight: "#FDEEEB",
          mediumPriority: "#F59E0B",
          mediumPriorityLight: "#FEF7E6",
          lowPriority: "#16836A",
          lowPriorityLight: "#E8F5F1",
          muted: "#5B7065",
          surface: "#FBFDFB",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(16, 61, 53, 0.05), 0 1px 2px -1px rgba(16, 61, 53, 0.05)",
        card: "0 4px 6px -1px rgba(16, 61, 53, 0.05), 0 2px 4px -2px rgba(16, 61, 53, 0.05)",
        dropdown: "0 10px 15px -3px rgba(16, 61, 53, 0.08), 0 4px 6px -4px rgba(16, 61, 53, 0.05)",
      },
    },
  },
  plugins: [],
}
