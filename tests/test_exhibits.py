import csv
import json
import math
import random
import re
import unittest
from hashlib import sha256

from electionlab.exhibits import (OUT, group_bootstrap, intraclass, quantile, sd_with_correlation,
                                  wilson)
from electionlab.inputs import ROOT


def frozen(name):
    with (ROOT / "results" / name).open() as f:
        return list(csv.DictReader(f))


class StatisticsTests(unittest.TestCase):
    def test_wilson_interval_brackets_the_rate_and_stays_in_range(self):
        low, high = wilson(86, 92)
        self.assertLess(low, 86 / 92)
        self.assertGreater(high, 86 / 92)
        self.assertAlmostEqual(low, 0.8649, places=3)
        self.assertAlmostEqual(wilson(200, 200)[1], 1.0)
        self.assertGreater(wilson(200, 200)[0], 0.98)
        self.assertEqual(wilson(0, 0), (0.0, 1.0))

    def test_intraclass_correlation_recovers_perfect_and_absent_grouping(self):
        self.assertAlmostEqual(intraclass([1, 1, 1, -1, -1, -1], list("aaabbb")), 1.0)
        # Two groups with the same mean share nothing: the estimate falls to its floor, -1/(n0 - 1).
        self.assertAlmostEqual(intraclass([1, -1, 1, -1], list("aabb")), -1.0)
        # A shared group effect of the same size as the individual noise gives a value in between.
        mixed = intraclass([2, 0, 2, 0, -2, 0, -2, 0], list("aaaabbbb"))
        self.assertTrue(0.3 < mixed < 0.9)

    def test_correlation_inflates_the_standard_deviation_of_a_sum(self):
        # Four unit bets on one night: variance 4 when independent, 16 when identical.
        own, cross = 4.0, 12.0
        self.assertEqual(sd_with_correlation(own, cross, 0), 2.0)
        self.assertEqual(sd_with_correlation(own, cross, 1), 4.0)
        self.assertAlmostEqual(sd_with_correlation(own, cross, 0.5), math.sqrt(10))

    def test_group_bootstrap_is_reproducible_and_keeps_groups_whole(self):
        rows = [dict(g="a", v=1), dict(g="a", v=1), dict(g="b", v=10)]
        total = lambda sample: sum(r["v"] for r in sample)
        first = group_bootstrap(rows, "g", total, 200, random.Random(7))
        again = group_bootstrap(rows, "g", total, 200, random.Random(7))
        self.assertEqual(first, again)
        self.assertEqual(set(first), {4, 12, 20})          # aa, ab, bb: a group is never split
        self.assertEqual(quantile([0, 10, 20], 0.5), 10)
        self.assertEqual(quantile([0, 10, 20], 0.25), 5)


