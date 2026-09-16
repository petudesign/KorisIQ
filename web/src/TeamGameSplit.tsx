import { useMemo, useState } from "react";
import { useI18n } from "./i18n";

type SeasonMatchRecord = typeof import("../../data/normalized/season_verified.json")["matches"][number];

type TeamGameRow = {
  team: string;
  opponent: string;
  isHome: boolean;
  threePM: number;
  threePA: number;
  twoPM: number;
  twoPA: number;
  freeThrowAttempts: number;
  turnovers: number;
  offensiveRebounds: number;
  opponentDefensiveRebounds: number;
  points: number;
  opponentPoints: number;
  pace: number;
  opponentNetRating: number | null;
  opponentDefensiveRating: number | null;
  opponentStrength: "strong" | "weak" | null;
  margin: number;
  threePointShare: number;
  offensiveRating: number;
  netRating: number;
};

type SeasonBaseline = {
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  possessions: number;
};

type TeamGameDataset = {
  rows: TeamGameRow[];
  opponentStrengthCutoff: number | null;
};

type SplitSummary = {
  games: number;
  threePA: number;
  threePointShare: number;
  threePointPct: number | null;
  efgPct: number | null;
  turnoverPct: number | null;
  offensiveReboundPct: number | null;
  freeThrowRate: number | null;
  pace: number | null;
  offensiveRating: number;
  netRating: number;
  opponentNetRating: number | null;
  opponentDefensiveRating: number | null;
  margin: number | null;
  homeGames: number;
  awayGames: number;
};

type OpponentComparison = {
  opponent: string;
  above: SplitSummary;
  below: SplitSummary;
};

type MetricDirection = "higher" | "lower" | "neutral";

export function estimatedPossessions(stats: SeasonMatchRecord["teams"][number]["stats"]) {
  const values = [stats.two_pa, stats.three_pa, stats.fta, stats.offensive_rebounds, stats.turnovers];
  if (values.some((value) => value === null)) return null;
  return stats.two_pa + stats.three_pa + 0.44 * stats.fta - stats.offensive_rebounds + stats.turnovers;
}

