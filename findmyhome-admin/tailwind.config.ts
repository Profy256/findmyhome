import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body:    ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink:    { DEFAULT: '#1c1c1a', 2: '#2d2d2a' },
        stone:  '#6b6b65',
        dust:   '#a8a8a0',
        sand:   '#e8e4dc',
        cream:  '#f5f2ec',
        paper:  '#faf8f4',
        gold:   { DEFAULT: '#b8965a', 2: '#cda96e', pale: '#f7f0e6' },
        forest: { DEFAULT: '#2d4a3e', 2: '#3a6b55' },
        wa:     '#25D366',
      },
      boxShadow: {
        card:  '0 2px 16px rgba(28,28,26,.07)',
        modal: '0 8px 48px rgba(28,28,26,.14)',
        gold:  '0 4px 24px rgba(184,150,90,.25)',
      },
    },
  },
  plugins: [],
};
export default config;
