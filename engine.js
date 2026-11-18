// Copied unchanged from skinsella/ui, zerve/web/engine.js, commit 9fae9f3. Do not edit here. Copy again from the book repository and run tests/check_engine.mjs.
// United Ireland fiscal model, version 3.14. JavaScript port of zerve/guided/02 to 06.
// Checked against the Python notebook by tests/test_guided_model.py. Constant 2023 euros, billions.
const FX_2023 = 0.86979;
const UK_2019_TO_2023_EUR = ((90.7406+92.0952+92.7667+92.7151)/(76.6540+77.4590+77.9213+78.3396))/FX_2023;
const UK_FY2022_TO_2023_EUR = ((90.7406+92.0952+92.7667+92.7151)/(85.7671+87.1467+89.3502+90.7406))/FX_2023;
const GNI_STAR = 290.9, NORTH_GNI = 63.265/FX_2023, PUBLISHED = 17.058;
const BASE_REVENUE = 21.773*UK_FY2022_TO_2023_EUR, BASE_SPENDING = BASE_REVENUE + PUBLISHED;
const DEFENCE_NET = 1.640, OTHER_NONID = 0.692, TAX_ADD = 1.840, PENSIONS = 6.864, DEBT_INT = 4.238;
const PENSION_TOPUP_FALL = 1.3*UK_FY2022_TO_2023_EUR;
const GROSS_PAY_FULL = 4.306*UK_2019_TO_2023_EUR, GROSS_WELFARE_FULL = 4.809*UK_2019_TO_2023_EUR;
const SOURCE_PAY_BASE = 6.797*UK_2019_TO_2023_EUR, SOURCE_WELFARE_BASE = 9.615*UK_2019_TO_2023_EUR;
const EU_CONTRIBUTION_RATE = 100*3.683/390.996, EU_RECEIPTS = 0.293527*UK_FY2022_TO_2023_EUR;
const DEBT_RATIOS = {2027: 56.4, 2028: 56.3, 2029: 56.2, 2030: 54.9};
const TRANSITORY_CT_PCT = {2027: 6.0, 2028: 5.7, 2029: 5.2, 2030: 5.9};
const POP = {"baseYear":2024,"ni":{"2024":{"total":1927855,"over65":349194},"2025":{"total":1931301,"over65":357695},"2026":{"total":1934180,"over65":366755},"2027":{"total":1936545,"over65":375613},"2028":{"total":1938324,"over65":384768},"2029":{"total":1939582,"over65":394243},"2030":{"total":1940347,"over65":403900},"2031":{"total":1940634,"over65":413012},"2032":{"total":1940471,"over65":421637},"2033":{"total":1939927,"over65":430027},"2034":{"total":1939054,"over65":437794},"2035":{"total":1937878,"over65":444859},"2036":{"total":1936429,"over65":451740},"2037":{"total":1934818,"over65":457615},"2038":{"total":1933097,"over65":463004},"2039":{"total":1931313,"over65":467365},"2040":{"total":1929481,"over65":470627},"2041":{"total":1927624,"over65":473832},"2042":{"total":1925677,"over65":476453},"2043":{"total":1923707,"over65":479525},"2044":{"total":1921673,"over65":483750},"2045":{"total":1919518,"over65":488871},"2046":{"total":1917172,"over65":493111},"2047":{"total":1914584,"over65":497114},"2048":{"total":1911750,"over65":501159},"2049":{"total":1908622,"over65":505183},"2050":{"total":1905145,"over65":509615}},"roi":{"M1":{"2022":5184000,"2027":5581800,"2032":5872400,"2037":6142300,"2042":6396300,"2047":6633600,"2052":6839200,"2057":7005400},"M2":{"2022":5184000,"2027":5530500,"2032":5761000,"2037":5946900,"2042":6113200,"2047":6259900,"2052":6373200,"2057":6446300},"M3":{"2022":5184000,"2027":5489700,"2032":5645500,"2037":5721200,"2042":5771500,"2047":5797300,"2052":5786300,"2057":5733700}}};
const DOYLE_PAY_TAX_OFFSET = 100*(1 - 15*0.152/(0.48*SOURCE_PAY_BASE));
const RATE_WELFARE_GROSS = .381 + .130*UK_2019_TO_2023_EUR, RATE_WELFARE_NET = .343 + .130*UK_2019_TO_2023_EUR;
const HARMONISATION_CASES = {
  upper: {payGapPct: null, payTaxOffset: 0, welfareGapPct: null, welfareTaxOffset: 0},
  middle: {payGapPct: 48, payTaxOffset: DOYLE_PAY_TAX_OFFSET, welfareGapPct: null, welfareTaxOffset: 0},
  rateBased: {payGapPct: 48, payTaxOffset: DOYLE_PAY_TAX_OFFSET, welfareGapPct: 100*RATE_WELFARE_GROSS/SOURCE_WELFARE_BASE,
              welfareTaxOffset: 100*(1 - RATE_WELFARE_NET/RATE_WELFARE_GROSS)},
  lower: {payGapPct: 48, payTaxOffset: DOYLE_PAY_TAX_OFFSET, welfareGapPct: 0, welfareTaxOffset: 0},
};
const CASE_LABELS = {upper: 'Upper', middle: 'Middle', rateBased: 'Rate-based', lower: 'Lower'};
const FORMS = {
  unitary: {name: 'Unitary', reratingScope: 100, reratingYears: 1, investment: 0.5, duplication: 0},
  federal: {name: 'Federal', reratingScope: 100, reratingYears: 20, investment: 0.5, duplication: 0.5},
  glide: {name: 'Managed Integration', reratingScope: 100, reratingYears: 15, investment: 1.5, duplication: 0.25},
  worst: {name: 'Higher Cost', reratingScope: 100, reratingYears: 1, investment: 0, duplication: 1},
};
const DEFAULTS = {southGrowth: 2, baselineGrowth: 2, realInterest: 2, niPayGrowth: 1, niBenefitGrowth: 1, pensionRateGrowth: 1,
  southPayGrowth: 1, southBenefitGrowth: 1, nonPensionWelfareBase: SOURCE_WELFARE_BASE - PENSIONS, populationVariant: 'M2',
  inheritedInterestYears: 25, taxShare: 35, baselineSpendingGrowth: 1, defenceSavingShare: 100, centralSavingShare: 100,
  taxAdjustmentShare: 100, pensionTransferYears: 40, pensionTopUpFall: PENSION_TOPUP_FALL, euContributionRate: EU_CONTRIBUTION_RATE,
  euReceipts: EU_RECEIPTS, publicPayBase: Math.round(SOURCE_PAY_BASE*1000)/1000, harmonisationCase: 'upper',
  riskPremiumThreshold: 80, riskPremiumSlope: 0, behaviourReceiptLoss: 0, migrationPct: 0, ctLossShare: 0};

