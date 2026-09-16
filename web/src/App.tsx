import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { availability, insights, match, players, teamSummary, type BoxScore, type Player, type PlayerRole, type TeamStats, type ViewKey } from "./data";
import { deriveTeamMetrics, type DerivedTeamMetrics } from "./metrics";
import seasonData from "../../data/normalized/season_verified.summary.json"; // Compact validated season totals.
import { TeamProfiles } from "./TeamProfiles";
import { TeamStyleMap } from "./TeamStyleMap";
import { TeamGameSplit } from "./TeamGameSplit";
import { scheduleByMatchId } from "./schedule";
import { useI18n, type Language } from "./i18n";
import { PaperLeaderShader } from "./PaperShaderBackdrop";

type SeasonMatchRecord = typeof import("../../data/normalized/season_verified.json")["matches"][number];
type RawTeam = SeasonMatchRecord["teams"][number];
type RawSeasonPlayer = RawTeam["players"][number];

type SeasonPlayerRow = {
  id: string;
  name: string;
  team: string;
  games: number;
  starts: number;
  minutes: number;
  points: number;
  twoPM: number;
  twoPA: number;
  threePM: number;
  threePA: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  efficiency: number;
};

type MatchListItem = {
  id: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  scheduledAt: string | null;
};

type AppMatch = Omit<typeof match, "eventCount"> & { eventCount: number | null };

let seasonMatchesPromise: Promise<SeasonMatchRecord[]> | null = null;

function loadSeasonMatches() {
  seasonMatchesPromise ??= import("../../data/normalized/season_verified.json").then((module) => module.default.matches);
  return seasonMatchesPromise;
}

function toBoxScore(rawStats: Record<string, number | null>, minutes: string | null = null): BoxScore {
  return {
    minutes,
    points: rawStats.points ?? null,
    twoPM: rawStats.two_pm ?? null,
    twoPA: rawStats.two_pa ?? null,
    twoPct: rawStats.two_p_pct ?? null,
    threePM: rawStats.three_pm ?? null,
    threePA: rawStats.three_pa ?? null,
    threePct: rawStats.three_p_pct ?? null,
    ftm: rawStats.ftm ?? null,
    fta: rawStats.fta ?? null,
    ftPct: rawStats.ft_pct ?? null,
    offensiveRebounds: rawStats.offensive_rebounds ?? null,
    defensiveRebounds: rawStats.defensive_rebounds ?? null,
    rebounds: rawStats.rebounds ?? null,
    assists: rawStats.assists ?? null,
    turnovers: rawStats.turnovers ?? null,
    steals: rawStats.steals ?? null,
    blocks: rawStats.blocks ?? null,
    blocksReceived: rawStats.blocks_received ?? null,
    fouls: rawStats.fouls ?? null,
    foulsDrawn: rawStats.fouls_drawn ?? null,
    plusMinus: rawStats.plus_minus ?? null,
    efficiency: rawStats.efficiency ?? null,
  };
}

function normalizePosition(position: string | null): PlayerRole {
  return position === "C" || position === "PF" || position === "SF" || position === "SG" || position === "PG" ? position : null;
}

function displayPlayerName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

function teamMark(name: string) {
  return name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
}

function playerMark(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function EntityPlaceholder({ name, kind }: { name: string; kind: "team" | "player" }) {
  return <span className={`entity-placeholder entity-placeholder--${kind}`} aria-hidden="true"><span>{kind === "team" ? teamMark(name) : playerMark(name)}</span></span>;
}

function NeutralPortrait() {
  return <span className="neutral-portrait" aria-hidden="true">
    <svg viewBox="0 0 120 170" role="presentation">
      <circle className="neutral-portrait-face" cx="60" cy="49" r="27" />
      <path className="neutral-portrait-neck" d="M44 69h32v25H44z" />
      <path className="neutral-portrait-body" d="M14 170c4-34 22-52 46-52s42 18 46 52H14Z" />
    </svg>
  </span>;
}

function formatScheduledDate(value: string | null, language: Language = "fi") {
  if (!value) return language === "fi" ? "Päivä ei lähteessä" : "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? language === "fi" ? "Päivä ei lähteessä" : "Date unavailable" : new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "numeric", year: "numeric" }).format(date);
}

function scheduledAtFor(record: SeasonMatchRecord) {
  return scheduleByMatchId[record.game.source_id] ?? record.game.scheduled_at;
}

function aggregateSeasonPlayers(records: SeasonMatchRecord[]) {
  const rows = new Map<string, SeasonPlayerRow>();
  for (const record of records) {
    for (const team of record.teams) {
      for (const player of team.players as RawSeasonPlayer[]) {
        const id = player.source_player_id;
        const row = rows.get(id) ?? {
          id,
          name: displayPlayerName(player.display_name),
          team: team.name,
          games: 0,
          starts: 0,
          minutes: 0,
          points: 0,
          twoPM: 0,
          twoPA: 0,
          threePM: 0,
          threePA: 0,
          rebounds: 0,
          assists: 0,
          turnovers: 0,
          steals: 0,
          blocks: 0,
          efficiency: 0,
        };
        const stats = player.stats;
        const minutes = player.minutes ?? 0;
        if (minutes > 0) row.games += 1;
        if (minutes > 0 && player.starter) row.starts += 1;
        row.minutes += minutes;
        row.points += stats.points ?? 0;
        row.twoPM += stats.two_pm ?? 0;
        row.twoPA += stats.two_pa ?? 0;
        row.threePM += stats.three_pm ?? 0;
        row.threePA += stats.three_pa ?? 0;
        row.rebounds += stats.rebounds ?? 0;
        row.assists += stats.assists ?? 0;
        row.turnovers += stats.turnovers ?? 0;
        row.steals += stats.steals ?? 0;
        row.blocks += stats.blocks ?? 0;
        row.efficiency += stats.efficiency ?? 0;
        rows.set(id, row);
      }
    }
  }
  return Array.from(rows.values()).filter((player) => player.games > 0);
}

function playerPerGame(player: SeasonPlayerRow, stat: keyof Pick<SeasonPlayerRow, "points" | "rebounds" | "assists">) {
  return player.games === 0 ? null : player[stat] / player.games;
}

function playerFgPctFromTotals(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return attempts === 0 ? null : ((player.twoPM + player.threePM) / attempts) * 100;
}

function playerThreePctFromTotals(player: SeasonPlayerRow) {
  return player.threePA === 0 ? null : (player.threePM / player.threePA) * 100;
}

function playerEfficiencyPer40(player: SeasonPlayerRow) {
  return player.minutes === 0 ? null : (player.efficiency / player.minutes) * 40;
}

function playerAttemptsPer40(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return player.minutes === 0 ? null : (attempts / player.minutes) * 40;
}

function toMatchListItem(record: SeasonMatchRecord): MatchListItem {
  const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
  const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
  return {
    id: record.game.source_id,
    homeName: home.name,
    awayName: away.name,
    homeScore: record.game.final_score.home,
    awayScore: record.game.final_score.away,
    venue: record.game.venue.name,
    scheduledAt: scheduledAtFor(record),
  };
}

function buildMatchViewModel(record: SeasonMatchRecord, language: Language = "fi"): { match: AppMatch; players: Player[]; teamSummary: typeof teamSummary; insights: typeof insights; availability: typeof availability } {
  const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
  const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
  const winner = home.score >= away.score ? home : away;
  const loser = winner === home ? away : home;
  const margin = Math.abs(home.score - away.score);
  const periods = record.game.periods.map((period) => ({ label: `${period.period}Q`, home: period.home_score, away: period.away_score }));
  const scheduledAt = scheduledAtFor(record);
  const biggestQuarter = periods.reduce((best, period) => Math.abs(period.home - period.away) > Math.abs(best.home - best.away) ? period : best, periods[0]);
  const playerRows: Player[] = record.teams.flatMap((team) => team.players.map((player) => ({
    name: displayPlayerName(player.display_name),
    team: team.name,
    teamColor: team.home_away === "home" ? "coral" : "mint",
    number: player.jersey_number,
    role: normalizePosition(player.position),
    starter: player.starter,
    stats: toBoxScore(player.stats as Record<string, number | null>, player.minutes_display),
  })));
  const homeStats: TeamStats = {
    ...toBoxScore(home.stats as Record<string, number | null>, "200:00"),
    leadTime: home.team_flow.timeInLead,
    leadChanges: home.team_flow.leadChanges,
    biggestLead: home.team_flow.biggestLead,
    longestRun: home.team_flow.biggestScoringRun,
  };
  const awayStats: TeamStats = {
    ...toBoxScore(away.stats as Record<string, number | null>, "200:00"),
    leadTime: away.team_flow.timeInLead,
    leadChanges: away.team_flow.leadChanges,
    biggestLead: away.team_flow.biggestLead,
    longestRun: away.team_flow.biggestScoringRun,
  };
  const matchModel = {
    competition: record.competition.name,
    season: "2025–26",
    date: formatScheduledDate(scheduledAt, language),
    time: scheduledAt ? new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(scheduledAt)) : "—",
    venue: record.game.venue.name,
    sourceMatchId: record.game.source_id,
    source: "Basket.fi / statistics",
    status: "Lopputulos",
    home: { name: home.name, score: home.score, color: "coral" },
    away: { name: away.name, score: away.score, color: "mint" },
    periods,
    eventCount: null,
    lineupCount: playerRows.length,
  };
  const insightModel = [
    { eyebrow: "Avaus", title: `${periods[0]?.home > periods[0]?.away ? home.name : away.name} aloitti vahvemmin`, body: `Ensimmäinen neljännes päättyi ${periods[0]?.home}–${periods[0]?.away}. ${winner.name} johti ottelua ${margin} pisteellä lopussa.`, accent: "mint" },
    { eyebrow: "Ratkaisu", title: `${winner.name} teki eron ${biggestQuarter?.label ?? "ottelussa"}`, body: `Suurin neljänneskohtainen ero syntyi lukemin ${biggestQuarter?.home}–${biggestQuarter?.away}. Se auttoi ${winner.name}a pitämään ottelun hallinnassa.`, accent: "amber" },
    { eyebrow: "Loppu", title: `${winner.name} voitti ${margin} pisteellä`, body: `${winner.name} teki ${winner.score} pistettä ja ${loser.name} ${loser.score}. Ottelun box score on saatavilla lähdedatassa.`, accent: "coral" },
  ] as typeof insights;
  const availabilityModel = availability.map((item) => item.label === "Box score -tilastot"
    ? { ...item, detail: `${playerRows.length} pelaajaa · MIN · heitot · levypallot · muut kentät` }
    : item.label === "Tapahtumat"
      ? { ...item, value: "Ei eritelty", tone: "warning", detail: "Tapahtumamäärä ei ole mukana kausi-indeksissä" }
      : item) as typeof availability;

  return {
    match: matchModel,
    players: playerRows,
    teamSummary: { home: { name: home.name, stats: homeStats }, away: { name: away.name, stats: awayStats } },
    insights: insightModel,
    availability: availabilityModel,
  };
}

