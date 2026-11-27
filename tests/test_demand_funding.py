from decimal import Decimal as D
import unittest

from electionlab.core import Event
from electionlab.core import stamp
from electionlab.demand_funding import charge, collect, reserve_per_share, simulate

DAY=86400
AT=stamp("2025-05-20T00:00:00Z")


def market(key,tape,*,win=1,lot=1,fees="per_fill_cent",settle=AT+180):
    return (dict(key=key,state="XX",date="2025-05-23",ticker="T-"+key,lot=lot,start=AT,end=AT+5*DAY,
                 fee_case=fees,settled_at=settle,yes_payoff=win),tape)


def q(sec,bid=.58,ask=.60):
    return Event(AT+sec,"quote",(bid+ask)/2,bid=bid,ask=ask)


def t(sec,size=400,price=.60,side="buy"):
    return Event(AT+sec,"trade",price,size,side)


class DemandFundingTests(unittest.TestCase):
    def test_two_simultaneous_requests_get_equal_fractions_regardless_of_order(self):
        a,b=[market(k,[q(1),t(7)]) for k in ("B","A")]
        def funded(rows):
            log=[]
            summary,detail,_,batches=simulate(rows,collect(rows),bank=D(10),order_log=log)
            self.assertEqual(summary["constrained_batches"],1)
            self.assertEqual(len(batches),1)
            self.assertGreaterEqual(summary["minimum_free_cash"],0)
            self.assertEqual(log[0]["granted"],log[1]["granted"])
            return {r["key"]:r["shares"] for r in detail}
        self.assertEqual(funded([a,b]),{"A":D(7),"B":D(7)})
        self.assertEqual(funded([a,b]),funded([b,a]))

    def test_orders_hold_cash_through_partial_fills_but_release_at_exact_deadline(self):
        a=market("A",[q(0),t(5,40)])
        b=market("B",[q(10),t(15),q(30),t(35)])
        s,r,f,_=simulate([a,b],collect([a,b]),bank=D("6.29"))
        self.assertGreater(s["rejected_requests"],0)
        self.assertFalse(any(row["ts"]==AT+15 for row in f))
        self.assertTrue(any(row["ts"]==AT+35 for row in f))
        self.assertGreaterEqual(s["minimum_free_cash"],0)

    def test_native_close_releases_protected_cash_and_stops_new_orders(self):
        a,tape=market("A",[q(0),t(7),q(10),t(15)])
        a["native_close"]=AT+6
        b=market("B",[q(6),t(11)])
        s,_,f,_=simulate([(a,tape),b],collect([(a,tape),b]),bank=D("6.29"))
        self.assertEqual([(r["key"],r["shares"]) for r in f],[("B",D(10))])
        self.assertEqual(s["minimum_free_cash"],D(".012"))

    def test_same_timestamp_settlement_cash_cannot_fund_new_order(self):
        a=market("A",[q(0),t(5)],settle=AT+61)
        b=market("B",[q(61),t(66),q(70),t(75)])
        _,_,f,_=simulate([a,b],collect([a,b]),bank=D("6.29"))
        self.assertFalse(any(row["ts"]==AT+66 for row in f))
        self.assertTrue(any(row["ts"]==AT+75 for row in f))

    def test_reserved_bill_covers_fragmented_native_fees_at_any_better_price(self):
        for schedule in ("waived","direct_member","per_fill_cent"):
            for lot in (D("1"),D(".01")):
                for limit in (D(".1"),D(".543"),D(".999")):
                    unit=reserve_per_share(limit,lot,schedule,D(".011"))
                    for price in (limit,limit/2,D(".001")):
                        f,_=charge(price,lot,schedule,None)
                        self.assertLessEqual(lot*(price+D(".011"))+f,lot*unit)

    def test_tied_opening_and_missing_market_never_reserve_cash(self):
        tie=market("tie",[q(0,.45,.55),q(60),t(65)])
        missing=market("missing",[])
        summary,r,_,_=simulate([tie,missing],collect([tie,missing]))
        self.assertEqual(summary["ending_cash"],D(1000))
        self.assertEqual(summary["maximum_order_cash"],0)

    def test_caps_and_protected_partial_fills_under_both_scenarios(self):
        tape = [q(0), t(1), t(3, 80), t(5, 100, .61), t(6, 400, .59), t(8, 400)]
        for i in range(1, 30):
            tape.extend([q(60*i), t(60*i+5)])
        case, tape = market("cap", tape, settle=AT + 2000)
        for stress in (False, True):
            _, rows, fills, _ = simulate([(case, tape)], collect([(case, tape)]), stress)
            self.assertEqual(rows[0]["shares"], 100)
            self.assertTrue(all(f["shares"] <= 10 for f in fills))
            self.assertTrue(all(f["price"] <= f["limit"] for f in fills))
            self.assertNotIn(AT+1, [f["ts"] for f in fills])
            self.assertNotIn(AT+5, [f["ts"] for f in fills])
            self.assertNotIn(AT+6, [f["ts"] for f in fills])
            self.assertEqual(fills[0]["shares"], 4 if stress else 2)

    def test_subsequent_quote_flip_does_not_reverse_direction(self):
        case = market("fixed", [q(0), q(2, .20, .25), t(6, price=.25),
                                t(7, price=.20, side="sell")])
        _, rows, fills, _ = simulate([case], collect([case]))
        self.assertEqual(rows[0]["side"], "YES")
        self.assertEqual(rows[0]["shares"], 10)
        self.assertEqual([f["price"] for f in fills], [D(".25")])
