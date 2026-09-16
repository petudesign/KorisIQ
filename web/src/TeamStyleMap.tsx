import { useMemo, useState } from "react";
import { useI18n } from "./i18n";

export type TeamStyleMapTeam = {
  name: string;
  games: number;
  per_game: {
    three_pa: number | null;
  };
  totals: {
    two_pm: number | null;
    two_pa: number | null;
    three_pm: number | null;
    three_pa: number | null;
  };
  metrics: {
    three_point_attempt_rate: number | null;
    free_throw_rate: number | null;
    turnover_pct: number | null;
    offensive_rebound_pct: number | null;
    efg_pct: number | null;
    true_shooting_pct: number | null;
    offensive_rating: number | null;
    net_rating: number | null;
    estimated_possessions: number | null;
  };
};

type StyleMapMetricKey =
  | "three_point_attempt_rate"
  | "three_point_attempts_per_game"
  | "free_throw_rate"
  | "turnover_pct"
  | "offensive_rebound_pct"
  | "possessions_per_game"
  | "efg_pct"
  | "two_point_pct"
  | "three_point_pct"
  | "true_shooting_pct"
  | "offensive_rating"
  | "net_rating";

type StyleMapMetric = {
  label: string;
  labelEn: string;
  unit: string;
  description: string;
  descriptionEn: string;
  lowLabel: string;
  lowLabelEn: string;
  highLabel: string;
  highLabelEn: string;
  direction: "lower" | "higher" | "style";
  getValue: (team: TeamStyleMapTeam) => number | null;
};

