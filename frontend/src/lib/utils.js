import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Tamanhos de fonte custom (tailwind.config.js) — sem isto o twMerge os confunde com cores `text-*`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['page-title', 'card-title', 'card-title-sm', 'kpi', 'label', 'meta', 'meta-sm'] }],
    },
  },
})

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
