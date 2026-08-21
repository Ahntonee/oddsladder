const { pool } = require('../config/db');

async function getHighestScoringTeams(limit = 20) {
  const [rows] = await pool.query(
    `SELECT team_name, goals_scored_avg, goals_conceded_avg, matches_played, wins, draws, losses
     FROM team_statistics WHERE goals_scored_avg IS NOT NULL ORDER BY goals_scored_avg DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getLowestScoringTeams(limit = 20) {
  const [rows] = await pool.query(
    `SELECT team_name, goals_scored_avg, goals_conceded_avg, matches_played
     FROM team_statistics WHERE goals_scored_avg IS NOT NULL ORDER BY goals_scored_avg ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getMostReliableTeamsByMarket(market, limit = 20) {
  const [rows] = await pool.query(
    `SELECT team_name, market, win_rate, total_predictions, correct_predictions
     FROM prediction_market_stats WHERE market = ? AND team_name IS NOT NULL AND win_rate IS NOT NULL
     ORDER BY win_rate DESC LIMIT ?`,
    [market, limit]
  );
  return rows;
}

async function getMostEffectivePredictionsByTeam(teamName) {
  const [rows] = await pool.query(
    `SELECT market, category, COUNT(*) as total, SUM(pal.is_correct) as correct,
            AVG(pal.confidence_score) as avg_confidence
     FROM prediction_accuracy_log pal
     JOIN predictions p ON p.id = pal.prediction_id
     WHERE p.home_team LIKE ? OR p.away_team LIKE ?
     GROUP BY market, category ORDER BY correct DESC LIMIT 10`,
    [`%${teamName}%`, `%${teamName}%`]
  );
  return rows;
}

async function getHighestScoringLeagues(limit = 20) {
  const [rows] = await pool.query(
    `SELECT ls.league_name, ls.goals_per_game, ls.btts_percentage, ls.over_2_5_percentage, ls.matches_played,
            l.id as league_id
     FROM league_statistics ls LEFT JOIN leagues l ON l.api_league_id = ls.api_league_id
     WHERE ls.goals_per_game IS NOT NULL ORDER BY ls.goals_per_game DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getLowestScoringLeagues(limit = 20) {
  const [rows] = await pool.query(
    `SELECT ls.league_name, ls.goals_per_game, ls.btts_percentage, ls.matches_played,
            l.id as league_id
     FROM league_statistics ls LEFT JOIN leagues l ON l.api_league_id = ls.api_league_id
     WHERE ls.goals_per_game IS NOT NULL ORDER BY ls.goals_per_game ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getMostReliableLeaguesByMarket(market, limit = 20) {
  const [rows] = await pool.query(
    `SELECT pms.league_id, l.name, pms.market, pms.win_rate, pms.total_predictions
     FROM prediction_market_stats pms JOIN leagues l ON l.id = pms.league_id
     WHERE pms.market = ? AND pms.league_id IS NOT NULL ORDER BY pms.win_rate DESC LIMIT ?`,
    [market, limit]
  );
  return rows;
}

async function getMostEffectivePredictionsByLeague(leagueId) {
  const [rows] = await pool.query(
    `SELECT pal.market, pal.category, COUNT(*) as total, SUM(pal.is_correct) as correct,
            ROUND(SUM(pal.is_correct)/COUNT(*)*100, 2) as win_rate
     FROM prediction_accuracy_log pal
     JOIN predictions p ON p.id = pal.prediction_id
     WHERE p.league_id = ?
     GROUP BY pal.market, pal.category ORDER BY win_rate DESC LIMIT 10`,
    [leagueId]
  );
  return rows;
}

async function getMostReliableMarkets() {
  const [rows] = await pool.query(
    `SELECT market, category, total_predictions, correct_predictions, win_rate, avg_confidence
     FROM prediction_market_stats WHERE win_rate IS NOT NULL
     ORDER BY win_rate DESC`
  );
  return rows;
}

async function getCrossMarketLeagueStats() {
  const [rows] = await pool.query(
    `SELECT pms.market, pms.category, l.name as league_name, pms.win_rate, pms.total_predictions
     FROM prediction_market_stats pms JOIN leagues l ON l.id = pms.league_id
     WHERE pms.league_id IS NOT NULL AND pms.win_rate IS NOT NULL
     ORDER BY pms.win_rate DESC LIMIT 50`
  );
  return rows;
}

async function getSummary() {
  const [total] = await pool.query('SELECT COUNT(*) as cnt FROM predictions WHERE published_at IS NOT NULL');
  const [stats] = await pool.query("SELECT stat_key, stat_value FROM accuracy_stats WHERE stat_key IN ('overall_win_rate','vip_win_rate','total_predictions','total_won')");
  const [leagues] = await pool.query('SELECT COUNT(*) as cnt FROM leagues WHERE is_active = 1');
  const statMap = {};
  stats.forEach(s => statMap[s.stat_key] = s.stat_value);

  return {
    totalPredictions: total[0].cnt,
    winRate: statMap.overall_win_rate || 0,
    vipWinRate: statMap.vip_win_rate || 0,
    totalWon: statMap.total_won || 0,
    leaguesCovered: leagues[0].cnt,
  };
}

async function refreshTeamStatistics() {
  const [teams] = await pool.query(
    `SELECT p.home_team as team_name, p.league_id,
            AVG(p.home_goals_avg) as goals_scored_avg,
            AVG(p.home_goals_conceded_avg) as goals_conceded_avg,
            COUNT(*) as matches_played
     FROM predictions p WHERE p.home_goals_avg IS NOT NULL AND p.published_at IS NOT NULL
     GROUP BY p.home_team, p.league_id`
  );

  for (const t of teams) {
    await pool.query(
      `INSERT INTO team_statistics (team_name, league_id, goals_scored_avg, goals_conceded_avg, matches_played)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE goals_scored_avg=VALUES(goals_scored_avg), goals_conceded_avg=VALUES(goals_conceded_avg), matches_played=VALUES(matches_played)`,
      [t.team_name, t.league_id, t.goals_scored_avg, t.goals_conceded_avg, t.matches_played]
    ).catch(() => {});
  }
  console.log(`[Statistics] Refreshed ${teams.length} team stats`);
}

async function refreshLeagueStatistics() {
  // Primary source: h2h_history (populated by the 2-year historical seed).
  // Computes goals/game, BTTS%, over 1.5/2.5/3.5%, home/draw/away win % per league.
  const [h2hRows] = await pool.query(
    `SELECT
       l.id           AS league_id,
       l.api_league_id,
       l.name         AS league_name,
       COUNT(*)                                                          AS matches_played,
       SUM(h.home_score + h.away_score)                                 AS total_goals,
       ROUND(AVG(h.home_score + h.away_score), 2)                       AS goals_per_game,
       ROUND(SUM(h.home_score >= 1 AND h.away_score >= 1) / COUNT(*) * 100, 1)  AS btts_pct,
       ROUND(SUM(h.home_score + h.away_score >= 2) / COUNT(*) * 100, 1)         AS over15_pct,
       ROUND(SUM(h.home_score + h.away_score >= 3) / COUNT(*) * 100, 1)         AS over25_pct,
       ROUND(SUM(h.home_score + h.away_score >= 4) / COUNT(*) * 100, 1)         AS over35_pct,
       ROUND(SUM(h.home_score > h.away_score)  / COUNT(*) * 100, 1)             AS home_win_pct,
       ROUND(SUM(h.away_score > h.home_score)  / COUNT(*) * 100, 1)             AS away_win_pct,
       ROUND(SUM(h.home_score = h.away_score)  / COUNT(*) * 100, 1)             AS draw_pct
     FROM leagues l
     JOIN h2h_history h ON h.league_api_id = l.api_league_id
     WHERE l.is_active = 1
     GROUP BY l.id, l.api_league_id, l.name
     HAVING matches_played >= 10`
  );

  const seededLeagueIds = new Set();

  for (const r of h2hRows) {
    seededLeagueIds.add(r.league_id);
    await pool.query(
      `INSERT INTO league_statistics
         (league_id, api_league_id, league_name, matches_played, total_goals,
          goals_per_game, btts_percentage, over_1_5_percentage,
          over_2_5_percentage, over_3_5_percentage,
          home_win_percentage, away_win_percentage, draw_percentage)
       VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?)
       ON DUPLICATE KEY UPDATE
         matches_played       = VALUES(matches_played),
         total_goals          = VALUES(total_goals),
         goals_per_game       = VALUES(goals_per_game),
         btts_percentage      = VALUES(btts_percentage),
         over_1_5_percentage  = VALUES(over_1_5_percentage),
         over_2_5_percentage  = VALUES(over_2_5_percentage),
         over_3_5_percentage  = VALUES(over_3_5_percentage),
         home_win_percentage  = VALUES(home_win_percentage),
         away_win_percentage  = VALUES(away_win_percentage),
         draw_percentage      = VALUES(draw_percentage)`,
      [r.league_id, r.api_league_id, r.league_name,
       r.matches_played, r.total_goals,
       r.goals_per_game, r.btts_pct, r.over15_pct,
       r.over25_pct, r.over35_pct,
       r.home_win_pct, r.away_win_pct, r.draw_pct]
    ).catch(() => {});
  }

  // Fallback for leagues with no seeded h2h data yet: estimate from prediction rows
  const [fallbackRows] = await pool.query(
    `SELECT l.id AS league_id, l.api_league_id, l.name AS league_name,
            COUNT(p.id) AS matches_played,
            ROUND(AVG(COALESCE(p.home_goals_avg,0) + COALESCE(p.away_goals_avg,0)), 2) AS goals_per_game
     FROM leagues l
     JOIN predictions p ON p.league_id = l.id AND p.published_at IS NOT NULL
     WHERE l.is_active = 1
     GROUP BY l.id
     HAVING matches_played >= 5`
  );

  for (const r of fallbackRows) {
    if (seededLeagueIds.has(r.league_id)) continue; // already handled above
    await pool.query(
      `INSERT INTO league_statistics (league_id, api_league_id, league_name, matches_played, goals_per_game)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         matches_played = VALUES(matches_played),
         goals_per_game = VALUES(goals_per_game)`,
      [r.league_id, r.api_league_id, r.league_name, r.matches_played, r.goals_per_game]
    ).catch(() => {});
  }

  console.log(`[Statistics] Refreshed league statistics — ${h2hRows.length} from h2h seed, ${fallbackRows.length} fallback`);
}

async function refreshMarketStats() {
  const [rows] = await pool.query(
    `SELECT pal.market, pal.category, pal.league_id,
            COUNT(*) as total_predictions, SUM(pal.is_correct) as correct_predictions,
            ROUND(SUM(pal.is_correct)/COUNT(*)*100,2) as win_rate,
            AVG(pal.confidence_score) as avg_confidence
     FROM prediction_accuracy_log pal
     WHERE pal.is_correct IS NOT NULL
     GROUP BY pal.market, pal.category, pal.league_id`
  );
  for (const r of rows) {
    await pool.query(
      `INSERT INTO prediction_market_stats (market, category, league_id, total_predictions, correct_predictions, win_rate, avg_confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_predictions=VALUES(total_predictions), correct_predictions=VALUES(correct_predictions), win_rate=VALUES(win_rate), avg_confidence=VALUES(avg_confidence)`,
      [r.market, r.category, r.league_id, r.total_predictions, r.correct_predictions || 0, r.win_rate, r.avg_confidence]
    ).catch(() => {});
  }
  console.log('[Statistics] Refreshed market stats');
}

// Compute per-league accuracy from resolved predictions and store reliability scores.
// Leagues with <20 resolved predictions keep the default 0.75 neutral score so we
// don't penalise leagues that simply haven't seen enough data yet.
async function refreshLeagueReliability() {
  const [rows] = await pool.query(
    `SELECT pal.league_id,
            COUNT(*) AS total,
            SUM(pal.is_correct) AS correct
     FROM prediction_accuracy_log pal
     WHERE pal.is_correct IS NOT NULL AND pal.league_id IS NOT NULL
     GROUP BY pal.league_id`
  );

  for (const r of rows) {
    const total = r.total || 0;
    const correct = r.correct || 0;
    const winRate = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : null;
    // Blend measured win rate toward a 0.97-0.50 reliability_score range.
    // Use a Bayesian prior of 0.70 (neutral) weighted by sample confidence (saturates at 100 samples).
    const sampleConfidence = Math.min(total, 100) / 100;
    const measuredReliability = total > 0 ? correct / total : 0.70;
    const reliability = parseFloat(
      (0.70 * (1 - sampleConfidence) + measuredReliability * sampleConfidence).toFixed(4)
    );

    await pool.query(
      `INSERT INTO league_reliability (league_id, total_predictions, correct_predictions, win_rate, reliability_score)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_predictions = VALUES(total_predictions),
         correct_predictions = VALUES(correct_predictions),
         win_rate = VALUES(win_rate),
         reliability_score = VALUES(reliability_score)`,
      [r.league_id, total, correct, winRate, reliability]
    );
  }
  console.log(`[Statistics] Refreshed league reliability for ${rows.length} leagues`);
}

// ── Accuracy Tracker ──────────────────────────────────────────────────────────

async function getAccuracySummary(leagueId = null) {
  const args = [];
  let where = "WHERE result IN ('won','lost')";
  if (leagueId) { where += ' AND league_id = ?'; args.push(leagueId); }
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as total, SUM(result='won') as won, SUM(result='lost') as lost,
            ROUND(SUM(result='won')/COUNT(*)*100,2) as accuracy
     FROM predictions ${where}`, args
  );
  return { total: row.total || 0, won: parseInt(row.won)||0, lost: parseInt(row.lost)||0, accuracy: parseFloat(row.accuracy)||0 };
}

async function getAccuracyByMarket(leagueId = null) {
  const args = [];
  let where = "WHERE result IN ('won','lost')";
  if (leagueId) { where += ' AND league_id = ?'; args.push(leagueId); }
  const [rows] = await pool.query(
    `SELECT market, COUNT(*) as total, SUM(result='won') as won,
            ROUND(SUM(result='won')/COUNT(*)*100,2) as accuracy
     FROM predictions ${where}
     GROUP BY market ORDER BY total DESC`, args
  );
  return rows.map(r => ({ market: r.market, total: r.total, won: parseInt(r.won)||0, accuracy: parseFloat(r.accuracy)||0 }));
}

async function getAccuracyByConfidenceBand() {
  const [rows] = await pool.query(
    `SELECT b*5 as band_low, COUNT(*) as total, SUM(result='won') as won
     FROM (SELECT FLOOR(confidence_score/5) as b, result
           FROM predictions WHERE result IN ('won','lost') AND confidence_score IS NOT NULL) t
     GROUP BY b ORDER BY b DESC`
  );
  return rows.map(r => ({
    band: `${r.band_low}–${parseInt(r.band_low)+4}%`,
    total: r.total, won: parseInt(r.won)||0,
    accuracy: r.total > 0 ? parseFloat(((parseInt(r.won)||0)/r.total*100).toFixed(2)) : 0
  }));
}

async function getAccuracyByTip() {
  const [rows] = await pool.query(
    `SELECT market, tip, COUNT(*) as total, SUM(result='won') as won,
            ROUND(SUM(result='won')/COUNT(*)*100,2) as accuracy
     FROM predictions WHERE result IN ('won','lost') AND tip IS NOT NULL AND tip != ''
     GROUP BY market, tip ORDER BY market, total DESC`
  );
  return rows.map(r => ({ market: r.market, tip: r.tip, total: r.total, won: parseInt(r.won)||0, accuracy: parseFloat(r.accuracy)||0 }));
}

async function getAccuracyByLeagueMarket(leagueId = null) {
  const args = [];
  let where = "WHERE p.result IN ('won','lost')";
  if (leagueId) { where += ' AND p.league_id = ?'; args.push(leagueId); }
  const [rows] = await pool.query(
    `SELECT l.name as league_name, l.country, p.market, p.tip,
            COUNT(*) as total, SUM(p.result='won') as won,
            ROUND(SUM(p.result='won')/COUNT(*)*100,2) as accuracy
     FROM predictions p JOIN leagues l ON l.id = p.league_id
     ${where}
     GROUP BY l.id, p.market, p.tip
     HAVING total >= 2
     ORDER BY p.market, accuracy DESC
     LIMIT 200`, args
  );
  return rows.map(r => ({ ...r, won: parseInt(r.won)||0, accuracy: parseFloat(r.accuracy)||0 }));
}

async function getAccuracyCalibration() {
  const [rows] = await pool.query(
    `SELECT market, tip,
            CONCAT(b*5,'–',b*5+4,'%') as band,
            COUNT(*) as total, SUM(result='won') as won,
            ROUND(SUM(result='won')/COUNT(*)*100,2) as accuracy,
            MAX(updated_at) as last_updated
     FROM (SELECT market, tip, FLOOR(confidence_score/5) as b, result, updated_at
           FROM predictions WHERE result IN ('won','lost') AND confidence_score IS NOT NULL AND tip IS NOT NULL) t
     GROUP BY market, tip, b
     ORDER BY last_updated DESC
     LIMIT 200`
  );
  return rows.map(r => ({ ...r, won: parseInt(r.won)||0, accuracy: parseFloat(r.accuracy)||0 }));
}

async function getPredictionFrequency(leagueId = null) {
  const args = [];
  let where = 'WHERE p.published_at IS NOT NULL AND p.tip IS NOT NULL AND p.tip != \'\'';
  if (leagueId) { where += ' AND p.league_id = ?'; args.push(leagueId); }
  const [rows] = await pool.query(
    `SELECT l.name as league_name, l.country, p.league_id,
            p.market, p.tip,
            COUNT(*) as cnt,
            SUM(p.result IN ('won','lost')) as resolved_count,
            SUM(p.result='won') as resolved_won,
            SUM(COUNT(*)) OVER (PARTITION BY p.league_id) as league_total
     FROM predictions p JOIN leagues l ON l.id = p.league_id
     ${where}
     GROUP BY p.league_id, p.market, p.tip
     ORDER BY l.name, cnt DESC
     LIMIT 300`, args
  ).catch(async () => {
    // Fallback without window function for older MySQL
    const [fb] = await pool.query(
      `SELECT l.name as league_name, l.country, p.league_id, p.market, p.tip,
              COUNT(*) as cnt,
              SUM(p.result IN ('won','lost')) as resolved_count,
              SUM(p.result='won') as resolved_won, 0 as league_total
       FROM predictions p JOIN leagues l ON l.id = p.league_id
       ${where} GROUP BY p.league_id, p.market, p.tip
       ORDER BY l.name, cnt DESC LIMIT 300`, args
    );
    return [fb];
  });
  return rows.map(r => ({
    ...r, cnt: r.cnt, resolved_count: parseInt(r.resolved_count)||0, resolved_won: parseInt(r.resolved_won)||0,
    share: r.league_total > 0 ? parseFloat((r.cnt/r.league_total*100).toFixed(1)) : 0
  }));
}

async function getAccuracyLeagues() {
  const [rows] = await pool.query(
    `SELECT DISTINCT l.id, l.name, l.country
     FROM predictions p JOIN leagues l ON l.id = p.league_id
     WHERE p.result IN ('won','lost')
     ORDER BY l.name`
  );
  return rows;
}

module.exports = {
  getHighestScoringTeams, getLowestScoringTeams,
  getMostReliableTeamsByMarket, getMostEffectivePredictionsByTeam,
  getHighestScoringLeagues, getLowestScoringLeagues,
  getMostReliableLeaguesByMarket, getMostEffectivePredictionsByLeague,
  getMostReliableMarkets, getCrossMarketLeagueStats,
  getSummary,
  getAccuracySummary, getAccuracyByMarket, getAccuracyByConfidenceBand,
  getAccuracyByTip, getAccuracyByLeagueMarket, getAccuracyCalibration,
  getPredictionFrequency, getAccuracyLeagues,
  refreshTeamStatistics, refreshLeagueStatistics, refreshMarketStats, refreshLeagueReliability,
};
