"""Command-line entry point for generating compact normalized snapshots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from analytics.season import aggregate_season
from analytics.export_web import export_summary

from ingestion.basketfi import BasketFiClient
from ingestion.basketfi_statistics import BasketFiStatisticsClient
from ingestion.fibalivestats import FibaLiveStatsClient
from ingestion.season import extract_season_matches, summarize_season_schedule
from ingestion.season_statistics import hydrate_season_statistics
from normalization.basketfi import normalize_match
from normalization.fibalivestats import normalize_shots
from validation.checks import validate_fiba_shots, validate_normalized_match, validate_statistics_snapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read and normalize one public basketball source record")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--match-id", help="Torneo/Basket.fi match ID")
    source.add_argument("--statistics-match-id", help="Torneo/Basket.fi match ID; fetches the full public box score")
    source.add_argument("--fiba-match-id", help="FIBA LiveStats match ID")
    source.add_argument("--season", action="store_true", help="Extract a compact season schedule")
    source.add_argument("--season-statistics", action="store_true", help="Hydrate played season matches with public box scores")
    parser.add_argument("--competition-id", help="Torneo competition ID, required with --match-id, --season, or --season-statistics")
    parser.add_argument("--category-id", help="Torneo category ID, required with --match-id, --season, or --season-statistics")
    parser.add_argument("--group-id", help="Optional competition phase/group filter for --season or --season-statistics")
    parser.add_argument("--limit", type=int, help="Optional maximum number of played games for --season-statistics")
    parser.add_argument("--delay-seconds", type=float, default=1.0, help="Delay between statistics requests for --season-statistics")
    parser.add_argument("--cache-dir", default="data/cache/statistics", help="Validated per-match cache; delete a match file to refresh it")
    parser.add_argument("--out", required=True, help="Output JSON path")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if (args.match_id or args.season or args.season_statistics) and not args.competition_id:
        raise SystemExit("--competition-id is required with --match-id, --season, or --season-statistics")
    if (args.match_id or args.season or args.season_statistics) and not args.category_id:
        raise SystemExit("--category-id is required with --match-id, --season, or --season-statistics")

    if args.match_id:
        client = BasketFiClient()
        category_payload = client.get_category(args.competition_id, args.category_id)
        payload = client.get_match(args.match_id)
        normalized = normalize_match(payload)
        category_info = category_payload.get("category")
        category_name = None
        if isinstance(category_info, dict):
            category_name = category_info.get("name") or category_info.get("category_name")
        normalized["source"]["requested_context"] = {
            "competition_id": args.competition_id,
            "category_id": args.category_id,
            "category_name": category_name,
        }
        normalized["validation"] = validate_normalized_match(normalized)
    elif args.statistics_match_id:
        normalized = BasketFiStatisticsClient().get_match_statistics(args.statistics_match_id)
        normalized["validation"] = validate_statistics_snapshot(normalized)
    elif args.season:
        client = BasketFiClient()
        payload = client.get_matches(args.competition_id, args.category_id)
        matches = extract_season_matches(payload, group_id=args.group_id)
        normalized = {
            "schema_version": "0.1",
            "source": {
                "system": "basketfi_torneopal",
                "entity": "season_schedule",
                "competition_id": args.competition_id,
                "category_id": args.category_id,
                "group_id": args.group_id,
            },
            "season": args.competition_id,
            "matches": matches,
            "summary": summarize_season_schedule(matches),
        }
    elif args.season_statistics:
        client = BasketFiClient()
        payload = client.get_matches(args.competition_id, args.category_id)
        matches = extract_season_matches(payload, group_id=args.group_id, played_only=True)
        hydration = hydrate_season_statistics(
            matches,
            BasketFiStatisticsClient().get_match_statistics,
            limit=args.limit,
            delay_seconds=max(0.0, args.delay_seconds),
            cache_dir=Path(args.cache_dir),
        )
        valid_snapshots = []
        validation_failures = []
        for snapshot in hydration["snapshots"]:
            validation = validate_statistics_snapshot(snapshot)
            snapshot["validation"] = validation
            if validation["valid"]:
                valid_snapshots.append(snapshot)
            else:
                validation_failures.append(
                    {
                        "source_match_id": snapshot.get("game", {}).get("source_id"),
                        "error": "statistics validation failed",
                        "validation": validation,
                    }
                )
        hydration["failures"].extend(validation_failures)
        hydration["summary"]["valid_games"] = len(valid_snapshots)
        hydration["summary"]["invalid_games"] = len(validation_failures)
        normalized = {
            "schema_version": "0.1",
            "source": {
                "system": "basketfi_sportradar_embed",
                "entity": "season_statistics",
                "competition_id": args.competition_id,
                "category_id": args.category_id,
                "group_id": args.group_id,
            },
            "season": args.competition_id,
            "matches": valid_snapshots,
            "failures": hydration["failures"],
            "summary": hydration["summary"],
            "aggregate": aggregate_season(valid_snapshots, season_id=args.competition_id),
        }
    else:
        payload = FibaLiveStatsClient().get_data(args.fiba_match_id)
        normalized = normalize_shots(payload, match_id=args.fiba_match_id)
        normalized["validation"] = validate_fiba_shots(normalized)

    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.season_statistics:
        export_summary(output)
    validation = normalized.get("validation", {})
    print(json.dumps({"out": str(output), "valid": validation.get("valid", True), "warnings": validation.get("warning_count", 0)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
