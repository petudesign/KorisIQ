import unittest

from ingestion.season import extract_season_matches, summarize_season_schedule
from ingestion.season_statistics import hydrate_season_statistics


class SeasonIngestionTests(unittest.TestCase):
    def test_cached_run_does_not_fetch_again(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path
        from unittest.mock import Mock
        from tests.test_basketfi_statistics import fixture_payload
        from normalization.basketfi_statistics import normalize_fixture_statistics
        fetch = Mock(return_value=normalize_fixture_statistics(fixture_payload(), match_id="1"))
        matches = [{"source_match_id": "1", "status": "Played"}]
        with TemporaryDirectory() as directory:
            hydrate_season_statistics(matches, fetch, cache_dir=Path(directory))
            result = hydrate_season_statistics(matches, fetch, cache_dir=Path(directory))
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(result["summary"]["cached_games"], 1)

    def test_extract_can_limit_to_regular_season(self):
        payload = {
            "matches": [
                {
                    "match_id": "1",
                    "competition_id": "huki2526",
                    "category_id": "1",
                    "season_id": "2025-2026",
                    "group_id": "302291",
                    "group_name": "Runkosarja",
                    "date": "2025-10-01",
                    "time": "18:30:00",
                    "status": "Played",
                    "team_A_id": "A",
                    "team_A_name": "Team A",
                    "team_B_id": "B",
                    "team_B_name": "Team B",
                    "fs_A": "80",
                    "fs_B": "75",
                },
                {
                    "match_id": "2",
                    "group_id": "302874",
                    "group_name": "Pudotuspelit",
                    "status": "Played",
                    "team_A_id": "A",
                    "team_A_name": "Team A",
                    "team_B_id": "C",
                    "team_B_name": "Team C",
                    "fs_A": "90",
                    "fs_B": "85",
                },
            ]
        }

        matches = extract_season_matches(payload, group_id="302291", played_only=True)

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["home"]["score"], 80)
        self.assertEqual(matches[0]["away"]["name"], "Team B")

    def test_schedule_summary_reports_coverage(self):
        matches = [
            {"status": "Played", "scheduled_date": "2025-10-01", "home": {"name": "Team A"}, "away": {"name": "Team B"}},
            {"status": "Fixture", "scheduled_date": "2026-04-01", "home": {"name": "Team A"}, "away": {"name": "Team C"}},
        ]

        summary = summarize_season_schedule(matches)

        self.assertEqual(summary["games"], 2)
        self.assertEqual(summary["played_games"], 1)
        self.assertEqual(summary["team_count"], 3)
        self.assertEqual(summary["date_range"]["to"], "2026-04-01")

    def test_hydration_keeps_per_game_failures_and_respects_limit(self):
        matches = [
            {"source_match_id": "1", "status": "Played"},
            {"source_match_id": "2", "status": "Played"},
            {"source_match_id": "3", "status": "Fixture"},
        ]

        def fetcher(match_id):
            if match_id == "2":
                raise RuntimeError("temporary source failure")
            from tests.test_basketfi_statistics import fixture_payload
            from normalization.basketfi_statistics import normalize_fixture_statistics
            return normalize_fixture_statistics(fixture_payload(), match_id=match_id)

        result = hydrate_season_statistics(matches, fetcher, limit=2)

        self.assertEqual(result["summary"]["available_played_games"], 2)
        self.assertEqual(result["summary"]["fetched_games"], 1)
        self.assertEqual(result["summary"]["failed_games"], 1)
        self.assertEqual(result["failures"][0]["source_match_id"], "2")


if __name__ == "__main__":
    unittest.main()
