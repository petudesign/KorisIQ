"""Small metric functions with explicit denominator behavior."""

from __future__ import annotations


def _ratio(numerator: float, denominator: float, scale: float = 1.0) -> float | None:
    if denominator == 0:
        return None
    return scale * numerator / denominator


def effective_field_goal_percentage(fgm: float, fga: float, three_pm: float) -> float | None:
    """eFG% = (FGM + 0.5 * 3PM) / FGA, returned as a percentage."""

    return _ratio(fgm + 0.5 * three_pm, fga, 100.0)


def true_shooting_percentage(points: float, fga: float, fta: float, free_throw_weight: float = 0.44) -> float | None:
    """TS% using the explicit 0.44 free-throw possession convention by default."""

    return _ratio(points, 2.0 * (fga + free_throw_weight * fta), 100.0)


def points_per_shot(points: float, fga: float) -> float | None:
    return _ratio(points, fga)


def estimated_possessions(fga: float, fta: float, offensive_rebounds: float, turnovers: float) -> float:
    """Estimate possessions; this is not a substitute for validated event possessions."""

    return fga + 0.44 * fta - offensive_rebounds + turnovers


def four_factors(*, fgm: float, fga: float, three_pm: float, points: float, fta: float, offensive_rebounds: float, total_rebounds: float, turnovers: float) -> dict[str, float | None]:
    """Return a compact four-factors-style summary with transparent inputs."""

    possessions = estimated_possessions(fga, fta, offensive_rebounds, turnovers)
    return {
        "efg_pct": effective_field_goal_percentage(fgm, fga, three_pm),
        "ts_pct": true_shooting_percentage(points, fga, fta),
        "offensive_rebound_pct_proxy": _ratio(offensive_rebounds, total_rebounds),
        "turnover_pct_proxy": _ratio(turnovers, possessions),
        "estimated_possessions": possessions,
    }
