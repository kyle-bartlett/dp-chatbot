/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Anker brand colors
        anker: {
          blue: '#00A0E9',
          dark: '#1a1a2e',
          light: '#f8f9fa',
          accent: '#00d4aa',
        }
      },
      borderRadius: {
        'chat': '1.25rem',
      }
    },
  },
  plugins: [],
}
