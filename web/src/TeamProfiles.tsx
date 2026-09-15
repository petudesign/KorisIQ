import { useState } from "react";
import season from "../../data/normalized/season_verified.summary.json";
import { useI18n } from "./i18n";

type Metrics = Record<string, number | null>;
type ProfileStatus = "above" | "below" | "level";

const definitions = [
  { key: "possessions_per_game", label: "Pallonhallinnat ottelua kohti", labelEn: "Possessions per game", unit: "", near: 0.8, strong: 1.6, explanation: "Arvio hyökkäysvuorojen määrästä. Jatkoaikoja ei ole vakioitu, joten tämä ei ole 40 minuutin tempo.", explanationEn: "An estimate of possessions per game. Overtime is not standardized, so this is not a 40-minute pace." },
  { key: "offensive_rating", label: "Hyökkäystehokkuus", labelEn: "Offensive efficiency", unit: "", near: 1.5, strong: 3, explanation: "Tehdyt pisteet sataa arvioitua pallonhallintaa kohti.", explanationEn: "Points scored per 100 estimated possessions." },
  { key: "defensive_rating", label: "Puolustustehokkuus", labelEn: "Defensive efficiency", unit: "", near: 1.5, strong: 3, explanation: "Päästetyt pisteet sataa arvioitua pallonhallintaa kohti. Pienempi luku on parempi.", explanationEn: "Points allowed per 100 estimated possessions. Lower is better." },
  { key: "three_point_attempt_rate", label: "Kolmosten osuus", labelEn: "Three-point attempt rate", unit: "%", near: 1, strong: 2, explanation: "Kuinka suuri osa kenttäheittoyrityksistä on kolmosia. Kuvaa pelitapaa, ei paremmuutta.", explanationEn: "The share of field-goal attempts that are threes. It describes style, not quality." },
  { key: "efg_pct", label: "Heittotehokkuus", labelEn: "Shot efficiency", unit: "%", near: 1, strong: 2, explanation: "Osumatarkkuus, joka huomioi kolmosen suuremman pistearvon (eFG%).", explanationEn: "Shooting efficiency that accounts for the extra value of threes (eFG%)." },
  { key: "offensive_rebound_pct", label: "Hyökkäyslevypallot", labelEn: "Offensive rebounding", unit: "%", near: 1, strong: 2, explanation: "Oman joukkueen osuus hyökkäyspään levypalloista.", explanationEn: "The team's share of available offensive rebounds." },
  { key: "turnover_pct", label: "Menetykset", labelEn: "Turnovers", unit: "%", near: 1, strong: 2, explanation: "Menetykset suhteessa arvioituihin pallonhallintoihin. Pienempi luku on parempi.", explanationEn: "Turnovers relative to estimated possessions. Lower is better." },
];
const format = (value: number | null, unit = "", emptyText = "Ei riittävää dataa", locale = "fi-FI") => value === null ? emptyText : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${unit}`;

function getProfileStatus(value: number | null, baseline: number | null, near: number, strong: number): { status: ProfileStatus; intensity: "normal" | "strong" } | null {
  if (value === null || baseline === null) return null;
  const delta = value - baseline;
  if (Math.abs(delta) <= near) return { status: "level", intensity: "normal" };
  return { status: delta > 0 ? "above" : "below", intensity: Math.abs(delta) >= strong ? "strong" : "normal" };
}

const statusLabel: Record<ProfileStatus, string> = {
  above: "Yli sarjan tason",
  below: "Alle sarjan tason",
  level: "Lähellä sarjan tasoa",
};

const statusLabelEn: Record<ProfileStatus, string> = {
  above: "Above league level",
  below: "Below league level",
  level: "Near league level",
};

function ProfileStatusIcon({ status }: { status: ProfileStatus }) {
  const path = status === "above"
    ? <path d="m4 16 5-5 3 3 8-8" />
    : status === "below"
      ? <path d="m4 8 5 5 3-3 8 8" />
      : <path d="M4 12h16" />;
  return <svg className="profile-status-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}

function getStatusLabel(comparison: { status: ProfileStatus; intensity: "normal" | "strong" } | null) {
  if (!comparison) return "Ei vertailua";
  if (comparison.intensity === "strong" && comparison.status === "above") return "Selvästi yli sarjan tason";
  if (comparison.intensity === "strong" && comparison.status === "below") return "Selvästi alle sarjan tason";
  return statusLabel[comparison.status];
}

export function TeamProfiles() {
  const { language, tr } = useI18n();
  const teams = season.aggregate.teams;
  const [selected, setSelected] = useState(teams[0]?.source_team_id ?? "");
  const team = teams.find(row => row.source_team_id === selected);
  if (!team) return <section className="panel detail-panel">Joukkueprofiilit avautuvat tarkistetuista ottelutilastoista.</section>;
  const profileMetrics = (row: typeof team): Metrics => ({ ...row.metrics, possessions_per_game: row.metrics.estimated_possessions === null ? null : row.metrics.estimated_possessions / row.games });
  const league: Metrics = { ...season.aggregate.league.metrics, possessions_per_game: season.aggregate.league.metrics.estimated_possessions / (2 * season.aggregate.games) };
  const teamMetricRows = teams.map(row => ({ row, metrics: profileMetrics(row) }));
  const meanTeamMetric = (key: string) => {
    const values = teamMetricRows.map(item => item.metrics[key]).filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return values.length === 0 ? null : values.reduce((sum, item) => sum + item, 0) / values.length;
  };
  const getBaseline = (key: string): number | null => {
    if (key === "defensive_rating") return meanTeamMetric(key);
    if (key === "offensive_rebound_pct") {
      const totals = season.aggregate.league.totals;
      return totals.offensive_rebounds + totals.defensive_rebounds > 0
        ? 100 * totals.offensive_rebounds / (totals.offensive_rebounds + totals.defensive_rebounds)
        : null;
    }
    const value = league[key];
    return typeof value === "number" && Number.isFinite(value) ? value : meanTeamMetric(key);
  };
  const metrics = profileMetrics(team);
  const localizedDefinitions = definitions.map((definition) => ({ ...definition, label: tr(definition.label, definition.labelEn), explanation: tr(definition.explanation, definition.explanationEn) }));
  const displayValue = (value: number | null, unit = "") => format(value, unit, tr("Ei riittävää dataa", "Insufficient data"), language === "fi" ? "fi-FI" : "en-GB");
  const localizedStatus = (comparison: { status: ProfileStatus; intensity: "normal" | "strong" } | null) => {
    if (!comparison) return tr("Ei vertailua", "No comparison");
    if (comparison.intensity === "strong" && comparison.status === "above") return tr("Selvästi yli sarjan tason", "Well above league level");
    if (comparison.intensity === "strong" && comparison.status === "below") return tr("Selvästi alle sarjan tason", "Well below league level");
    return tr(statusLabel[comparison.status], statusLabelEn[comparison.status]);
  };
  const threeBaseline = getBaseline("three_point_attempt_rate");
  const threeDelta = metrics.three_point_attempt_rate === null || threeBaseline === null ? null : metrics.three_point_attempt_rate - threeBaseline;
  const threeStatus = getProfileStatus(metrics.three_point_attempt_rate, threeBaseline, 1, 2);
  return <>
    <section className="panel profile-intro">
      <label htmlFor="profile-team">{tr("Valitse joukkue", "Select team")}</label>
      <select id="profile-team" value={selected} onChange={event => setSelected(event.target.value)} aria-describedby="profile-team-context">
        {teams.map(row => <option key={row.source_team_id} value={row.source_team_id}>{row.name}</option>)}
      </select>
      <p id="profile-team-context">{team.games} {tr("tarkistettua ottelua", "verified games")} · {tr("Naisten Korisliiga", "Women's Korisliiga")} 2025–26 · {tr("runkosarja", "regular season")}</p>
      <h2>{threeStatus === null ? tr("Peliprofiili muodostuu aineiston mukana", "Playing profile builds with the dataset") : threeStatus.status === "level" ? tr("Kolmosten osuus on lähellä sarjan tasoa", "Three-point share is near the league level") : threeStatus.status === "above" ? tr("Kolmosia sarjan tasoa enemmän", "More threes than the league level") : tr("Kolmosia sarjan tasoa vähemmän", "Fewer threes than the league level")}</h2>
      <p role="status" aria-live="polite">{threeDelta !== null && <>{tr(`Kolmoset muodostavat ${format(metrics.three_point_attempt_rate, "%")} heittoyrityksistä, sarjan aineistossa ${format(threeBaseline, "%")}. Ero on ${format(Math.abs(threeDelta))} prosenttiyksikköä.`, `Threes account for ${displayValue(metrics.three_point_attempt_rate, "%")} of field-goal attempts, compared with ${displayValue(threeBaseline, "%")} for the league. The difference is ${displayValue(Math.abs(threeDelta))} percentage points.`)}</>}</p>
      {threeStatus && <span className={`profile-status profile-status--${threeStatus.status} profile-status--${threeStatus.intensity}`}><span><ProfileStatusIcon status={threeStatus.status} /></span>{localizedStatus(threeStatus)}</span>}
      <div className="profile-legend" aria-label={tr("Väriprofiilin selite", "Color profile legend")}><span className="profile-legend-item profile-legend-item--above"><i aria-hidden="true"><ProfileStatusIcon status="above" /></i> {tr("yli sarjan tason", "above league level")}</span><span className="profile-legend-item profile-legend-item--level"><i aria-hidden="true"><ProfileStatusIcon status="level" /></i> {tr("lähellä sarjan tasoa", "near league level")}</span><span className="profile-legend-item profile-legend-item--below"><i aria-hidden="true"><ProfileStatusIcon status="below" /></i> {tr("alle sarjan tason", "below league level")}</span></div>
      <small>{tr(`Vertailussa ${season.aggregate.games}/${season.summary.available_played_games} ottelua. Tulokset kuvaavat saatavilla olevaa aineistoa.`, `Comparison covers ${season.aggregate.games}/${season.summary.available_played_games} games. Results describe the available dataset.`)}</small>
    </section>
    <section className="profile-grid" aria-label={`${team.name}: ${tr("vertailu sarjan tasoon", "comparison with league level")}`}>
      {localizedDefinitions.map(definition => {
        const value = metrics[definition.key] ?? null;
        const baseline = getBaseline(definition.key);
        const comparison = getProfileStatus(value, baseline, definition.near, definition.strong);
        const values = teamMetricRows.map(item => item.metrics[definition.key]).filter((item): item is number => typeof item === "number" && Number.isFinite(item));
        const min = Math.min(...values, baseline ?? Infinity);
        const max = Math.max(...values, baseline ?? -Infinity);
        const position = (number: number) => max === min ? 50 : 5 + (number - min) / (max - min) * 90;
        return <article className="panel profile-metric" key={definition.key}>
          <div className="profile-metric-heading"><h3>{definition.label}</h3>{comparison && <span className={`profile-status profile-status--${comparison.status} profile-status--${comparison.intensity}`}><span><ProfileStatusIcon status={comparison.status} /></span>{localizedStatus(comparison)}</span>}</div>
          <strong className={comparison ? `profile-value profile-value--${comparison.status}` : "profile-value"}>{displayValue(value, definition.unit)}</strong>
          <p>{definition.explanation}</p>
          {value !== null && baseline !== null && <>
            <div className={`profile-scale profile-scale--${comparison?.status ?? "level"}`} aria-label={`${definition.label}: ${localizedStatus(comparison)}`} role="img">
              {values.map((number, index) => <i className="profile-peer" key={index} style={{ left: `${position(number)}%` }} />)}
              <i className="profile-average" style={{ left: `${position(baseline)}%` }} />
              <i className="profile-selected" style={{ left: `${position(value)}%` }} />
            </div>
            <div className="profile-scale-labels"><span>{displayValue(min, definition.unit)}</span><span>{displayValue(max, definition.unit)}</span></div>
            <small>{tr("Sarjan taso", "League level")} {displayValue(baseline, definition.unit)} · {tr("ero", "difference")} {displayValue(Math.abs(value - baseline))} {definition.unit === "%" ? tr("prosenttiyksikköä", "percentage points") : definition.key === "possessions_per_game" ? tr("pallonhallintaa", "possessions") : tr("pistettä", "points")}</small>
          </>}
        </article>;
      })}
    </section>
    <section className="panel profile-intro">
      <h3>{tr("Näin luet profiilia", "How to read the profile")}</h3>
      <p>{tr("Asteikon pisteet ovat joukkueita, valkoinen viiva on sarjan taso ja korostettu rengas valitsemasi joukkue. Asteikko vaihtuu mittarin mukaan.", "The dots are teams, the white line is the league level, and the highlighted ring is the selected team. The scale changes by metric.")}</p>
      <p>{tr("Tehokkuusluvut perustuvat box scoresta arvioituihin pallonhallintoihin. Vastustajien tasoa ei ole vakioitu. Kolmosten suuri osuus ei yksin tarkoita tehokasta hyökkäystä.", "Efficiency metrics use possessions estimated from the box score. Opponent strength is not adjusted for. A high three-point share does not by itself mean a more efficient offense.")}</p>
      <details><summary>{tr("Laskentatapa ja lähde", "Method and source")}</summary><p>{tr("Lähde: Basket.fi:n julkiset ottelutilastot. Prosentit lasketaan osumien ja yritysten yhteismääristä. Pallonhallinta-arvio = 2PA + 3PA + 0,44 × FTA − hyökkäyslevypallot + menetykset. ORtg ja DRtg käyttävät molempien joukkueiden pallonhallinta-arvioiden keskiarvoa.", "Source: Basket.fi public game statistics. Percentages use total makes and attempts. Estimated possessions = 2PA + 3PA + 0.44 × FTA − offensive rebounds + turnovers. ORtg and DRtg use the average possession estimate for both teams.")}</p></details>
    </section>
  </>;
}
