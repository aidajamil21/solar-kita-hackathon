/**
 * Plain-language explanations for the "i" buttons, in one place so the wording stays consistent.
 * Keep the numbers in line with src/data.ts, src/green.ts and src/plan.ts.
 */
import { GREEN } from './green'
import { PLAN, totalBack } from './plan'
import { EV, fmtHour } from './ev'

export const HELP = {
  /* ---- solar projects ---- */
  entryCost: (unit: string) =>
    `The price of one ${unit}. Pick as many as you like. Each ${unit} is your share of the project: Sime Darby Property owns and maintains the panels. What you pay comes back over 10 years in monthly credits, plus the project’s return.`,
  expectedReturn:
    'On top of getting your money back over 10 years, you earn this much a year on the part not yet returned, paid in monthly Energy Savings Credits. Capped at 3% a year and not guaranteed: cloudier months pay a little less.',
  moneyBack:
    'Every month from the month after you buy, 1/120 of what you paid comes back to you, so the full amount is returned over 10 years. The return is added on top.',
  rewardPoints: (unit: string) =>
    `Community Energy Points you earn once for every ${unit} you join. Spend them in Rewards on vouchers, EV charging credit and more.`,
  carbon:
    'Estimated CO₂ your share avoids each year, compared with taking the same electricity from the grid (0.585 kg CO₂e per kWh).',
  kwp:
    'kWp (kilowatt-peak) is how much power panels produce in full sun. In Malaysia, 1 kWp makes about 1,300 kWh a year. Your share is sized by what solar really costs to build (roughly RM 2.50–4 per watt).',
  blocks:
    'Each panel row is split into blocks (1a, 1b, 1c, 1d…), and each block can be picked on its own. Striped blocks belong to other residents; green ones are yours.',
  capacityToday: 'How much of the site’s maximum power it is producing right now. It changes with sunshine through the day.',
  homesPowered: 'Roughly how many homes the whole site’s yearly output could supply.',

  /* ---- money ---- */
  energyCredit:
    'Your share of the solar savings, applied as a discount on your TNB electricity bill on the 28th of every month.',
  portfolioValue:
    'What you’ve put in plus the extra you’ve earned so far. Part of what you put in has already come back to you as credits; the rest is still on its way. It’s an estimate, not a price you could sell your share for.',
  entryTotal: 'The total you’ve paid for your solar blocks.',
  nextCredit: 'When your next Energy Savings Credit is applied to your TNB bill (the 28th of each month).',
  creditAccount: 'The TNB electricity account your Energy Savings Credits are applied to.',

  /* ---- points & rewards ---- */
  pointsBalance: 'Points you can spend right now. Redeeming a reward takes points from this balance.',
  level:
    'Your level depends on lifetime points: everything you’ve ever earned, even points you’ve spent. Seedling from 0, Solar Supporter from 500, Solar Champion from 2,000, Net-Zero Advocate from 5,000.',
  redeem: 'Redeeming spends points from your balance and gives you a voucher code to show at the partner. It can’t be undone.',

  /* ---- go green ---- */
  greenDaily: `Walks and rides can earn up to ${GREEN.dailyCap} points a day. Trips after that are still saved and count towards your CO₂ and petrol savings.`,
  greenRate: `Points are whole numbers per trip: 1 for every ${GREEN.walk.kmPerPoint} km walked or ${GREEN.cycle.kmPerPoint} km cycled. Shorter trips earn no points but still count towards your impact.`,
  greenArea: `To earn points, at least ${Math.round(GREEN.minInsideShare * 100)}% of the trip must be within ${GREEN.areaRadiusKm} km of your home township, and the speed must look like walking or cycling.`,
  greenDemo: 'Replays a realistic loop around your township in a few seconds, for trying the feature without walking. Demo trips are marked “demo” in your history.',
  greenSavings: `Compared with driving the same distance in a petrol car: about ${GREEN.co2KgPerKm} kg CO₂ and ${GREEN.petrolLPerKm} L of petrol per km (RON95 at RM ${GREEN.petrolPrice.toFixed(2)}/L).`,

  /* ---- solar builder plan ---- */
  planComesBack: (amount: number) =>
    `Each RM ${amount.toLocaleString()} you pay is returned over 10 years: 1/${PLAN.months} of it every month, plus ${PLAN.ratePct}% a year on the part not yet returned. In total it brings back about RM ${totalBack(amount).toFixed(2)}.`,
  planFirstMonth: 'Your first credit arrives the month after your first payment. It grows every month as more of your payments start coming back.',
  planPoints: `1 point for every RM ${PLAN.rmPerPoint} you pay, plus ${PLAN.streakBonuses[0].points} bonus points after ${PLAN.streakBonuses[0].at} payments in a row and ${PLAN.yearlyBonus} every 12.`,
  planStillToCome: 'Money you’ve paid that hasn’t come back yet, plus the 3% extra still due on it. It keeps arriving monthly even if you stop the plan.',
  planExtra: 'The 3%-a-year extra you’ve received so far, on top of getting your own money back.',
  planReceived: 'Everything that has come back to you so far: your own money returned plus the 3% extra.',
  planStreak: 'Monthly payments in a row. Pausing resets the streak; streaks earn bonus points.',
  planPause: 'Pausing skips future payments until you resume. Payments already made keep coming back. Your streak resets.',
  planStop: 'Stopping ends future payments only. Everything you’ve already paid keeps coming back on schedule.',
  planAmount: 'The new amount applies from your next payment. Payments already made don’t change.',
  planSkip: 'Prototype only: makes a month pass so you can see the next payment, points and credits without waiting.',

  /* ---- EV charging ---- */
  evPrice: `One price all day: RM ${EV.pricePerKwh.toFixed(2)} for every kWh your car takes. You only pay for the energy actually delivered.`,
  evPeak: `The solar peak (${fmtHour(EV.peakStart)}–${fmtHour(EV.peakEnd)}) is when the station’s solar canopy produces the most. Charging then earns ${EV.peakPointsPerKwh} points per kWh, against 1 point per ${1 / EV.offPeakPointsPerKwh} kWh at other times.`,
  evPayAfter: 'Booking is free and holds a bay for you. When you finish charging, the app works out the energy used and you pay the bill then. Cancel any time before you start.',
  evEstimate: 'An estimate: cars draw less power as their battery fills. The real figures are worked out when you finish charging.',
  evBay: 'Each station has several charging bays. A free bay is assigned when you book, and stays yours for the whole booking.',

  /* ---- settings ---- */
  mapMode: '3D shows your township in full detail but uses more battery and graphics power. 2D is a lighter flat map with the same pins, filters and sites.',
  resetDemo: 'Puts your account back to the prototype’s starting data: holdings, points, alerts and history. Other residents aren’t affected.',
  night: 'Switch the map between daytime and night-time lighting.',
  energyFlow: 'Shows animated energy flowing from the solar sites to homes around them.',
  verifiedData: 'The Solar Analyst only answers from your recorded Solar Kita data, keeps forecasts separate from actual results, and can’t move money or change your records.',
} as const
