from decimal import Decimal as D
import unittest
from electionlab.demand_funding import collect, simulate
from electionlab.replay import window
from tests.test_demand_funding import market, q, t, AT


class ImmediateStrategyTests(unittest.TestCase):
    def test_later_higher_price_does_not_require_a_discount(self):
        c = market('immediate', [q(0), t(2), q(10, .80, .82), t(12, price=.82)])
        _, rows, fills, _ = simulate([c], collect([c]))
        self.assertEqual(rows[0]['shares'], D(20))
        self.assertEqual([f['price'] for f in fills], [D('.6'), D('.82')])

    def test_partial_fills_then_next_quote_places_next_order(self):
        c = market('example', [q(0), t(2,160), t(8,240), q(9), t(12,400)])
        log = []
        _, rows, fills, _ = simulate([c], collect([c]), order_log=log)
        self.assertEqual([r['ts'] for r in log], [AT, AT+9])
        self.assertEqual([r['shares'] for r in fills], [D(4), D(6), D(10)])
        self.assertEqual(rows[0]['shares'], D(20))

    def test_moving_start_reselects_favourite_from_new_first_quote(self):
        c = market('start', [q(0), q(86400, .20, .25), t(86402,price=.20,side='sell')],
                   win=0, settle=AT+86410)
        selected = window([c], days=2)
        _, rows, _, _ = simulate(selected, collect(selected))
        self.assertEqual(rows[0]['side'], 'NO')
        self.assertEqual(rows[0]['shares'], 10)
        self.assertEqual(rows[0]['redemption'], 10)
        self.assertEqual(selected[0][0]['end'], c[0]['end'])

    def test_year_filter_keeps_only_that_year(self):
        a = market('a', [])
        b = (a[0] | {'date':'2026-05-23', 'key':'b'}, [])
        self.assertEqual([c['key'] for c, _ in window([a,b], year=2025)], ['a'])

    def test_unavailable_earlier_starts_fail(self):
        with self.assertRaises(ValueError):
            window([], days=4)
