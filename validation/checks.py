"""Validation checks that distinguish hard failures from legitimate empty states."""

from __future__ import annotations

from math import isfinite
from typing import Any


def _number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) else None


def _check(name: str, status: str, detail: str) -> dict[str, str]:
    return {"name": name, "status": status, "detail": detail}


def validate_normalized_match(match: dict[str, Any]) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    source = match.get("source", {})
    game = match.get("game", {})
    teams = match.get("teams", [])
    players = match.get("players", [])
    events = match.get("events", [])

    if source.get("source_entity_id") and game.get("source_id") == source.get("source_entity_id"):
        checks.append(_check("match_identity", "pass", "source and game IDs are present and agree"))
    else:
        checks.append(_check("match_identity", "fail", "source_entity_id and game.source_id must agree"))

    team_ids = [team.get("source_id") for team in teams if isinstance(team, dict)]
    if len(teams) == 2 and all(team_ids):
        checks.append(_check("two_teams", "pass", "two teams with source IDs are present"))
    else:
        checks.append(_check("two_teams", "fail", "a basketball match requires exactly two identified teams"))

    if len(team_ids) == 2 and all(team_ids) and team_ids[0] != team_ids[1]:
        checks.append(_check("home_away_identity", "pass", "home and away source IDs differ"))
    else:
        checks.append(_check("home_away_identity", "fail", "home and away source IDs must differ"))

    player_ids = [row.get("source_lineup_id") for row in players if isinstance(row, dict)]
    if len(player_ids) == len(set(player_ids)):
        checks.append(_check("unique_lineups", "pass", "lineup IDs are unique"))
    else:
        checks.append(_check("unique_lineups", "fail", "duplicate lineup IDs detected"))

    event_ids = [row.get("source_event_id") for row in events if isinstance(row, dict) and row.get("source_event_id")]
    if len(event_ids) == len(set(event_ids)):
        checks.append(_check("unique_events", "pass", "event IDs are unique or no events are present"))
    else:
        checks.append(_check("unique_events", "fail", "duplicate event IDs detected"))

    periods = game.get("periods", [])
    final_score = game.get("final_score", {})
    period_home = [_number(row.get("home_score")) for row in periods if isinstance(row, dict)]
    period_away = [_number(row.get("away_score")) for row in periods if isinstance(row, dict)]
    final_home = _number(final_score.get("home")) if isinstance(final_score, dict) else None
    final_away = _number(final_score.get("away")) if isinstance(final_score, dict) else None
    if period_home and period_away and final_home is not None and final_away is not None:
        if sum(period_home) == final_home and sum(period_away) == final_away:
            checks.append(_check("period_score_reconciliation", "pass", "period scores sum to final score"))
        else:
            checks.append(_check("period_score_reconciliation", "fail", "period scores do not sum to final score"))
    else:
        checks.append(_check("period_score_reconciliation", "warn", "not enough score fields to reconcile; common for fixtures"))

    status = str(game.get("status") or "").lower()
    if status in {"fixture", "scheduled", "upcoming"} and not events and not players:
        checks.append(_check("fixture_empty_state", "pass", "unplayed fixture has no stats and is represented as unavailable"))
    elif game.get("status") and (events or players):
        checks.append(_check("played_payload", "pass", "match status and statistical payload are both present"))
    else:
        checks.append(_check("played_payload", "warn", "status/payload combination needs source review"))

    failures = sum(check["status"] == "fail" for check in checks)
    warnings = sum(check["status"] == "warn" for check in checks)
    return {"valid": failures == 0, "failure_count": failures, "warning_count": warnings, "checks": checks}


