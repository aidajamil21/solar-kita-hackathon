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

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** monthly sunshine factor (0 = Jan); must match src/data.ts and seed.sql */
export const SUNSHINE = [0.92, 1.02, 1.08, 1.06, 1.0, 0.97, 1.01, 0.99, 0.95, 0.9, 0.86, 0.88]

export function toMonthLabel(dateLike) {
  return MONTHS[new Date(dateLike).getUTCMonth()]
}

/** an error that carries the HTTP status to answer with */
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** 'RM 1,449.26' (dp = 2) or 'RM 9,000' (dp = 0) */
export const rm = (n, dp = 2) =>
  'RM ' + Number(n).toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** today's date in Malaysia as YYYY-MM-DD */
export const todayKL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())

/** first day of the month (UTC) as YYYY-MM-DD */
export const monthStart = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`

/** list of month starts (UTC Dates) from `from` up to and including the current month */
export function monthsUntilNow(from) {
  const out = []
  const now = new Date()
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const d = new Date(from)
  for (let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); t <= end;) {
    out.push(new Date(t))
    const m = new Date(t)
    t = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)
  }
  return out
}

/** credit due date for a month: the 28th, 10:00 UTC (same as seed.sql) */
export const dueDate = (month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 28, 10))

/** purchases are returned over this many months */
export const MONTHS_BACK = 120

/**
 * Credit k (1..120) for a block purchase of `price`: 1/120 of the price back, plus `rate`
 * (a fraction, e.g. 0.025) a year on the part not yet returned, scaled by the month's sunshine.
 * Same formula as src/store.tsx and seed.sql.
 */
export function blockCredit(price, rate, k, month) {
  // whole sen and integer maths so it rounds exactly like Postgres numeric (half up)
  const divRound = (num, den) => Math.floor((2 * num + den) / (2 * den))
  const P = Math.round(Number(price) * 100)
  const cap = divRound(P, MONTHS_BACK)
  const capital = k < MONTHS_BACK ? cap : P - cap * (MONTHS_BACK - 1)
  const rateMicro = Math.round(Number(rate) * 1e6)
  const sun = Math.round(SUNSHINE[new Date(month).getUTCMonth()] * 100)
  const interest = divRound((P - cap * (k - 1)) * rateMicro * sun, 1e6 * 100 * 12)
  return { capital: capital / 100, interest: interest / 100, amount: (capital + interest) / 100 }
}
