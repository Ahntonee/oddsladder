/**
 * Backtest Engine
 * ──────────────
 * Fetches historical fixtures from API-Football (past N seasons),
 * reconstructs match-time team scoring averages from results that
 * occurred BEFORE each fixture, runs the Poisson prediction model,
 * compares to actual results, and stores calibration data.
 *
 * Results are stored in `backtest_results` and used to:
 *  1. Measure per-league model accuracy
 *  2. Seed league_reliability with real data before live predictions accumulate
 *  3. Identify which markets the model predicts best
 */

const axios = require('axios');
const { pool } = require('../config/db');

const BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const KEY  = process.env.API_FOOTBALL_KEY;
const api  = axios.create({ baseURL: BASE, headers: { 'x-apisports-key': KEY }, timeout: 20000 });

// ── Poisson helpers (duplicated from intelligence.js to keep service self-contained) ──
function pmf(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let f = 1; for (let i = 2; i <= k; i++) f *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / f;
}
function buildProbs(lh, la, maxK = 6) {
  let hw = 0, dr = 0, aw = 0, btts = 0, tot = 0;
  const gp = {};
  for (let h = 0; h <= maxK; h++) for (let a = 0; a <= maxK; a++) {
    const p = pmf(lh, h) * pmf(la, a); tot += p;
    if (h > a) hw += p; else if (h === a) dr += p; else aw += p;
    if (h >= 1 && a >= 1) btts += p;
    const n = h + a; gp[n] = (gp[n] || 0) + p;
  }
  const over25 = 1 - (gp[0]||0) - (gp[1]||0) - (gp[2]||0);
  const under25 = 1 - over25;
  return { homeWin: hw/tot, draw: dr/tot, awayWin: aw/tot, bttsYes: btts/tot, over25, under25 };
}
function selectTip(probs) {
  const candidates = [
    { tip: 'Home Win',       market: '1X2',        prob: probs.homeWin },
    { tip: 'Away Win',       market: '1X2',        prob: probs.awayWin },
    { tip: 'Draw',           market: '1X2',        prob: probs.draw    },
    { tip: 'Over 2.5 Goals', market: 'Over/Under', prob: probs.over25  },
    { tip: 'Under 2.5 Goals',market: 'Over/Under', prob: probs.under25 },
    { tip: 'BTTS Yes',       market: 'BTTS',       prob: probs.bttsYes },
  ];
  return candidates.reduce((a, b) => b.prob > a.prob ? b : a);
}
function gradeBacktest(tip, homeScore, awayScore) {
  const t = tip.toLowerCase(); const tot = homeScore + awayScore;
  if (t.includes('home win'))        return homeScore > awayScore;
  if (t.includes('away win'))        return awayScore > homeScore;
  if (t.includes('draw'))            return homeScore === awayScore;
  if (t.includes('over 2.5'))        return tot > 2;
  if (t.includes('under 2.5'))       return tot < 3;
  if (t.includes('btts yes'))        return homeScore >= 1 && awayScore >= 1;
  return false;
}

