const { pool } = require('../config/db');
const { clamp } = require('../utils/helpers');

async function getWeight(key) {
  const [rows] = await pool.query(
    'SELECT weight_value FROM intelligence_weights WHERE weight_key = ?', [key]
  );
  return rows.length ? parseFloat(rows[0].weight_value) : 0;
}

function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 1; i <= k; i++) fact *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / fact;
}

function parseFormString(form) {
  if (!form) return [];
  return form.toUpperCase().split('').filter(c => ['W', 'D', 'L'].includes(c));
}

function formWinRate(results) {
  if (!results.length) return 0.5;
  const weights = [1.5, 1.2, 1.0, 0.8, 0.5];
  let total = 0, wins = 0;
  results.slice(0, 5).forEach((r, i) => {
    const w = weights[i] || 0.5;
    total += w;
    if (r === 'W')      wins += w;
    else if (r === 'D') wins += w * 0.33;
  });
  return total > 0 ? wins / total : 0.5;
}

// Read an auto-adjusted market coefficient from intelligence_weights, falling back to the
// hardcoded default. Results are cached in-process for 10 minutes to avoid per-call DB reads.
const _coeffCache = new Map();
const _coeffTTL   = 10 * 60 * 1000;

async function getMarketCoeff(market) {
  const defaults = {
    '1X2': 1.0, 'Over/Under': 0.95, 'BTTS': 0.90,
    'Double Chance': 0.92, 'Draw No Bet': 0.88,
    'Correct Score': 0.55, 'Corners': 0.80,
    'Accumulator': 0.40,
  };
  const fallback = defaults[market] || 0.80;

  const key = `market_coeff_${(market || '').toLowerCase().replace(/[^a-z]/g, '_')}`;
  const cached = _coeffCache.get(key);
  if (cached && Date.now() - cached.at < _coeffTTL) return cached.val;

  try {
    const [rows] = await pool.query(
      'SELECT weight_value FROM intelligence_weights WHERE weight_key=?', [key]
    );
    const val = rows.length ? parseFloat(rows[0].weight_value) : fallback;
    _coeffCache.set(key, { val, at: Date.now() });
    return val;
  } catch {
    return fallback;
  }
}

