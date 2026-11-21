"""Native market events and shared constants. Monetary quantities use US dollars."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal as D

BANK = D(1000)
CAP = D(100)
CLIP = D(10)
DAY = 86400


def stamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


ASOF = stamp("2026-11-20T00:00:00Z")


@dataclass(frozen=True, slots=True)
class Event:
    ts: float
    kind: str                       # quote, trade, settlement
    price: float                    # midpoint / YES trade price / settlement payoff
    size: float = 0
    aggressor: str = ''             # buy or sell YES
    bid: float = 0
    ask: float = 1


def decimal_price(value):
    # Native NO uses float complements of finite 3-decimal YES prices.
    return D(str(round(value,8)))
