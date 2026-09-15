"""Aggregate normalized basketball box scores into season-level summaries.

The aggregator deliberately works on normalized snapshots, not on a particular
Basket.fi response. This keeps the seasonal UI independent from the source
adapter and makes provider changes a boundary concern.
"""

from __future__ import annotations

from collections import defaultdict
from math import isfinite
from typing import Any, Iterable


COUNTING_STATS = (
    "points",
    "two_pm",
    "two_pa",
    "three_pm",
    "three_pa",
    "ftm",
    "fta",
    "offensive_rebounds",
    "defensive_rebounds",
    "rebounds",
    "assists",
    "turnovers",
    "steals",
    "blocks",
    "blocks_received",
    "fouls",
    "fouls_drawn",
    "efficiency",
)

ALIASES: dict[str, tuple[str, ...]] = {
    "points": ("points", "pts"),
    "two_pm": ("two_pm", "twoPM", "2pm", "2PM"),
    "two_pa": ("two_pa", "twoPA", "2pa", "2PA"),
    "three_pm": ("three_pm", "threePM", "3pm", "3PM"),
    "three_pa": ("three_pa", "threePA", "3pa", "3PA"),
    "ftm": ("ftm", "FTM"),
    "fta": ("fta", "FTA"),
    "offensive_rebounds": ("offensive_rebounds", "offensiveRebounds", "or", "OR"),
    "defensive_rebounds": ("defensive_rebounds", "defensiveRebounds", "dr", "DR"),
    "rebounds": ("rebounds", "REB", "reb"),
    "assists": ("assists", "AST", "ast"),
    "turnovers": ("turnovers", "TO", "to"),
    "steals": ("steals", "STL", "stl"),
    "blocks": ("blocks", "BLK", "blk"),
    "blocks_received": ("blocks_received", "blocksReceived", "br", "BR"),
    "fouls": ("fouls", "PF", "pf"),
    "fouls_drawn": ("fouls_drawn", "foulsDrawn", "fd", "FD"),
    "efficiency": ("efficiency", "Eff", "eff"),
}


def _number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        result = float(value)
        return result if isfinite(result) else None
    except (TypeError, ValueError):
        return None


def _round(value: float | None, decimals: int = 1) -> float | None:
    if value is None:
        return None
    return round(value, decimals)


def _ratio(numerator: float | None, denominator: float | None, scale: float = 1.0) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return _round(numerator / denominator * scale)


def _value(row: dict[str, Any], key: str) -> float | None:
    for alias in ALIASES[key]:
        if alias in row:
            return _number(row[alias])
    return None


def _stats(row: dict[str, Any]) -> dict[str, float | None]:
    source_stats = row.get("stats") or row.get("box_score") or row
    if not isinstance(source_stats, dict):
        return {key: None for key in COUNTING_STATS}
    return {key: _value(source_stats, key) for key in COUNTING_STATS}


def _possessions(stats: dict[str, float | None]) -> float | None:
    if any(stats.get(key) is None for key in ("two_pa", "three_pa", "fta", "offensive_rebounds", "turnovers")):
        return None
    return stats["two_pa"] + stats["three_pa"] + 0.44 * stats["fta"] - stats["offensive_rebounds"] + stats["turnovers"]


def _derived_metrics(totals: dict[str, float | None], *, shared_possessions: float | None, opponent_points: float | None, opponent_offensive_rebounds: float | None, opponent_defensive_rebounds: float | None) -> dict[str, float | None]:
    fgm = None if totals["two_pm"] is None or totals["three_pm"] is None else totals["two_pm"] + totals["three_pm"]
    fga = None if totals["two_pa"] is None or totals["three_pa"] is None else totals["two_pa"] + totals["three_pa"]
    possessions = _possessions(totals)
    return {
        "field_goals_made": fgm,
        "field_goals_attempted": fga,
        "fg_pct": _ratio(fgm, fga, 100),
        "efg_pct": _ratio(None if fgm is None or totals["three_pm"] is None else fgm + 0.5 * totals["three_pm"], fga, 100),
        "true_shooting_pct": _ratio(totals["points"], None if fga is None or totals["fta"] is None else 2 * (fga + 0.44 * totals["fta"]), 100),
        "estimated_possessions": _round(possessions),
        "offensive_rating": _ratio(totals["points"], shared_possessions, 100),
        "defensive_rating": _ratio(opponent_points, shared_possessions, 100),
        "net_rating": None if totals["points"] is None or opponent_points is None or shared_possessions in (None, 0) else _round((totals["points"] - opponent_points) / shared_possessions * 100),
        "assist_turnover": _ratio(totals["assists"], totals["turnovers"]),
        "turnover_pct": _ratio(totals["turnovers"], possessions, 100),
        "offensive_rebound_pct": _ratio(totals["offensive_rebounds"], None if opponent_defensive_rebounds is None or totals["offensive_rebounds"] is None else totals["offensive_rebounds"] + opponent_defensive_rebounds, 100),
        "defensive_rebound_pct": _ratio(totals["defensive_rebounds"], None if opponent_offensive_rebounds is None or totals["defensive_rebounds"] is None else totals["defensive_rebounds"] + opponent_offensive_rebounds, 100),
        "three_point_attempt_rate": _ratio(totals["three_pa"], fga, 100),
        "free_throw_rate": _ratio(totals["fta"], fga, 100),
    }


