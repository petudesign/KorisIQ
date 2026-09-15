"""Normalize a Basket.fi/Torneo match while retaining source provenance."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from math import isfinite
from typing import Any


def _number(value: Any) -> int | float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not isfinite(number):
        return None
    return int(number) if number.is_integer() else number


def _text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _boolish(value: Any) -> bool | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes"}


def _hash_payload(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _period_scores(match: dict[str, Any]) -> list[dict[str, Any]]:
    periods: list[dict[str, Any]] = []
    for period in range(1, 6):
        home = _number(match.get(f"p{period}s_A"))
        away = _number(match.get(f"p{period}s_B"))
        if home is None and away is None:
            continue
        periods.append({"period": period, "home_score": home, "away_score": away})
    return periods


def normalize_match(payload: dict[str, Any], *, ingested_at_utc: str | None = None) -> dict[str, Any]:
    """Return the stable KorisIQ envelope for one ``getMatch`` response."""

    match = payload.get("match")
    if not isinstance(match, dict):
        raise ValueError("Basket.fi payload does not contain a match object")
    match_id = _text(match.get("match_id"))
    if not match_id:
        raise ValueError("Basket.fi match has no match_id")

    status = (_text(match.get("status")) or "").lower()
    is_unplayed_status = status in {"fixture", "scheduled", "upcoming"}
    # Torneo may expose pre-game 0 placeholders. They are not a recorded score.
    home_score = None if is_unplayed_status else _number(match.get("live_A"))
    away_score = None if is_unplayed_status else _number(match.get("live_B"))
    lineup_rows = match.get("lineups") if isinstance(match.get("lineups"), list) else []
    event_rows = match.get("events") if isinstance(match.get("events"), list) else []
    ingested = ingested_at_utc or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    players: list[dict[str, Any]] = []
    for row in lineup_rows:
        if not isinstance(row, dict):
            continue
        stats = {
            key: _number(row.get(source_key))
            for key, source_key in {
                "points": "points",
                "assists": "assists",
                "shots": "shots",
                "blocks": "blocks",
                "fouls": "fouls",
                "goals": "goals",
            }.items()
            if row.get(source_key) not in (None, "")
        }
        players.append(
            {
                "source_player_id": _text(row.get("player_id")),
                "source_lineup_id": _text(row.get("lineup_id")),
                "display_name": _text(row.get("player_name")),
                "team_source_id": _text(row.get("team_id")),
                "jersey_number": _text(row.get("shirt_number")),
                "starter": _boolish(row.get("start")),
                "position": _text(row.get("position")),
                "minutes": _number(row.get("playing_time_min")),
                "stats": stats,
                "source_fields": {
                    "birthyear": row.get("birthyear"),
                    "raw_playing_time_min": row.get("playing_time_min"),
                },
            }
        )

    events: list[dict[str, Any]] = []
    for row in event_rows:
        if not isinstance(row, dict):
            continue
        events.append(
            {
                "source_event_id": _text(row.get("event_id")),
                "period": _number(row.get("period")),
                "clock": {
                    "display": _text(row.get("time")),
                    "minute": _number(row.get("time_min")),
                    "second": _number(row.get("time_sec")),
                },
                "event_type": _text(row.get("code_en")) or _text(row.get("code")),
                "source_code": _text(row.get("code")),
                "description": _text(row.get("description")),
                "player_source_id": _text(row.get("player_id")),
                "team_source_id": _text(row.get("team_id")),
                "score_after": {
                    "home": _number(row.get("s_A")),
                    "away": _number(row.get("s_B")),
                },
            }
        )

    has_final_score = home_score is not None and away_score is not None
    has_box_score = status not in {"fixture", "scheduled", "upcoming"} and (
        _boolish(match.get("match_report_exists")) is True or has_final_score
    )

    normalized = {
        "schema_version": "0.1",
        "source": {
            "system": "basketfi_torneopal",
            "entity": "match",
            "source_entity_id": match_id,
            "source_url": f"https://koripallo-api.torneopal.net/taso/rest/getMatch?match_id={match_id}",
            "ingested_at_utc": ingested,
            "payload_sha256": _hash_payload(payload),
        },
        "competition": {
            "source_id": _text(match.get("competition_id")),
            "name": _text(match.get("competition_name")),
        },
        "season": {"source_id": _text(match.get("season_id")), "name": _text(match.get("season_id"))},
        "game": {
            "source_id": match_id,
            "match_number": _text(match.get("match_number")),
            "scheduled_date": _text(match.get("date")),
            "scheduled_time": _text(match.get("time")),
            "timezone": _text(match.get("time_zone")),
            "status": _text(match.get("status")),
            "statistics_level": _text(match.get("statistics_level")),
            "venue": {
                "source_id": _text(match.get("venue_id")),
                "name": _text(match.get("venue_name")),
                "city": _text(match.get("venue_city_name")),
            },
            "periods": _period_scores(match),
            "final_score": {"home": home_score, "away": away_score},
        },
        "teams": [
            {
                "source_id": _text(match.get("team_A_id")),
                "name": _text(match.get("team_A_name")),
                "home_away": "home",
                "score": home_score,
            },
            {
                "source_id": _text(match.get("team_B_id")),
                "name": _text(match.get("team_B_name")),
                "home_away": "away",
                "score": away_score,
            },
        ],
        "players": players,
        "events": events,
        "shots": [],
        "availability": {
            "lineups": bool(lineup_rows),
            "events": bool(event_rows),
            "box_score": has_box_score,
            "shot_coordinates": _boolish(match.get("shotmap")) is True,
        },
    }
    return normalized
