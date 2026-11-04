/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        unbounded: ["var(--font-unbounded)", "Unbounded", "sans-serif"],
        display: ["var(--font-unbounded)", "Unbounded", "sans-serif"],
      },
      borderRadius: {
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
        "3xl": "16px",
      },
      backdropBlur: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "16px",
        "3xl": "24px",
      },
      colors: {
        purple: {
          50: "#f4f5ff",
          100: "#e8eafd",
          200: "#d3d8fb",
          300: "#b6c0f7",
          400: "#919cf0",
          500: "#7380e6",
          600: "#5a66d1",
          700: "#4a54b0",
          800: "#3c458f",
          900: "#343b74",
          950: "#232848",
        },
      },
    },
  },
  plugins: [],
};
