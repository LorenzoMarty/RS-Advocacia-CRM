import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
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
        // Tokens do design system (CSS vars diretas, sem alpha).
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        subtle: 'var(--subtle)',
      },
      // Escala de tipo do redesign em rem (1rem = --font-base * escalas do usuário).
      fontSize: {
        'page-title': ['2.43rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'card-title': ['1.43rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'card-title-sm': ['1.29rem', { lineHeight: '1.2', fontWeight: '700' }],
        kpi: ['3.43rem', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
        label: ['.79rem', { lineHeight: '1.2', letterSpacing: '.07em', fontWeight: '700' }],
        meta: ['.93rem', { lineHeight: '1.3', fontWeight: '500' }],
        'meta-sm': ['.86rem', { lineHeight: '1.3', fontWeight: '500' }],
      },
      boxShadow: { pop: 'var(--shadow-pop)', hover: 'var(--shadow-hover)' },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['Urbanist', 'system-ui', 'sans-serif'],
        // Alias temporário: font-serif ainda existe em páginas não migradas; renderiza em Urbanist. Remover na fase 7.
        serif: ['Urbanist', 'system-ui', 'sans-serif'],
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