function displayStat(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

function displayPct(value: number | null) {
  return displayStat(value, "%");
}

function displayPlusMinus(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : `${value}`;
}

function displayMinutes(value: string | null) {
  return value === null ? "—" : value;
}

function displayPair(home: number | null, away: number | null, formatter = displayStat) {
  return `${formatter(home)}–${formatter(away)}`;
}

function displayAdvantage(homeName: string, awayName: string, home: number | null, away: number | null, suffix = "", language: Language = "fi") {
  if (home === null || away === null) return language === "fi" ? "Ei vertailtavaa dataa" : "No comparable data";
  const difference = Math.round(Math.abs(home - away) * 10) / 10;
  if (difference === 0) return language === "fi" ? "Tasainen vertailu" : "Even comparison";
  return `${home > away ? homeName : awayName} +${difference}${suffix}`;
}

function getMetricValue(metrics: DerivedTeamMetrics, key: keyof DerivedTeamMetrics) {
  return metrics[key];
}

function BoxScoreCell({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  return <>{displayStat(value, suffix)}</>;
}

function playerPoints(player: Player) {
  return player.stats.points ?? -1;
}

function playerFgPct(boxScore: BoxScore) {
  if (boxScore.twoPM === null || boxScore.threePM === null || boxScore.twoPA === null || boxScore.threePA === null) return null;
  const attempts = boxScore.twoPA + boxScore.threePA;
  return attempts === 0 ? 0 : Math.round(((boxScore.twoPM + boxScore.threePM) / attempts) * 1000) / 10;
}

function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

type IconName = "overview" | "games" | "teams" | "players" | "season" | "matchup" | "health" | "settings" | "sun" | "moon" | "chevron" | "trophy" | "flag" | "target" | "bolt" | "sort" | "sortAsc" | "sortDesc";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    games: <><path d="M6 4.5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h5M8 16h7" /></>,
    teams: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="11" r="2.5" /><path d="M3.8 19c.4-2.9 2.2-4.5 5.2-4.5s4.8 1.6 5.2 4.5M14.7 15.5c2.8-.2 4.7 1 5.5 3.5" /></>,
    players: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.5-3.6 2.8-5.5 7-5.5s6.5 1.9 7 5.5" /></>,
    season: <><path d="M4 18V9M10 18V5M16 18v-7M22 18V3" /><path d="M3 21h20" /></>,
    matchup: <><path d="M5 7h14M5 17h14M8 4 5 7l3 3M16 14l3 3-3 3" /></>,
    health: <><path d="M4 16.5 8 12l3 2 5-7 4 4.5" /><path d="M4 20h16" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.6 8.6 0 1 0 20.5 15.2Z" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    trophy: <><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11M12 13v4M8.5 20h7M10 17h4" /></>,
    flag: <><path d="M6 20V4" /><path d="M6 5h11l-2.5 3 2.5 3H6" /></>,
    target: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" /></>,
    bolt: <path d="m13.5 2-8 11h6l-1 9 8-11h-6l1-9Z" />,
    sort: <><path d="M5 7h14M5 12h11M5 17h7" /></>,
    sortAsc: <><path d="M5 7h7M5 12h11M5 17h14" /></>,
    sortDesc: <><path d="M5 7h14M5 12h11M5 17h7" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function ArrowUpRight() {
  return <svg aria-hidden="true" className="arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>;
}

type CourtMode = "all" | "points" | "missing";

function CourtDiagram({ mode }: { mode: CourtMode }) {
  const { tr } = useI18n();
  const copy = mode === "points"
    ? { kicker: tr("Pistekartta", "Shot map"), title: tr("Koordinaatit puuttuvat", "Coordinates unavailable"), body: tr("Tässä ottelussa ei ole x–y-sijainteja, joista pisteet voisi piirtää.", "This game has no x–y locations from which to plot shots.") }
    : mode === "missing"
      ? { kicker: tr("Datan tila", "Data status"), title: tr("Puuttuva kenttä", "Missing field"), body: tr("Laukaisukoordinaatit vaativat uuden tai rikastetun datalähteen.", "Shot coordinates require a new or enriched data source.") }
      : { kicker: tr("Kenttäanalyysi", "Court analysis"), title: tr("Laukaisukoordinaatit puuttuvat", "Shot coordinates unavailable"), body: tr("Basket.fi / Torneo ei palauta tälle ottelulle x–y-sijainteja.", "Basket.fi / Torneo does not return x–y locations for this game.") };

  return (
    <div className="court-wrap">
      <svg className="court-diagram" viewBox="0 0 820 430" role="img" aria-label={tr("Koripallokenttä ilman laukaisukoordinaatteja", "Basketball court without shot coordinates")}>
        <rect x="14" y="14" width="792" height="402" rx="3" />
        <path d="M410 14v402M14 215h792M410 165a50 50 0 1 0 0 100a50 50 0 1 0 0-100Z" />
        <path d="M14 124h164v182H14M178 124a91 91 0 0 1 0 182M806 124H642v182h164M642 124a91 91 0 0 0 0 182" />
        <path d="M52 184v62M768 184v62M52 215h35M768 215h-35" />
        <circle cx="91" cy="215" r="11" /><circle cx="729" cy="215" r="11" />
      </svg>
      <div className="court-empty-state">
        <span className="court-empty-kicker">{copy.kicker}</span>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
    </div>
  );
}

function BoxScoreTable({ rows }: { rows: Player[] }) {
  const { tr } = useI18n();
  return (
    <div className="box-score-table-wrap">
      <table className="box-score-table">
        <caption className="sr-only">{tr("Ottelun pelaajakohtainen box score", "Game player box score")}</caption>
        <thead>
          <tr>
            <th scope="col">{tr("Pelaaja", "Player")}</th>
            <th scope="col">MIN</th>
            <th scope="col">PTS</th>
            <th scope="col">2PM</th>
            <th scope="col">2PA</th>
            <th scope="col">2P%</th>
            <th scope="col">3PM</th>
            <th scope="col">3PA</th>
            <th scope="col">3P%</th>
            <th scope="col">FTM</th>
            <th scope="col">FTA</th>
            <th scope="col">FT%</th>
            <th scope="col">OR</th>
            <th scope="col">DR</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">TO</th>
            <th scope="col">STL</th>
            <th scope="col">BLK</th>
            <th scope="col">BR</th>
            <th scope="col">PF</th>
            <th scope="col">FD</th>
            <th scope="col">+/-</th>
            <th scope="col">Eff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => {
            const boxScore = player.stats;
            return (
              <tr key={player.name}>
                <th scope="row" className="box-score-player"><span><strong>{player.name}{player.starter ? <em className="starter-marker"> (A)</em> : null}</strong><small>{player.team} · {player.role ?? "—"}</small></span></th>
                <td>{displayMinutes(boxScore.minutes)}</td>
                <td className="box-score-emphasis"><BoxScoreCell value={boxScore.points} /></td>
                <td><BoxScoreCell value={boxScore.twoPM} /></td>
                <td><BoxScoreCell value={boxScore.twoPA} /></td>
                <td><BoxScoreCell value={boxScore.twoPct} suffix="%" /></td>
                <td><BoxScoreCell value={boxScore.threePM} /></td>
                <td><BoxScoreCell value={boxScore.threePA} /></td>
                <td><BoxScoreCell value={boxScore.threePct} suffix="%" /></td>
                <td><BoxScoreCell value={boxScore.ftm} /></td>
                <td><BoxScoreCell value={boxScore.fta} /></td>
                <td><BoxScoreCell value={boxScore.ftPct} suffix="%" /></td>
                <td><BoxScoreCell value={boxScore.offensiveRebounds} /></td>
                <td><BoxScoreCell value={boxScore.defensiveRebounds} /></td>
                <td className="box-score-emphasis"><BoxScoreCell value={boxScore.rebounds} /></td>
                <td><BoxScoreCell value={boxScore.assists} /></td>
                <td><BoxScoreCell value={boxScore.turnovers} /></td>
                <td><BoxScoreCell value={boxScore.steals} /></td>
                <td><BoxScoreCell value={boxScore.blocks} /></td>
                <td><BoxScoreCell value={boxScore.blocksReceived} /></td>
                <td><BoxScoreCell value={boxScore.fouls} /></td>
                <td><BoxScoreCell value={boxScore.foulsDrawn} /></td>
                <td className={boxScore.plusMinus !== null && boxScore.plusMinus > 0 ? "positive" : boxScore.plusMinus !== null && boxScore.plusMinus < 0 ? "negative" : ""}>{displayPlusMinus(boxScore.plusMinus)}</td>
                <td className="box-score-emphasis"><BoxScoreCell value={boxScore.efficiency} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchesView({ onOpenMatch }: { onOpenMatch: (id: string) => void }) {
  const { language, tr } = useI18n();
  const [matchRows, setMatchRows] = useState<MatchListItem[]>([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches()
      .then((records) => {
        if (!cancelled) setMatchRows(records.map(toMatchListItem));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teams = useMemo(() => Array.from(new Set(matchRows.flatMap((item) => [item.homeName, item.awayName])).values()).sort((a, b) => a.localeCompare(b, "fi")), [matchRows]);
  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fi-FI");
    return matchRows.filter((item) => {
      const matchesTeam = teamFilter === "all" || item.homeName === teamFilter || item.awayName === teamFilter;
      const matchesQuery = normalizedQuery.length === 0 || `${item.id} ${item.homeName} ${item.awayName}`.toLocaleLowerCase("fi-FI").includes(normalizedQuery);
      return matchesTeam && matchesQuery;
    });
  }, [matchRows, query, teamFilter]);

  return (
    <>
      <section className="matches-toolbar panel">
        <div>
          <strong>{tr("Naisten Korisliiga", "Women's Korisliiga")} · 2025–26</strong>
          <p>{tr(`${seasonData.aggregate.games} validia box score -ottelua. Päivämäärät on yhdistetty Basket.fi:n kausitulossivulta.`, `${seasonData.aggregate.games} verified box score games. Dates are joined from Basket.fi's season results page.`)}</p>
        </div>
        <div className="matches-toolbar-controls">
          <label>{tr("Hae otteluista", "Search games")}<input aria-label={tr("Hae otteluista", "Search games")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Joukkue tai ottelu-ID", "Team or game ID")} /></label>
          <label>{tr("Joukkue", "Team")}<select aria-label={tr("Rajaa joukkueella", "Filter by team")} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">{tr("Kaikki joukkueet", "All teams")}</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        </div>
      </section>

      <section className="matches-panel panel" aria-labelledby="matches-heading">
        <div className="matches-panel-heading">
          <div><h2 id="matches-heading">{tr("Otteluindeksi", "Game index")}</h2><p>{tr("Valitse ottelu ja avaa sen analyysi.", "Choose a game to open its analysis.")}</p></div>
          <span>{matchRows.length > 0 ? `${filteredMatches.length} / ${matchRows.length}` : `${seasonData.aggregate.games} ${tr("ottelua", "games")}`}</span>
        </div>
        {loadError ? <div className="match-list-empty"><strong>{tr("Ottelulistan lataus epäonnistui", "Could not load games")}</strong><p>{tr("Yritä päivittää sivu. Datan lähde on paikallinen kausitiedosto.", "Try refreshing the page. The data source is a local season file.")}</p></div> : matchRows.length === 0 ? <div className="match-list-empty"><strong>{tr("Ladataan otteluita…", "Loading games…")}</strong><p>{tr("Haetaan tarkistettuja otteluita kausitiedostosta.", "Loading verified games from the season file.")}</p></div> : filteredMatches.length === 0 ? <div className="match-list-empty"><strong>{tr("Ei osumia", "No matches")}</strong><p>{tr("Muuta hakua tai joukkuevalintaa.", "Change the search or team filter.")}</p></div> : (
          <div className="match-list" role="list">
            {filteredMatches.map((item) => {
              const homeWon = item.homeScore > item.awayScore;
              return <button className="match-list-row" key={item.id} onClick={() => onOpenMatch(item.id)} aria-label={tr(`Avaa ottelun ${item.homeName} vastaan ${item.awayName} analyysi`, `Open analysis for ${item.homeName} vs ${item.awayName}`)}>
                <span className="match-list-meta"><strong>#{item.id}</strong><small>{formatScheduledDate(item.scheduledAt, language)}</small></span>
                <span className="match-list-teams"><span className="match-team-side"><strong>{item.homeName}</strong><b className={homeWon ? "match-winner" : ""}>{item.homeScore}</b></span><span className="match-list-vs">vs</span><span className="match-team-side match-team-side-away"><b className={!homeWon ? "match-winner" : ""}>{item.awayScore}</b><strong>{item.awayName}</strong></span><small>{item.venue} · {homeWon ? item.homeName : item.awayName} {tr("voitti", "won")}</small></span>
                <span className="match-list-open"><span>Box score</span><Icon name="chevron" size={14} /></span>
              </button>;
            })}
          </div>
        )}
      </section>
    </>
  );
}

function overviewValue(value: number | null, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}${suffix}`;
}

function overviewIntegerValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}`;
}

function overviewSignedIntegerValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${overviewIntegerValue(value)}` : overviewIntegerValue(value);
}

function overviewSignedValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${overviewValue(value)}` : overviewValue(value);
}

type StandingRow = {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

function buildStandings(records: SeasonMatchRecord[]) {
  const standings = new Map<string, StandingRow>();
  for (const team of seasonData.aggregate.teams) {
    standings.set(team.name, { name: team.name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const record of records) {
    const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
    const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
    if (!home || !away) continue;
    const homeStanding = standings.get(home.name);
    const awayStanding = standings.get(away.name);
    if (!homeStanding || !awayStanding) continue;
    homeStanding.pointsFor += home.score;
    homeStanding.pointsAgainst += away.score;
    awayStanding.pointsFor += away.score;
    awayStanding.pointsAgainst += home.score;
    if (home.score > away.score) {
      homeStanding.wins += 1;
      awayStanding.losses += 1;
    } else if (away.score > home.score) {
      awayStanding.wins += 1;
      homeStanding.losses += 1;
    }
  }

  return Array.from(standings.values()).sort((a, b) => {
    const winDifference = b.wins - a.wins;
    if (winDifference !== 0) return winDifference;
    const pointDifference = (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    if (pointDifference !== 0) return pointDifference;
    return b.pointsFor - a.pointsFor;
  });
}

type TeamSortKey = "offensive_rating" | "defensive_rating" | "net_rating" | "three_point_attempt_rate";
type SortDirection = "asc" | "desc";

const teamSortLabels: Record<TeamSortKey, string> = {
  offensive_rating: "ORtg",
  defensive_rating: "DRtg",
  net_rating: "Net",
  three_point_attempt_rate: "3PA-osuus",
};

function teamSortLabel(key: TeamSortKey, translate: (finnish: string, english: string) => string) {
  return translate(teamSortLabels[key], key === "three_point_attempt_rate" ? "3PA share" : teamSortLabels[key]);
}

const teamDefaultDirections: Record<TeamSortKey, SortDirection> = {
  offensive_rating: "desc",
  defensive_rating: "asc",
  net_rating: "desc",
  three_point_attempt_rate: "desc",
};

function OverviewContext({ onOpenMatches }: { onOpenMatches: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { tr } = useI18n();
  const leagueName = tr("Naisten Korisliiga", "Women's Korisliiga");

  return (
    <div className="overview-context" aria-label={tr("Valittu sarja ja kausi", "Selected league and season")}>
      <div className="overview-context-competition">
        <button className="context-selector" type="button" aria-expanded={isOpen} aria-controls="overview-context-menu" aria-haspopup="listbox" onClick={() => setIsOpen((open) => !open)}>
          <span><strong>{leagueName}</strong><span>2025–26</span></span>
          <Icon name="chevron" size={12} />
        </button>
        {isOpen && <div className="context-menu" id="overview-context-menu" role="listbox" aria-label={tr("Sarjan ja kauden valinta", "League and season selector")}>
          <button className="context-option active" type="button" role="option" aria-selected="true" onClick={() => setIsOpen(false)}><span>{leagueName}</span><small>{tr("2025–26 · valittu", "2025–26 · selected")}</small></button>
          <p className="context-menu-note">{tr("Muut sarjat ja kaudet liitetään tähän valikkoon myöhemmin.", "Other leagues and seasons will be added here later.")}</p>
        </div>}
      </div>
      <div className="overview-context-stat"><strong>{seasonData.aggregate.games}</strong><span>{tr("ottelua", "games")}</span></div>
      <div className="overview-context-stat"><strong>{seasonData.aggregate.teams.length}</strong><span>{tr("joukkuetta", "teams")}</span></div>
      <button className="outline-button small" onClick={onOpenMatches}>{tr("Selaa otteluita", "Browse games")} <ArrowUpRight /></button>
    </div>
  );
}

function PaperTeamMarker({ teamName, status }: { teamName: string; status: "winner" | "last" }) {
  const initials = teamName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  return (
    <div className={`paper-team-marker paper-team-marker--${status}`} aria-hidden="true">
      <span className="paper-team-marker-initials">{initials}</span>
      <span className="paper-team-marker-status"><Icon name={status === "winner" ? "trophy" : "flag"} size={17} /></span>
    </div>
  );
}

function PaperLeaderCard({ title, playerName, value, team, shaderColor, valueColor, visual }: { title: string; playerName: string; value: string; team: string; shaderColor: string; valueColor: string; visual?: ReactNode }) {
  return (
    <div className="overview-leader-card overview-leader-card--ppg" style={{ "--ppg-value-color": valueColor } as CSSProperties}>
      <PaperLeaderShader colorFront={shaderColor} />
      <div className="ppg-card-content">
        <div className="ppg-card-title">{title}</div>
        <div className="ppg-card-player">{playerName}</div>
        <div className="ppg-card-value">{value}</div>
        <div className="ppg-card-team">{team}</div>
        {visual ?? <img className="ppg-card-silhouette" src="/ppg-silhouette.png" alt="" aria-hidden="true" />}
      </div>
    </div>
  );
}

function OverviewSectionLinks({ tr }: { tr: (fi: string, en: string) => string }) {
  const links = [
    { href: "#overview-summary", label: tr("Yhteenveto", "Summary") },
    { href: "#overview-leaders", label: tr("Kauden kärjet", "Season leaders") },
    { href: "#overview-scratchpad", label: tr("Rakenna analyysikysymys", "Build an analysis question") },
    { href: "#overview-teams", label: tr("Joukkueet", "Teams") },
    { href: "#team-style-map", label: "Team Style Map" },
    { href: "#team-game-split", label: tr("Pelitavan ja tuloksen yhteys", "Playing style and outcome") },
  ];

  return <>
    <nav className="overview-section-nav overview-section-nav--desktop" aria-label={tr("Yleiskatsauksen osiot", "Overview sections")}>
      <div className="overview-section-nav-rail">
        {links.map((link) => (
          <a className="overview-section-nav-marker" href={link.href} key={link.href} aria-label={link.label}>
            <span className="overview-section-nav-marker-bar" aria-hidden="true" />
            <span className="overview-section-nav-marker-tooltip" aria-hidden="true">{link.label}</span>
          </a>
        ))}
      </div>
    </nav>

    <details className="overview-section-nav overview-section-nav--mobile">
      <summary>{tr("Sisältö", "Contents")} <Icon name="chevron" size={14} /></summary>
      <ol>
        {links.map((link, index) => <li key={link.href}><a href={link.href}><span className="overview-section-nav-number">{String(index + 1).padStart(2, "0")}</span><span className="overview-section-nav-label">{link.label}</span></a></li>)}
      </ol>
    </details>
  </>;
}

type ScratchMetricKey = "steals" | "fta" | "three_pa" | "turnovers" | "points";
type ScratchPeriodKey = "game" | "q1" | "q2" | "q3" | "q4";

const scratchMetrics: Array<{ key: ScratchMetricKey; labelFi: string; labelEn: string }> = [
  { key: "steals", labelFi: "riistot", labelEn: "steals" },
  { key: "fta", labelFi: "FTA", labelEn: "FTA" },
  { key: "three_pa", labelFi: "3PA", labelEn: "3PA" },
  { key: "turnovers", labelFi: "menetykset", labelEn: "turnovers" },
  { key: "points", labelFi: "pisteet", labelEn: "points" },
];

const scratchPeriods: Array<{ key: ScratchPeriodKey; labelFi: string; labelEn: string }> = [
  { key: "game", labelFi: "koko ottelussa", labelEn: "in the full game" },
  { key: "q1", labelFi: "ensimmäisellä neljänneksellä", labelEn: "in the first quarter" },
  { key: "q2", labelFi: "toisella neljänneksellä", labelEn: "in the second quarter" },
  { key: "q3", labelFi: "kolmannella neljänneksellä", labelEn: "in the third quarter" },
  { key: "q4", labelFi: "viimeisellä neljänneksellä", labelEn: "in the final quarter" },
];

function OverviewScratchpad() {
  const { tr, language } = useI18n();
  const [subject, setSubject] = useState("all");
  const [metricKey, setMetricKey] = useState<ScratchMetricKey>("steals");
  const metric = scratchMetrics.find((item) => item.key === metricKey)!;
  const metricLabel = tr(metric.labelFi, metric.labelEn);
  const format = (value: number, digits = 0) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const rows = seasonData.aggregate.teams
    .filter((team) => subject === "all" || team.name === subject)
    .map((team) => ({ name: team.name, games: team.games, total: team.totals[metricKey], average: team.games > 0 ? team.totals[metricKey] / team.games : null }))
    .sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity) || a.name.localeCompare(b.name, "fi"));

  return (
    <section id="overview-scratchpad" className="panel overview-scratchpad overview-section-anchor" aria-labelledby="overview-scratchpad-heading">
      <div className="panel-heading panel-heading--plain">
        <div>
          <h3 id="overview-scratchpad-heading">{tr("Rakenna analyysikysymys", "Build an analysis question")}</h3>
          <p className="panel-subcopy">{tr("Rakenna yksi analyysikysymys vaihdettavista palikoista.", "Build one analysis question from swappable building blocks.")}</p>
        </div>
        <span className="panel-context">2025–26</span>
      </div>

      <div className="overview-scratchpad-controls">
        <label>
          <span>{tr("Kuka?", "Who?")}</span>
          <select value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="all">{tr("Jokaisen joukkueen", "Every team")}</option>
            {seasonData.aggregate.teams.map((team) => <option value={team.name} key={team.name}>{team.name}</option>)}
          </select>
        </label>
        <label>
          <span>{tr("Mitä?", "What?")}</span>
          <select value={metricKey} onChange={(event) => setMetricKey(event.target.value as ScratchMetricKey)}>
            {scratchMetrics.map((item) => <option value={item.key} key={item.key}>{tr(item.labelFi, item.labelEn)}</option>)}
          </select>
        </label>
        <label>
          <span>{tr("Milloin?", "When?")}</span>
          <select defaultValue="game" aria-describedby="scratchpad-period-note">
            {scratchPeriods.map((item) => <option value={item.key} key={item.key} disabled={item.key !== "game"}>{tr(item.labelFi, item.labelEn)}{item.key !== "game" ? tr(" — ei vielä saatavilla", " — not yet available") : ""}</option>)}
          </select>
        </label>
      </div>

      <p id="scratchpad-period-note" className="scratchpad-note">{tr("Neljänneskohtaiset valinnat eivät ole vielä saatavilla.", "Quarter-level selections are not available yet.")}</p>
      <div className="scratchpad-results" aria-live="polite" aria-atomic="true">
        <table>
          <thead><tr><th scope="col">{tr("Joukkue", "Team")}</th><th scope="col">{tr("Keskiarvo / ottelu", "Average / game")}</th><th scope="col">{tr("Yhteensä", "Total")}</th><th scope="col">{tr("Ottelut", "Games")}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td><strong>{row.average === null ? "—" : format(row.average, 1)}</strong></td><td>{format(row.total)}</td><td>{format(row.games)}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p>{tr("Valinnalle ei ole saatavilla tuloksia.", "No results available for this selection.")}</p>}
      </div>
      <p className="scratchpad-note">{tr("Mukana koko ottelu jatkoaikoineen. Joukkueet järjestetty ottelukeskiarvon mukaan suurimmasta pienimpään; suurempi luku ei aina tarkoita parempaa.", "Full games include overtime. Teams are ordered by average from highest to lowest; higher does not always mean better.")}</p>
    </section>
  );
}

function OverviewView({ onOpenTeams }: { onOpenTeams: () => void }) {
  const { tr } = useI18n();
  const league = seasonData.aggregate.league;
  const leaguePace = league.games > 0 ? league.metrics.estimated_possessions / (league.games * 2) : null;
  const netRankedTeams = useMemo(() => [...seasonData.aggregate.teams].sort((a, b) => b.metrics.net_rating - a.metrics.net_rating), []);
  const largestNetRating = Math.max(1, ...netRankedTeams.map((team) => Math.abs(team.metrics.net_rating)));
  const leadingTeam = netRankedTeams[0];
  const trailingTeam = netRankedTeams[netRankedTeams.length - 1];
  const [teamSort, setTeamSort] = useState<{ key: TeamSortKey; direction: SortDirection }>({ key: "net_rating", direction: "desc" });
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [seasonPlayers, setSeasonPlayers] = useState<SeasonPlayerRow[]>([]);
  const [seasonMatches, setSeasonMatches] = useState<SeasonMatchRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches().then((records) => {
      if (cancelled) return;
      setStandings(buildStandings(records));
      setSeasonPlayers(aggregateSeasonPlayers(records));
      setSeasonMatches(records);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTeams = useMemo(() => [...seasonData.aggregate.teams].sort((a, b) => {
    const aValue = a.metrics[teamSort.key];
    const bValue = b.metrics[teamSort.key];
    return teamSort.direction === "desc" ? bValue - aValue : aValue - bValue;
  }), [teamSort]);

  const toggleTeamSort = (key: TeamSortKey) => {
    setTeamSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: teamDefaultDirections[key] });
  };

  const qualifiedPlayers = useMemo(() => seasonPlayers.filter((player) => player.games >= 8 && player.minutes >= 120), [seasonPlayers]);
  const ppgLeader = [...qualifiedPlayers].sort((a, b) => (playerPerGame(b, "points") ?? -1) - (playerPerGame(a, "points") ?? -1))[0];
  const efficiencyLeader = [...qualifiedPlayers].sort((a, b) => (playerEfficiencyPer40(b) ?? -1) - (playerEfficiencyPer40(a) ?? -1))[0];
  const winner = standings[0];
  const lastPlace = standings[standings.length - 1];

  return (
    <>
      <section id="overview-summary" className="overview-metrics-grid overview-section-anchor" aria-label={tr("Liigan keskeiset tunnusluvut", "League key metrics")}>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.offensive_rating)} <span className="overview-metric-unit">ORtg</span></strong><small>{tr("Sarjan hyökkäystehokkuus", "League offensive efficiency")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(leaguePace)} <span className="overview-metric-unit">{tr("pallonhallintaa / ottelu", "possessions/game")}</span></strong><small>{tr("Pelin tempo", "Game pace")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.three_point_attempt_rate, "%")} <span className="overview-metric-unit">{tr("kolmosyritysten osuus", "shots from three")}</span></strong><small>{tr("Heittoprofiili", "Shot profile")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.efg_pct, "%")} <span className="overview-metric-unit">eFG</span></strong><small>{tr("Heittotehokkuus", "Shooting efficiency")}</small></div>
      </section>

      <section id="overview-leaders" className="panel overview-leaders-panel overview-section-anchor" aria-labelledby="overview-leaders-heading">
        <div className="panel-heading panel-heading--plain"><div><h3 id="overview-leaders-heading">{tr("Kauden kärjet", "Season leaders")}</h3><p className="panel-subcopy">{tr("Perusluvut saavat tässä rinnalleen kauden kontekstin.", "Core stats, with season context alongside them.")}</p></div><span className="panel-context">{tr("min. 8 ottelua pelaajille", "min. 8 games for players")}</span></div>
        <div className="overview-leader-grid">
          <PaperLeaderCard
            title={tr("Runkosarjan ykkönen", "Regular-season leader")}
            playerName={winner?.name ?? tr("Ladataan…", "Loading…")}
            value={winner ? `${winner.wins} ${tr("voittoa", "wins")}` : "—"}
            team={winner ? `${overviewSignedIntegerValue(winner.pointsFor - winner.pointsAgainst)} ${tr("piste-ero", "point differential")}` : tr("Sijoitus muodostetaan", "Ranking is calculated")}
            shaderColor="#54E08B33"
            valueColor="#54E08B"
            visual={<PaperTeamMarker teamName={winner?.name ?? "?"} status="winner" />}
          />
          <PaperLeaderCard
            title={tr("Runkosarjan viimeinen", "Bottom of the regular season")}
            playerName={lastPlace?.name ?? tr("Ladataan…", "Loading…")}
            value={lastPlace ? `${lastPlace.losses} ${tr("tappiota", "losses")}` : "—"}
            team={lastPlace ? `${overviewSignedIntegerValue(lastPlace.pointsFor - lastPlace.pointsAgainst)} ${tr("piste-ero", "point differential")}` : tr("Sijoitus muodostetaan", "Ranking is calculated")}
            shaderColor="#FF756A33"
            valueColor="#FF756A"
            visual={<PaperTeamMarker teamName={lastPlace?.name ?? "?"} status="last" />}
          />
          <PaperLeaderCard
            title={tr("Eniten pisteitä / ottelu", "Most points / game")}
            playerName={ppgLeader?.name ?? tr("Ladataan…", "Loading…")}
            value={ppgLeader ? `${overviewValue(playerPerGame(ppgLeader, "points"))} PPG` : "—"}
            team={ppgLeader?.team ?? tr("Pelaajatiedot latautuvat", "Player data is loading")}
            shaderColor="#6B49DE33"
            valueColor="#6AC432"
          />
          <PaperLeaderCard
            title={tr("Tehokkain peliaikaan nähden", "Most efficient per minute")}
            playerName={efficiencyLeader?.name ?? tr("Ladataan…", "Loading…")}
            value={efficiencyLeader ? `${overviewValue(playerEfficiencyPer40(efficiencyLeader))} Eff/40` : "—"}
            team={efficiencyLeader?.team ?? tr("Pelaajatiedot latautuvat", "Player data is loading")}
            shaderColor="#54E08B33"
            valueColor="#54E08B"
          />
        </div>
      </section>

      <OverviewScratchpad />

      <section id="overview-teams" className="overview-layout overview-section-anchor">
        <div className="panel overview-table-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Joukkueiden tehokkuus", "Team efficiency")}</h3><p className="panel-subcopy">{tr("Net Rating yhdistää hyökkäyksen ja puolustuksen samaan vertailuun.", "Net Rating combines offense and defense in one comparison.")}</p></div><button className="outline-button small" onClick={onOpenTeams}>{tr("Joukkueprofiilit", "Team profiles")} <ArrowUpRight /></button></div>
          <div className="overview-table-wrap">
            <table className="overview-table">
              <caption className="sr-only">{tr("Naisten Korisliigan joukkueiden tehokkuusvertailu", "Women's Korisliiga team efficiency comparison")}</caption>
              <thead><tr><th scope="col">#</th><th scope="col">{tr("Joukkue", "Team")}</th>{(Object.keys(teamSortLabels) as TeamSortKey[]).map((key) => <th key={key} scope="col" aria-sort={teamSort.key === key ? teamSort.direction === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button ${teamSort.key === key ? "active" : ""}`} type="button" onClick={() => toggleTeamSort(key)} aria-label={`${tr("Järjestä", "Sort by")} ${teamSortLabel(key, tr)}`}><span>{teamSortLabel(key, tr)}</span><span className="sort-indicator" aria-hidden="true"><Icon name={teamSort.key !== key ? "sort" : teamSort.direction === "asc" ? "sortAsc" : "sortDesc"} size={12} /></span></button></th>)}</tr></thead>
              <tbody>{sortedTeams.map((team, index) => <tr className={index === 0 ? "overview-team-row--leader" : index === sortedTeams.length - 1 ? "overview-team-row--trailing" : ""} key={team.name}><td className="rank">{index + 1}</td><th scope="row">{team.name}</th><td>{overviewValue(team.metrics.offensive_rating)}</td><td>{overviewValue(team.metrics.defensive_rating)}</td><td className={team.metrics.net_rating >= 0 ? "metric-positive" : "metric-negative"}>{overviewSignedValue(team.metrics.net_rating)}</td><td>{overviewValue(team.metrics.three_point_attempt_rate, "%")}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="overview-table-note">{tr("Klikkaa mittarin otsikkoa vaihtaaksesi järjestystä. Sijoitus seuraa valittua mittaria; DRtg:ssä pienempi on parempi, joten oletus alkaa pienimmästä.", "Click a metric heading to change the order. Ranking follows the selected metric; lower DRtg is better, so it starts from the lowest value.")}</p>
        </div>

        <div className="panel overview-control-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Hallinnan jakauma", "Control distribution")}</h3><p className="panel-subcopy">{tr("Net Rating tekee joukkueiden peliedusta näkyvän suhteessa nollatasoon.", "Net Rating makes each team's edge visible relative to zero.")}</p></div><span className="panel-context panel-context--derived">proxy</span></div>
          <div className="control-plot" role="group" aria-labelledby="control-plot-title">
            <span id="control-plot-title" className="sr-only">{tr("Joukkueiden Net Rating -jakauma: positiivinen arvo on nollatason oikealla puolella ja negatiivinen vasemmalla puolella.", "Team Net Rating distribution: positive values sit right of zero and negative values sit left of zero.")}</span>
            <div className="control-scale"><span>{tr("alle 0", "below 0")}</span><span>0</span><span>{tr("yli 0", "above 0")}</span></div>
            <div className="control-rows">{netRankedTeams.map((team) => {
              const isPositive = team.metrics.net_rating >= 0;
              const barWidth = `${(Math.abs(team.metrics.net_rating) / largestNetRating) * 45}%`;
              return <div className="control-row" key={team.name}><span>{team.name}</span><div className="control-track"><i className={`control-bar ${isPositive ? "positive" : "negative"}`} style={isPositive ? { left: "50%", width: barWidth } : { right: "50%", width: barWidth }} /></div><b className={isPositive ? "metric-positive" : "metric-negative"}>{overviewSignedValue(team.metrics.net_rating)}</b></div>;
            })}</div>
          </div>
          <div className="control-readout"><strong>{leadingTeam.name} {overviewSignedValue(leadingTeam.metrics.net_rating)} · {trailingTeam.name} {overviewSignedValue(trailingTeam.metrics.net_rating)}</strong><p>{tr("Net Rating on tässä hallinnan suuntaa-antava proxy: se tiivistää hyökkäyksen ja puolustuksen piste-eron arvioitua pallonhallintaa kohden. Se ei ole Basket.fi:n oma tilastokenttä.", "Net Rating is a directional proxy here: it summarizes scoring margin per estimated possession. It is not an official Basket.fi field.")}</p></div>
        </div>
      </section>

      <div id="team-style-map" className="overview-section-anchor"><TeamStyleMap teams={seasonData.aggregate.teams} /></div>
      <div id="team-game-split" className="overview-section-anchor"><TeamGameSplit matches={seasonMatches} /></div>

      <div className="overview-coverage"><span><strong>{tr("Aineisto", "Dataset")}</strong><span>{tr("tarkistettu runkosarjan box score -aineisto", "verified regular-season box score data")}</span></span><span><strong>Basket.fi</strong><span>{tr("päivämäärät tuloslistalta · tilastot ottelusivuilta", "dates from results page · stats from game pages")}</span></span></div>
    </>
  );
}

type PlayerSeasonSortKey = "games" | "minutes" | "pointsPerGame" | "fgPct" | "threePct" | "reboundsPerGame" | "assistsPerGame" | "efficiencyPer40" | "attemptsPer40";

const playerSeasonSortLabels: Record<PlayerSeasonSortKey, string> = {
  games: "GP",
  minutes: "MIN",
  pointsPerGame: "PPG",
  fgPct: "FG%",
  threePct: "3P%",
  reboundsPerGame: "REB/G",
  assistsPerGame: "AST/G",
  efficiencyPer40: "Eff/40",
  attemptsPer40: "FGA/40",
};

function playerSeasonSortValue(player: SeasonPlayerRow, key: PlayerSeasonSortKey) {
  switch (key) {
    case "games": return player.games;
    case "minutes": return player.minutes;
    case "pointsPerGame": return playerPerGame(player, "points");
    case "fgPct": return playerFgPctFromTotals(player);
    case "threePct": return playerThreePctFromTotals(player);
    case "reboundsPerGame": return playerPerGame(player, "rebounds");
    case "assistsPerGame": return playerPerGame(player, "assists");
    case "efficiencyPer40": return playerEfficiencyPer40(player);
    case "attemptsPer40": return playerAttemptsPer40(player);
  }
}

function PlayersView() {
  const { tr } = useI18n();
  const [seasonPlayers, setSeasonPlayers] = useState<SeasonPlayerRow[]>([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sort, setSort] = useState<{ key: PlayerSeasonSortKey; direction: SortDirection }>({ key: "pointsPerGame", direction: "desc" });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches()
      .then((records) => {
        if (!cancelled) setSeasonPlayers(aggregateSeasonPlayers(records));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teams = useMemo(() => Array.from(new Set(seasonPlayers.map((player) => player.team))).sort((a, b) => a.localeCompare(b, "fi")), [seasonPlayers]);
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fi-FI");
    return seasonPlayers.filter((player) => {
      const matchesTeam = teamFilter === "all" || player.team === teamFilter;
      const matchesQuery = normalizedQuery.length === 0 || `${player.name} ${player.team}`.toLocaleLowerCase("fi-FI").includes(normalizedQuery);
      return matchesTeam && matchesQuery;
    });
  }, [seasonPlayers, query, teamFilter]);
  const sortedPlayers = useMemo(() => [...filteredPlayers].sort((a, b) => {
    const aValue = playerSeasonSortValue(a, sort.key);
    const bValue = playerSeasonSortValue(b, sort.key);
    if (aValue === null && bValue === null) return a.name.localeCompare(b.name, "fi");
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    if (aValue !== bValue) return sort.direction === "desc" ? bValue - aValue : aValue - bValue;
    return a.name.localeCompare(b.name, "fi");
  }), [filteredPlayers, sort]);

  const qualifiedPlayers = useMemo(() => seasonPlayers.filter((player) => player.games >= 8 && player.minutes >= 120), [seasonPlayers]);
  const ppgLeader = [...qualifiedPlayers].sort((a, b) => (playerPerGame(b, "points") ?? -1) - (playerPerGame(a, "points") ?? -1))[0];
  const efficiencyLeader = [...qualifiedPlayers].sort((a, b) => (playerEfficiencyPer40(b) ?? -1) - (playerEfficiencyPer40(a) ?? -1))[0];
  const minutesLeader = [...seasonPlayers].sort((a, b) => b.minutes - a.minutes)[0];

  const togglePlayerSort = (key: PlayerSeasonSortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: "desc" });
  };

  const sortableHeader = (key: PlayerSeasonSortKey) => {
    const active = sort.key === key;
    return <th key={key} scope="col" aria-sort={active ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button ${active ? "active" : ""}`} type="button" onClick={() => togglePlayerSort(key)} aria-label={`${tr("Järjestä", "Sort by")} ${playerSeasonSortLabels[key]}`}><span>{playerSeasonSortLabels[key]}</span><span className="sort-indicator" aria-hidden="true"><Icon name={!active ? "sort" : sort.direction === "asc" ? "sortAsc" : "sortDesc"} size={12} /></span></button></th>;
  };

  return (
    <>
      <section className="players-toolbar panel">
        <div><strong>{tr("Naisten Korisliiga", "Women's Korisliiga")} · 2025–26</strong><p>{seasonPlayers.length > 0 ? tr(`${seasonPlayers.length} pelaajaa yhdistetty ottelukohtaisista box scoreista.`, `${seasonPlayers.length} players merged from game-level box scores.`) : tr("Ladataan kauden pelaajia…", "Loading season players…")} {tr("Järjestettävä listaus näyttää koko aineiston, ei vain kärkinimiä.", "The sortable list shows the full dataset, not only the leaders.")}</p></div>
        <div className="players-toolbar-controls">
          <label>{tr("Hae pelaajista", "Search players")}<input aria-label={tr("Hae pelaajista", "Search players")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Pelaaja tai joukkue", "Player or team")} /></label>
          <label>{tr("Joukkue", "Team")}<select aria-label={tr("Rajaa pelaajat joukkueella", "Filter players by team")} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">{tr("Kaikki joukkueet", "All teams")}</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        </div>
      </section>

      <section className="players-leaders-grid" aria-label="Pelaajien kauden kärjet">
        <div className="panel player-leader-card"><span className="stat-label">{tr("Eniten pisteitä / ottelu", "Most points / game")}</span><strong>{ppgLeader?.name ?? tr("Ladataan…", "Loading…")}</strong><b>{ppgLeader ? `${overviewValue(playerPerGame(ppgLeader, "points"))} PPG` : "—"}</b><small>{ppgLeader ? `${ppgLeader.team} · ${tr("vähintään 8 ottelua", "at least 8 games")}` : ""}</small></div>
        <div className="panel player-leader-card"><span className="stat-label">{tr("Tehokkain peliaikaan nähden", "Most efficient per minute")}</span><strong>{efficiencyLeader?.name ?? tr("Ladataan…", "Loading…")}</strong><b>{efficiencyLeader ? `${overviewValue(playerEfficiencyPer40(efficiencyLeader))} Eff/40` : "—"}</b><small>{efficiencyLeader ? `${efficiencyLeader.team} · FGA/40 ${overviewValue(playerAttemptsPer40(efficiencyLeader))}` : tr("Eff normalisoituna 40 minuuttiin", "Efficiency normalized to 40 minutes")}</small></div>
        <div className="panel player-leader-card"><span className="stat-label">{tr("Eniten peliminuutteja", "Most minutes played")}</span><strong>{minutesLeader?.name ?? tr("Ladataan…", "Loading…")}</strong><b>{minutesLeader ? `${overviewValue(minutesLeader.minutes)} MIN` : "—"}</b><small>{minutesLeader ? `${minutesLeader.team} · ${minutesLeader.games} ${tr("ottelua", "games")}` : ""}</small></div>
      </section>

      <section className="panel players-table-panel" aria-labelledby="players-list-heading">
        <div className="panel-heading panel-heading--plain"><div><h2 id="players-list-heading">{tr("Pelaajapooli", "Player pool")}</h2><p className="panel-subcopy">{tr("Kaikki vähintään yhden minuutin pelanneet pelaajat. Klikkaa mittaria vaihtaaksesi järjestyksen.", "Every player with at least one minute. Click a metric to change the order.")}</p></div><span className="panel-context">{seasonPlayers.length > 0 ? `${filteredPlayers.length} / ${seasonPlayers.length}` : "—"}</span></div>
        {loadError ? <div className="match-list-empty"><strong>{tr("Pelaajalistan lataus epäonnistui", "Could not load players")}</strong><p>{tr("Yritä päivittää sivu. Datan lähde on paikallinen kausitiedosto.", "Try refreshing the page. The data source is a local season file.")}</p></div> : seasonPlayers.length === 0 ? <div className="match-list-empty"><strong>{tr("Ladataan pelaajia…", "Loading players…")}</strong><p>{tr("Yhdistetään ottelukohtaisia box score -rivejä kausitasolle.", "Merging game-level box score rows into season totals.")}</p></div> : sortedPlayers.length === 0 ? <div className="match-list-empty"><strong>{tr("Ei osumia", "No matches")}</strong><p>{tr("Muuta hakua tai joukkuevalintaa.", "Change the search or team filter.")}</p></div> : <div className="players-table-wrap">
          <table className="players-table">
            <caption className="sr-only">Naisten Korisliigan kauden pelaajalista</caption>
            <thead><tr><th scope="col">#</th><th scope="col">{tr("Pelaaja", "Player")}</th><th scope="col">{tr("Joukkue", "Team")}</th>{(Object.keys(playerSeasonSortLabels) as PlayerSeasonSortKey[]).map(sortableHeader)}</tr></thead>
            <tbody>{sortedPlayers.map((player, index) => <tr key={player.id}><td className="rank">{index + 1}</td><th scope="row" className="players-table-player"><strong>{player.name}</strong><small>{player.starts > 0 ? `${player.starts} ${tr("aloitusta", "starts")}` : tr("Ei avausmerkintää", "No start data")}</small></th><td className="players-table-team">{player.team}</td><td>{player.games}</td><td>{overviewValue(player.minutes)}</td><td className="players-table-emphasis">{overviewValue(playerPerGame(player, "points"))}</td><td>{overviewValue(playerFgPctFromTotals(player), "%")}</td><td>{overviewValue(playerThreePctFromTotals(player), "%")}</td><td>{overviewValue(playerPerGame(player, "rebounds"))}</td><td>{overviewValue(playerPerGame(player, "assists"))}</td><td className="players-table-emphasis">{overviewValue(playerEfficiencyPer40(player))}</td><td>{overviewValue(playerAttemptsPer40(player))}</td></tr>)}</tbody>
          </table>
        </div>}
        <p className="players-method-note">{tr("Kosketuksia ei ole mukana Basket.fi:n nykyisessä lähteessä. Eff/40 normalisoi lähteen tehokkuuden peliaikaan; FGA/40 kertoo samalla, kuinka aktiivisesti pelaaja käytti heittoja. Nämä eivät väitä mittaavansa kosketuksia.", "Touches are not included in the current Basket.fi source. Eff/40 normalizes source efficiency to playing time; FGA/40 adds a shot-activity context. Neither claims to measure touches.")}</p>
      </section>
    </>
  );
}

function SeasonView() {
  const { tr } = useI18n();
  const totals = seasonData.aggregate.league.totals;
  const games = seasonData.aggregate.games;
  const totalTwoPM = totals.two_pm;
  const totalTwoPA = totals.two_pa;
  const totalThreePM = totals.three_pm;
  const totalThreePA = totals.three_pa;
  const totalFgm = totalTwoPM + totalThreePM;
  const totalFga = totalTwoPA + totalThreePA;
  const percent = (value: number, denominator: number) => denominator === 0 ? "—" : `${Math.round((value / denominator) * 1000) / 10}%`;
  const sampleMetrics = [
    { label: `3PA / ${tr("joukkue", "team")} / ${tr("ottelu", "game")}`, value: `${Math.round(totalThreePA / (2 * games) * 10) / 10}`, note: `${games} ${tr("ottelun otos", "game sample")}` },
    { label: tr("3PA-osuus", "3PA share"), value: percent(totalThreePA, totalFga), note: tr("kaikista FG-yrityksistä", "of all FG attempts") },
    { label: "FG%", value: percent(totalFgm, totalFga), note: tr("2P + 3P yhteensä", "2P + 3P combined") },
    { label: "3P%", value: percent(totalThreePM, totalThreePA), note: tr("3P-yrityksistä", "of 3P attempts") },
  ];

  return (
    <>
      <section className="season-toolbar panel">
        <div><strong>{tr("Naisten Korisliiga", "Women's Korisliiga")}</strong><small>{tr("Kaikki joukkueet · ottelukohtainen box score", "All teams · game-level box scores")}</small></div>
        <div className="season-toolbar-actions"><span className="season-chip active">2025–26</span><span className="season-chip">{games === seasonData.summary.available_played_games ? tr("Koko runkosarja", "Full regular season") : tr("Osittainen aineisto", "Partial dataset")}</span><span className="season-sample">{games} / {seasonData.summary.available_played_games} {tr("ottelua tarkistettu", "games verified")}</span></div>
      </section>

      <section className="season-metrics-grid">
        {sampleMetrics.map((metric) => <div className="panel season-metric" key={metric.label}><span className="stat-label">{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}
      </section>

      <section className="season-layout">
        <div className="panel season-trend-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Heittoprofiilin trendi", "Shot profile trend")}</h3></div><span className="panel-context">{tr("ei vielä riittävää aineistoa", "not enough data yet")}</span></div>
          <div className="trend-stage">
            <div className="trend-grid-lines"><span>{tr("enemmän", "more")}</span><i /><i /><i /><span>{tr("vähemmän", "less")}</span></div>
            <div className="trend-empty"><strong>{tr("Kausivertailu tarvitsee vähintään kaksi kattavaa kautta", "Season comparison needs at least two complete seasons")}</strong><p>{tr(`Nykyiset luvut perustuvat ${games} tarkistettuun otteluun. Aineisto ei vielä kuvaa koko sarjan vuosikehitystä.`, `Current figures are based on ${games} verified games. The dataset does not yet show the league's long-term trend.`)}</p></div>
          </div>
          <div className="trend-legend"><span><i className="legend-dot mint-dot" /> {tr("3PA-osuus", "3PA share")}</span><span><i className="legend-dot coral-dot" /> 3P%</span><span className="legend-note">{tr("näytä muutos prosenttiyksikköinä", "show change in percentage points")}</span></div>
        </div>

        <div className="panel season-coverage-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Data kasvaa näin", "How the dataset grows")}</h3></div><span className="signal-count">1 / 3</span></div>
          <div className="season-timeline">
            <div className="season-timeline-row muted"><span>2024–25</span><strong>{tr("Ei ladattu", "Not loaded")}</strong><small>{tr("odottaa kausitiedoston latausta", "waiting for season file")}</small></div>
            <div className="season-timeline-row current"><span>2025–26</span><strong>{games} / 108 {tr("ottelua", "games")}</strong><small>{tr("runkosarjan tarkistetut ottelutilastot", "verified regular-season game stats")}</small></div>
            <div className="season-timeline-row"><span>2026–27</span><strong>{tr("Kerätään", "Collecting")}</strong><small>{tr("108 ohjelmassa · 0 pelattua", "108 scheduled · 0 played")}</small></div>
          </div>
          <p className="season-coverage-note">{tr("Kun kausien määrä ja ottelumäärä kasvavat, sama näkymä vaihtuu testinäytteestä oikeaksi trendianalyysiksi.", "As seasons and game counts grow, this view will move from a test sample to a real trend analysis.")}</p>
        </div>
      </section>

      <section className="panel season-read-panel">
        <div className="panel-heading panel-heading--plain"><div><h3>{tr("KorisIQ lisää kontekstin, ei vain rankingia", "KorisIQ adds context, not just rankings")}</h3></div><span className="panel-context">{tr("metodologia näkyviin", "methodology visible")}</span></div>
        <div className="season-read-grid">
          <div><strong>{tr("Nykyinen havainto", "Current finding")}</strong><p>{tr(`Tarkistetuissa ${games} ottelussa kolmen pisteen yritykset muodostavat ${percent(totalThreePA, totalFga)} kaikista kenttäheittoyrityksistä.`, `Across ${games} verified games, three-point attempts account for ${percent(totalThreePA, totalFga)} of all field-goal attempts.`)}</p></div>
          <div><strong>{tr("Vuosivertailu odottaa toista kautta", "Year-over-year comparison needs another season")}</strong><p>{tr("Yhden kauden perusteella ei voi päätellä, onko kolmosten määrä noussut vuosien aikana.", "One season cannot tell us whether three-point volume has risen over time.")}</p></div>
          <div><strong>{tr("Seuraava taso", "Next level")}</strong><p>{tr("Kun aineistoa on tarpeeksi, vertaamme muutosta liigan keskiarvoon, joukkueiden jakaumaan ja kolmen vuoden liukuvaan trendiin.", "With enough data, we will compare change with the league average, team distribution, and a three-year rolling trend.")}</p></div>
        </div>
      </section>
    </>
  );
}

type MatchComparison = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  higherIsBetter: boolean;
  format?: (value: number | null) => string;
};

