/**
 * riskModel.js — Hook-Up Game STI-risk engine
 * -----------------------------------------------------------------------------
 * Educational model. Estimates the probability that a student contracts an STI
 * over one year given their partner choices, then (optionally) rolls a single
 * outcome. All figures are EDUCATIONAL ESTIMATES calibrated to public-health
 * literature (CDC, NHANES, per-partnership transmission studies). NOT medical
 * advice. See the Methodology appendix for sources and caveats.
 *
 * Framework-agnostic: works as an ES module or can be loaded directly in a
 * browser (attaches to window.RiskModel if `module` is undefined).
 * -----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// PARAMETERS  (see Tables 1–3 in the spec)
// ---------------------------------------------------------------------------

/**
 * Per-STI data.
 *  - prevalence:   chance a random STRANGER (unscreened young adult) carries it
 *  - transmission: per-partnership transmission TO the student (condomless,
 *                  partner infected), keyed by anatomy pairing:
 *      receptive = student vulva + partner penis
 *      insertive = student penis + partner vulva
 *      pp        = student penis + partner penis (50/50 blended anal role)
 *      vv        = student vulva + partner vulva
 * Condom effect is applied globally via CONDOM_FACTOR (see below).
 */
const STI_DATA = {
  hpv:            { label: "HPV",             prevalence: 0.40,  transmission: { receptive: 0.55, insertive: 0.45, pp: 0.50, vv: 0.30   } },
  herpes:         { label: "Herpes (HSV-2)",  prevalence: 0.10,  transmission: { receptive: 0.15, insertive: 0.08, pp: 0.12, vv: 0.08   } },
  chlamydia:      { label: "Chlamydia",       prevalence: 0.04,  transmission: { receptive: 0.35, insertive: 0.10, pp: 0.30, vv: 0.02   } },
  trichomoniasis: { label: "Trichomoniasis",  prevalence: 0.02,  transmission: { receptive: 0.40, insertive: 0.10, pp: 0.05, vv: 0.10   } },
  gonorrhea:      { label: "Gonorrhea",       prevalence: 0.007, transmission: { receptive: 0.50, insertive: 0.20, pp: 0.45, vv: 0.02   } },
  hiv:            { label: "HIV",             prevalence: 0.003, transmission: { receptive: 0.02, insertive: 0.007, pp: 0.08, vv: 0.0005 } },
  syphilis:       { label: "Syphilis",        prevalence: 0.002, transmission: { receptive: 0.30, insertive: 0.30, pp: 0.40, vv: 0.10   } },
};

/**
 * Condom effect (applied per-STI when the global condom toggle is ON).
 *
 * Most STIs here are fluid-borne — correct/consistent condom use cuts
 * transmission ~98% (factor 0.02). HPV and herpes spread from skin a condom
 * doesn't cover, so they're held at ~40% protection (factor 0.60). That's why
 * condoms slash most STIs but leave HPV/herpes stubbornly high.
 * (Syphilis is also partly skin-contact in reality, but it's grouped with the
 * 98% set here for simplicity since its prevalence is tiny.)
 */
const CONDOM_FACTOR = 0.02;            // fluid-borne STIs
const CONDOM_FACTOR_SKIN = 0.60;       // skin-contact STIs (HPV, herpes)
const SKIN_CONTACT_STIS = new Set(["hpv", "herpes"]);

/** Order used for display / deterministic iteration. */
const STI_KEYS = ["hpv", "herpes", "chlamydia", "trichomoniasis", "gonorrhea", "hiv", "syphilis"];

/** Partner-tier prevalence multipliers (Table 3). */
const TIER_MULTIPLIER = {
  stranger:     1.00,
  acquaintance: 0.60,
  friend:       0.30,
  partner:      0.12, // boyfriend/girlfriend/spouse
};

const TIER_KEYS = ["partner", "friend", "acquaintance", "stranger"];

/**
 * HPV-vaccine effect. Applied to HPV transmission only when the student reports
 * being vaccinated. The vaccine (Gardasil 9) prevents ~90% of infections with
 * the high-risk, cancer-causing HPV types — the strains that actually matter
 * for health outcomes — so we model a 90% reduction in HPV acquisition.
 */
const HPV_VACCINE_FACTOR = 0.10;

/** UI constraints. */
const MIN_PARTNERS = 1;
const MAX_PARTNERS = 10; // total across all tiers

// ---------------------------------------------------------------------------
// CORE HELPERS
// ---------------------------------------------------------------------------

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Resolve the transmission value for one STI given the student's anatomy and a
 * single partner's anatomy.
 *   studentAnatomy: "penis" | "vulva"
 *   partnerAnatomy: "penis" | "vulva" | "both"
 * For a bi/pan student ("both"), we use the HIGHER-risk pairing (per design).
 */
function transmissionFor(stiKey, studentAnatomy, partnerAnatomy) {
  const t = STI_DATA[stiKey].transmission;

  if (partnerAnatomy === "both") {
    return Math.max(
      transmissionFor(stiKey, studentAnatomy, "penis"),
      transmissionFor(stiKey, studentAnatomy, "vulva")
    );
  }

  if (studentAnatomy === "vulva" && partnerAnatomy === "penis") return t.receptive;
  if (studentAnatomy === "penis" && partnerAnatomy === "vulva") return t.insertive;
  if (studentAnatomy === "penis" && partnerAnatomy === "penis") return t.pp;
  if (studentAnatomy === "vulva" && partnerAnatomy === "vulva") return t.vv;

  throw new Error(`Invalid anatomy pairing: ${studentAnatomy} / ${partnerAnatomy}`);
}

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------

