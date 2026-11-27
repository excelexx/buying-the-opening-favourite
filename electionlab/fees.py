"""Historical Kalshi taker charges for a single funded order."""
from decimal import Decimal as D, ROUND_CEILING, ROUND_FLOOR


def charge(price, size, fee_case, remainder):
    if fee_case == "waived":
        return D(0), None
    unrounded = D(".07") * size * price * (1 - price)
    if fee_case == "per_fill_cent":
        return unrounded.quantize(D(".01"), rounding=ROUND_CEILING), None
    if fee_case != "direct_member":
        raise ValueError(f"Unsupported historical fee case {fee_case!r}")

    # Round the fee to a microdollar, then the net cash movement down to $0.0001.
    # Retain overcollection within this order and return earned $0.0001 rebates.
    fee = unrounded.quantize(D(".000001"), rounding=ROUND_CEILING)
    net = -size * price - fee
    quantum = D(".0001")
    rounding = net - net.quantize(quantum, rounding=ROUND_FLOOR)
    available = (remainder or D(0)) + rounding
    rebate = min(available, fee + rounding).quantize(quantum, rounding=ROUND_FLOOR)
    return fee + rounding - rebate, available - rebate
