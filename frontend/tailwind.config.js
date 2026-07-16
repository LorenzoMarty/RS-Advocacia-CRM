import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // O CSS legado (styles/**) já define reset/base próprios para todas as telas
  // fora do piloto Shadcn — o preflight do Tailwind zeraria .btn/.surface/.field etc.
  corePlugins: {
    preflight: false,
  },
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        border: 'hsl(var(--tw-border) / <alpha-value>)',
        input: 'hsl(var(--tw-input) / <alpha-value>)',
        ring: 'hsl(var(--tw-ring))',
        background: 'hsl(var(--tw-background))',
        foreground: 'hsl(var(--tw-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--tw-primary))',
          foreground: 'hsl(var(--tw-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--tw-secondary))',
          foreground: 'hsl(var(--tw-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--tw-destructive))',
          foreground: 'hsl(var(--tw-destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--tw-muted))',
          foreground: 'hsl(var(--tw-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--tw-accent))',
          foreground: 'hsl(var(--tw-accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--tw-card))',
          foreground: 'hsl(var(--tw-card-foreground))',
        },
        success: 'hsl(var(--tw-success))',
        warn: 'hsl(var(--tw-warn))',
      },
      borderRadius: {
        lg: 'var(--tw-radius)',
        md: 'calc(var(--tw-radius) - 2px)',
        sm: 'calc(var(--tw-radius) - 4px)',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['"Inter Variable"', '"Inter"', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
