"""Extract a compact, source-neutral season schedule from Torneo match rows."""

from __future__ import annotations

from datetime import date
from typing import Any, Iterable


def _text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _score(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def extract_season_matches(payload: dict[str, Any], *, group_id: str | None = None, played_only: bool = False) -> list[dict[str, Any]]:
    """Return compact match records, optionally limited to one competition phase."""

    rows = payload.get("matches")
    if not isinstance(rows, list):
        return []

    matches: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if group_id is not None and str(row.get("group_id")) != str(group_id):
            continue
        status = _text(row.get("status"))
        if played_only and (status or "").lower() not in {"played", "finished", "completed"}:
            continue
        match_id = _text(row.get("match_id"))
        if not match_id:
            continue
        matches.append(
            {
                "source_match_id": match_id,
                "competition_id": _text(row.get("competition_id")),
                "category_id": _text(row.get("category_id")),
                "season_id": _text(row.get("season_id")),
                "group_id": _text(row.get("group_id")),
                "group_name": _text(row.get("group_name")),
                "scheduled_date": _text(row.get("date")),
                "scheduled_time": _text(row.get("time")),
                "status": status,
                "home": {
                    "source_team_id": _text(row.get("team_A_id")),
                    "name": _text(row.get("team_A_name")),
                    "score": _score(row.get("fs_A")),
                },
                "away": {
                    "source_team_id": _text(row.get("team_B_id")),
                    "name": _text(row.get("team_B_name")),
                    "score": _score(row.get("fs_B")),
                },
            }
        )
    return matches


def summarize_season_schedule(matches: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Summarize schedule coverage without interpreting missing statistics as zero."""

    rows = list(matches)
    team_names: set[str] = set()
    for row in rows:
        for side in ("home", "away"):
            team = row.get(side)
            if isinstance(team, dict) and team.get("name"):
                team_names.add(str(team["name"]))
    teams = sorted(team_names)
    dates = []
    for row in rows:
        value = row.get("scheduled_date")
        if not value:
            continue
        try:
            dates.append(date.fromisoformat(value))
        except ValueError:
            continue

    return {
        "games": len(rows),
        "teams": teams,
        "team_count": len(teams),
        "played_games": sum(1 for row in rows if row.get("status", "").lower() in {"played", "finished", "completed"}),
        "date_range": {
            "from": min(dates).isoformat() if dates else None,
            "to": max(dates).isoformat() if dates else None,
        },
    }