function seasonNetRating(baseline: SeasonBaseline) {
  return baseline.possessions === 0 ? null : ((baseline.pointsFor - baseline.pointsAgainst) / baseline.possessions) * 100;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function buildSeasonBaselines(matches: SeasonMatchRecord[]) {
  const baselines = new Map<string, SeasonBaseline>();
  for (const match of matches) {
    if (match.teams.length !== 2) continue;
    const home = match.teams[0];
    const away = match.teams[1];
    const homePossessions = estimatedPossessions(home.stats);
    const awayPossessions = estimatedPossessions(away.stats);
    if (homePossessions === null || awayPossessions === null) continue;
    const sharedPossessions = (homePossessions + awayPossessions) / 2;
    if (sharedPossessions === 0) continue;
    for (const [team, opponent] of [[home, away], [away, home]] as const) {
      const baseline = baselines.get(team.name) ?? { games: 0, pointsFor: 0, pointsAgainst: 0, possessions: 0 };
      baseline.games += 1;
      baseline.pointsFor += team.score;
      baseline.pointsAgainst += opponent.score;
      baseline.possessions += sharedPossessions;
      baselines.set(team.name, baseline);
    }
  }
  return baselines;
}

function buildTeamGameRows(matches: SeasonMatchRecord[]): TeamGameDataset {
  const baselineByTeam = buildSeasonBaselines(matches);
  const opponentStrengthCutoff = median([...baselineByTeam.values()].flatMap((baseline) => {
    const rating = seasonNetRating(baseline);
    return rating === null ? [] : [rating];
  }));
  const rows: TeamGameRow[] = [];
  for (const match of matches) {
    if (match.teams.length !== 2) continue;
    for (let index = 0; index < match.teams.length; index += 1) {
      const team = match.teams[index];
      const opponent = match.teams[index === 0 ? 1 : 0];
      const teamPossessions = estimatedPossessions(team.stats);
      const opponentPossessions = estimatedPossessions(opponent.stats);
      const fga = team.stats.two_pa + team.stats.three_pa;
      const sharedPossessions = teamPossessions === null || opponentPossessions === null ? null : (teamPossessions + opponentPossessions) / 2;
      const opponentDefensiveRebounds = opponent.stats.defensive_rebounds;
      if (sharedPossessions === null || sharedPossessions === 0 || fga === 0 || opponentDefensiveRebounds === null) continue;
      const opponentBaseline = baselineByTeam.get(opponent.name);
      const opponentGamesAfterThis = opponentBaseline ? opponentBaseline.games - 1 : 0;
      const opponentPossessionsAfterThis = opponentBaseline ? opponentBaseline.possessions - sharedPossessions : 0;
      const opponentNetRating = opponentBaseline && opponentGamesAfterThis > 0 && opponentPossessionsAfterThis > 0
        ? ((opponentBaseline.pointsFor - opponent.score - (opponentBaseline.pointsAgainst - team.score)) / opponentPossessionsAfterThis) * 100
        : null;
      const opponentDefensiveRating = opponentBaseline && opponentGamesAfterThis > 0 && opponentPossessionsAfterThis > 0
        ? ((opponentBaseline.pointsAgainst - team.score) / opponentPossessionsAfterThis) * 100
        : null;
      const opponentStrength = opponentNetRating !== null && opponentStrengthCutoff !== null
        ? opponentNetRating >= opponentStrengthCutoff ? "strong" : "weak"
        : null;

      rows.push({
        team: team.name,
        opponent: opponent.name,
        isHome: team.home_away === "home",
        threePM: team.stats.three_pm,
        threePA: team.stats.three_pa,
        twoPM: team.stats.two_pm,
        twoPA: team.stats.two_pa,
        freeThrowAttempts: team.stats.fta,
        turnovers: team.stats.turnovers,
        offensiveRebounds: team.stats.offensive_rebounds,
        opponentDefensiveRebounds,
        points: team.score,
        opponentPoints: opponent.score,
        pace: sharedPossessions,
        opponentNetRating,
        opponentDefensiveRating,
        opponentStrength,
        margin: team.score - opponent.score,
        threePointShare: (team.stats.three_pa / fga) * 100,
        offensiveRating: (team.score / sharedPossessions) * 100,
        netRating: ((team.score - opponent.score) / sharedPossessions) * 100,
      });
    }
  }
  return { rows, opponentStrengthCutoff };
}

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize(rows: TeamGameRow[]): SplitSummary | null {
  if (rows.length === 0) return null;
  const totalThreePM = rows.reduce((sum, row) => sum + row.threePM, 0);
  const totalThreePA = rows.reduce((sum, row) => sum + row.threePA, 0);
  const totalFga = rows.reduce((sum, row) => sum + row.twoPA + row.threePA, 0);
  const totalFgm = rows.reduce((sum, row) => sum + row.twoPM + row.threePM, 0);
  const totalPossessions = rows.reduce((sum, row) => sum + row.pace, 0);
  const totalTurnovers = rows.reduce((sum, row) => sum + row.turnovers, 0);
  const totalFta = rows.reduce((sum, row) => sum + row.freeThrowAttempts, 0);
  const totalOffensiveRebounds = rows.reduce((sum, row) => sum + row.offensiveRebounds, 0);
  const totalOpponentDefensiveRebounds = rows.reduce((sum, row) => sum + row.opponentDefensiveRebounds, 0);
  const opponentNetRatings = rows.flatMap((row) => row.opponentNetRating === null ? [] : [row.opponentNetRating]);
  const opponentDefensiveRatings = rows.flatMap((row) => row.opponentDefensiveRating === null ? [] : [row.opponentDefensiveRating]);
  return {
    games: rows.length,
    threePA: average(rows.map((row) => row.threePA)) ?? 0,
    threePointShare: totalFga === 0 ? 0 : (totalThreePA / totalFga) * 100,
    threePointPct: totalThreePA === 0 ? null : (totalThreePM / totalThreePA) * 100,
    efgPct: totalFga === 0 ? null : ((totalFgm + 0.5 * totalThreePM) / totalFga) * 100,
    turnoverPct: totalFga + 0.44 * totalFta + totalTurnovers === 0 ? null : (totalTurnovers / (totalFga + 0.44 * totalFta + totalTurnovers)) * 100,
    offensiveReboundPct: totalOffensiveRebounds + totalOpponentDefensiveRebounds === 0 ? null : (totalOffensiveRebounds / (totalOffensiveRebounds + totalOpponentDefensiveRebounds)) * 100,
    freeThrowRate: totalFga === 0 ? null : (totalFta / totalFga) * 100,
    pace: average(rows.map((row) => row.pace)),
    offensiveRating: average(rows.map((row) => row.offensiveRating)) ?? 0,
    netRating: average(rows.map((row) => row.netRating)) ?? 0,
    opponentNetRating: average(opponentNetRatings),
    opponentDefensiveRating: average(opponentDefensiveRatings),
    margin: average(rows.map((row) => row.margin)),
    homeGames: rows.filter((row) => row.isHome).length,
    awayGames: rows.filter((row) => !row.isHome).length,
  };
}

function buildOpponentComparisons(rows: TeamGameRow[], teamAverageShare: number | null) {
  if (teamAverageShare === null) return [] as OpponentComparison[];
  const rowsByOpponent = new Map<string, TeamGameRow[]>();
  for (const row of rows) {
    const opponentRows = rowsByOpponent.get(row.opponent) ?? [];
    opponentRows.push(row);
    rowsByOpponent.set(row.opponent, opponentRows);
  }
  return [...rowsByOpponent.entries()]
    .sort(([opponentA], [opponentB]) => opponentA.localeCompare(opponentB, "fi"))
    .flatMap(([opponent, opponentRows]) => {
      const above = summarize(opponentRows.filter((row) => row.threePointShare > teamAverageShare));
      const below = summarize(opponentRows.filter((row) => row.threePointShare < teamAverageShare));
      return above && below ? [{ opponent, above, below }] : [];
    });
}

function formatValue(value: number | null, language: string, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatSignedValue(value: number | null, language: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}`;
}

function formatSignedPercentage(value: number | null, language: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}%`;
}

function contextValueClass(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) return "game-split-context-value game-split-context-value--neutral";
  return `game-split-context-value game-split-context-value--${value > 0 ? "positive" : "negative"}`;
}