async function ensureBacktestTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backtest_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      league_id INT NOT NULL,
      api_league_id INT NOT NULL,
      season INT NOT NULL,
      fixture_id INT NOT NULL UNIQUE,
      home_team VARCHAR(255),
      away_team VARCHAR(255),
      match_date DATETIME,
      predicted_tip VARCHAR(100),
      predicted_market VARCHAR(50),
      predicted_prob DECIMAL(5,4),
      home_goals_lambda DECIMAL(6,4),
      away_goals_lambda DECIMAL(6,4),
      actual_home INT,
      actual_away INT,
      is_correct TINYINT(1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bt_league (league_id),
      INDEX idx_bt_correct (is_correct)
    )
  `);
}

async function runBacktest({ leagueIds = null, seasons = null, limit = 500, onProgress = null } = {}) {
  if (!KEY) throw new Error('API_FOOTBALL_KEY not configured');
  await ensureBacktestTable();

  // Default: active leagues that are popular, last 2 seasons
  const currentSeason = parseInt(process.env.API_FOOTBALL_SEASON || '2025');
  const targetSeasons = seasons || [currentSeason - 1, currentSeason - 2];

  let leagueRows;
  if (leagueIds?.length) {
    [leagueRows] = await pool.query(
      `SELECT id, api_league_id, name FROM leagues WHERE id IN (?) AND is_active=1`, [leagueIds]
    );
  } else {
    [leagueRows] = await pool.query(
      `SELECT id, api_league_id, name FROM leagues WHERE is_active=1 AND is_popular=1 LIMIT 20`
    );
  }

  let totalProcessed = 0, totalCorrect = 0;
  const leagueSummary = [];

  for (const league of leagueRows) {
    for (const season of targetSeasons) {
      let leagueCorrect = 0, leagueTotal = 0;
      let page = 1;

      while (true) {
        let resp;
        try {
          resp = await api.get('/fixtures', {
            params: { league: league.api_league_id, season, status: 'FT', page }
          });
        } catch (e) {
          console.error(`[Backtest] API error ${league.name} s${season}:`, e.message);
          break;
        }

        const fixtures = resp.data?.response || [];
        if (!fixtures.length) break;

        // Build running team averages UP TO each fixture date within this dataset
        // Sort by date ascending so we can accumulate stats as we go
        const sorted = [...fixtures].sort((a, b) =>
          new Date(a.fixture.date) - new Date(b.fixture.date)
        );

        // Running stats map: teamName → { scored[], conceded[] }
        const teamStats = {};
        const addStat = (team, scored, conceded) => {
          if (!teamStats[team]) teamStats[team] = { scored: [], conceded: [] };
          teamStats[team].scored.push(scored);
          teamStats[team].conceded.push(conceded);
        };
        const getAvg = (team, field) => {
          const arr = teamStats[team]?.[field] || [];
          if (!arr.length) return field === 'scored' ? 1.3 : 1.2;
          return arr.reduce((s, v) => s + v, 0) / arr.length;
        };

        for (const f of sorted) {
          const { fixture, teams, goals } = f;
          if (goals.home === null || goals.away === null) continue;

          const homeTeam = teams.home.name;
          const awayTeam = teams.away.name;
          const homeScore = goals.home;
          const awayScore = goals.away;

          // Use stats accumulated BEFORE this match
          const homeGoalsAvg = getAvg(homeTeam, 'scored');
          const awayGoalsAvg = getAvg(awayTeam, 'scored');
          const homeConcededAvg = getAvg(homeTeam, 'conceded');
          const awayConcededAvg = getAvg(awayTeam, 'conceded');

          const lh = homeGoalsAvg * awayConcededAvg * 1.15; // home advantage
          const la = awayGoalsAvg * homeConcededAvg;
          const probs = buildProbs(lh, la);
          const pick = selectTip(probs);
          const isCorrect = gradeBacktest(pick.tip, homeScore, awayScore) ? 1 : 0;

          try {
            await pool.query(
              `INSERT IGNORE INTO backtest_results
                (league_id, api_league_id, season, fixture_id, home_team, away_team, match_date,
                 predicted_tip, predicted_market, predicted_prob,
                 home_goals_lambda, away_goals_lambda, actual_home, actual_away, is_correct)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [league.id, league.api_league_id, season, fixture.id,
               homeTeam, awayTeam, new Date(fixture.date),
               pick.tip, pick.market, pick.prob.toFixed(4),
               lh.toFixed(4), la.toFixed(4),
               homeScore, awayScore, isCorrect]
            );
          } catch {}

          // Now record the actual result into running stats
          addStat(homeTeam, homeScore, awayScore);
          addStat(awayTeam, awayScore, homeScore);

          leagueTotal++; leagueCorrect += isCorrect;
          totalProcessed++; totalCorrect += isCorrect;
          if (onProgress) onProgress({ totalProcessed, leagueTotal, league: league.name, season });
          if (limit > 0 && totalProcessed >= limit) break;
        }

        if (limit > 0 && totalProcessed >= limit) break;

        const paging = resp.data?.paging;
        if (!paging || page >= paging.total) break;
        page++;
        await new Promise(r => setTimeout(r, 300)); // respect rate limit
      }

      const leagueWinRate = leagueTotal > 0
        ? parseFloat(((leagueCorrect / leagueTotal) * 100).toFixed(2)) : null;

      leagueSummary.push({ league: league.name, season, total: leagueTotal, correct: leagueCorrect, winRate: leagueWinRate });
      console.log(`[Backtest] ${league.name} ${season}: ${leagueTotal} fixtures, ${leagueWinRate?.toFixed(1)}% accuracy`);

      if (limit > 0 && totalProcessed >= limit) break;
    }

    // Seed league_reliability from backtest data for this league
    await seedLeagueReliabilityFromBacktest(league.id);
    if (limit > 0 && totalProcessed >= limit) break;
  }

  const overallWinRate = totalProcessed > 0
    ? parseFloat(((totalCorrect / totalProcessed) * 100).toFixed(2)) : 0;

  return { totalProcessed, totalCorrect, overallWinRate, leagueSummary };
}

