import unittest

from normalization.basketfi_statistics import normalize_fixture_statistics
from validation.checks import validate_statistics_snapshot


def fixture_payload():
    fixture = {
        "id": "fixture-1",
        "startDateTime": "2025-10-01T18:30:00",
        "status": "CONFIRMED",
        "venue": "Test Arena",
        "competitors": [
            {"entityId": "home-1", "isHome": True, "name": "Home", "score": "80"},
            {"entityId": "away-1", "isHome": False, "name": "Away", "score": "75"},
        ],
        "periodData": {},
    }
    def side(team_id, points, starter):
        return {
            "entity": {
                "points": points,
                "pointsTwoMade": 20,
                "pointsTwoAttempted": 40,
                "pointsTwoPercentage": 50,
                "pointsThreeMade": 5,
                "pointsThreeAttempted": 15,
                "pointsThreePercentage": 33.33,
                "freeThrowsMade": points - 55,
                "freeThrowsAttempted": 30,
                "freeThrowsPercentage": 83.33,
                "reboundsOffensive": 10,
                "reboundsDefensive": 20,
                "rebounds": 30,
                "assists": 15,
                "turnovers": 8,
                "steals": 5,
                "blocks": 2,
                "blocksReceived": 1,
                "foulsTotal": 18,
                "foulsDrawn": 16,
                "plusMinus": None,
                "efficiency": 90,
            },
            "extra": {},
            "persons": [{"rows": [{
                "personId": f"{team_id}-player",
                "entityId": team_id,
                "personName": "Starter",
                "starter": starter,
                "participated": True,
                "statistics": {"minutes": "PT30M15S", "points": points, "pointsTwoMade": 4},
            }]}],
        }
    return {"data": {"banner": {"competition": {"id": "c1", "name": "Test League"}, "season": {"id": "s1", "name": "2025-26"}, "fixture": fixture}, "fixture": fixture, "statistics": {"advancedStatsEnabled": False, "data": {"base": {"home": side("home-1", 80, True), "away": side("away-1", 75, False)}}}}}


class BasketFiStatisticsTests(unittest.TestCase):
    def test_nested_person_rows_and_team_stats_are_normalized(self):
        snapshot = normalize_fixture_statistics(fixture_payload(), match_id="968948")

        self.assertEqual(snapshot["game"]["source_id"], "968948")
        self.assertEqual(snapshot["teams"][0]["stats"]["points"], 80)
        self.assertEqual(snapshot["teams"][0]["players"][0]["minutes_display"], "30:15")
        self.assertTrue(snapshot["teams"][0]["players"][0]["starter"])
        self.assertEqual(snapshot["teams"][1]["players"][0]["stats"]["points"], 75)

    def test_statistics_snapshot_validation(self):
        result = validate_statistics_snapshot(normalize_fixture_statistics(fixture_payload(), match_id="968948"))

        self.assertTrue(result["valid"])
        self.assertEqual(result["failure_count"], 0)


if __name__ == "__main__":
    unittest.main()