type ComparisonResult = "home" | "away" | "tie" | "unknown";

function getComparisonResult(home: number | null, away: number | null, higherIsBetter: boolean): ComparisonResult {
  if (home === null || away === null) return "unknown";
  if (home === away) return "tie";
  const homeIsBetter = higherIsBetter ? home > away : home < away;
  return homeIsBetter ? "home" : "away";
}

function comparisonText(result: ComparisonResult, side: "home" | "away", language: Language) {
  if (result === "unknown") return language === "fi" ? "Vertailu puuttuu" : "Comparison unavailable";
  if (result === "tie") return language === "fi" ? "Tasapeli" : "Tie";
  return result === side ? language === "fi" ? "Parempi" : "Better" : language === "fi" ? "Heikompi" : "Worse";
}

function ComparisonValue({ metric, side, result }: { metric: MatchComparison; side: "home" | "away"; result: ComparisonResult }) {
  const { language } = useI18n();
  const value = side === "home" ? metric.home : metric.away;
  const state = result === "tie" ? "tie" : result === side ? "better" : result === "unknown" ? "unknown" : "worse";
  return <strong className={`comparison-value comparison-value--${state}`} aria-label={`${metric.label}: ${value === null ? language === "fi" ? "ei dataa" : "no data" : metric.format ? metric.format(value) : value}, ${comparisonText(result, side, language).toLowerCase()}`}>
    {value === null ? "—" : metric.format ? metric.format(value) : value}
  </strong>;
}