def _per_game(totals: dict[str, float | None], games: int) -> dict[str, float | None]:
    if games == 0:
        return {key: None for key in totals}
    return {key: _round(value / games) if value is not None else None for key, value in totals.items()}


def aggregate_season(snapshots: Iterable[dict[str, Any]], *, season_id: str | None = None, competition: str | None = None) -> dict[str, Any]:
    """Aggregate completed normalized box-score snapshots.

    Percentages are weighted from makes/attempts. Team ratings use the average
    of both teams' estimated possessions for each game and stay labeled as
    estimates until a validated possession feed is available.
    """

    teams: dict[str, dict[str, Any]] = {}
    seen_games: set[str] = set()

    for snapshot in snapshots:
        game = snapshot.get("game") if isinstance(snapshot.get("game"), dict) else {}
        game_id = str(game.get("source_id") or snapshot.get("source", {}).get("source_entity_id") or len(seen_games))
        if game_id in seen_games:
            continue
        rows = snapshot.get("teams") if isinstance(snapshot.get("teams"), list) else []
        usable_rows = [row for row in rows if isinstance(row, dict) and (row.get("source_id") or row.get("team_source_id"))]
        if len(usable_rows) != 2:
            continue

        normalized_rows: list[dict[str, Any]] = []
        for row in usable_rows:
            team_id = str(row.get("source_id") or row.get("team_source_id"))
            normalized_rows.append({"id": team_id, "name": row.get("name") or row.get("team_name") or team_id, "stats": _stats(row), "score": _number(row.get("score"))})

        seen_games.add(game_id)
        for row in normalized_rows:
            bucket = teams.setdefault(row["id"], {"source_team_id": row["id"], "name": row["name"], "games": 0, "totals": defaultdict(float), "seen": defaultdict(int), "shared_possessions": 0.0, "opponent_points": 0.0, "opponent_offensive_rebounds": 0.0, "opponent_defensive_rebounds": 0.0, "opponent_seen": defaultdict(int)})
            bucket["games"] += 1
            for key, value in row["stats"].items():
                if value is not None:
                    bucket["totals"][key] += value
                    bucket["seen"][key] += 1

            opponent = next((other for other in normalized_rows if other["id"] != row["id"]), None)
            own_possessions = _possessions(row["stats"])
            opponent_possessions = _possessions(opponent["stats"]) if opponent else None
            if own_possessions is not None and opponent_possessions is not None:
                bucket["shared_possessions"] += (own_possessions + opponent_possessions) / 2
                bucket["opponent_seen"]["possessions"] += 1
            if opponent:
                if opponent["score"] is not None:
                    bucket["opponent_points"] += opponent["score"]
                    bucket["opponent_seen"]["points"] += 1
                if opponent["stats"]["offensive_rebounds"] is not None:
                    bucket["opponent_offensive_rebounds"] += opponent["stats"]["offensive_rebounds"]
                    bucket["opponent_seen"]["offensive_rebounds"] += 1
                if opponent["stats"]["defensive_rebounds"] is not None:
                    bucket["opponent_defensive_rebounds"] += opponent["stats"]["defensive_rebounds"]
                    bucket["opponent_seen"]["defensive_rebounds"] += 1

    team_results: list[dict[str, Any]] = []
    league_totals: dict[str, float | None] = {key: 0.0 for key in COUNTING_STATS}
    league_seen: dict[str, int] = defaultdict(int)
    league_possessions = 0.0
    league_games = len(seen_games)

    for bucket in sorted(teams.values(), key=lambda value: str(value["name"])):
        games = bucket["games"]
        totals = {key: (_round(bucket["totals"][key]) if bucket["seen"][key] == games else None) for key in COUNTING_STATS}
        for key, value in totals.items():
            if value is not None:
                league_totals[key] = (league_totals[key] or 0) + value
                league_seen[key] += 1
        league_possessions += bucket["shared_possessions"]
        shared = bucket["shared_possessions"] if bucket["opponent_seen"]["possessions"] == games else None
        team_results.append({
            "source_team_id": bucket["source_team_id"],
            "name": bucket["name"],
            "games": games,
            "totals": totals,
            "per_game": _per_game(totals, games),
            "metrics": _derived_metrics(totals, shared_possessions=shared, opponent_points=_round(bucket["opponent_points"]) if bucket["opponent_seen"]["points"] == games else None, opponent_offensive_rebounds=_round(bucket["opponent_offensive_rebounds"]) if bucket["opponent_seen"]["offensive_rebounds"] == games else None, opponent_defensive_rebounds=_round(bucket["opponent_defensive_rebounds"]) if bucket["opponent_seen"]["defensive_rebounds"] == games else None),
        })

    league_totals = {key: (_round(value) if team_results and league_seen[key] == len(team_results) else None) for key, value in league_totals.items()}
    league_metrics = _derived_metrics(league_totals, shared_possessions=league_possessions or None, opponent_points=None, opponent_offensive_rebounds=None, opponent_defensive_rebounds=None)

    return {
        "schema_version": "0.1",
        "season_id": season_id,
        "competition": competition,
        "games": league_games,
        "teams": team_results,
        "league": {
            "games": league_games,
            "totals": league_totals,
            "per_game": _per_game(league_totals, league_games),
            "metrics": league_metrics,
        },
    }