async function calculateConfidence({
  market, category, tip,
  homeForm, awayForm, homeFormVenue, awayFormVenue,
  h2hSummary,
  odds,
  leagueId,
  homeGoalsAvg, awayGoalsAvg, homeGoalsConcededAvg, awayGoalsConcededAvg,
}) {
  const W = {
    form:   await getWeight('form_weight')   || 0.30,
    h2h:    await getWeight('h2h_weight')    || 0.20,
    odds:   await getWeight('odds_weight')   || 0.20,
    market: await getWeight('market_weight') || 0.15,
    league: await getWeight('league_weight') || 0.15,
  };

  const homeResults      = parseFormString(homeForm);
  const awayResults      = parseFormString(awayForm);
  const homeVenueResults = parseFormString(homeFormVenue);
  const awayVenueResults = parseFormString(awayFormVenue);

  const mkt     = (market   || '').toUpperCase();
  const cat     = (category || '');
  const tipLow  = (tip      || '').toLowerCase();

  const is1X2    = mkt === '1X2'          || ['home_win','away_win','draw'].includes(cat);
  const isOver   = mkt.includes('OVER')   || cat.startsWith('over_');
  const isUnder  = mkt.includes('UNDER')  || cat.startsWith('under_');
  const isBTTS   = mkt.includes('BTTS')   || cat === 'gg' || cat === 'ng';
  const isDC     = mkt === 'DOUBLE CHANCE' || ['dc_1x','dc_x2','dc_12'].includes(cat);
  const isDNB    = mkt === 'DRAW NO BET'  || ['dnb_home','dnb_away'].includes(cat);
  const isCS     = mkt === 'CORRECT SCORE' || cat === 'correct_score';
  const isCorners = mkt === 'CORNERS'     || cat.startsWith('corners_');

  // ── Factor 1: Form ────────────────────────────────────────────────────────
  let formScore = 0;

  if (is1X2) {
    const venueHomeRate  = formWinRate(homeVenueResults.length ? homeVenueResults : homeResults);
    const overallHomeRate = formWinRate(homeResults);
    const homeRate = 0.65 * venueHomeRate + 0.35 * overallHomeRate;
    const awayRate = 1 - formWinRate(awayVenueResults.length ? awayVenueResults : awayResults);
    let signal = 0.5;
    if (tipLow.includes('home') || cat === 'home_win') signal = homeRate;
    else if (tipLow.includes('away') || cat === 'away_win') signal = awayRate;
    else if (cat === 'draw') signal = 1 - Math.abs(homeRate - 0.5);
    formScore = clamp(signal, 0, 1) * W.form * 100;

  } else if (isOver) {
    const N = parseFloat((tipLow.match(/[\d.]+/)?.[0]) || 2.5);
    const expectedTotal = (homeGoalsAvg || 1.3) + (awayGoalsAvg || 1.1);
    const goalsSignal   = clamp(0.5 + (expectedTotal - N) / Math.max(N, 1.5) * 0.45, 0, 1);
    const formSignal    = formWinRate(homeResults) * 0.5 + (1 - formWinRate(awayResults)) * 0.5;
    formScore = (0.65 * goalsSignal + 0.35 * formSignal) * W.form * 100;

  } else if (isUnder) {
    const N = parseFloat((tipLow.match(/[\d.]+/)?.[0]) || 2.5);
    const expectedTotal = (homeGoalsAvg || 1.3) + (awayGoalsAvg || 1.1);
    const goalsSignal   = clamp(0.5 + (N - expectedTotal) / Math.max(N, 1.5) * 0.45, 0, 1);
    formScore = goalsSignal * W.form * 100;

  } else if (isBTTS) {
    const expHome    = ((homeGoalsAvg || 1.3) + (awayGoalsConcededAvg || 1.2)) / 2;
    const expAway    = ((awayGoalsAvg || 1.1) + (homeGoalsConcededAvg || 1.2)) / 2;
    const pHomeSc    = 1 - poissonPMF(expHome, 0);
    const pAwaySc    = 1 - poissonPMF(expAway, 0);
    const bttsProb   = cat === 'ng' ? 1 - pHomeSc * pAwaySc : pHomeSc * pAwaySc;
    const formSignal = formWinRate(homeResults) * 0.5 + (1 - formWinRate(awayResults)) * 0.5;
    formScore = (0.65 * bttsProb + 0.35 * formSignal) * W.form * 100;

  } else if (isDC) {
    // Double Chance: which two outcomes are covered?
    const homeRate = formWinRate(homeResults);
    const awayRate = formWinRate(awayResults);
    let signal = 0.5;
    if (cat === 'dc_1x') signal = homeRate;                              // home wins or draws
    else if (cat === 'dc_x2') signal = 1 - awayRate;                    // away doesn't lose
    else if (cat === 'dc_12') signal = 0.5 + Math.abs(homeRate - 0.5); // decisiveness
    formScore = clamp(signal, 0, 1) * W.form * 100;

  } else if (isDNB) {
    // Draw No Bet: same as 1X2 but draw is a void — slight signal boost.
    const venueRate = formWinRate(homeVenueResults.length ? homeVenueResults : homeResults);
    let signal = 0.5;
    if      (cat === 'dnb_home') signal = Math.min(venueRate * 1.08, 1.0);
    else if (cat === 'dnb_away') signal = Math.min((1 - formWinRate(awayVenueResults.length ? awayVenueResults : awayResults)) * 1.08, 1.0);
    formScore = clamp(signal, 0, 1) * W.form * 100;

  } else if (isCS) {
    // Correct Score: form matters little; discount heavily.
    const formSignal = formWinRate(homeResults) * 0.5 + (1 - formWinRate(awayResults)) * 0.5;
    formScore = formSignal * W.form * 50;

  } else if (isCorners) {
    // Corners: game intensity (expected goals) is the best proxy for corner volume.
    const expectedGoals   = (homeGoalsAvg || 1.3) + (awayGoalsAvg || 1.1);
    const intensitySignal = clamp(expectedGoals / 3.0, 0, 1);
    formScore = intensitySignal * W.form * 100;

  } else {
    formScore = formWinRate(homeResults) * W.form * 100;
  }

  // ── Factor 2: H2H ─────────────────────────────────────────────────────────
  let h2hScore = 0;
  if (h2hSummary) {
    const recentPart = h2hSummary.includes('|') ? h2hSummary.split('|')[0] : h2hSummary;
    const olderPart  = h2hSummary.includes('|') ? h2hSummary.split('|')[1] : null;
    const parseH2H = str => {
      const parts = {};
      if (!str) return parts;
      str.replace(/([A-Z]+)(\d+)/g, (_, k, v) => { parts[k] = parseInt(v); });
      return parts;
    };
    const recent = parseH2H(recentPart);
    const older  = parseH2H(olderPart);
    const rH = recent.RH || recent.H || 0;
    const rA = recent.RA || recent.A || 0;
    const rD = recent.RD || recent.D || 0;
    const oH = older?.OH || 0, oA = older?.OA || 0, oD = older?.OD || 0;
    const totalR = rH + rA + rD || 1;
    const totalO = oH + oA + oD || 1;
    let h2hSignal;
    if      (cat === 'home_win' || cat === 'dc_1x' || cat === 'dnb_home') h2hSignal = (rH * 2 + oH) / (totalR * 2 + totalO);
    else if (cat === 'away_win' || cat === 'dc_x2' || cat === 'dnb_away') h2hSignal = (rA * 2 + oA) / (totalR * 2 + totalO);
    else if (cat === 'draw')                                               h2hSignal = (rD * 2 + oD) / (totalR * 2 + totalO);
    else                                                                   h2hSignal = Math.max(rH, rA, rD) / totalR;
    h2hScore = clamp(h2hSignal, 0, 1) * W.h2h * 100;
  } else {
    h2hScore = 0.5 * W.h2h * 100;
  }

  // ── Factor 3: Odds ────────────────────────────────────────────────────────
  let oddsScore = 0;
  if (odds) {
    const implied = 1 / parseFloat(odds);
    let oddsSignal;
    if      (implied >= 0.5 && implied <= 0.7) oddsSignal = 0.90;
    else if (implied > 0.7)                    oddsSignal = 0.75;
    else if (implied < 0.35)                   oddsSignal = 0.35;
    else                                        oddsSignal = 0.60;
    oddsScore = oddsSignal * W.odds * 100;
  } else {
    oddsScore = 0.6 * W.odds * 100;
  }

  // ── Factor 4: Market coefficient (learned + hardcoded baseline) ───────────
  const mktCoeff  = await getMarketCoeff(market);
  const marketScore = mktCoeff * W.market * 100;

  // ── Factor 5: League reliability ──────────────────────────────────────────
  let leagueCoeff = 0.75;
  if (leagueId) {
    try {
      const [[lr]] = await pool.query(
        'SELECT reliability_score FROM league_reliability WHERE league_id = ?', [leagueId]
      );
      if (lr) leagueCoeff = parseFloat(lr.reliability_score);
    } catch {}
  }
  const leagueScore = leagueCoeff * W.league * 100;

  let rawScore = formScore + h2hScore + oddsScore + marketScore + leagueScore;

  // ── Bayesian self-learning adjustment ────────────────────────────────────
  // As the sample of historical outcomes for this market/category grows, the
  // historical win rate is blended in, gradually overriding the model signal.
  try {
    const [outcomeRows] = await pool.query(
      `SELECT COUNT(*) as total, SUM(is_correct) as correct
       FROM intelligence_outcomes
       WHERE market=? AND category=? AND is_correct IS NOT NULL`,
      [market || '', category || '']
    );
    const { total, correct } = outcomeRows[0];
    if (total >= 10) {
      const histWinRate = (correct || 0) / total;
      const lr = await getWeight('learning_rate') || 0.10;
      rawScore = rawScore * (1 - lr) + histWinRate * 100 * lr;
    }
  } catch {}

  // Soft regression to mean (prevents extreme scores from model noise)
  const regressed = rawScore * 0.90 + 50 * 0.10;
  return clamp(Math.round(regressed), 1, 99);
}

module.exports = { calculateConfidence, getWeight, poissonPMF };
