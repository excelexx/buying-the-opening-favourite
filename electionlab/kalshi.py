"""Read public exchange pages in memory and rebuild the frozen normalized events."""
from datetime import datetime
from decimal import Decimal
import json
import math
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://api.elections.kalshi.com/trade-api/v2"


def get(route, **params):
    url = BASE + route + ("?" + urlencode(params) if params else "")
    for attempt in range(5):
        try:
            request = Request(url, headers={"User-Agent": "US-Election-Paper-Replay/1"})
            with urlopen(request, timeout=45) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code not in {408, 429, 500, 502, 503, 504} or attempt == 4:
                raise
            hint = error.headers.get("Retry-After", "")
            wait = max(2 ** attempt, int(hint) if hint.isdigit() else 0)
        except (URLError, TimeoutError):
            if attempt == 4:
                raise
            wait = 2 ** attempt
        time.sleep(wait)


def source_pages(case):
    ticker = case["ticker"]
    historical = "/historical/markets/" + ticker
    try:
        market = get(historical)["market"]
        candle_route = historical + "/candlesticks"
    except HTTPError as error:
        if error.code != 404:
            raise
        market = get("/markets/" + ticker)["market"]
        series = ticker.split("-")[0]
        candle_route = f"/series/{series}/markets/{ticker}/candlesticks"

    if market["ticker"] != ticker:
        raise ValueError("Unexpected market " + market["ticker"])
    start, end = case["start"], case["end"]
    candles = []
    for day in range(start, end, 86400):
        page = get(candle_route, start_ts=day, end_ts=min(day + 86400, end), period_interval=1)
        if page["ticker"] != ticker:
            raise ValueError("Wrong candle market")
        candles.extend(page["candlesticks"])

    trades = []
    for route in ("/historical/trades", "/markets/trades"):
        params = dict(ticker=ticker, min_ts=start, max_ts=end, limit=1000)
        seen = set()
        while True:
            page = get(route, **params)
            trades.extend(page["trades"])
            cursor = page["cursor"]
            if not cursor:
                break
            if cursor in seen:
                raise ValueError("Trade pagination returned a repeated cursor")
            seen.add(cursor)
            params["cursor"] = cursor
    return candles, trades


def normalize(case, candles, trades):
    """Apply the frozen minute-close, print, quarantine and within-timestamp rules."""
    start = max(case["start"], case["opening"])
    stop = min(case["end"], case["native_close"])
    omitted = set(case.get("omitted_minute_ends", ()))
    prefilter = case.get("quarantine_before_normalization", False)
    quotes = {}
    for candle in candles:
        ts = candle["end_period_ts"]
        if not start <= ts < stop or (prefilter and ts in omitted):
            continue
        bid = candle["yes_bid"].get("close_dollars", candle["yes_bid"].get("close"))
        ask = candle["yes_ask"].get("close_dollars", candle["yes_ask"].get("close"))
        if bid is None or ask is None:
            continue
        bid, ask = float(bid), float(ask)
        if 0 <= bid < ask <= 1:
            quote = [ts, "quote", (bid + ask) / 2, 0, "", bid, ask]
            if ts in quotes and quote != quotes[ts]:
                raise ValueError("Conflicting quote at " + str(ts))
            quotes[ts] = quote

    first = min(quotes, default=float("inf"))
    tape = [row for ts, row in quotes.items() if ts not in omitted]
    seen = {}
    for trade in trades:
        if trade["ticker"] != case["ticker"]:
            raise ValueError("Unexpected trade ticker")
        ts = datetime.fromisoformat(trade["created_time"].replace("Z", "+00:00")).timestamp()
        if not first <= ts < stop or (math.floor(ts / 60) + 1) * 60 in omitted:
            continue
        side = trade.get("taker_outcome_side", trade.get("taker_side"))
        price = Decimal(trade["yes_price_dollars"])
        size = Decimal(trade["count_fp"])
        block = trade["is_block_trade"]
        if side not in {"yes", "no"} or not 0 <= price <= 1 or size <= 0:
            raise ValueError("Invalid trade fields")
        key = trade["trade_id"]
        identity = (ts, side, price, size, block)
        if key in seen:
            if seen[key] != identity:
                raise ValueError("Conflicting duplicate trade")
            continue
        seen[key] = identity
        if not block:
            tape.append([ts, "trade", float(price), float(size), "buy" if side == "yes" else "sell", 0, 1])

    # A print at a minute boundary precedes the new candle. Stable sorting retains
    # the venue's order among prints sharing the same timestamp.
    tape.sort(key=lambda row: (row[0], row[1] == "quote"))
    return json.dumps(tape, separators=(",", ":"), allow_nan=False).encode()