function summaryMetricClass(value: number | null, compareValue: number | null, direction: MetricDirection, signTone = false) {
  if (signTone && value !== null && Number.isFinite(value)) {
    if (value > 0) return "summary-metric-value summary-metric-value--positive";
    if (value < 0) return "summary-metric-value summary-metric-value--negative";
  }
  if (value === null || compareValue === null || !Number.isFinite(value) || !Number.isFinite(compareValue) || direction === "neutral" || value === compareValue) {
    return "summary-metric-value summary-metric-value--neutral";
  }
  const isBetter = direction === "higher" ? value > compareValue : value < compareValue;
  return `summary-metric-value summary-metric-value--${isBetter ? "better" : "worse"}`;
}

function deltaValueClass(value: number | null, direction: MetricDirection = "higher") {
  if (value === null || !Number.isFinite(value) || value === 0) return "game-split-delta-value game-split-delta-value--neutral";
  const isPositiveDirection = direction === "lower" ? value < 0 : value > 0;
  return `game-split-delta-value game-split-delta-value--${isPositiveDirection ? "positive" : "negative"}`;
}

function SummaryMetricValue({ value, compareValue, direction, language, suffix = "", signed = false }: { value: number | null; compareValue: number | null; direction: MetricDirection; language: string; suffix?: string; signed?: boolean }) {
  return <b className={summaryMetricClass(value, compareValue, direction, signed)}>{signed ? formatSignedValue(value, language) : formatValue(value, language, suffix)}</b>;
}

function formatGameCount(games: number, language: string) {
  if (language === "fi") return `${games} ${games === 1 ? "peli" : "peliä"}`;
  return `${games} ${games === 1 ? "game" : "games"}`;
}

function SplitOutcome({ summary, language }: { summary: SplitSummary | null; language: string }) {
  if (!summary) return <span className="game-split-context-outcome game-split-context-outcome--empty">—</span>;
  return <span className="game-split-context-outcome">
    <span className="game-split-context-games">{formatGameCount(summary.games, language)}</span>
    <strong className={contextValueClass(summary.netRating)}>{formatSignedValue(summary.netRating, language)}</strong>
  </span>;
}

