export function prefersReducedMotion() {
  if (import.meta.server || typeof matchMedia === 'undefined') return false
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}
