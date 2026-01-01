/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./popup.html",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: 'rgba(255, 255, 255, 0.85)',
          border: 'rgba(255, 255, 255, 0.3)',
        },
        accent: {
          primary: '#3b82f6',
          hover: '#2563eb',
          selected: '#1d4ed8',
        },
        measure: {
          line: '#f97316',
          text: '#ea580c',
        }
      },
      backdropBlur: {
        glass: '12px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
        panel: '0 4px 24px rgba(0, 0, 0, 0.15)',
      }
    },
  },
  plugins: [],
}
