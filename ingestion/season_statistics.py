"""Hydrate a compact Torneo schedule with validated public box scores."""

from __future__ import annotations

from time import sleep
import json
import hashlib
from pathlib import Path
from typing import Any, Callable
from validation.checks import validate_statistics_snapshot


PlayedMatchFetcher = Callable[[str], dict[str, Any]]


def hydrate_season_statistics(
    matches: list[dict[str, Any]],
    fetcher: PlayedMatchFetcher,
    *,
    limit: int | None = None,
    delay_seconds: float = 0.0,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """Fetch played-match statistics while keeping per-match failures visible."""

    if limit is not None and limit < 1:
        raise ValueError("limit must be positive")
    if delay_seconds < 0:
        raise ValueError("delay_seconds cannot be negative")
    cached = 0
    played = [
        row for row in matches
        if str(row.get("status") or "").lower() in {"played", "finished", "completed"}
        and row.get("source_match_id")
    ]
    selected = played[:limit] if limit is not None else played
    snapshots: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for index, match in enumerate(selected):
        match_id = str(match["source_match_id"])
        try:
            path = cache_dir / (hashlib.sha256(match_id.encode()).hexdigest() + ".json") if cache_dir else None
            snapshot = None
            if path and path.exists():
                try:
                    candidate = json.loads(path.read_text(encoding="utf-8"))
                    if candidate.get("game", {}).get("source_id") == match_id and validate_statistics_snapshot(candidate)["valid"]:
                        snapshot = candidate
                        cached += 1
                except (ValueError, AttributeError):
                    pass
            if snapshot is None:
                snapshot = fetcher(match_id)
                if snapshot.get("game", {}).get("source_id") != match_id:
                    raise ValueError("returned match identity differs from requested match")
                validation = validate_statistics_snapshot(snapshot)
                snapshot["validation"] = validation
                if not validation["valid"]:
                    raise ValueError("box-score validation failed: " + str(validation["checks"]))
                if path:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = path.with_suffix(".tmp")
                    temporary.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
                    temporary.replace(path)
            snapshots.append(snapshot)
        except Exception as exc:  # one source failure must not discard a whole season
            failures.append({"source_match_id": match_id, "error": f"{type(exc).__name__}: {exc}"})
        if delay_seconds > 0 and index < len(selected) - 1:
            sleep(delay_seconds)

    return {
        "snapshots": snapshots,
        "failures": failures,
        "summary": {
            "available_played_games": len(played),
            "requested_games": len(selected),
            "fetched_games": len(snapshots),
            "failed_games": len(failures),
            "cached_games": cached,
        },
    }
