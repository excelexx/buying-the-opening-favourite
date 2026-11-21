"""Fund protected orders from one shared account in native event time."""
from dataclasses import dataclass
from decimal import Decimal as D
from functools import lru_cache
from heapq import heappop, heappush, merge
from itertools import groupby

from .core import ASOF, BANK, CAP, CLIP, decimal_price
from .fees import charge

ZERO = D(0)
ONE = D(1)


@lru_cache(maxsize=1024)
def reserve_per_share(price, lot, fee_case, friction):
    """Cover a fill at the protected limit, even if every native lot fills separately."""
    if fee_case == "waived":
        return price + friction
    padding = {"per_fill_cent": D(".01"), "direct_member": D(".000101")}[fee_case]
    # The purchase price plus the unrounded fee increases throughout [0, 1].
    return price + friction + D(".07") * price * (1 - price) + padding / lot


@dataclass
class Order:
    ts: float
    limit: D
    left: D
    unit_reserve: D
    remainder: D | None = None


@dataclass
class Book:
    lot: D
    fee_case: str
    end: float
    side: str | None = None
    ask: D | None = None
    quote_at: float = 0.0
    order: Order | None = None
    shares: D = ZERO
    spent: D = ZERO
    fee: D = ZERO
    friction: D = ZERO
    redemption: D = ZERO
    desired: D = ZERO
    granted: D = ZERO
    ordered: int = 0
    constrained: int = 0
    settled: bool = False


def collect(rows):
    """Lock the first qualifying midpoint and merge native streams without reordering ties."""
    keys = [case["key"] for case, _ in rows]
    tickers = [case["ticker"] for case, _ in rows if case["ticker"]]
    if len(keys) != len(set(keys)) or len(tickers) != len(set(tickers)):
        raise ValueError("Duplicate native claim")

    streams = []
    for case, tape in rows:
        key = case["key"]
        settled = case.get("settled_at")
        if settled is not None:
            if settled > ASOF or case.get("yes_payoff") not in (0, 1):
                raise ValueError("Invalid settlement")
            streams.append([(settled, key, -1, "settle", None, None)])

        stream = []
        previous = case["start"]
        side = None
        for index, event in enumerate(tape):
            if not previous <= event.ts < case["end"] or event.kind not in ("quote", "trade"):
                raise ValueError("Invalid feature tape")
            previous = event.ts
            if event.kind == "quote":
                interior = 0 < event.bid < event.ask < 1
                if side is None and interior:
                    price_sum = D(str(event.bid)) + D(str(event.ask))
                    side = "YES" if price_sum > 1 else "NO" if price_sum < 1 else ""
                if not side:
                    continue
                ask = decimal_price(event.ask if side == "YES" else 1 - event.bid) if interior else None
                stream.append((event.ts, key, index, "quote", side, ask))
            elif side and event.aggressor == ("buy" if side == "YES" else "sell"):
                price = decimal_price(event.price if side == "YES" else 1 - event.price)
                stream.append((event.ts, key, index, "trade", price, D(str(event.size))))
        if stream:
            streams.append(stream)
    return list(merge(*streams))


SETTINGS = {
    "base": (2, D(".025"), D(".001")),
    "stress": (5, D(".01"), D(".011")),
}