function ComparisonRow({ metric }: { metric: MatchComparison }) {
  const result = getComparisonResult(metric.home, metric.away, metric.higherIsBetter);
  return <div className="comparison-row">
    <ComparisonValue metric={metric} side="home" result={result} />
    <span>{metric.label}</span>
    <ComparisonValue metric={metric} side="away" result={result} />
  </div>;
}

const mobileNavItems: Array<{ labelFi: string; labelEn: string; view: ViewKey; icon: IconName }> = [
  { labelFi: "Yleiskatsaus", labelEn: "Overview", view: "overview", icon: "overview" },
  { labelFi: "Ottelut", labelEn: "Games", view: "matches", icon: "games" },
  { labelFi: "Joukkueet", labelEn: "Teams", view: "teams", icon: "teams" },
  { labelFi: "Pelaajat", labelEn: "Players", view: "players", icon: "players" },
  { labelFi: "Kausitrendit", labelEn: "Season", view: "season", icon: "season" },
];

type ThemeMode = "dark" | "light";

function getInitialTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem("korisiq-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return "dark";
}

function App() {
  const { language, setLanguage, tr } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [view, setView] = useState<ViewKey>("overview");
  const [selectedMatchId, setSelectedMatchId] = useState(match.sourceMatchId);
  const [activeMatch, setActiveMatch] = useState<AppMatch>(match);
  const [activePlayers, setActivePlayers] = useState(players);
  const [activeTeamSummary, setActiveTeamSummary] = useState(teamSummary);
  const [activeInsights, setActiveInsights] = useState(insights);
  const [activeAvailability, setActiveAvailability] = useState(availability);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [playerFilter, setPlayerFilter] = useState<"all" | "home" | "away">("all");
  const [courtMode, setCourtMode] = useState<CourtMode>("all");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("korisiq-theme", theme);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [theme]);
  useEffect(() => {
    let cancelled = false;
    if (selectedMatchId === match.sourceMatchId) {
      setActiveMatch(match);
      setActivePlayers(players);
      setActiveTeamSummary(teamSummary);
      setActiveInsights(insights);
      setActiveAvailability(availability);
      return () => {
        cancelled = true;
      };
    }
    loadSeasonMatches().then((records) => {
      const selectedRecord = records.find((record) => record.game.source_id === selectedMatchId);
      if (!selectedRecord || cancelled) return;
      const viewModel = buildMatchViewModel(selectedRecord, language);
      setActiveMatch(viewModel.match);
      setActivePlayers(viewModel.players);
      setActiveTeamSummary(viewModel.teamSummary);
      setActiveInsights(viewModel.insights);
      setActiveAvailability(viewModel.availability);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMatchId, language]);
  const derived = useMemo(() => ({
    home: deriveTeamMetrics(activeTeamSummary.home.stats, activeTeamSummary.away.stats),
    away: deriveTeamMetrics(activeTeamSummary.away.stats, activeTeamSummary.home.stats),
  }), [activeTeamSummary]);
  const visiblePlayers = useMemo(() => (showAllPlayers ? activePlayers : activePlayers.slice(0, 4)), [activePlayers, showAllPlayers]);
  const boxScoreComparisons: MatchComparison[] = [
    { key: "points", label: tr("Pisteet", "Points"), home: activeTeamSummary.home.stats.points, away: activeTeamSummary.away.stats.points, higherIsBetter: true },
    { key: "fg", label: "FG%", home: derived.home.fgPct, away: derived.away.fgPct, higherIsBetter: true, format: displayPct },
    { key: "rebounds", label: tr("Levypallot", "Rebounds"), home: activeTeamSummary.home.stats.rebounds, away: activeTeamSummary.away.stats.rebounds, higherIsBetter: true },
    { key: "assists", label: tr("Syötöt", "Assists"), home: activeTeamSummary.home.stats.assists, away: activeTeamSummary.away.stats.assists, higherIsBetter: true },
    { key: "turnovers", label: tr("Menetykset", "Turnovers"), home: activeTeamSummary.home.stats.turnovers, away: activeTeamSummary.away.stats.turnovers, higherIsBetter: false },
    { key: "steals", label: tr("Riistot", "Steals"), home: activeTeamSummary.home.stats.steals, away: activeTeamSummary.away.stats.steals, higherIsBetter: true },
    { key: "fouls", label: "PF", home: activeTeamSummary.home.stats.fouls, away: activeTeamSummary.away.stats.fouls, higherIsBetter: false },
  ];
  const derivedComparisons: MatchComparison[] = [
    { key: "efg", label: "eFG%", home: getMetricValue(derived.home, "efgPct"), away: getMetricValue(derived.away, "efgPct"), higherIsBetter: true, format: displayPct },
    { key: "ts", label: "TS%", home: getMetricValue(derived.home, "trueShootingPct"), away: getMetricValue(derived.away, "trueShootingPct"), higherIsBetter: true, format: displayPct },
    { key: "ortg", label: "ORtg", home: getMetricValue(derived.home, "offensiveRating"), away: getMetricValue(derived.away, "offensiveRating"), higherIsBetter: true },
    { key: "drtg", label: "DRtg", home: getMetricValue(derived.home, "defensiveRating"), away: getMetricValue(derived.away, "defensiveRating"), higherIsBetter: false },
    { key: "net", label: "Net Rating", home: getMetricValue(derived.home, "netRating"), away: getMetricValue(derived.away, "netRating"), higherIsBetter: true },
    { key: "ast-to", label: "AST/TO", home: getMetricValue(derived.home, "assistTurnover"), away: getMetricValue(derived.away, "assistTurnover"), higherIsBetter: true },
  ];
  const firstQuarter = activeMatch.periods[0] ?? { home: null, away: null };
  const displayedInsights = useMemo(() => {
    if (language === "fi") return activeInsights;
    const strongestStart = firstQuarter.home !== null && firstQuarter.away !== null && firstQuarter.home > firstQuarter.away ? activeMatch.home.name : activeMatch.away.name;
    const biggestQuarter = activeMatch.periods.reduce((best, period) => Math.abs(period.home - period.away) > Math.abs(best.home - best.away) ? period : best, activeMatch.periods[0] ?? { label: "game", home: 0, away: 0 });
    const winner = activeMatch.home.score >= activeMatch.away.score ? activeMatch.home : activeMatch.away;
    const loser = winner === activeMatch.home ? activeMatch.away : activeMatch.home;
    const margin = Math.abs(activeMatch.home.score - activeMatch.away.score);
    return [
      { eyebrow: "Opening", title: `${strongestStart} started stronger`, body: `The first quarter ended ${firstQuarter.home}–${firstQuarter.away}. ${winner.name} led the game by ${margin} points at the final buzzer.`, accent: "mint" },
      { eyebrow: "Separation", title: `${winner.name} created separation in ${biggestQuarter.label}`, body: `The biggest quarter margin was ${biggestQuarter.home}–${biggestQuarter.away}. That stretch helped ${winner.name} control the game.`, accent: "amber" },
      { eyebrow: "Finish", title: `${winner.name} won by ${margin}`, body: `${winner.name} scored ${winner.score} points and ${loser.name} ${loser.score}. The game box score is available in the source data.`, accent: "coral" },
    ] as typeof insights;
  }, [activeInsights, activeMatch, firstQuarter.away, firstQuarter.home, language]);
  const displayedAvailability = useMemo(() => {
    if (language === "fi") return activeAvailability;
    return activeAvailability.map((item) => {
      const label = {
        "Ottelun metadata": "Game metadata",
        "Box score -tilastot": "Box score statistics",
        "Tapahtumat": "Events",
        "Johdetut tehokkuusluvut": "Derived efficiency metrics",
        "Laukaisukoordinaatit": "Shot coordinates",
        "Peliminuutit": "Playing minutes",
      }[item.label] ?? item.label;
      const value = {
        "Saatavilla": "Available",
        "Arvio": "Estimate",
        "Ei tässä lähteessä": "Not in this source",
        "Ei eritelty": "Not itemised",
      }[item.value] ?? item.value;
      const detail = item.label === "Ottelun metadata" ? "teams · time · venue"
        : item.label === "Box score -tilastot" ? `${activePlayers.length} players · MIN · shots · rebounds · other fields`
          : item.label === "Tapahtumat" ? (item.tone === "warning" ? "Event-level detail is not included in the season index" : "Event feed available")
            : item.label === "Johdetut tehokkuusluvut" ? "Possessions are estimated from the box score formula"
              : item.label === "Laukaisukoordinaatit" ? "Requires a new data source"
                : "MIN field from the statistics page";
      return { ...item, label, value, detail };
    });
  }, [activeAvailability, activePlayers.length, language]);
  const storyStats = [
    { label: tr("Riistot", "Steals"), value: displayPair(activeTeamSummary.home.stats.steals, activeTeamSummary.away.stats.steals), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, activeTeamSummary.home.stats.steals, activeTeamSummary.away.stats.steals, "", language) },
    { label: tr("1. neljännes", "1st quarter"), value: displayPair(firstQuarter.home, firstQuarter.away), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, firstQuarter.home, firstQuarter.away, language === "fi" ? " pistettä" : " points", language) },
    { label: "eFG%", value: displayPair(derived.home.efgPct, derived.away.efgPct, displayPct), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, derived.home.efgPct, derived.away.efgPct, language === "fi" ? " prosenttiyks." : " pp", language) },
    { label: tr("Hyökkäyslevyt", "Offensive rebounds"), value: displayPair(activeTeamSummary.home.stats.offensiveRebounds, activeTeamSummary.away.stats.offensiveRebounds), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, activeTeamSummary.home.stats.offensiveRebounds, activeTeamSummary.away.stats.offensiveRebounds, "", language) },
  ];
  const isMatchDetail = view === "story" || view === "player-detail" || view === "data";

  return (
    <div className={`app-shell app-shell--${view}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <Mark />
          <span>Koris<span>IQ</span></span>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">NK</div>
          <div>
            <strong>{tr("Naisten Korisliiga", "Women's Korisliiga")}</strong>
            <span>2025–26 · {tr("analyysi", "analysis")}</span>
          </div>
          <span className="chevron"><Icon name="chevron" size={14} /></span>
        </div>

        <nav className="main-nav" aria-label={tr("Päänavigaatio", "Main navigation")}>
          <p className="nav-label">{tr("Näkymä", "Views")}</p>
          <button className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}><span className="nav-glyph"><Icon name="overview" /></span> {tr("Yleiskatsaus", "Overview")}</button>
          <button className={`nav-item ${view === "matches" ? "active" : ""}`} onClick={() => setView("matches")}><span className="nav-glyph"><Icon name="games" /></span> {tr("Ottelut", "Games")} <span className="nav-count">{seasonData.aggregate.games}</span></button>
          <button className={`nav-item ${view === "teams" ? "active" : ""}`} onClick={() => setView("teams")}><span className="nav-glyph"><Icon name="teams" /></span> {tr("Joukkueet", "Teams")}</button>
          <button className={`nav-item ${view === "players" ? "active" : ""}`} onClick={() => setView("players")}><span className="nav-glyph"><Icon name="players" /></span> {tr("Pelaajat", "Players")}</button>
          <button className={`nav-item ${view === "season" ? "active" : ""}`} onClick={() => setView("season")}><span className="nav-glyph"><Icon name="season" /></span> {tr("Kausitrendit", "Season trends")}</button>
          <p className="nav-label nav-label-lower">{tr("Työkalut", "Tools")}</p>
          <button className="nav-item"><span className="nav-glyph"><Icon name="matchup" /></span> Matchup Lab</button>
          <button className="nav-item"><span className="nav-glyph"><Icon name="health" /></span> {tr("Datan tila", "Data status")}</button>
        </nav>

        <div className="sidebar-footer">
          <div className="source-health"><span className="health-dot" /> {tr("Julkinen lähde yhdistetty", "Public source connected")}</div>
          <div className="sidebar-footer-row"><span>{tr("Vaihe 1", "Phase 1")}</span><span>0.1</span></div>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label={tr("Mobiilinavigaatio", "Mobile navigation")}>
        {mobileNavItems.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} aria-current={view === item.view ? "page" : undefined} onClick={() => setView(item.view)}>
          <span className="mobile-nav-icon"><Icon name={item.icon} size={18} /></span>
          <span>{tr(item.labelFi, item.labelEn)}</span>
        </button>)}
      </nav>

      <main className={`main-content main-content--${view}`}>
        <header className="topbar">
          <div className="mobile-brand" aria-label="KorisIQ"><Mark /><span>Koris<span>IQ</span></span></div>
          <div className="breadcrumbs">
            <button className={`crumb-link ${view === "overview" ? "crumb-current" : ""}`} onClick={() => setView("overview")}>{tr("Yleiskatsaus", "Overview")}</button>
            {isMatchDetail ? <><b>/</b><button className="crumb-link" onClick={() => setView("matches")}>{tr("Ottelut", "Games")}</button><b>/</b><span className="crumb-current">{view === "player-detail" ? tr("Pelaajat", "Players") : view === "data" ? tr("Data & saatavuus", "Data & availability") : tr("Ottelun tarina", "Game story")}</span></> : view !== "overview" ? <><b>/</b><span className="crumb-current">{view === "teams" ? tr("Joukkueprofiilit", "Team profiles") : view === "season" ? tr("Sarjan trendit", "League trends") : view === "players" ? tr("Pelaajat", "Players") : tr("Ottelut", "Games")}</span></> : null}
          </div>
          <div className="topbar-actions">
            <button className="language-toggle" type="button" onClick={() => setLanguage(language === "fi" ? "en" : "fi")} aria-label={language === "fi" ? "Switch to English" : "Vaihda suomeen"} title={language === "fi" ? "Switch to English" : "Vaihda suomeen"}>{language === "fi" ? "EN" : "FI"}</button>
            <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? tr("Vaihda vaaleaan tilaan", "Switch to light mode") : tr("Vaihda tummaan tilaan", "Switch to dark mode")} title={theme === "dark" ? tr("Vaihda vaaleaan tilaan", "Switch to light mode") : tr("Vaihda tummaan tilaan", "Switch to dark mode")}><Icon name={theme === "dark" ? "sun" : "moon"} size={15} /></button>
            <button className="icon-button" aria-label={tr("Asetukset", "Settings")}><Icon name="settings" size={15} /></button>
            <div className="user-avatar">PK</div>
          </div>
        </header>

        <div className={view === "overview" ? "page-with-outline" : undefined}>
          {view === "overview" && <OverviewSectionLinks tr={tr} />}
          <div className="page-content">
          <section className={`intro-row intro-row--${view} ${view === "overview" ? "intro-row--overview" : ""}`}>
            <div>
            <h1>{view === "overview" ? tr("Yleiskatsaus", "Overview") : view === "teams" ? tr("Joukkueen peliprofiili", "Team profile") : view === "season" ? tr("Kausitrendit", "Season trends") : view === "matches" ? tr("Ottelut", "Games") : view === "players" ? tr("Pelaajat", "Players") : tr("Pelin tarina", "Game story")}</h1>
              <p className="intro-copy">{view === "overview" ? tr("Naisten Korisliigan kauden luvut, tehokkuus ja peliprofiili yhdellä sivulla.", "Women's Korisliiga season metrics, efficiency, and playing profile in one view.") : view === "teams" ? tr("Tutki joukkueen heittovalintoja ja tehokkuutta suhteessa sarjan tasoon.", "Explore a team's shot selection and efficiency relative to the league.") : view === "season" ? tr("Seuraa, miten suomalaisen koripallon heittoprofiili ja pelin tehokkuus muuttuvat kausien välillä.", "Track how shot profiles and efficiency change across Finnish basketball seasons.") : view === "matches" ? tr("Selaa kauden tarkistettuja box score -otteluita ja avaa yksittäisen ottelun analyysi.", "Browse verified season box scores and open an individual game analysis.") : view === "players" ? tr("Tutki koko kauden pelaajapoolia, rooleja ja tehokkuutta suhteessa peliaikaan.", "Explore the full player pool, roles, and efficiency relative to playing time.") : tr("Näe mitä tapahtui, milloin peli kääntyi ja mitä datasta voidaan oikeasti päätellä.", "See what happened, when the game shifted, and what the data can actually tell us.")}</p>
            </div>
            {view === "overview" ? <OverviewContext onOpenMatches={() => setView("matches")} /> : isMatchDetail ? <button className="outline-button" onClick={() => setView("matches")}>{tr("Palaa otteluihin", "Back to games")} <Icon name="chevron" size={13} /></button> : null}
          </section>

          {view === "overview" ? <OverviewView onOpenTeams={() => setView("teams")} /> : view === "players" ? <PlayersView /> : view === "teams" ? <TeamProfiles onOpenMatch={(id) => { setSelectedMatchId(id); setView("story"); }} /> : view === "season" ? <SeasonView /> : view === "matches" ? <MatchesView onOpenMatch={(id) => { setSelectedMatchId(id); setView("story"); }} /> : <>
          <section className="match-hero panel">
            <div className="match-hero-top">
              <div className="match-meta"><span>{tr(activeMatch.competition, "Women's Korisliiga")}</span><span className="meta-separator">·</span><span>{activeMatch.season}</span></div>
              <div className="source-tag"><span className="source-tag-dot" /> {activeMatch.source}</div>
            </div>
            <div className="scoreboard">
              <div className="team-block team-home">
                <div className="team-crest crest-coral">{teamMark(activeMatch.home.name)}</div>
                <div><span className="team-role">{tr("Koti", "Home")}</span><h2>{activeMatch.home.name}</h2></div>
              </div>
              <div className="score-center">
                <span className="final-label">{tr(activeMatch.status, "Final")}</span>
                <div className="score-line"><strong>{activeMatch.home.score}</strong><span>–</span><strong>{activeMatch.away.score}</strong></div>
                <div className="score-quarters" aria-label={tr("Neljänneksien pistetilanteet", "Quarter scores")}>{activeMatch.periods.map((period) => <span key={period.label}><b>{period.label}</b> {period.home}–{period.away}</span>)}</div>
              </div>
              <div className="team-block team-away">
                <div><span className="team-role">{tr("Vieras", "Away")}</span><h2>{activeMatch.away.name}</h2></div>
                <div className="team-crest crest-mint">{teamMark(activeMatch.away.name)}</div>
              </div>
            </div>
            <div className="match-context"><span>{activeMatch.date}{activeMatch.time === "—" ? "" : ` · ${activeMatch.time}`}</span><span>{activeMatch.venue}</span><span>{tr("Ottelu", "Game")} #{activeMatch.sourceMatchId}</span></div>
          </section>

          <nav className="view-tabs" aria-label={tr("Ottelun näkymät", "Game views")}>
            <button className={view === "story" ? "tab-active" : ""} onClick={() => setView("story")}>{tr("Ottelun tarina", "Game story")}</button>
            <button className={view === "player-detail" ? "tab-active" : ""} onClick={() => setView("player-detail")}>{tr("Pelaajat", "Players")}</button>
            <button className={view === "data" ? "tab-active" : ""} onClick={() => setView("data")}>Data & {tr("saatavuus", "availability")}</button>
          </nav>

          {view === "story" && (
            <>
              <section className="stat-strip" aria-label={tr("Ottelun avainluvut", "Game key metrics")}>
                {storyStats.map((stat) => <div className="stat-item" key={stat.label}><span className="stat-label">{stat.label}</span><strong className="stat-value">{stat.value}</strong><span className="stat-note">{stat.note}</span></div>)}
              </section>

              <section className="analysis-board">
                <div className="panel comparison-panel">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Ottelun luvut", "Game numbers")}</h3></div></div>
                  <div className="comparison-teams"><span><i className="legend-dot coral-dot" /> {activeTeamSummary.home.name}</span><span>{activeTeamSummary.away.name} <i className="legend-dot mint-dot" /></span></div>
                  <div className="comparison-rows" role="group" aria-label={tr("Koti- ja vierasjoukkueen tilastovertailu", "Home and away team stat comparison")}>
                    {boxScoreComparisons.map(metric => <ComparisonRow key={metric.key} metric={metric} />)}
                  </div>
                  <div className="comparison-subheading"><span>{tr("Johdetut mittarit", "Derived metrics")}</span><small>{tr("box score -arvio", "box score estimate")}</small></div>
                  <div className="comparison-rows derived-rows">
                    {derivedComparisons.map(metric => <ComparisonRow key={metric.key} metric={metric} />)}
                  </div>
                  <div className="comparison-note">{tr("Vihreä tarkoittaa mittarin kannalta parempaa arvoa ja koralli heikompaa. Menetyksissä, PF:ssä ja DRtg:ssä pienempi on parempi. FG% lasketaan 2P- ja 3P-yrityksistä. ORtg, DRtg ja Net Rating käyttävät arvioituja pallonhallintoja.", "Green marks the better value for the metric and coral the weaker one. Lower is better for turnovers, PF, and DRtg. FG% is calculated from 2P and 3P attempts. ORtg, DRtg, and Net Rating use estimated possessions.")}</div>
                </div>

                <div className="panel court-panel">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Kenttäanalyysi", "Court analysis")}</h3></div><span className="panel-context">Basket.fi / Torneo</span></div>
                  <div className="court-toolbar"><span>{tr("Ottelun tapahtumat", "Game events")}</span><div><button className={`court-filter ${courtMode === "all" ? "active" : ""}`} onClick={() => setCourtMode("all")}>{tr("Kaikki", "All")}</button><button className={`court-filter ${courtMode === "points" ? "active" : ""}`} onClick={() => setCourtMode("points")}>{tr("Pisteet", "Points")}</button><button className={`court-filter ${courtMode === "missing" ? "active" : ""}`} onClick={() => setCourtMode("missing")}>{tr("Puuttuva data", "Missing data")}</button></div></div>
                  <CourtDiagram mode={courtMode} />
                  <div className="court-footer"><span><strong>{displayStat(activeMatch.eventCount)}</strong> {tr("tapahtumaa", "events")}</span><span><strong>{activeMatch.periods.length}</strong> {tr("neljännestä", "quarters")}</span><span className="court-footer-muted">{tr("Laukaisukartta avautuu koordinaattidatalla", "Shot map opens when coordinate data is available")}</span></div>
                </div>
              </section>

              <section className="panel roster-panel">
                <div className="panel-heading panel-heading--plain"><div><h3>{tr("Pisteet tässä ottelussa", "Points in this game")}</h3></div><span className="signal-count">{activePlayers.length} {tr("pelaajaa", "players")}</span></div>
                <div className="roster-toolbar"><span>{tr("Rooli = lähteen karkea normalisointi · (A) = avausviisikko", "Role = rough normalization from the source · (A) = starter")}</span><div className="roster-filters"><button className={playerFilter === "all" ? "active" : ""} onClick={() => setPlayerFilter("all")}>{tr("Kaikki", "All")}</button><button className={playerFilter === "home" ? "active" : ""} onClick={() => setPlayerFilter("home")}>{activeMatch.home.name}</button><button className={playerFilter === "away" ? "active" : ""} onClick={() => setPlayerFilter("away")}>{activeMatch.away.name}</button></div></div>
                <div className="roster-columns">
                  {[{ key: "home" as const, name: activeMatch.home.name, color: "coral" }, { key: "away" as const, name: activeMatch.away.name, color: "mint" }].map((team) => {
                    const teamPlayers = activePlayers.filter((player) => player.team === team.name).sort((a, b) => playerPoints(b) - playerPoints(a));
                    if (playerFilter !== "all" && playerFilter !== team.key) return null;
                    return <div className="roster-team" key={team.name}>
                      <div className="roster-team-heading"><span><i className={`legend-dot ${team.color === "coral" ? "coral-dot" : "mint-dot"}`} /> {team.name}</span><strong>{teamPlayers.reduce((total, player) => total + (player.stats.points ?? 0), 0)} {tr("pistettä", "points")}</strong></div>
                      <div className="roster-header"><span>{tr("Pelaaja", "Player")}</span><span>MIN</span><span>PTS</span><span>FG%</span><span>REB</span><span>AST</span><span>TO</span><span>PF</span></div>
                      {teamPlayers.map((player) => <div className="roster-row" key={player.name}><span className="roster-player"><i className={`team-dot ${player.teamColor}`} /><b>{player.number ?? "·"}</b><span><strong>{player.name}{player.starter ? <em className="starter-marker"> (A)</em> : null}</strong><small>{player.role ?? "—"}</small></span></span><span className="roster-minutes">{displayMinutes(player.stats.minutes)}</span><strong className="roster-points">{displayStat(player.stats.points)}</strong><span className="roster-stat">{displayPct(playerFgPct(player.stats))}</span><span className="roster-stat">{displayStat(player.stats.rebounds)}</span><span className="roster-stat">{displayStat(player.stats.assists)}</span><span className="roster-stat">{displayStat(player.stats.turnovers)}</span><span className="roster-fouls">{displayStat(player.stats.fouls)}</span></div>)}
                    </div>;
                  })}
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel narrative-panel">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Kolme havaintoa", "Three observations")}</h3></div><ArrowUpRight /></div>
                  <div className="insight-list">
                    {displayedInsights.map((insight, index) => <article className="insight" key={insight.title}><div className={`insight-index ${insight.accent}`}>0{index + 1}</div><div><span className="insight-eyebrow">{insight.eyebrow}</span><h4>{insight.title}</h4><p>{insight.body}</p></div></article>)}
                  </div>
                </div>
                <div className="panel signal-panel">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Mitä tiedämme?", "What do we know?")}</h3></div><span className="signal-count">4/6</span></div>
                  <div className="signal-progress"><span /></div>
                  <p className="signal-copy">{tr("Tämä näkymä erottaa julkaistun faktan, puuttuvan kentän ja vielä validoimattoman tiedon.", "This view separates published facts, missing fields, and data that still needs validation.")}</p>
                  <div className="signal-links"><span><i className="signal-dot ready" /> {tr("Saatavilla", "Available")}</span><span><i className="signal-dot warning" /> {tr("Tarkistettava", "Needs review")}</span></div>
                  <button className="outline-button small" onClick={() => setView("data")}>{tr("Näytä kaikki kentät", "Show all fields")} <ArrowUpRight /></button>
                </div>
              </section>
            </>
          )}

          {view === "player-detail" && <section className="panel detail-panel"><div className="panel-heading"><div><span className="section-kicker">{tr("Pelaajavaikutus", "Player impact")}</span><h3>{tr("Koko ottelun box score", "Full-game box score")}</h3></div><button className="outline-button small" onClick={() => setShowAllPlayers(!showAllPlayers)}>{showAllPlayers ? tr("Näytä vähemmän", "Show less") : tr("Näytä kaikki", "Show all")}</button></div><p className="detail-intro">{tr("Samat Basket.fi:n viralliset kentät kuin lähdesivulla: minuutit, heittoyritykset, levypallot, syötöt, menetykset, puolustusluvut ja tehopisteet. `(A)` merkitsee avausviisikkoa.", "The same official Basket.fi fields as the source page: minutes, shot attempts, rebounds, assists, turnovers, defensive stats, and efficiency. `(A)` marks a starter.")}</p><BoxScoreTable rows={visiblePlayers} /></section>}

          {view === "data" && <section className="panel detail-panel"><div className="panel-heading"><div><span className="section-kicker">{tr("Datan alkuperä", "Data source")}</span><h3>{tr("Ottelun datan saatavuus", "Game data availability")}</h3></div><span className="source-id">{tr("Lähde-ID", "Source ID")} {activeMatch.sourceMatchId}</span></div><p className="detail-intro">{tr("KorisIQ ei täytä puuttuvia arvoja nollilla. Jokainen analyysi rakentuu sen päälle, mitä lähde oikeasti palauttaa.", "KorisIQ does not fill missing values with zeros. Each analysis is built on what the source actually returns.")}</p><div className="availability-list">{displayedAvailability.map((item) => <div className="availability-row" key={item.label}><span className={`availability-icon ${item.tone}`}>{item.tone === "ready" ? "✓" : item.tone === "warning" ? "!" : "–"}</span><div><strong>{item.label}</strong><span>{item.detail}</span></div><em className={item.tone}>{item.value}</em></div>)}</div><div className="data-footnote"><span className="status-dot" /> {tr("Lähde", "Source")}: Basket.fi / statistics · {tr("haettu", "retrieved")} 15.9.2026 · {tr("historiallinen näyte", "historical sample")}</div></section>}
          </>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