function normalizeInput(input) {
  const studentAnatomy = input.studentAnatomy;
  const partnerAnatomy = input.partnerAnatomy;
  const condoms = !!input.condoms;
  const hpvVaccinated = !!input.hpvVaccinated;

  if (studentAnatomy !== "penis" && studentAnatomy !== "vulva")
    throw new Error('studentAnatomy must be "penis" or "vulva"');
  if (!["penis", "vulva", "both"].includes(partnerAnatomy))
    throw new Error('partnerAnatomy must be "penis", "vulva", or "both"');

  // Accept either { partners: {tier: n} } or a single tier + count shorthand.
  const partners = {};
  let total = 0;
  for (const tier of TIER_KEYS) {
    const n = Math.max(0, Math.floor((input.partners && input.partners[tier]) || 0));
    partners[tier] = n;
    total += n;
  }

  if (total < MIN_PARTNERS)
    throw new Error(`Need at least ${MIN_PARTNERS} partner.`);
  if (total > MAX_PARTNERS)
    throw new Error(`Total partners capped at ${MAX_PARTNERS} (got ${total}).`);

  return { studentAnatomy, partnerAnatomy, condoms, hpvVaccinated, partners, totalPartners: total };
}

// ---------------------------------------------------------------------------
// MAIN CALCULATION
// ---------------------------------------------------------------------------

/**
 * Compute STI probabilities for a scenario.
 * @returns {{
 *   pAny: number,                       // P(at least one STI this year)
 *   perSTI: Array<{key,label,pGet,weight}>, // marginal P(get s) + display weight
 *   input: object                       // normalized input echo
 * }}
 */
function calculateRisk(rawInput) {
  const input = normalizeInput(rawInput);
  const { studentAnatomy, partnerAnatomy, condoms, hpvVaccinated, partners } = input;

  const perSTI = [];
  let pNoneProduct = 1; // Π over STIs of P(no s)  → 1 − this = P(any)

  for (const key of STI_KEYS) {
    const sti = STI_DATA[key];
    const condomFactor = condoms
      ? (SKIN_CONTACT_STIS.has(key) ? CONDOM_FACTOR_SKIN : CONDOM_FACTOR)
      : 1;
    const vaccineFactor = key === "hpv" && hpvVaccinated ? HPV_VACCINE_FACTOR : 1;
    const transmission = transmissionFor(key, studentAnatomy, partnerAnatomy) * vaccineFactor;

    // Probability the student AVOIDS this STI across all partners.
    let pNoS = 1;
    for (const tier of TIER_KEYS) {
      const n = partners[tier];
      if (n === 0) continue;
      const effPrevalence = sti.prevalence * TIER_MULTIPLIER[tier];
      const rPerPartner = clamp01(effPrevalence * transmission * condomFactor);
      pNoS *= Math.pow(1 - rPerPartner, n);
    }

    const pGet = 1 - pNoS;
    perSTI.push({ key, label: sti.label, pGet });
    pNoneProduct *= pNoS;
  }

  const pAny = 1 - pNoneProduct;

  // Display weights for "which STI" pick (normalized marginal contributions).
  const sumGet = perSTI.reduce((acc, s) => acc + s.pGet, 0) || 1;
  for (const s of perSTI) s.weight = s.pGet / sumGet;

  // Sort high→low for nicer display.
  perSTI.sort((a, b) => b.pGet - a.pGet);

  return { pAny, perSTI, input };
}

// ---------------------------------------------------------------------------
// OUTCOME ROLL  ("show the odds, then roll the dice")
// ---------------------------------------------------------------------------

/**
 * Roll an outcome from a calculateRisk() result. Each STI is rolled
 * INDEPENDENTLY against its own probability, so the student can contract
 * zero, one, or several STIs in a year. Results stay in descending-probability
 * order (perSTI is pre-sorted).
 * @param result  output of calculateRisk()
 * @param rng     optional () => [0,1) for deterministic testing (defaults Math.random)
 * @returns {{ contracted: boolean, stis: Array<{key,label}> }}
 */
function rollOutcome(result, rng = Math.random) {
  const stis = result.perSTI
    .filter((s) => rng() < s.pGet)
    .map((s) => ({ key: s.key, label: s.label }));
  return { contracted: stis.length > 0, stis };
}

/** Convenience: percent string, e.g. fmtPct(0.524) → "52%". */
const fmtPct = (p, digits = 0) => (p * 100).toFixed(digits) + "%";

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

const RiskModel = {
  STI_DATA,
  STI_KEYS,
  TIER_MULTIPLIER,
  TIER_KEYS,
  HPV_VACCINE_FACTOR,
  CONDOM_FACTOR,
  CONDOM_FACTOR_SKIN,
  MIN_PARTNERS,
  MAX_PARTNERS,
  transmissionFor,
  calculateRisk,
  rollOutcome,
  fmtPct,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = RiskModel;
} else if (typeof window !== "undefined") {
  window.RiskModel = RiskModel;
}