def validate_statistics_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Validate the full Basket.fi/Sportradar box-score shape."""

    checks: list[dict[str, str]] = []
    source = snapshot.get("source", {})
    game = snapshot.get("game", {})
    teams = snapshot.get("teams", [])
    if source.get("source_entity_id") and game.get("source_id") == source.get("source_entity_id"):
        checks.append(_check("game_identity", "pass", "source and game IDs are present and agree"))
    else:
        checks.append(_check("game_identity", "fail", "source_entity_id and game.source_id must agree"))

    team_ids = [team.get("source_id") for team in teams if isinstance(team, dict)]
    if len(teams) == 2 and all(team_ids) and len(set(team_ids)) == 2:
        checks.append(_check("two_teams", "pass", "two distinct teams with source IDs are present"))
    else:
        checks.append(_check("two_teams", "fail", "a box score requires exactly two distinct identified teams"))

    final_score = game.get("final_score", {})
    team_scores = [team.get("score") for team in teams if isinstance(team, dict)]
    if isinstance(final_score, dict) and team_scores == [final_score.get("home"), final_score.get("away")]:
        checks.append(_check("score_reconciliation", "pass", "team scores agree with game final score"))
    else:
        checks.append(_check("score_reconciliation", "fail", "team scores and final score disagree"))

    for team in teams:
        stats = team.get("stats", {})
        required = ("points", "two_pm", "two_pa", "three_pm", "three_pa", "ftm", "fta", "offensive_rebounds", "defensive_rebounds", "rebounds", "assists", "turnovers")
        complete = all(_number(stats.get(key)) is not None for key in required)
        checks.append(_check("complete_box_score", "pass" if complete else "fail", str(team.get("name"))))
        if not complete:
            continue
        consistent = (
            2 * stats["two_pm"] + 3 * stats["three_pm"] + stats["ftm"] == team.get("score") == stats["points"]
            and stats["offensive_rebounds"] + stats["defensive_rebounds"] == stats["rebounds"]
            and all(stats[made] <= stats[attempted] for made, attempted in (("two_pm", "two_pa"), ("three_pm", "three_pa"), ("ftm", "fta")))
            and all(stats[key] >= 0 for key in required)
        )
        checks.append(_check("box_score_arithmetic", "pass" if consistent else "fail", str(team.get("name"))))

    player_ids: list[str] = []
    for team in teams:
        if not isinstance(team, dict):
            continue
        rows = team.get("players", [])
        player_ids.extend(row.get("source_player_id") for row in rows if isinstance(row, dict) and row.get("source_player_id"))
    if len(player_ids) == len(set(player_ids)):
        checks.append(_check("unique_players", "pass", "player IDs are unique in the fixture"))
    else:
        checks.append(_check("unique_players", "fail", "duplicate player IDs detected"))

    if snapshot.get("availability", {}).get("box_score"):
        checks.append(_check("box_score_present", "pass", "full box-score totals are present"))
    else:
        checks.append(_check("box_score_present", "warn", "fixture has no full box-score totals yet"))

    failures = sum(check["status"] == "fail" for check in checks)
    warnings = sum(check["status"] == "warn" for check in checks)
    return {"valid": failures == 0, "failure_count": failures, "warning_count": warnings, "checks": checks}


def validate_fiba_shots(feed: dict[str, Any]) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    shots = feed.get("shots", [])
    if not shots:
        checks.append(_check("shots_present", "warn", "no shot rows are available"))
    else:
        checks.append(_check("shots_present", "pass", f"{len(shots)} shot rows are available"))

    bad_made = [row for row in shots if row.get("made") not in (0, 1)]
    if bad_made:
        checks.append(_check("binary_made", "fail", "shot made values must be 0 or 1"))
    else:
        checks.append(_check("binary_made", "pass", "shot made values are binary"))

    bad_coordinates = [row for row in shots if _number(row.get("x")) is None or _number(row.get("y")) is None]
    if bad_coordinates:
        checks.append(_check("finite_coordinates", "fail", "shot coordinates must be finite numeric values"))
    else:
        checks.append(_check("finite_coordinates", "pass", "all supplied shot coordinates are finite"))
    checks.append(_check("coordinate_bounds", "warn", "court bounds and orientation are intentionally not assumed"))
    failures = sum(check["status"] == "fail" for check in checks)
    warnings = sum(check["status"] == "warn" for check in checks)
    return {"valid": failures == 0, "failure_count": failures, "warning_count": warnings, "checks": checks}