function ContextColumnHeader({ title, detail }: { title: string; detail: string }) {
  return <span className="game-split-context-column-heading"><strong>{title}</strong><small>({detail})</small></span>;
}

function SummaryCard({ title, summary, compareSummary, language }: { title: string; summary: SplitSummary | null; compareSummary: SplitSummary | null; language: string }) {
  const { tr } = useI18n();
  if (!summary) return <article className="game-split-summary game-split-summary--empty"><strong>{title}</strong><p>—</p></article>;
  return (
    <article className="game-split-summary">
      <div className="game-split-summary-title">{title}</div>
      <div className="game-split-summary-main"><strong className={summaryMetricClass(summary.offensiveRating, compareSummary?.offensiveRating ?? null, "higher")}>{formatValue(summary.offensiveRating, language)}</strong><span>ORtg</span></div>
      <div className="game-split-summary-grid">
        <span><small>{tr("Net Rating", "Net Rating")}</small><SummaryMetricValue value={summary.netRating} compareValue={compareSummary?.netRating ?? null} direction="higher" language={language} signed /></span>
        <span><small>{tr("3PA / ottelu", "3PA / game")}</small><SummaryMetricValue value={summary.threePA} compareValue={compareSummary?.threePA ?? null} direction="neutral" language={language} /></span>
        <span><small>3PA/FGA</small><SummaryMetricValue value={summary.threePointShare} compareValue={compareSummary?.threePointShare ?? null} direction="neutral" language={language} suffix="%" /></span>
        <span><small>3P%</small><SummaryMetricValue value={summary.threePointPct} compareValue={compareSummary?.threePointPct ?? null} direction="higher" language={language} suffix="%" /></span>
        <span><small>eFG%</small><SummaryMetricValue value={summary.efgPct} compareValue={compareSummary?.efgPct ?? null} direction="higher" language={language} suffix="%" /></span>
        <span><small>{tr("Ottelut", "Games")}</small><SummaryMetricValue value={summary.games} compareValue={compareSummary?.games ?? null} direction="neutral" language={language} /></span>
      </div>
      <div className="game-split-factors">
        <small>{tr("Hyökkäyksen neljä tekijää", "Four Factors of the offense")}</small>
        <div className="game-split-factor-grid">
          <span><em>eFG%</em><SummaryMetricValue value={summary.efgPct} compareValue={compareSummary?.efgPct ?? null} direction="higher" language={language} suffix="%" /></span>
          <span><em>TOV%</em><SummaryMetricValue value={summary.turnoverPct} compareValue={compareSummary?.turnoverPct ?? null} direction="lower" language={language} suffix="%" /></span>
          <span><em>ORB%</em><SummaryMetricValue value={summary.offensiveReboundPct} compareValue={compareSummary?.offensiveReboundPct ?? null} direction="higher" language={language} suffix="%" /></span>
          <span><em>FTr</em><SummaryMetricValue value={summary.freeThrowRate} compareValue={compareSummary?.freeThrowRate ?? null} direction="higher" language={language} suffix="%" /></span>
          </div>
        </div>
    </article>
  );
}

