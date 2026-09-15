import unittest

from analytics.metrics import (
    effective_field_goal_percentage,
    estimated_possessions,
    four_factors,
    true_shooting_percentage,
)


class MetricTests(unittest.TestCase):
    def test_common_formulas(self):
        self.assertAlmostEqual(effective_field_goal_percentage(8, 10, 4), 100.0)
        self.assertAlmostEqual(true_shooting_percentage(20, 10, 0), 100.0)
        self.assertEqual(estimated_possessions(10, 4, 2, 3), 12.76)

    def test_zero_denominators_are_unknown(self):
        self.assertIsNone(effective_field_goal_percentage(0, 0, 0))
        self.assertIsNone(true_shooting_percentage(0, 0, 0))
        self.assertIsNone(four_factors(fgm=0, fga=0, three_pm=0, points=0, fta=0, offensive_rebounds=0, total_rebounds=0, turnovers=0)["efg_pct"])

