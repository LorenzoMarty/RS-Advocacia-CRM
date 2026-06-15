/**
 * Motion presets — framer-motion variants compartilhadas pelo app.
 *
 * Todas as variantes respeitam prefers-reduced-motion: quando o usuário pede
 * movimento reduzido, `prefersReducedMotion()` retorna true e as variantes
 * colapsam para transições instantâneas (sem translate/scale).
 *
 * Tokens de tempo/easing espelham os de variables.css (--motion*, --ease-*).
 */

export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.36,
};

// Espelha --ease-out / --ease-spring de variables.css.
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];

/** True quando o ambiente pede movimento reduzido (SSR-safe). */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const reduce = prefersReducedMotion();

/** Entrada com fade + leve subida. Use em seções/cards na carga da página. */
export const fadeUp = {
  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/** Contêiner que escalona a entrada dos filhos (use com staggerItem). */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: reduce
      ? {}
      : { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

/** Item filho de staggerContainer. */
export const staggerItem = {
  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/** Pop com leve overshoot — para badges, contadores, ícones de destaque. */
export const pop = {
  hidden: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: reduce
      ? { duration: DURATION.fast }
      : { duration: DURATION.slow, ease: EASE_SPRING },
  },
};

/**
 * Estados de hover/tap para cards clicáveis (whileHover / whileTap).
 * Espalhe em <motion.div {...cardHover}> ou use Pressable.
 */
export const cardHover = reduce
  ? {}
  : {
      whileHover: { y: -3, transition: { duration: DURATION.fast, ease: EASE_OUT } },
      whileTap: { scale: 0.985 },
    };

/** Variantes de página (enter/exit) usadas por MotionPage. */
export const pageVariants = {
  initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
  exit: reduce
    ? { opacity: 0, transition: { duration: DURATION.fast } }
    : { opacity: 0, y: -6, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};
