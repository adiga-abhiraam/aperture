/** @type {import('tailwindcss').Config} */
// Material-3 style tokens. Every color is a CSS variable (RGB triplet) defined
// in app/globals.css so light and dark themes swap without touching classes.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('--c-bg'),
        surface: {
          DEFAULT: v('--c-surface'),
          low: v('--c-surface-low'),
          container: v('--c-surface-container'),
          high: v('--c-surface-high'),
          highest: v('--c-surface-highest'),
        },
        outline: {
          DEFAULT: v('--c-outline'),
          variant: v('--c-outline-variant'),
        },
        on: {
          surface: v('--c-on-surface'),
          variant: v('--c-on-surface-variant'),
          muted: v('--c-on-surface-muted'),
        },
        primary: {
          DEFAULT: v('--c-primary'),
          hover: v('--c-primary-hover'),
          on: v('--c-on-primary'),
          container: v('--c-primary-container'),
          'on-container': v('--c-on-primary-container'),
        },
        success: { DEFAULT: v('--c-success'), container: v('--c-success-container') },
        warning: { DEFAULT: v('--c-warning'), container: v('--c-warning-container') },
        error: { DEFAULT: v('--c-error'), container: v('--c-error-container') },
      },
      fontFamily: {
        sans: [
          '"Google Sans"',
          'Roboto',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['"Roboto Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // Google elevation levels
        e1: '0 1px 2px 0 rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)',
        e2: '0 1px 2px 0 rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',
        e3: '0 4px 8px 3px rgba(60,64,67,.15), 0 1px 3px 0 rgba(60,64,67,.30)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn .2s ease-out both',
        'scale-in': 'scaleIn .15s ease-out both',
      },
    },
  },
  plugins: [],
};
