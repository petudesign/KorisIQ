"""Normalize the historical FIBA LiveStats shot representation."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def _number(value: Any) -> int | float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def _hash_payload(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def normalize_shots(payload: dict[str, Any], *, match_id: str, ingested_at_utc: str | None = None) -> dict[str, Any]:
    teams: list[dict[str, Any]] = []
    shots: list[dict[str, Any]] = []
    team_object = payload.get("tm")
    if not isinstance(team_object, dict):
        raise ValueError("FIBA LiveStats payload does not contain a team object")

    for team_id, team in team_object.items():
        if not isinstance(team, dict):
            continue
        team_shots = team.get("shot") if isinstance(team.get("shot"), list) else []
        teams.append(
            {
                "source_id": str(team_id),
                "name": team.get("name"),
                "score": _number(team.get("score")),
                "shot_count": len(team_shots),
            }
        )
        for index, shot in enumerate(team_shots):
            if not isinstance(shot, dict):
                continue
            shots.append(
                {
                    "source_shot_id": f"{match_id}:{team_id}:{shot.get('actionNumber', index)}:{index}",
                    "team_source_id": str(team_id),
                    "player_source_id": str(shot.get("p")) if shot.get("p") not in (None, "") else None,
                    "player_display_name": shot.get("player"),
                    "jersey_number": shot.get("shirtNumber") or shot.get("pno"),
                    "period": _number(shot.get("per")),
                    "period_type": shot.get("perType"),
                    "shot_type": shot.get("actionType"),
                    "subtype": shot.get("subType"),
                    "made": _number(shot.get("r")),
                    "x": _number(shot.get("x")),
                    "y": _number(shot.get("y")),
                    "action_number": _number(shot.get("actionNumber")),
                    "previous_action": shot.get("previousAction"),
                }
            )

    ingested = ingested_at_utc or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "schema_version": "0.1",
        "source": {
            "system": "fiba_livestats",
            "entity": "shot_feed",
            "source_entity_id": str(match_id),
            "source_url": f"https://fibalivestats.dcd.shared.geniussports.com/data/{match_id}/data.json",
            "ingested_at_utc": ingested,
            "payload_sha256": _hash_payload(payload),
        },
        "teams": teams,
        "shots": shots,
        "availability": {
            "lineups": False,
            "events": isinstance(payload.get("pbp"), list) and bool(payload.get("pbp")),
            "box_score": any(team.get("score") is not None for team in teams),
            "shot_coordinates": bool(shots),
        },
        "play_by_play_available": isinstance(payload.get("pbp"), list) and bool(payload.get("pbp")),
        "coordinate_semantics": {
            "available": bool(shots),
            "bounds": None,
            "orientation": None,
            "note": "Numeric coordinates observed; court calibration remains unknown.",
        },
    }