def simulate(cases, events, stress=False, *, bank=BANK, detail=True, order_log=None,
             setting=None):
    """Process expiry, native messages and pro-rata order grants at each timestamp."""
    latency, participation, friction = SETTINGS[setting or ("stress" if stress else "base")]
    by_key = {case["key"]: case for case, _ in cases}
    books = {
        key: Book(D(str(case["lot"])), case["fee_case"],
                  min(case["end"], case.get("native_close", case["end"])))
        for key, case in by_key.items()
    }
    cash = min_free = bank
    held = max_held = ZERO
    constrained_batches = rejected = max_live = live = 0
    expiries = []
    fills = []
    batches = []

    for ts, group in groupby(events, key=lambda item: item[0]):
        while expiries and expiries[0][0] <= ts:
            _, key, placed = heappop(expiries)
            book = books[key]
            order = book.order
            if order and order.ts == placed:
                held -= order.left * order.unit_reserve
                book.order = None
                live -= 1

        # Fills and settlements at ts cannot fund other requests at the same ts.
        free_at_start = cash - held
        if free_at_start < 0:
            raise ValueError("Unfunded live order")
        requests = {}
        for _, key, index, kind, value, amount in group:
            book = books[key]
            if kind == "settle":
                if book.order:
                    held -= book.order.left * book.order.unit_reserve
                    book.order = None
                    live -= 1
                if book.settled:
                    raise ValueError("Redeemed twice")
                book.settled = True
                if book.side and int(book.side == "YES") == by_key[key]["yes_payoff"]:
                    book.redemption = book.shares
                    cash += book.redemption
                continue
            if book.settled or ts >= book.end or book.shares >= CAP:
                continue
            if kind == "quote":
                book.side, book.ask, book.quote_at = value, amount, ts
                if book.ask is not None and book.order is None and key not in requests:
                    wanted = min(CLIP, CAP - book.shares)
                    wanted = (wanted // book.lot) * book.lot
                    if not wanted:
                        continue
                    reserve = reserve_per_share(book.ask, book.lot, book.fee_case, friction)
                    requests[key] = (book.ask, wanted, reserve)
                continue

            price, print_size = value, amount
            order = book.order
            if (order is None or book.ask is None or ts < order.ts + latency
                    or ts - book.quote_at > 30 or not book.ask <= price <= order.limit):
                continue
            qty = min(order.left, (print_size * participation // book.lot) * book.lot)
            if not qty:
                continue
            fee, order.remainder = charge(price, qty, book.fee_case, order.remainder)
            drag = qty * friction
            cost = qty * price + fee + drag
            if cost > qty * order.unit_reserve:
                raise ValueError("Insufficient protected reserve")
            cash -= cost
            held -= qty * order.unit_reserve
            book.shares += qty
            book.spent += cost
            book.fee += fee
            book.friction += drag
            order.left -= qty
            if detail:
                fills.append(dict(
                    key=key, ts=ts, source_index=index, side=book.side, submit=order.ts,
                    price=price, limit=order.limit, shares=qty, fees=fee, friction=drag, cost=cost,
                ))
            if order.left == 0:
                book.order = None
                live -= 1

        if not requests:
            continue
        requested = sum(wanted * unit for _, wanted, unit in requests.values())
        fraction = min(ONE, free_at_start / requested)
        constrained = fraction < ONE
        constrained_batches += int(constrained)
        added = ZERO
        count = 0
        for key, (limit, wanted, unit) in requests.items():
            book = books[key]
            if book.settled or book.order is not None:
                raise ValueError("Order arbitration conflict")
            qty = (wanted * fraction // book.lot) * book.lot if constrained else wanted
            book.desired += wanted
            book.granted += qty
            book.constrained += int(qty < wanted)
            if order_log is not None:
                order_log.append(dict(ts=ts, key=key, limit=limit, desired=wanted, granted=qty,
                                      unit_reserve=unit, held=qty * unit))
            if not qty:
                rejected += 1
                continue
            book.order = Order(ts, limit, qty, unit)
            added += qty * unit
            book.ordered += 1
            live += 1
            count += 1
            heappush(expiries, (min(ts + 30, book.end), key, ts))
        held += added
        if added > free_at_start or held > cash:
            raise ValueError("Simultaneous orders overcommitted cash")
        min_free = min(min_free, cash - held)
        max_held = max(max_held, held)
        max_live = max(max_live, live)
        if constrained and detail:
            batches.append(dict(ts=ts, requests=len(requests), submitted=count, free=free_at_start,
                                wanted_reserve=requested, held_at_limits=added, fraction=fraction))

    # Every order expires by its market's window end.
    if any(book.end > ASOF for book in books.values()):
        raise ValueError("Window still live at observation cutoff")
    rows = []
    for key, book in books.items():
        case = by_key[key]
        rows.append(dict(
            key=key, date=case["date"], state=case["state"], ticker=case["ticker"], side=book.side or "",
            shares=book.shares, orders=book.ordered, requested_order_shares=book.desired,
            funded_order_shares=book.granted, constrained_requests=book.constrained,
            cost=book.spent, fees=book.fee, friction=book.friction, redemption=book.redemption,
            open_units=ZERO if book.settled else book.shares, net=book.redemption - book.spent,
        ))
    if cash != bank + sum(row["net"] for row in rows):
        raise ValueError("Account does not reconcile")
    summary = dict(
        elections=len(rows), filled=sum(row["shares"] > 0 for row in rows),
        starting_cash=bank, ending_cash=cash, net=cash - bank,
        outstanding_units=sum(row["open_units"] for row in rows), minimum_free_cash=min_free,
        maximum_order_cash=max_held, constrained_batches=constrained_batches,
        rejected_requests=rejected, maximum_live_orders=max_live,
    )
    return summary, rows, fills, batches
