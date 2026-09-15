import unittest

from validation.checks import validate_fiba_shots, validate_normalized_match


def normalized_fixture(status="Fixture", events=None, players=None, periods=None, final_home=None, final_away=None):
    return {
        "source": {"source_entity_id": "fixture-1"},
        "game": {
            "source_id": "fixture-1",
            "status": status,
            "periods": periods or [],
            "final_score": {"home": final_home, "away": final_away},
        },
        "teams": [{"source_id": "home"}, {"source_id": "away"}],
        "players": players or [],
        "events": events or [],
    }


class ValidationTests(unittest.TestCase):
    def test_unplayed_fixture_is_valid_with_empty_stats(self):
        result = validate_normalized_match(normalized_fixture())
        self.assertTrue(result["valid"])
        self.assertEqual(result["failure_count"], 0)

    def test_periods_reconcile(self):
        result = validate_normalized_match(
            normalized_fixture(
                status="Played",
                periods=[{"home_score": 7, "away_score": 18}, {"home_score": 18, "away_score": 22}],
                final_home=25,
                final_away=40,
                events=[{"source_event_id": "e1"}],
                players=[{"source_lineup_id": "l1"}],
            )
        )
        self.assertTrue(result["valid"])
        self.assertTrue(any(check["name"] == "period_score_reconciliation" and check["status"] == "pass" for check in result["checks"]))

    def test_bad_period_total_fails(self):
        result = validate_normalized_match(
            normalized_fixture(
                status="Played",
                periods=[{"home_score": 7, "away_score": 18}],
                final_home=99,
                final_away=40,
                events=[{"source_event_id": "e1"}],
                players=[{"source_lineup_id": "l1"}],
            )
        )
        self.assertFalse(result["valid"])

    def test_fiba_shot_validation_keeps_coordinate_semantics_open(self):
        result = validate_fiba_shots({"shots": [{"made": 0, "x": 24.68, "y": 16.21}]})
        self.assertTrue(result["valid"])
        self.assertTrue(any(check["name"] == "coordinate_bounds" and check["status"] == "warn" for check in result["checks"]))

