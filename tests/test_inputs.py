from hashlib import sha256
import json
import unittest

from electionlab.inputs import CALENDAR, CALENDAR_SHA256
from electionlab.kalshi import normalize


class InputTests(unittest.TestCase):
    def test_roster_pins_all_listed_tapes_and_retains_empty_windows(self):
        raw = CALENDAR.read_bytes()
        self.assertEqual(sha256(raw).hexdigest(), CALENDAR_SHA256)
        rows = json.loads(raw)
        listed = [r for r in rows if r["ticker"]]
        self.assertEqual(len(rows), 1780)
        self.assertEqual(len({r["date"] for r in rows}), 52)
        self.assertEqual(len({r["ticker"] for r in listed}), 530)
        self.assertTrue(all(len(r["events_sha256"]) == 64 and r["opening"] is not None for r in listed))

    def test_public_reader_preserves_the_minute_boundary_and_deduplicates_prints(self):
        case = {"ticker": "TEST", "start": 0, "end": 180, "native_close": 180, "opening": 0}
        candles = [{"end_period_ts": t, "yes_bid": {"close_dollars": ".58"},
                    "yes_ask": {"close_dollars": ".60"}} for t in (60,120)]
        print_row = {"ticker": "TEST", "created_time": "1970-01-01T00:02:00Z", "trade_id": "t1",
                     "taker_side": "yes", "yes_price_dollars": ".60", "count_fp": "100", "is_block_trade": False}
        rows = json.loads(normalize(case, candles, [print_row, print_row]))
        self.assertEqual([(r[0], r[1]) for r in rows], [(60,"quote"), (120,"trade"), (120,"quote")])