const paperSettings = c => ({...DEFAULTS, harmonisationCase: c});
function policy(form, gNI = 2, ukKeeps = true) {
  const f = FORMS[form];
  return {reratingScope: f.reratingScope, reratingYears: f.reratingYears, investment: f.investment, duplication: f.duplication,
          gNI, pensionsUK: ukKeeps, debtUK: ukKeeps, counterfactual: false, shared: false};
}
const calendar = (s, t) => ({c: t, popYear: 2024 + t, debtYear: Math.min(2030, 2026 + t),
  gni: GNI_STAR*Math.pow(1 + s.southGrowth/100, t), niRef: Math.pow(1 + s.baselineGrowth/100, t)});
function populationAt(year, variant = 'M2') {
  const knots = POP.roi[variant], ys = Object.keys(knots).map(Number).sort((a, b) => a - b);
  const y = Math.max(ys[0], Math.min(ys[ys.length - 1], year));
  const l = Math.max(...ys.filter(k => k <= y)), r = Math.min(...ys.filter(k => k >= y));
  const roi = l === r ? knots[l] : knots[l] + (knots[r] - knots[l])*(y - l)/(r - l);
  const ni = POP.ni[String(Math.max(2024, Math.min(2050, year)))];
  return {ni: ni.total, niOver65: ni.over65, roi};
}
function components(p, s, t) {
  const cal = calendar(s, t), k = cal.c, idx = g => Math.pow(1 + g/100, k);
  const start = populationAt(2024, s.populationVariant), pop = populationAt(cal.popYear, s.populationVariant);
  const vol = pop.ni/start.ni, pvol = pop.niOver65/start.niOver65;
  const mig = p.counterfactual ? 1 : 1 + s.migrationPct/100*Math.min(t/25, 1);
  const payBase = s.publicPayBase, benefitBase = s.nonPensionWelfareBase;
  const purchasesBase = BASE_SPENDING - payBase - benefitBase - PENSIONS - DEBT_INT - DEFENCE_NET - OTHER_NONID;
  const rel = (p.counterfactual && !p.shared) ? 1 : (1 + p.gNI/100)/(1 + s.baselineGrowth/100);
  const pay = payBase*idx(s.niPayGrowth)*Math.pow(rel, t)*vol;
  const benefits = benefitBase*idx(s.niBenefitGrowth)*vol*mig;
  const pensionBase = PENSIONS - s.pensionTopUpFall;
  const pensionEnv = pensionBase*idx(s.pensionRateGrowth)*pvol;
  const pf = idx(s.baselineSpendingGrowth)*vol;
  const purchases = purchasesBase*pf;
  const defence = DEFENCE_NET*pf*(1 - s.defenceSavingShare/100);
  const central = OTHER_NONID*pf*(1 - s.centralSavingShare/100);
  const allocInt = t <= s.inheritedInterestYears ? DEBT_INT : 0;
  const pensionCost = pensionEnv*(p.pensionsUK ? Math.min(t/s.pensionTransferYears, 1) : 1);
  const spending = pay + benefits + pensionCost + purchases + defence + central + (p.debtUK ? 0 : allocInt);
  const revenue = BASE_REVENUE*cal.niRef;
  const extraReceipts = TAX_ADD*s.taxAdjustmentShare/100*cal.niRef;
  const phase = p.counterfactual ? 0 : Math.min(t/p.reratingYears, 1)*p.reratingScope/100;
  const h = HARMONISATION_CASES[s.harmonisationCase];
  const payGap = h.payGapPct === null ? GROSS_PAY_FULL : h.payGapPct/100*SOURCE_PAY_BASE;
  const welfGap = h.welfareGapPct === null ? GROSS_WELFARE_FULL : h.welfareGapPct/100*SOURCE_WELFARE_BASE;
  const grossPay = payGap === 0 ? 0 : phase*Math.max(0, (payBase + payGap)*idx(s.southPayGrowth)*vol - pay);
  const welfareBase = benefitBase + pensionBase, w = pensionBase/welfareBase;
  const welfTarget = (welfareBase + welfGap)*idx(s.southBenefitGrowth)*((1 - w)*vol*mig + w*pvol);
  const grossWelfare = welfGap === 0 ? 0 : phase*Math.max(0, welfTarget - (benefits + pensionEnv));
  const harmonisation = grossPay*(1 - h.payTaxOffset/100) + grossWelfare*(1 - h.welfareTaxOffset/100);
  return {spending, revenue, extraReceipts, harmonisation, grossWelfare, roiPopulation: pop.roi};
}
function simulate(p, s, horizon = 25) {
  const neutral = p.counterfactual && !p.shared;
  let debt = 0, cum = 0, ctDebt = 0, prevPct = null; const rows = [];
  for (let t = 1; t <= horizon; t++) {
    const cal = calendar(s, t), baseOut = NORTH_GNI*cal.niRef;
    const out = neutral ? baseOut : baseOut*Math.pow((1 + p.gNI/100)/(1 + s.baselineGrowth/100), t);
    const c = components(p, s, t);
    const gap = c.spending - c.revenue - c.extraReceipts;
    const invest = (neutral || t > 10) ? 0 : p.investment;
    const growthTax = s.taxShare/100*(out - baseOut);
    const euC = p.counterfactual ? 0 : s.euContributionRate/100*out;
    const euR = p.counterfactual ? 0 : s.euReceipts;
    const behaviour = p.counterfactual ? 0 : s.behaviourReceiptLoss/100*c.grossWelfare;
    const primary = p.counterfactual ? (p.shared ? invest : 0)
      : gap + c.harmonisation + invest + p.duplication - growthTax + euC - euR + behaviour;
    const rate = s.realInterest + (prevPct === null ? 0 : s.riskPremiumSlope/100*Math.max(0, prevPct - s.riskPremiumThreshold));
    const interest = debt*rate/100, cost = primary + interest;
    debt = Math.max(0, debt + cost); cum += cost;
    ctDebt = ctDebt*(1 + s.realInterest/100) + s.ctLossShare/100*TRANSITORY_CT_PCT[cal.debtYear]/100*cal.gni;
    const income = neutral ? cal.gni : cal.gni + out;
    prevPct = 100*(DEBT_RATIOS[cal.debtYear]/100*cal.gni + ctDebt + debt)/income;
    rows.push({year: t, cost, primary, interest, rate, gap, harmonisation: c.harmonisation, investment: invest,
               administration: p.counterfactual ? 0 : p.duplication, growthTax, euContribution: euC, euReceipts: euR, behaviour, income, republicGni: cal.gni, niOutput: out, ctDebt, borrowing: debt, cumulative: cum, totalDebtPct: prevPct,
               costPctGni: 100*cost/cal.gni, burdenLimit: 0.02*cal.gni, costPerResident: cost*1e9/c.roiPopulation});
  }
  return rows;
}
const checks = (rows, ceiling = 80, burden = 2, fallingFrom = 20) => ({
  debt: rows.every(x => x.totalDebtPct < ceiling),
  burden: rows.every(x => x.costPctGni <= burden),
  falling: rows.filter(x => x.year >= fallingFrom).every(x => x.cost < rows[x.year - 2].cost)});
const repaid = rows => rows[rows.length - 1].cumulative <= 0;
function growthNeeded(p, s, test, horizon = 25) {
  const ok = g => test(simulate({...p, gNI: g}, s, horizon));
  if (ok(0)) return 0;
  let lo = 0, hi = null, g = .25;
  while (g <= 7) { if (ok(g)) { hi = g; break; } lo = g; g += .25; }
  if (hi === null) return null;
  for (let i = 0; i < 32; i++) { const m = (lo + hi)/2; if (ok(m)) hi = m; else lo = m; }
  return Math.ceil(hi*10 - 1e-8)/10;
}
