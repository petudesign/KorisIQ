import unittest

from analytics.season import aggregate_season


def box(points, two_pm, two_pa, three_pm, three_pa, fta, offensive_rebounds, defensive_rebounds, assists, turnovers):
    return {
        "points": points,
        "two_pm": two_pm,
        "two_pa": two_pa,
        "three_pm": three_pm,
        "three_pa": three_pa,
        "fta": fta,
        "offensive_rebounds": offensive_rebounds,
        "defensive_rebounds": defensive_rebounds,
        "rebounds": offensive_rebounds + defensive_rebounds,
        "assists": assists,
        "turnovers": turnovers,
        "steals": 0,
        "blocks": 0,
        "blocks_received": 0,
        "fouls": 0,
        "fouls_drawn": 0,
        "ftm": 0,
        "efficiency": 0,
    }


def game(game_id, team_a_stats, team_b_stats):
    return {
        "source": {"source_entity_id": game_id},
        "game": {"source_id": game_id, "status": "Played"},
        "teams": [
            {"source_id": "A", "name": "Team A", "score": team_a_stats["points"], "stats": team_a_stats},
            {"source_id": "B", "name": "Team B", "score": team_b_stats["points"], "stats": team_b_stats},
        ],
    }


class SeasonAggregationTests(unittest.TestCase):
    def test_missing_opponent_possessions_does_not_inflate_rating(self):
        first = game("g1", box(20, 8, 10, 0, 0, 0, 2, 8, 4, 1), box(10, 1, 10, 0, 0, 0, 1, 9, 1, 2))
        second = game("g2", box(20, 8, 10, 0, 0, 0, 2, 8, 4, 1), box(10, 1, 10, 0, 0, 0, 1, 9, 1, 2))
        second["teams"][1]["stats"]["fta"] = None
        summary = aggregate_season([first, second])
        self.assertIsNone(summary["teams"][0]["metrics"]["offensive_rating"])

    def test_percentages_are_weighted_and_per_game_values_are_exposed(self):
        snapshots = [
            game("g1", box(20, 8, 10, 0, 0, 0, 2, 8, 4, 1), box(10, 1, 10, 0, 0, 0, 1, 9, 1, 2)),
            game("g2", box(20, 1, 10, 0, 0, 0, 2, 8, 2, 1), box(10, 1, 10, 0, 0, 0, 1, 9, 1, 2)),
        ]

        summary = aggregate_season(snapshots, season_id="2025-2026", competition="Naisten Korisliiga")
        team_a = next(team for team in summary["teams"] if team["source_team_id"] == "A")

        self.assertEqual(summary["games"], 2)
        self.assertEqual(team_a["totals"]["two_pm"], 9)
        self.assertEqual(team_a["totals"]["two_pa"], 20)
        self.assertEqual(team_a["metrics"]["fg_pct"], 45.0)
        self.assertEqual(team_a["per_game"]["points"], 20.0)

    def test_duplicate_games_are_not_double_counted(self):
        snapshot = game("g1", box(20, 8, 10, 0, 0, 0, 2, 8, 4, 1), box(10, 1, 10, 0, 0, 0, 1, 9, 1, 2))
        summary = aggregate_season([snapshot, snapshot])

        self.assertEqual(summary["games"], 1)
        self.assertEqual(next(team for team in summary["teams"] if team["source_team_id"] == "A")["games"], 1)


if __name__ == "__main__":
    unittest.main()
