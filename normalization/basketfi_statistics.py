"""Normalize the public Basket.fi Sportradar fixture box score."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any


STAT_FIELDS: dict[str, str] = {
    "points": "points",
    "two_pm": "pointsTwoMade",
    "two_pa": "pointsTwoAttempted",
    "two_p_pct": "pointsTwoPercentage",
    "three_pm": "pointsThreeMade",
    "three_pa": "pointsThreeAttempted",
    "three_p_pct": "pointsThreePercentage",
    "ftm": "freeThrowsMade",
    "fta": "freeThrowsAttempted",
    "ft_pct": "freeThrowsPercentage",
    "offensive_rebounds": "reboundsOffensive",
    "defensive_rebounds": "reboundsDefensive",
    "rebounds": "rebounds",
    "assists": "assists",
    "turnovers": "turnovers",
    "steals": "steals",
    "blocks": "blocks",
    "blocks_received": "blocksReceived",
    "fouls": "foulsTotal",
    "fouls_drawn": "foulsDrawn",
    "plus_minus": "plusMinus",
    "efficiency": "efficiency",
}


def _number(value: Any) -> int | float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not number == number or number in (float("inf"), float("-inf")):
        return None
    return int(number) if number.is_integer() else number


def _text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes"}


def _hash_payload(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _duration_minutes(value: Any) -> float | None:
    """Convert ISO-8601 durations such as PT30M47S to decimal minutes."""

    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(r"PT(?:(?P<hours>\d+(?:\.\d+)?)H)?(?:(?P<minutes>\d+(?:\.\d+)?)M)?(?:(?P<seconds>\d+(?:\.\d+)?)S)?", str(value))
    if not match:
        return None
    hours = float(match.group("hours") or 0)
    minutes = float(match.group("minutes") or 0)
    seconds = float(match.group("seconds") or 0)
    return round(hours * 60 + minutes + seconds / 60, 4)


def _duration_display(value: Any) -> str | None:
    minutes = _duration_minutes(value)
    if minutes is None:
        return _text(value)
    total_seconds = round(minutes * 60)
    return f"{total_seconds // 60}:{total_seconds % 60:02d}"


def _stats(source: Any) -> dict[str, int | float | None]:
    source = source if isinstance(source, dict) else {}
    return {target: _number(source.get(key)) for target, key in STAT_FIELDS.items()}


def _competitors(fixture: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    rows = fixture.get("competitors") if isinstance(fixture.get("competitors"), list) else []
    for index, row in enumerate(rows[:2]):
        if not isinstance(row, dict):
            continue
        side = "home" if row.get("isHome") is True or (index == 0 and "isHome" not in row) else "away"
        result[side] = row
    return result


def _periods(data: dict[str, Any], team_ids: dict[str, str | None]) -> list[dict[str, Any]]:
    period_data = data.get("banner", {}).get("fixture", {}).get("periodData", {})
    scores = period_data.get("teamScores", {}) if isinstance(period_data, dict) else {}
    home_scores = scores.get(team_ids.get("home"), []) if isinstance(scores, dict) else []
    away_scores = scores.get(team_ids.get("away"), []) if isinstance(scores, dict) else []
    home_by_period = {row.get("periodId"): row.get("score") for row in home_scores if isinstance(row, dict)}
    away_by_period = {row.get("periodId"): row.get("score") for row in away_scores if isinstance(row, dict)}
    period_ids = sorted(set(home_by_period) | set(away_by_period))
    return [
        {"period": period_id, "home_score": _number(home_by_period.get(period_id)), "away_score": _number(away_by_period.get(period_id))}
        for period_id in period_ids
    ]


def normalize_fixture_statistics(
    payload: dict[str, Any],
    *,
    match_id: str | None = None,
    source_url: str | None = None,
    embed_url: str | None = None,
    ingested_at_utc: str | None = None,
) -> dict[str, Any]:
    """Map the public widget response to the KorisIQ game/teams/players shape."""

    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    fixture = data.get("fixture") if isinstance(data.get("fixture"), dict) else data.get("banner", {}).get("fixture", {})
    statistics = data.get("statistics") if isinstance(data.get("statistics"), dict) else {}
    base = statistics.get("data", {}).get("base", {}) if isinstance(statistics.get("data"), dict) else {}
    if not isinstance(fixture, dict) or not isinstance(base, dict):
        raise ValueError("Sportradar payload does not contain fixture statistics")

    competitors = _competitors(fixture)
    if set(competitors) != {"home", "away"}:
        raise ValueError("Sportradar fixture does not contain two competitors")
    team_ids = {side: _text(competitors[side].get("entityId")) for side in ("home", "away")}
    fixture_id = _text(fixture.get("id"))
    game_id = _text(match_id) or fixture_id
    if not game_id:
        raise ValueError("Sportradar fixture has no stable ID")
    ingested = ingested_at_utc or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    teams: list[dict[str, Any]] = []
    for side in ("home", "away"):
        competitor = competitors[side]
        side_data = base.get(side) if isinstance(base.get(side), dict) else {}
        entity_stats = side_data.get("entity") if isinstance(side_data.get("entity"), dict) else {}
        person_groups = side_data.get("persons") if isinstance(side_data.get("persons"), list) else []
        rows: list[dict[str, Any]] = []
        for group in person_groups:
            if not isinstance(group, dict):
                continue
            group_rows = group.get("rows")
            if isinstance(group_rows, list):
                rows.extend(row for row in group_rows if isinstance(row, dict))
            elif "statistics" in group:
                rows.append(group)
        players: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            raw_player_stats = row.get("statistics") if isinstance(row.get("statistics"), dict) else {}
            players.append(
                {
                    "source_player_id": _text(row.get("personId")),
                    "display_name": _text(row.get("personName")),
                    "team_source_id": _text(row.get("entityId")) or team_ids[side],
                    "jersey_number": _text(row.get("bib")),
                    "starter": _bool(row.get("starter")),
                    "position": _text(row.get("position")),
                    "participated": _bool(row.get("participated")),
                    "dnp_reason": _text(row.get("didNotPlayReason")),
                    "minutes": _duration_minutes(raw_player_stats.get("minutes")),
                    "minutes_display": _duration_display(raw_player_stats.get("minutes")),
                    "stats": _stats(raw_player_stats),
                    "source_fields": {
                        "active": _bool(row.get("active")),
                        "person_link": _text(row.get("personLink")),
                    },
                }
            )

        teams.append(
            {
                "source_id": team_ids[side],
                "name": _text(competitor.get("name")),
                "home_away": side,
                "score": _number(competitor.get("score")),
                "stats": _stats(entity_stats),
                "team_extra_stats": _stats(side_data.get("extra")),
                "team_flow": side_data.get("totalEntityStats") if isinstance(side_data.get("totalEntityStats"), dict) else {},
                "players": players,
            }
        )

    competition = data.get("banner", {}).get("competition", {}) if isinstance(data.get("banner"), dict) else {}
    season = data.get("banner", {}).get("season", {}) if isinstance(data.get("banner"), dict) else {}
    fixture_url = source_url or (f"https://tulospalvelu.basket.fi/match/{match_id}/statistics" if match_id else None)
    status = _text(fixture.get("status"))
    final_score = {"home": teams[0]["score"], "away": teams[1]["score"]}

    return {
        "schema_version": "0.1",
        "source": {
            "system": "basketfi_sportradar_embed",
            "entity": "fixture_statistics",
            "source_entity_id": game_id,
            "source_url": fixture_url,
            "upstream_fixture_id": fixture_id,
            "upstream_url": embed_url,
            "ingested_at_utc": ingested,
            "payload_sha256": _hash_payload(payload),
        },
        "competition": {"source_id": _text(competition.get("id")), "name": _text(competition.get("name"))},
        "season": {"source_id": _text(season.get("id")), "name": _text(season.get("name"))},
        "game": {
            "source_id": game_id,
            "upstream_fixture_id": fixture_id,
            "scheduled_at": _text(fixture.get("startDateTime")),
            "status": status,
            "venue": {"name": _text(fixture.get("venue"))},
            "periods": _periods(data, team_ids),
            "final_score": final_score,
        },
        "teams": teams,
        "availability": {
            "box_score": bool(base),
            "advanced_stats": statistics.get("advancedStatsEnabled") is True,
            "shot_coordinates": False,
        },
    }
