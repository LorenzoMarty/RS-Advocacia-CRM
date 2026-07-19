/**
 * Fundação de movimento & interatividade — app/motion
 * ===================================================
 * Primitivos compartilhados. Importe daqui:
 *   import { MotionPage, fadeUp, staggerContainer,
 *            staggerItem, pop, cardHover } from '../motion';
 *
 * Re-exporta também `motion` e `AnimatePresence` do framer-motion por
 * conveniência, para não acoplar páginas ao nome do pacote.
 *
 * API
 * ---
 * Componentes:
 *   <MotionPage className?>...</MotionPage>
 *       Envólucro de transição de página (fade + translateY). No shell já está
 *       dentro de <AnimatePresence mode="wait">, keyado por pathname.
 *
 * Variantes framer-motion (use em <motion.* variants={...}>):
 *   fadeUp           — { hidden, visible } fade + subida
 *   staggerContainer — escalona filhos (pareie com staggerItem)
 *   staggerItem      — item filho do container
 *   pop              — entrada com overshoot (badges/contadores)
 *
 * Estados de interação (spread em <motion.div {...cardHover}>):
 *   cardHover        — { whileHover, whileTap } para cards clicáveis
 *
 * Utilitários:
 *   prefersReducedMotion(): boolean
 *   DURATION { fast, base, slow } (segundos) | EASE_OUT
 *
 * Acessibilidade: toda variante/componente colapsa sob
 * prefers-reduced-motion (JS via prefersReducedMotion(); CSS via variables.css
 * e loading.css). Não criam focus traps; foco/teclado seguem o DOM normal.
 *
 * CSS de afford. (já no design system, sem import JS necessário):
 *   .card.is-clickable / .surface.is-clickable — hover lift + cursor:pointer
 *   .skeleton / .skeleton-stack                — shimmer (loading.css)
 */
export { motion, AnimatePresence } from 'framer-motion';

export { default as MotionPage } from './MotionPage';

export {
  DURATION,
  EASE_OUT,
  prefersReducedMotion,
  fadeUp,
  staggerContainer,
  staggerItem,
  pop,
  cardHover,
} from './presets';
