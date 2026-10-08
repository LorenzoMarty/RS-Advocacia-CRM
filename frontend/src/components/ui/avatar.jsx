import { cn } from "@/lib/utils"

// Só os 4 matizes de categoria (--cat-*), escolhidos de forma deterministica por id/nome.
const TONES = ["civel", "trabalhista", "empresarial", "tributario"]

function toneFor(seed) {
  let hash = 0
  for (const char of String(seed ?? "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return TONES[hash % TONES.length]
}

function initialsFor(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "?"
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function Avatar({ name, seed, size = 38, className, style, ...props }) {
  const tone = toneFor(seed ?? name)
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center rounded-sm font-extrabold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.37),
        background: `var(--cat-${tone})`,
        color: `var(--cat-${tone}-ink)`,
        ...style,
      }}
      {...props}
    >
      {initialsFor(name)}
    </span>
  )
}

export { Avatar }
