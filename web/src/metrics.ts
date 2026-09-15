import type { BoxScore } from "./data";

export type DerivedTeamMetrics = {
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  fgPct: number | null;
  efgPct: number | null;
  trueShootingPct: number | null;
  estimatedPossessions: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
  assistTurnover: number | null;
  turnoverPct: number | null;
  offensiveReboundPct: number | null;
  defensiveReboundPct: number | null;
  threePointAttemptRate: number | null;
  freeThrowRate: number | null;
};

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ratio(numerator: number | null, denominator: number | null, multiplier = 1) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return round((numerator / denominator) * multiplier);
}

export function estimatePossessions(team: BoxScore) {
  if (team.twoPA === null || team.threePA === null || team.fta === null || team.offensiveRebounds === null || team.turnovers === null) return null;
  return round(team.twoPA + team.threePA + 0.44 * team.fta - team.offensiveRebounds + team.turnovers);
}

export function deriveTeamMetrics(team: BoxScore, opponent: BoxScore): DerivedTeamMetrics {
  const fieldGoalsMade = team.twoPM === null || team.threePM === null ? null : team.twoPM + team.threePM;
  const fieldGoalsAttempted = team.twoPA === null || team.threePA === null ? null : team.twoPA + team.threePA;
  const possessions = estimatePossessions(team);
  const opponentPossessions = estimatePossessions(opponent);
  const sharedPossessions = possessions === null || opponentPossessions === null
    ? null
    : round((possessions + opponentPossessions) / 2);
  const points = team.points;

  return {
    fieldGoalsMade,
    fieldGoalsAttempted,
    fgPct: ratio(fieldGoalsMade, fieldGoalsAttempted, 100),
    efgPct: team.threePM === null ? null : ratio(fieldGoalsMade === null ? null : fieldGoalsMade + 0.5 * team.threePM, fieldGoalsAttempted, 100),
    trueShootingPct: points === null || fieldGoalsAttempted === null || team.fta === null
      ? null
      : ratio(points, 2 * (fieldGoalsAttempted + 0.44 * team.fta), 100),
    estimatedPossessions: possessions,
    offensiveRating: points === null ? null : ratio(points, sharedPossessions, 100),
    defensiveRating: opponent.points === null ? null : ratio(opponent.points, sharedPossessions, 100),
    netRating: points === null || opponent.points === null || sharedPossessions === null
      ? null
      : round(((points - opponent.points) / sharedPossessions) * 100),
    assistTurnover: ratio(team.assists, team.turnovers),
    turnoverPct: ratio(team.turnovers, possessions, 100),
    offensiveReboundPct: team.offensiveRebounds === null ? null : ratio(team.offensiveRebounds, team.offensiveRebounds + (opponent.defensiveRebounds ?? 0), 100),
    defensiveReboundPct: team.defensiveRebounds === null ? null : ratio(team.defensiveRebounds, team.defensiveRebounds + (opponent.offensiveRebounds ?? 0), 100),
    threePointAttemptRate: ratio(team.threePA, fieldGoalsAttempted, 100),
    freeThrowRate: ratio(team.fta, fieldGoalsAttempted, 100),
  };
}