// Seed league_reliability from backtest results (only if live data is insufficient)
async function seedLeagueReliabilityFromBacktest(leagueId) {
  const [[live]] = await pool.query(
    `SELECT total_predictions FROM league_reliability WHERE league_id = ?`, [leagueId]
  );
  // Only seed from backtest if live data is thin (<20 predictions)
  if (live && live.total_predictions >= 20) return;

  const [[bt]] = await pool.query(
    `SELECT COUNT(*) as total, SUM(is_correct) as correct
     FROM backtest_results WHERE league_id = ? AND is_correct IS NOT NULL`, [leagueId]
  );
  if (!bt || !bt.total) return;

  const sampleConf = Math.min(bt.total, 200) / 200;
  const measured = bt.correct / bt.total;
  const reliability = parseFloat((0.70 * (1 - sampleConf) + measured * sampleConf).toFixed(4));

  await pool.query(
    `INSERT INTO league_reliability (league_id, total_predictions, correct_predictions, win_rate, reliability_score)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_predictions = VALUES(total_predictions),
       correct_predictions = VALUES(correct_predictions),
       win_rate = VALUES(win_rate),
       reliability_score = VALUES(reliability_score)`,
    [leagueId, bt.total, bt.correct || 0,
     parseFloat(((bt.correct / bt.total) * 100).toFixed(2)), reliability]
  );
}

async function getBacktestSummary() {
  const [byLeague] = await pool.query(
    `SELECT l.name, br.api_league_id, br.season,
            COUNT(*) as total, SUM(br.is_correct) as correct,
            ROUND(SUM(br.is_correct)/COUNT(*)*100, 2) as win_rate
     FROM backtest_results br JOIN leagues l ON l.id = br.league_id
     GROUP BY l.name, br.api_league_id, br.season
     ORDER BY win_rate DESC`
  );
  const [byMarket] = await pool.query(
    `SELECT predicted_market as market, COUNT(*) as total,
            SUM(is_correct) as correct,
            ROUND(SUM(is_correct)/COUNT(*)*100, 2) as win_rate
     FROM backtest_results GROUP BY predicted_market ORDER BY win_rate DESC`
  );
  const [[overall]] = await pool.query(
    `SELECT COUNT(*) as total, SUM(is_correct) as correct,
            ROUND(SUM(is_correct)/COUNT(*)*100, 2) as win_rate
     FROM backtest_results`
  );
  return { overall, byLeague, byMarket };
}

module.exports = { runBacktest, getBacktestSummary, seedLeagueReliabilityFromBacktest };