class CommittedExhibitsTests(unittest.TestCase):
    """The presentation's numbers must agree with the frozen results without any market data."""

    @classmethod
    def setUpClass(cls):
        cls.raw = OUT.read_bytes()
        cls.data = json.loads(cls.raw)

    def test_file_matches_the_recorded_digest(self):
        provenance = json.loads((ROOT / "data/provenance.json").read_text())
        self.assertEqual(sha256(self.raw).hexdigest(), provenance["exhibits_sha256"])

    def test_identity_matches_the_frozen_account(self):
        for row in frozen("accounts.csv"):
            if row["period"] != "2024–2026":
                continue
            identity = self.data["scenarios"][row["scenario"]]["identity"]
            for field in ("net", "cost", "fees", "friction", "redemption", "shares"):
                self.assertAlmostEqual(identity[field], float(row[field]), places=5)
            self.assertAlmostEqual(identity["shares"] * (identity["win_rate"] - identity["avg_cost"]),
                                   identity["net"], places=2)
            self.assertAlmostEqual(identity["margin"] * identity["turnover"] * 100, identity["return_pct"], places=3)

    def test_every_split_of_the_fills_adds_back_to_the_account(self):
        for scenario, entry in self.data["scenarios"].items():
            net = entry["identity"]["net"]
            fills = entry["fills"]
            for cells in (fills["by_day"], fills["by_price"], list(fills["by_anchor"].values()),
                          list(fills["by_phase"].values())):
                self.assertAlmostEqual(sum(c["net"] for c in cells), net, places=3, msg=scenario)
                self.assertAlmostEqual(sum(c["shares"] for c in cells), entry["identity"]["shares"], places=3)
            self.assertEqual(sum(c["fills"] for c in fills["by_day"]), entry["capital"]["fills"])

    def test_voting_dates_and_positions_match_the_frozen_tables(self):
        for scenario, entry in self.data["scenarios"].items():
            dates = [r for r in frozen("voting_dates.csv") if r["scenario"] == scenario]
            self.assertEqual([d["date"] for d in entry["dates"]], [r["date"] for r in dates])
            for mine, theirs in zip(entry["dates"], dates):
                self.assertAlmostEqual(mine["net"], float(theirs["net"]), places=5)
            positions = [r for r in frozen("positions.csv") if r["scenario"] == scenario]
            held = [r for r in positions if float(r["shares"]) > 0]
            self.assertEqual(entry["positions"]["positions"], len(held))
            self.assertEqual(sum(t["positions"] for t in entry["positions"]["by_type"]), len(held))
            self.assertAlmostEqual(sum(t["net"] for t in entry["positions"]["by_type"]), entry["identity"]["net"], places=3)
            risk = entry["risk"]
            self.assertAlmostEqual(risk["z_independent"],
                                   (risk["net"] - risk["null_mean"]) / math.sqrt(risk["own_variance"]), places=4)
            self.assertAlmostEqual(risk["net_without_top_date"] + risk["top_date_net"], risk["net"], places=4)
            self.assertEqual(sum(risk["boot_hist"]["counts"]), risk["boot_draws"])

    def test_calendar_and_opening_sample_are_complete(self):
        universe = self.data["universe"]
        self.assertEqual(len(universe["cells"]), 1780)
        self.assertEqual(len(universe["dates"]), 52)
        self.assertEqual(sum(cell[2] for cell in universe["cells"]), 530)
        bought = sum(1 for cell in universe["cells"] if cell[4] > 0)
        self.assertEqual(bought, self.data["scenarios"]["normal"]["positions"]["positions"])
        opening = self.data["opening"]
        self.assertEqual(sum(b["n"] for b in opening["buckets"]), opening["settled"])
        self.assertEqual(sum(b["wins"] for b in opening["buckets"]), opening["wins"])
        self.assertAlmostEqual(opening["wins"] / opening["settled"], opening["win_rate"], places=5)
        self.assertEqual(opening["sided"] + opening["tied"], opening["quoted"])

    def test_findings_stated_in_words_still_hold(self):
        """The chapters say these in prose, so a change in the data must fail here before it misleads there."""
        opening = self.data["opening"]
        # "Above 70¢ every group won more often than it cost", and the cheaper groups did not.
        for group in opening["buckets"]:
            compare = self.assertGreater if group["lo"] >= 0.7 else self.assertLess
            compare(group["win_rate"], group["mean_ask"], group)
        # The same-night correlation "cannot be told from zero", and 0.1 is "not ruled out".
        self.assertLess(opening["same_night_null_lo"], 0)
        self.assertLess(opening["same_night_corr"], opening["same_night_null_hi"])
        self.assertGreater(opening["same_night_null_share_above"], 0.05)
        for entry in self.data["scenarios"].values():
            fills, risk = entry["fills"], entry["risk"]
            # "The money came from buying the favourite when it was marked down."
            self.assertGreater(fills["by_anchor"]["below"]["net"], 0)
            self.assertLess(fills["by_anchor"]["at_or_above"]["net"], 0)
            # "Promising, not proven": above a fair market, but short of two standard deviations.
            self.assertTrue(0 < risk["z_independent"] < 2, risk["z_independent"])


class DeckTextTests(unittest.TestCase):
    """Figures typed into the original chapters must equal the frozen tables."""

    def test_result_tables_in_the_deck_match_accounts_and_start_days(self):
        deck = (ROOT / "artifacts/opening-favourite/src/deck.ts").read_text()
        for row in frozen("accounts.csv"):
            net, pct = float(row["net"]), float(row["return_pct"])
            self.assertIn(f"+${net:.2f}", deck, row)
            self.assertIn(f"{pct:.2f}%", deck, row)
        chart = re.search(r"startChart = \[(.*?)\];", deck, re.S).group(1)
        values = [float(v) for v in re.findall(r"v: ([\d.]+)", chart)]
        normal = {int(r["days_before_vote"]): float(r["net"]) for r in frozen("start_days.csv")
                  if r["scenario"] == "normal"}
        self.assertEqual(values, [round(normal[d], 2) for d in (3, 2, 1, 0)])


if __name__ == "__main__":
    unittest.main()
