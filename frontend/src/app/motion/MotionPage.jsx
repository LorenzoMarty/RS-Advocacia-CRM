/**
 * MotionPage — envólucro de transição de página (enter/exit).
 *
 * Usado no shell (ProtectedLayout) dentro de <AnimatePresence>, com `key`
 * setada para location.pathname. Anima fade + leve translateY.
 * Respeita prefers-reduced-motion via pageVariants.
 *
 * Props extras (className, etc.) são repassadas ao motion.div.
 */
import { motion as Motion } from 'framer-motion';

import { pageVariants } from './presets';

export default function MotionPage({ children, className, ...rest }) {
  return (
    <Motion.div
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ minWidth: 0 }}
      {...rest}
    >
      {children}
    </Motion.div>
  );
}
