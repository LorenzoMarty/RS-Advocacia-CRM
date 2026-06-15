/**
 * Pressable — feedback de press/tap (escala) para elementos clicáveis:
 * cards, linhas de tabela, botões custom.
 *
 * Por padrão renderiza um <motion.div>; passe `as` para trocar o elemento
 * (ex.: as={motion.button}, as={motion.a}). Respeita prefers-reduced-motion
 * (desliga o scale). Todas as props extras (onClick, className, role...) são
 * repassadas.
 *
 * Exemplo:
 *   <Pressable className="card is-clickable" onClick={...}>...</Pressable>
 */
import { motion as Motion } from 'framer-motion';

import { DURATION, EASE_OUT, prefersReducedMotion } from './presets';

const reduce = prefersReducedMotion();

export default function Pressable({ as, lift = true, children, ...rest }) {
  const Component = as || Motion.div;

  const interactions = reduce
    ? {}
    : {
        whileHover: lift
          ? { y: -2, transition: { duration: DURATION.fast, ease: EASE_OUT } }
          : undefined,
        whileTap: { scale: 0.97 },
      };

  return (
    <Component {...interactions} {...rest}>
      {children}
    </Component>
  );
}