const styleMapMetrics: Record<StyleMapMetricKey, StyleMapMetric> = {
  three_point_attempt_rate: {
    label: "Kolmosyritysosuus (3PA/FGA)",
    labelEn: "3PA share (3PA/FGA)",
    unit: "%",
    description: "Kuinka suuri osa kenttäheittoyrityksistä on kolmosyrityksiä.",
    descriptionEn: "The share of field-goal attempts that are three-point attempts.",
    lowLabel: "vähemmän kolmosia",
    lowLabelEn: "fewer threes",
    highLabel: "enemmän kolmosia",
    highLabelEn: "more threes",
    direction: "style",
    getValue: (team) => team.metrics.three_point_attempt_rate,
  },
  three_point_attempts_per_game: {
    label: "Kolmosyritykset / ottelu (3PA)",
    labelEn: "Three-point attempts / game (3PA)",
    unit: "",
    description: "Kolmosyritysten määrä ottelua kohti.",
    descriptionEn: "Three-point attempts per game.",
    lowLabel: "vähemmän 3PA / ottelu",
    lowLabelEn: "fewer 3PA / game",
    highLabel: "enemmän 3PA / ottelu",
    highLabelEn: "more 3PA / game",
    direction: "style",
    getValue: (team) => team.per_game.three_pa,
  },
  free_throw_rate: {
    label: "Vapaaheittosuhde (FTA/FGA)",
    labelEn: "Free-throw rate (FTA/FGA)",
    unit: "%",
    description: "Vapaaheittoyritykset suhteessa kenttäheittoyrityksiin.",
    descriptionEn: "Free-throw attempts relative to field-goal attempts.",
    lowLabel: "vähemmän vapaaheittoja",
    lowLabelEn: "fewer free throws",
    highLabel: "enemmän vapaaheittoja",
    highLabelEn: "more free throws",
    direction: "style",
    getValue: (team) => team.metrics.free_throw_rate,
  },
  turnover_pct: {
    label: "Menetysaste (TOV%)",
    labelEn: "Turnover rate (TOV%)",
    unit: "%",
    description: "Menetykset suhteessa arvioituihin pallonhallintoihin.",
    descriptionEn: "Turnovers relative to estimated possessions.",
    lowLabel: "vähemmän menetyksiä",
    lowLabelEn: "fewer turnovers",
    highLabel: "enemmän menetyksiä",
    highLabelEn: "more turnovers",
    direction: "lower",
    getValue: (team) => team.metrics.turnover_pct,
  },
  offensive_rebound_pct: {
    label: "Hyökkäyslevypallot (ORB%)",
    labelEn: "Offensive rebounding (ORB%)",
    unit: "%",
    description: "Joukkueen osuus hyökkäyspään levypalloista.",
    descriptionEn: "The team's share of available offensive rebounds.",
    lowLabel: "vähemmän hyökkäyslevypalloja",
    lowLabelEn: "fewer offensive rebounds",
    highLabel: "enemmän hyökkäyslevypalloja",
    highLabelEn: "more offensive rebounds",
    direction: "higher",
    getValue: (team) => team.metrics.offensive_rebound_pct,
  },
  possessions_per_game: {
    label: "Tempoarvio / ottelu",
    labelEn: "Estimated pace / game",
    unit: "",
    description: "Box scoresta arvioidut pallonhallinnat ottelua kohti.",
    descriptionEn: "Estimated possessions per game from the box score.",
    lowLabel: "hitaampi tempo",
    lowLabelEn: "slower pace",
    highLabel: "nopeampi tempo",
    highLabelEn: "faster pace",
    direction: "style",
    getValue: (team) => team.metrics.estimated_possessions === null || team.games === 0 ? null : team.metrics.estimated_possessions / team.games,
  },
  efg_pct: {
    label: "eFG%",
    labelEn: "eFG%",
    unit: "%",
    description: "Kokonaisheittotehokkuus, joka huomioi kolmosen suuremman pistearvon.",
    descriptionEn: "Overall shooting efficiency adjusted for the extra value of threes.",
    lowLabel: "matalampi eFG%",
    lowLabelEn: "lower eFG%",
    highLabel: "korkeampi eFG%",
    highLabelEn: "higher eFG%",
    direction: "higher",
    getValue: (team) => team.metrics.efg_pct,
  },
  two_point_pct: {
    label: "Kakkosten osumatarkkuus (2P%)",
    labelEn: "Two-point accuracy (2P%)",
    unit: "%",
    description: "Kuinka suuri osa kahden pisteen yrityksistä menee sisään.",
    descriptionEn: "The share of two-point attempts that go in.",
    lowLabel: "matalampi 2P%",
    lowLabelEn: "lower 2P%",
    highLabel: "korkeampi 2P%",
    highLabelEn: "higher 2P%",
    direction: "higher",
    getValue: (team) => percentage(team.totals.two_pm, team.totals.two_pa),
  },
  three_point_pct: {
    label: "Kolmosten osumatarkkuus (3P%)",
    labelEn: "Three-point accuracy (3P%)",
    unit: "%",
    description: "Kuinka suuri osa kolmosyrityksistä menee sisään.",
    descriptionEn: "The share of three-point attempts that go in.",
    lowLabel: "matalampi 3P%",
    lowLabelEn: "lower 3P%",
    highLabel: "korkeampi 3P%",
    highLabelEn: "higher 3P%",
    direction: "higher",
    getValue: (team) => percentage(team.totals.three_pm, team.totals.three_pa),
  },
  true_shooting_pct: {
    label: "TS%",
    labelEn: "TS%",
    unit: "%",
    description: "Pisteisiin, kenttäheittoihin ja vapaaheittoihin perustuva tehokkuus.",
    descriptionEn: "Efficiency based on points, field goals and free throws.",
    lowLabel: "matalampi TS%",
    lowLabelEn: "lower TS%",
    highLabel: "korkeampi TS%",
    highLabelEn: "higher TS%",
    direction: "higher",
    getValue: (team) => team.metrics.true_shooting_pct,
  },
  offensive_rating: {
    label: "ORtg",
    labelEn: "ORtg",
    unit: "",
    description: "Pisteet sataa arvioitua pallonhallintaa kohti.",
    descriptionEn: "Points scored per 100 estimated possessions.",
    lowLabel: "matalampi ORtg",
    lowLabelEn: "lower ORtg",
    highLabel: "korkeampi ORtg",
    highLabelEn: "higher ORtg",
    direction: "higher",
    getValue: (team) => team.metrics.offensive_rating,
  },
  net_rating: {
    label: "Net Rating",
    labelEn: "Net Rating",
    unit: "",
    description: "Hyökkäyksen ja puolustuksen erotus arvioitua pallonhallintaa kohti.",
    descriptionEn: "Offense minus defense per estimated possession.",
    lowLabel: "negatiivisempi Net Rating",
    lowLabelEn: "more negative Net Rating",
    highLabel: "positiivisempi Net Rating",
    highLabelEn: "more positive Net Rating",
    direction: "higher",
    getValue: (team) => team.metrics.net_rating,
  },
};