export function TeamGameSplit({ matches }: { matches: SeasonMatchRecord[] }) {
  const { language, tr } = useI18n();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const gameDataset = useMemo(() => buildTeamGameRows(matches), [matches]);
  const rows = gameDataset.rows;
  const opponentStrengthCutoff = gameDataset.opponentStrengthCutoff;
  const teamNames = useMemo(() => [...new Set(rows.map((row) => row.team))].sort((a, b) => a.localeCompare(b, "fi")), [rows]);
  const activeTeam = selectedTeam && teamNames.includes(selectedTeam) ? selectedTeam : teamNames[0] ?? null;
  const teamRows = rows.filter((row) => row.team === activeTeam);
  const teamAverageShare = average(teamRows.map((row) => row.threePointShare));
  const teamAverageThreePA = average(teamRows.map((row) => row.threePA));
  const aboveAverageRows = teamAverageShare === null ? [] : teamRows.filter((row) => row.threePointShare > teamAverageShare);
  const belowAverageRows = teamAverageShare === null ? [] : teamRows.filter((row) => row.threePointShare < teamAverageShare);
  const aboveSummary = summarize(aboveAverageRows);
  const belowSummary = summarize(belowAverageRows);
  const strongOpponentRows = teamRows.filter((row) => row.opponentStrength === "strong");
  const weakOpponentRows = teamRows.filter((row) => row.opponentStrength === "weak");
  const strongAboveSummary = summarize(strongOpponentRows.filter((row) => teamAverageShare !== null && row.threePointShare > teamAverageShare));
  const strongBelowSummary = summarize(strongOpponentRows.filter((row) => teamAverageShare !== null && row.threePointShare < teamAverageShare));
  const weakAboveSummary = summarize(weakOpponentRows.filter((row) => teamAverageShare !== null && row.threePointShare > teamAverageShare));
  const weakBelowSummary = summarize(weakOpponentRows.filter((row) => teamAverageShare !== null && row.threePointShare < teamAverageShare));
  const opponentComparisons = useMemo(() => buildOpponentComparisons(teamRows, teamAverageShare), [teamRows, teamAverageShare]);
  const deltaOrtg = aboveSummary && belowSummary ? aboveSummary.offensiveRating - belowSummary.offensiveRating : null;
  const deltaNetRating = aboveSummary && belowSummary ? aboveSummary.netRating - belowSummary.netRating : null;
  const deltaEfg = aboveSummary && belowSummary && aboveSummary.efgPct !== null && belowSummary.efgPct !== null ? aboveSummary.efgPct - belowSummary.efgPct : null;
  const deltaTurnoverPct = aboveSummary && belowSummary && aboveSummary.turnoverPct !== null && belowSummary.turnoverPct !== null ? aboveSummary.turnoverPct - belowSummary.turnoverPct : null;
  const deltaFreeThrowRate = aboveSummary && belowSummary && aboveSummary.freeThrowRate !== null && belowSummary.freeThrowRate !== null ? aboveSummary.freeThrowRate - belowSummary.freeThrowRate : null;
  const deltaOpponentNetRating = aboveSummary && belowSummary && aboveSummary.opponentNetRating !== null && belowSummary.opponentNetRating !== null ? aboveSummary.opponentNetRating - belowSummary.opponentNetRating : null;
  const deltaOpponentDefensiveRating = aboveSummary && belowSummary && aboveSummary.opponentDefensiveRating !== null && belowSummary.opponentDefensiveRating !== null ? aboveSummary.opponentDefensiveRating - belowSummary.opponentDefensiveRating : null;
  const deltaMargin = aboveSummary && belowSummary && aboveSummary.margin !== null && belowSummary.margin !== null ? aboveSummary.margin - belowSummary.margin : null;
  const deltaPace = aboveSummary && belowSummary && aboveSummary.pace !== null && belowSummary.pace !== null ? aboveSummary.pace - belowSummary.pace : null;
  const opponentContextGap = deltaOpponentNetRating === null ? null : Math.abs(deltaOpponentNetRating);
  const aboveGroupFacedStrongerOpponents = deltaOpponentNetRating !== null && deltaOpponentNetRating >= 0;

  return (
    <section className="panel game-split-panel" aria-labelledby="team-game-split-heading">
      <div className="panel-heading panel-heading--plain game-split-heading">
        <div>
          <h3 id="team-game-split-heading">{tr("Pelitavan ja tuloksen yhteys", "Playing style and outcome")}</h3>
          <p className="panel-subcopy">{tr("Miten joukkueen hyökkäys erosi, kun kolmosyritysosuus oli oman keskiarvon ylä- tai alapuolella?", "How did the team's offense differ when its three-point share was above or below its own average?")}</p>
        </div>
        <span className="panel-context">{tr("kuvaileva vertailu", "descriptive comparison")}</span>
      </div>

      {teamNames.length === 0 ? <div className="game-split-empty">{tr("Ottelukohtainen aineisto latautuu…", "Loading game-level data…")}</div> : <>
        <div className="game-split-toolbar">
          <label htmlFor="game-split-team">{tr("Joukkue", "Team")}</label>
          <select id="game-split-team" value={activeTeam ?? ""} onChange={(event) => setSelectedTeam(event.target.value)}>
            {teamNames.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
          {teamAverageShare !== null && teamAverageThreePA !== null && <span>{tr(`Oman kauden keskiarvo: ${formatValue(teamAverageShare, language, "%")} 3PA/FGA · ${formatValue(teamAverageThreePA, language)} 3PA / ottelu`, `Own season average: ${formatValue(teamAverageShare, language, "%")} 3PA/FGA · ${formatValue(teamAverageThreePA, language)} 3PA / game`)}</span>}
        </div>

        <div className="game-split-summary-grid-layout">
          <SummaryCard title={tr("Yli oman keskiarvon", "Above own average")} summary={aboveSummary} compareSummary={belowSummary} language={language} />
          <SummaryCard title={tr("Alle oman keskiarvon", "Below own average")} summary={belowSummary} compareSummary={aboveSummary} language={language} />
        </div>

        <details className="game-split-context-panel">
          <summary className="game-split-context-heading game-split-context-disclosure">
            <div>
              <strong>{tr("Ottelukonteksti", "Game context")}</strong>
              <span>{tr("Ennen johtopäätöstä: kohtasivatko ryhmät samanlaisia vastustajia?", "Before drawing a conclusion: did the groups face similar opponents?")}</span>
            </div>
            <small>
              <span className="game-split-context-disclosure-closed">{tr("Avaa konteksti", "Open context")}</span>
              <span className="game-split-context-disclosure-open">{tr("Sulje konteksti", "Close context")}</span>
              <span className="game-split-disclosure-chevron" aria-hidden="true">⌄</span>
            </small>
          </summary>
          <div className="game-split-context-body">
          <div className="game-split-context-table-wrap">
            <table className="game-split-context-table">
              <thead>
                <tr><th scope="col">{tr("Konteksti", "Context")}</th><th scope="col"><ContextColumnHeader title={tr("Yli", "Above")} detail={tr("oma 3PA/FGA", "own 3PA/FGA")} /></th><th scope="col"><ContextColumnHeader title={tr("Alle", "Below")} detail={tr("oma 3PA/FGA", "own 3PA/FGA")} /></th><th scope="col"><ContextColumnHeader title={tr("Ero", "Difference")} detail={tr("Yli-ryhmän ja alle-ryhmän välinen ero", "Difference between above and below groups")} /></th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">{tr("Vastustajan Net Rating", "Opponent Net Rating")}</th><td className={contextValueClass(aboveSummary?.opponentNetRating ?? null)}>{formatSignedValue(aboveSummary?.opponentNetRating ?? null, language)}</td><td className={contextValueClass(belowSummary?.opponentNetRating ?? null)}>{formatSignedValue(belowSummary?.opponentNetRating ?? null, language)}</td><td className={contextValueClass(deltaOpponentNetRating)}>{formatSignedValue(deltaOpponentNetRating, language)}</td></tr>
                <tr><th scope="row">{tr("Vastustajan puolustustehokkuus (DRtg)", "Opponent defensive rating (DRtg)")}</th><td className={contextValueClass(aboveSummary?.opponentDefensiveRating ?? null)}>{formatValue(aboveSummary?.opponentDefensiveRating ?? null, language)}</td><td className={contextValueClass(belowSummary?.opponentDefensiveRating ?? null)}>{formatValue(belowSummary?.opponentDefensiveRating ?? null, language)}</td><td className={contextValueClass(deltaOpponentDefensiveRating)}>{formatSignedValue(deltaOpponentDefensiveRating, language)}</td></tr>
                <tr><th scope="row">{tr("Piste-ero / ottelu", "Point margin / game")}</th><td className={contextValueClass(aboveSummary?.margin ?? null)}>{formatSignedValue(aboveSummary?.margin ?? null, language)}</td><td className={contextValueClass(belowSummary?.margin ?? null)}>{formatSignedValue(belowSummary?.margin ?? null, language)}</td><td className={contextValueClass(deltaMargin)}>{formatSignedValue(deltaMargin, language)}</td></tr>
                <tr><th scope="row">{tr("Arvioitu tempo", "Estimated pace")}</th><td className={contextValueClass(aboveSummary?.pace ?? null)}>{formatValue(aboveSummary?.pace ?? null, language)}</td><td className={contextValueClass(belowSummary?.pace ?? null)}>{formatValue(belowSummary?.pace ?? null, language)}</td><td className={contextValueClass(deltaPace)}>{formatSignedValue(deltaPace, language)}</td></tr>
                <tr><th scope="row">{tr("Koti / vieras", "Home / away")}</th><td className={contextValueClass(null)}>{aboveSummary ? `${aboveSummary.homeGames} / ${aboveSummary.awayGames}` : "—"}</td><td className={contextValueClass(null)}>{belowSummary ? `${belowSummary.homeGames} / ${belowSummary.awayGames}` : "—"}</td><td className={contextValueClass(null)}>—</td></tr>
                <tr><th scope="row">{tr("Ottelut", "Games")}</th><td className={contextValueClass(null)}>{aboveSummary?.games ?? "—"}</td><td className={contextValueClass(null)}>{belowSummary?.games ?? "—"}</td><td className={contextValueClass(null)}>—</td></tr>
              </tbody>
            </table>
          </div>
          {deltaOpponentNetRating !== null && Math.abs(deltaOpponentNetRating) >= 3 && opponentContextGap !== null && <p className="game-split-context-callout">{tr(`Kontekstihuomio: yli-keskiarvon ryhmän vastustajien kausitason Net Rating oli keskimäärin ${formatValue(opponentContextGap, language)} pistettä ${aboveGroupFacedStrongerOpponents ? "korkeampi" : "matalampi"} kuin alle-ryhmässä. Ryhmien tuloserotusta ei pidä tulkita suoraan kolmosyritysten vaikutukseksi.`, `Context note: opponents in the above-average group had a season Net Rating ${formatValue(opponentContextGap, language)} points ${aboveGroupFacedStrongerOpponents ? "higher" : "lower"} on average than in the below-average group. The outcome difference should not be read as a direct effect of three-point attempts.`)}</p>}

          <div className="game-split-context-subsection">
            <div className="game-split-context-heading">
              <div>
                <strong>{tr("Vastustajan taso", "Opponent strength")}</strong>
                <span>{tr("Jaottelu perustuu vastustajan kausitason Net Ratingiin, ei tämän yksittäisen ottelun tulokseen.", "The split uses the opponent's season Net Rating, not the result of this individual game.")}</span>
              </div>
              <small>{opponentStrengthCutoff === null ? "—" : tr(`Sarjan mediaani: ${formatSignedValue(opponentStrengthCutoff, language)} Net Rating`, `League median: ${formatSignedValue(opponentStrengthCutoff, language)} Net Rating`)}</small>
            </div>
            <div className="game-split-context-table-wrap">
              <table className="game-split-context-table">
                <thead>
                  <tr><th scope="col">{tr("Vastustajaryhmä", "Opponent group")}</th><th scope="col"><ContextColumnHeader title={tr("Yli", "Above")} detail={tr("pelit, Net Rating", "games, Net Rating")} /></th><th scope="col"><ContextColumnHeader title={tr("Alle", "Below")} detail={tr("pelit, Net Rating", "games, Net Rating")} /></th><th scope="col"><ContextColumnHeader title={tr("Ero", "Difference")} detail={tr("Yli-ryhmän ja alle-ryhmän välinen ero", "Difference between above and below groups")} /></th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">{tr("Vahvat vastustajat", "Strong opponents")}</th><td><SplitOutcome summary={strongAboveSummary} language={language} /></td><td><SplitOutcome summary={strongBelowSummary} language={language} /></td><td className={contextValueClass(strongAboveSummary && strongBelowSummary ? strongAboveSummary.netRating - strongBelowSummary.netRating : null)}>{formatSignedValue(strongAboveSummary && strongBelowSummary ? strongAboveSummary.netRating - strongBelowSummary.netRating : null, language)}</td></tr>
                  <tr><th scope="row">{tr("Heikot vastustajat", "Weaker opponents")}</th><td><SplitOutcome summary={weakAboveSummary} language={language} /></td><td><SplitOutcome summary={weakBelowSummary} language={language} /></td><td className={contextValueClass(weakAboveSummary && weakBelowSummary ? weakAboveSummary.netRating - weakBelowSummary.netRating : null)}>{formatSignedValue(weakAboveSummary && weakBelowSummary ? weakAboveSummary.netRating - weakBelowSummary.netRating : null, language)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="game-split-context-subsection">
            <div className="game-split-context-heading">
              <div>
                <strong>{tr("Samat vastustajat", "Same opponents")}</strong>
                <span>{tr("Vain vastustajat, joita vastaan on ollut sekä yli- että alle-keskiarvon otteluita.", "Only opponents with both above- and below-average games.")}</span>
              </div>
              <small>{tr(`${opponentComparisons.length} vertailukelpoista vastustajaa`, `${opponentComparisons.length} comparable opponents`)}</small>
            </div>
            {opponentComparisons.length === 0 ? <p className="game-split-context-empty">{tr("Samaa vastustajaa vastaan ei ole vielä riittävästi molempia ottelutyyppejä vertailuun.", "There are not enough of both game types against the same opponent yet.")}</p> : <div className="game-split-context-table-wrap">
              <table className="game-split-context-table game-split-context-table--opponents">
                <thead>
                  <tr><th scope="col">{tr("Vastustaja", "Opponent")}</th><th scope="col"><ContextColumnHeader title={tr("Yli", "Above")} detail={tr("pelit, Net Rating", "games, Net Rating")} /></th><th scope="col"><ContextColumnHeader title={tr("Alle", "Below")} detail={tr("pelit, Net Rating", "games, Net Rating")} /></th><th scope="col"><ContextColumnHeader title={tr("Ero", "Difference")} detail={tr("Yli-ryhmän ja alle-ryhmän välinen ero", "Difference between above and below groups")} /></th></tr>
                </thead>
                <tbody>
                  {opponentComparisons.map(({ opponent, above, below }) => <tr key={opponent}><th scope="row">{opponent}</th><td><SplitOutcome summary={above} language={language} /></td><td><SplitOutcome summary={below} language={language} /></td><td className={contextValueClass(above.netRating - below.netRating)}>{formatSignedValue(above.netRating - below.netRating, language)}</td></tr>)}
                </tbody>
              </table>
            </div>}
          </div>
          </div>
        </details>

        <div className="game-split-delta" aria-live="polite">
          <strong>{tr("Ryhmien erotus", "Difference between groups")}</strong>
          <span>ORtg <b className={deltaValueClass(deltaOrtg)}>{formatSignedValue(deltaOrtg, language)}</b></span>
          <span>Net Rating <b className={deltaValueClass(deltaNetRating)}>{formatSignedValue(deltaNetRating, language)}</b></span>
          <span>eFG% <b className={deltaValueClass(deltaEfg)}>{formatSignedPercentage(deltaEfg, language)}</b></span>
          <span>TOV% <b className={deltaValueClass(deltaTurnoverPct, "lower")}>{formatSignedPercentage(deltaTurnoverPct, language)}</b></span>
          <span>FTr <b className={deltaValueClass(deltaFreeThrowRate)}>{formatSignedPercentage(deltaFreeThrowRate, language)}</b></span>
        </div>
        </>}

      <p className="game-split-note">{tr("eFG% + TOV% + ORB% + FTr muodostavat hyökkäyksen Four Factors -rungon. Jako perustuu joukkueen omien otteluiden 3PA/FGA-keskiarvoon, ja täsmälleen keskiarvoon osuvat ottelut jäävät ryhmien ulkopuolelle. Ottelukontekstissa vastustajan kausiluvut lasketaan ilman tarkasteltavaa ottelua, jotta ottelu ei vaikuta omaan vertailukohtaansa. Tämä auttaa näkemään, kohtasivatko ryhmät erilaisia vastustajia, mutta ei vielä vakioi vastustajan tasoa tilastollisesti. ORtg, Net Rating ja tempo ovat box scoresta arvioituja. Tämä näyttää yhteyden, ei syy-seurausta.", "eFG% + TOV% + ORB% + FTr form the core Four Factors of the offense. The split uses the team's own game-level 3PA/FGA average, and games exactly at the average are left out. In the game context, each opponent's season values exclude the game being examined, so the game does not leak into its own comparison baseline. This shows whether the groups faced different opponents, but it is not yet a statistical opponent adjustment. ORtg, Net Rating and pace are estimated from the box score. This shows an association, not causation.")}</p>
    </section>
  );
}
