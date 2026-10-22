/**
 * Solar Builder Plan: a fixed monthly payment that supports a township solar farm.
 * Each payment is returned over 120 months, starting the month after it's paid:
 * 1/120 of it every month, plus 3% a year on the part not yet returned.
 * Same rules as server/src/plan.js (the server keeps the real records; this is for previews).
 */
export const PLAN = {
  months: 120,
  ratePct: 3,
  minAmount: 50,
  maxAmount: 10000,
  rmPerPoint: 5,
  streakBonuses: [{ at: 6, points: 50 }],
  yearlyBonus: 100,
  /** amounts offered in the app */
  presets: [100, 200, 300, 500, 1000],
} as const

const round2 = (n: number) => Math.round(n * 100) / 100

/** monthly credits for one payment, k = 1..120 months after it */
export function trancheCredits(amount: number) {
  const cap = round2(amount / PLAN.months)
  return Array.from({ length: PLAN.months }, (_, i) => {
    const k = i + 1
    const capital = k < PLAN.months ? cap : round2(amount - cap * (PLAN.months - 1))
    const interest = round2(((amount - cap * (k - 1)) * PLAN.ratePct) / 100 / 12)
    return { k, capital, interest }
  })
}

/** total that comes back for one payment over 10 years */
export const totalBack = (amount: number) => round2(trancheCredits(amount).reduce((a, c) => a + c.capital + c.interest, 0))

/** points for one monthly payment (before streak bonuses) */
export const pointsFor = (amount: number) => Math.floor(amount / PLAN.rmPerPoint)

/** points from streak bonuses over the first `months` payments */
export function streakPoints(months: number) {
  let pts = 0
  for (let n = 1; n <= months; n++) {
    pts += PLAN.streakBonuses.find((b) => b.at === n)?.points ?? 0
    if (n % 12 === 0) pts += PLAN.yearlyBonus
  }
  return pts
}

/**
 * If you pay `amount` every month for `paidMonths` months, where do you stand after `atMonth` months?
 * Payment j (0-based) is made in month j; its credits arrive in months j+1 ... j+120.
 */
export function projection(amount: number, paidMonths: number, atMonth = paidMonths) {
  const credits = trancheCredits(amount)
  let paid = 0, received = 0, monthlyNow = 0
  for (let j = 0; j < Math.min(paidMonths, atMonth); j++) {
    paid += amount
    const elapsed = Math.min(PLAN.months, atMonth - j)
    for (let k = 1; k <= elapsed; k++) received += credits[k - 1].capital + credits[k - 1].interest
    const kNow = atMonth - j
    if (kNow >= 1 && kNow <= PLAN.months) monthlyNow += credits[kNow - 1].capital + credits[kNow - 1].interest
  }
  return {
    paid: round2(paid),
    received: round2(received),
    /** credit arriving in month `atMonth` */
    monthlyNow: round2(monthlyNow),
    stillToCome: round2(Math.min(paidMonths, atMonth) * totalBack(amount) - received),
    points: Math.min(paidMonths, atMonth) * pointsFor(amount) + streakPoints(Math.min(paidMonths, atMonth)),
  }
}