const xMetricKeys: StyleMapMetricKey[] = ["three_point_attempt_rate", "three_point_attempts_per_game", "free_throw_rate", "turnover_pct", "offensive_rebound_pct", "possessions_per_game"];
const yMetricKeys: StyleMapMetricKey[] = ["three_point_pct", "two_point_pct", "efg_pct", "true_shooting_pct", "offensive_rating", "net_rating"];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function formatValue(value: number | null, metric: StyleMapMetric, language: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}${metric.unit}`;
}

function percentage(made: number | null, attempts: number | null) {
  return made === null || attempts === null || attempts === 0 ? null : (made / attempts) * 100;
}

function compactTeamName(name: string) {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

export function TeamStyleMap({ teams }: { teams: TeamStyleMapTeam[] }) {
  const { language, tr } = useI18n();
  const [xKey, setXKey] = useState<StyleMapMetricKey>("three_point_attempt_rate");
  const [yKey, setYKey] = useState<StyleMapMetricKey>("efg_pct");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(teams[0]?.name ?? null);
  const xMetric = styleMapMetrics[xKey];
  const yMetric = styleMapMetrics[yKey];

  const rows = useMemo(() => teams.map((team) => ({
    team,
    x: xMetric.getValue(team),
    y: yMetric.getValue(team),
  })).filter((row): row is { team: TeamStyleMapTeam; x: number; y: number } => row.x !== null && row.y !== null && Number.isFinite(row.x) && Number.isFinite(row.y)), [teams, xMetric, yMetric]);

  const xValues = rows.map((row) => row.x);
  const yValues = rows.map((row) => row.y);
  const xMedian = median(xValues);
  const yMedian = median(yValues);
  const xRange = xValues.length > 0 ? [Math.min(...xValues), Math.max(...xValues)] : [0, 1];
  const yRange = yValues.length > 0 ? [Math.min(...yValues), Math.max(...yValues)] : [0, 1];
  const xSpan = Math.max(xRange[1] - xRange[0], 1);
  const ySpan = Math.max(yRange[1] - yRange[0], 1);
  const xMin = xRange[0] - xSpan * 0.12;
  const xMax = xRange[1] + xSpan * 0.12;
  const yMin = yRange[0] - ySpan * 0.12;
  const yMax = yRange[1] + ySpan * 0.12;
  const chart = { width: 720, height: 400, left: 20, right: 20, top: 26, bottom: 55 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const toX = (value: number) => chart.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const toY = (value: number) => chart.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
  const selectedRow = rows.find((row) => row.team.name === selectedTeam) ?? rows[0];
  const xLowLabel = tr(xMetric.lowLabel, xMetric.lowLabelEn);
  const xHighLabel = tr(xMetric.highLabel, xMetric.highLabelEn);
  const yLowLabel = tr(yMetric.lowLabel, yMetric.lowLabelEn);
  const yHighLabel = tr(yMetric.highLabel, yMetric.highLabelEn);
  const selectedPosition = selectedRow && xMedian !== null && yMedian !== null
    ? `${selectedRow.x >= xMedian ? xHighLabel : xLowLabel} · ${selectedRow.y >= yMedian ? yHighLabel : yLowLabel}`
    : null;

  const directionNote = (metric: StyleMapMetric, axis: "x" | "y") => {
    if (metric.direction === "lower") {
      return tr(`${axis.toUpperCase()}-akselilla pienempi arvo on yleensä parempi.`, `On the ${axis.toUpperCase()} axis, a lower value is generally better.`);
    }
    if (metric.direction === "higher") {
      return tr(`${axis.toUpperCase()}-akselilla suurempi arvo kuvaa yleensä parempaa tulosta.`, `On the ${axis.toUpperCase()} axis, a higher value generally indicates a better outcome.`);
    }
    return tr(`${axis.toUpperCase()}-akseli kuvaa pelityyliä, ei paremmuusjärjestystä.`, `The ${axis.toUpperCase()} axis describes style, not a ranking.`);
  };

  const selectTeam = (name: string) => setSelectedTeam(name);
  const handlePointKeyDown = (event: React.KeyboardEvent<SVGGElement>, name: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTeam(name);
    }
  };

  return (
    <section className="panel style-map-panel" aria-labelledby="team-style-map-heading">
      <div className="panel-heading panel-heading--plain style-map-heading">
        <div>
          <h3 id="team-style-map-heading">Team Style Map</h3>
          <p className="panel-subcopy">{tr("Vertaa yhtä pelin piirrettä joukkueen tehokkuuteen tai tulokseen.", "Compare one team tendency with its efficiency or outcome.")}</p>
        </div>
        <span className="panel-context">{tr("kuvaileva vertailu", "descriptive comparison")}</span>
      </div>

      <div className="style-map-controls" aria-label={tr("Scatterin mittarivalinnat", "Scatter metric controls")}>
        <label><span>{tr("X · joukkueen tapa", "X · team tendency")}</span><select value={xKey} onChange={(event) => setXKey(event.target.value as StyleMapMetricKey)}>{xMetricKeys.map((key) => <option key={key} value={key}>{tr(styleMapMetrics[key].label, styleMapMetrics[key].labelEn)}</option>)}</select></label>
        <label><span>{tr("Y · tehokkuus / tulos", "Y · efficiency / outcome")}</span><select value={yKey} onChange={(event) => setYKey(event.target.value as StyleMapMetricKey)}>{yMetricKeys.map((key) => <option key={key} value={key}>{tr(styleMapMetrics[key].label, styleMapMetrics[key].labelEn)}</option>)}</select></label>
      </div>

      {rows.length === 0 ? <div className="style-map-empty">{tr("Scatteriin ei ole vielä riittävästi mittaritietoa.", "There is not enough metric data for the scatter yet.")}</div> : <div className="style-map-layout">
        <div className="style-map-chart-wrap">
          <svg className="style-map-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby="team-style-map-title team-style-map-description">
            <title id="team-style-map-title">{`${tr(styleMapMetrics[xKey].label, styleMapMetrics[xKey].labelEn)} × ${tr(styleMapMetrics[yKey].label, styleMapMetrics[yKey].labelEn)}`}</title>
            <desc id="team-style-map-description">{tr("Jokainen piste on joukkue. Katkoviivat jakavat joukkueet valittujen mittareiden mediaanien mukaan.", "Each point is a team. Dashed lines split teams by the medians of the selected metrics.")}</desc>
            <rect className="style-map-plot-bg" x={chart.left} y={chart.top} width={plotWidth} height={plotHeight} rx="5" />
            {xMedian !== null && <line className="style-map-median" x1={toX(xMedian)} x2={toX(xMedian)} y1={chart.top} y2={chart.top + plotHeight} />}
            {yMedian !== null && <line className="style-map-median" x1={chart.left} x2={chart.left + plotWidth} y1={toY(yMedian)} y2={toY(yMedian)} />}
            <text className="style-map-quadrant style-map-quadrant--top-left" x={chart.left + 10} y={chart.top + 17}>{`${xLowLabel} · ${yHighLabel}`}</text>
            <text className="style-map-quadrant style-map-quadrant--top-right" x={chart.left + plotWidth - 10} y={chart.top + 17} textAnchor="end">{`${xHighLabel} · ${yHighLabel}`}</text>
            <text className="style-map-quadrant style-map-quadrant--bottom-left" x={chart.left + 10} y={chart.top + plotHeight - 10}>{`${xLowLabel} · ${yLowLabel}`}</text>
            <text className="style-map-quadrant style-map-quadrant--bottom-right" x={chart.left + plotWidth - 10} y={chart.top + plotHeight - 10} textAnchor="end">{`${xHighLabel} · ${yLowLabel}`}</text>
            <text className="style-map-tick" x={chart.left} y={chart.top + plotHeight + 17}>{formatValue(xRange[0], xMetric, language)}</text>
            <text className="style-map-tick" x={chart.left + plotWidth} y={chart.top + plotHeight + 17} textAnchor="end">{formatValue(xRange[1], xMetric, language)}</text>
            <text className="style-map-axis-label" x={chart.left + plotWidth / 2} y={chart.height - 8} textAnchor="middle">{tr(xMetric.label, xMetric.labelEn)}</text>
            <text className="style-map-axis-label" transform={`translate(14 ${chart.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">{tr(yMetric.label, yMetric.labelEn)}</text>
            {rows.map((row) => {
              const isSelected = row.team.name === selectedRow?.team.name;
              return <g className={`style-map-point ${isSelected ? "selected" : ""}`} key={row.team.name} tabIndex={0} role="button" aria-label={`${row.team.name}: ${formatValue(row.x, xMetric, language)} ${tr("x-akselilla", "on x-axis")}, ${formatValue(row.y, yMetric, language)} ${tr("y-akselilla", "on y-axis")}`} onClick={() => selectTeam(row.team.name)} onKeyDown={(event) => handlePointKeyDown(event, row.team.name)}>
                <title>{`${row.team.name} · ${formatValue(row.x, xMetric, language)} · ${formatValue(row.y, yMetric, language)}`}</title>
                <circle className="style-map-point-dot" cx={toX(row.x)} cy={toY(row.y)} r={isSelected ? 7 : 5} />
                <text className="style-map-team-label" x={toX(row.x) + 9} y={toY(row.y) - 8}>{compactTeamName(row.team.name)}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="style-map-details">
          <div className="style-map-details-heading">{tr("Joukkueet", "Teams")}</div>
          <div className="style-map-team-list">{rows.map((row) => <button className={`style-map-team-button ${row.team.name === selectedRow?.team.name ? "active" : ""}`} type="button" key={row.team.name} aria-pressed={row.team.name === selectedRow?.team.name} onClick={() => selectTeam(row.team.name)}><span>{row.team.name}</span><small>{formatValue(row.x, xMetric, language)} · {formatValue(row.y, yMetric, language)}</small></button>)}</div>
          {selectedRow && <div className="style-map-readout"><strong>{selectedRow.team.name}</strong><p>{formatValue(selectedRow.x, xMetric, language)} {tr(styleMapMetrics[xKey].label, styleMapMetrics[xKey].labelEn)} · {formatValue(selectedRow.y, yMetric, language)} {tr(styleMapMetrics[yKey].label, styleMapMetrics[yKey].labelEn)}</p>{selectedPosition && <small>{selectedPosition}</small>}</div>}
        </div>
      </div>}
      <p className="style-map-note">{tr(`${xMetric.description} ${yMetric.description} Mediaaniviivat jakavat joukkueet valittujen mittareiden mediaanien mukaan. ${directionNote(xMetric, "x")} ${directionNote(yMetric, "y")} ORtg ja tempo ovat box scoresta arvioituja.`, `${xMetric.descriptionEn} ${yMetric.descriptionEn} Dashed lines divide teams by the medians of the selected metrics. ${directionNote(xMetric, "x")} ${directionNote(yMetric, "y")} ORtg and pace are estimated from the box score.`)}</p>
    </section>
  );
}
