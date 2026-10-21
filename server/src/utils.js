export function nowMeta(basis, source) {
  return {
    basis,
    asOf: new Date().toISOString(),
    source,
  }
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export function toMonthLabel(dateLike) {
  const d = new Date(dateLike)
  return d.toLocaleString('en-MY', { month: 'short' })
}
