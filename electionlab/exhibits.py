"""Derive the presentation's math exhibits from verified market events.

The replay answers "what did the fixed rules earn?". This module answers "where did
it come from, and how sure can we be?" using the same verified tapes and the same
simulator. It writes one JSON file that the web presentation imports, so every
figure on the site traces to this code.

    python -m electionlab.exhibits --tapes /path/to/verified-tapes
    python -m electionlab.exhibits --archives /path/to/source-archives
    python -m electionlab.exhibits --kalshi --save-tapes /path/to/verified-tapes

Standard library only. Money is in US dollars; probabilities are in [0, 1].
"""
import argparse
import csv
import json
import math
import random
import re
from collections import defaultdict
from decimal import Decimal as D
from hashlib import sha256
from pathlib import Path

from .core import ASOF, Event
from .demand_funding import collect, simulate
from .inputs import CALENDAR, CALENDAR_SHA256, ROOT, population
from .replay import MODES, window

OUT = ROOT / "artifacts/opening-favourite/src/data/exhibits.json"
DAY = 86400
SEED = 20261120
TAKER = 0.07

# Roster key prefixes grouped into six readable contest types.
TYPES = [
    ("President, state by state", ("presidential_state_electoral",)),
    ("Senate and House, general and special", ("senate", "house", "house_general_sworn")),
    ("Governor, general", ("governor",)),
    ("Primaries and runoffs", (
        "us_primary_holdout", "us_primary_late", "house_nomination_funding",
        "house_primary_replication", "house_primary_remaining", "regular_senate_runoff",
        "us_ag_nomination")),
    ("Ballot measures", ("us_ballot_general", "us_ballot_measures_2025")),
    ("Mayor", ("mayor",)),
]
TYPE_OF = {prefix: index for index, (_, prefixes) in enumerate(TYPES) for prefix in prefixes}


# ---------------------------------------------------------------- inputs

def cached_population(directory, save=None):
    """Read normalized tapes named <sha256>.json, checking every digest."""
    roster = CALENDAR.read_bytes()
    if sha256(roster).hexdigest() != CALENDAR_SHA256:
        raise ValueError("The U.S. replay roster differs from the frozen manifest")
    rows = []
    for case in json.loads(roster):
        tape = []
        if case["ticker"]:
            raw = (directory / (case["events_sha256"] + ".json")).read_bytes()
            if sha256(raw).hexdigest() != case["events_sha256"]:
                raise ValueError(f"Frozen tape mismatch for {case['key']}")
            tape = [Event(*event) for event in json.loads(raw)]
        rows.append((case, tape))
    return rows


def save_tapes(rows, directory):
    """Write each verified tape back out byte-for-byte so later runs need no network."""
    directory.mkdir(parents=True, exist_ok=True)
    for case, tape in rows:
        if not case["ticker"]:
            continue
        raw = json.dumps([[e.ts, e.kind, e.price, e.size, e.aggressor, e.bid, e.ask] for e in tape],
                         separators=(",", ":"), allow_nan=False).encode()
        if sha256(raw).hexdigest() != case["events_sha256"]:
            raise ValueError(f"Cannot re-serialize {case['key']} exactly")
        (directory / (case["events_sha256"] + ".json")).write_bytes(raw)


# ---------------------------------------------------------------- small statistics

def wilson(wins, n, z=1.959964):
    """Wilson score interval for a binomial proportion."""
    if not n:
        return 0.0, 1.0
    p = wins / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return max(0.0, centre - half), min(1.0, centre + half)


def mean(values):
    return sum(values) / len(values)


def sample_sd(values):
    m = mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / (len(values) - 1))


def intraclass(values, groups):
    """Share of the variance that members of one group have in common: the correlation
    between two members of the same group. One-way random-effects estimate for groups
    of unequal size, (MSB - MSW) / (MSB + (n0 - 1) MSW)."""
    members = defaultdict(list)
    for v, g in zip(values, groups):
        members[g].append(v)
    n, count = len(values), len(members)
    grand = mean(values)
    between = sum(len(m) * (mean(m) - grand) ** 2 for m in members.values()) / (count - 1)
    within = sum(sum((v - mean(m)) ** 2 for v in m) for m in members.values()) / (n - count)
    typical = (n - sum(len(m) ** 2 for m in members.values()) / n) / (count - 1)
    denominator = between + (typical - 1) * within
    return (between - within) / denominator if denominator else 0.0


def group_bootstrap(rows, key, statistic, draws, rng):
    """Resample whole groups with replacement; return the sorted statistic."""
    groups = defaultdict(list)
    for row in rows:
        groups[row[key]].append(row)
    names = sorted(groups)
    out = []
    for _ in range(draws):
        sample = []
        for _ in names:
            sample.extend(groups[names[rng.randrange(len(names))]])
        out.append(statistic(sample))
    out.sort()
    return out


def quantile(sorted_values, q):
    position = q * (len(sorted_values) - 1)
    low = int(position)
    high = min(low + 1, len(sorted_values) - 1)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (position - low)


def sd_with_correlation(own, cross, rho):
    """Standard deviation of a sum whose same-night pairs share correlation rho."""
    return math.sqrt(max(0.0, own + rho * cross))


def fee_per_share(price, fee_case):
    """Unrounded taker fee per share; 2024 election contracts were fee-free."""
    return 0.0 if fee_case == "waived" else TAKER * price * (1 - price)


# ---------------------------------------------------------------- opening quotes

def opening_quotes(rows):
    """The first usable quote of each contract, read exactly as the simulator reads it."""
    opening = {}
    for case, tape in rows:
        for event in tape:
            if event.kind == "quote" and 0 < event.bid < event.ask < 1:
                total = D(str(event.bid)) + D(str(event.ask))
                side = "YES" if total > 1 else "NO" if total < 1 else ""
                yes = side != "NO"
                opening[case["key"]] = dict(
                    side=side, ts=event.ts,
                    mid=(event.bid + event.ask) / 2 if yes else 1 - (event.bid + event.ask) / 2,
                    ask=event.ask if yes else 1 - event.bid,
                    bid=event.bid if yes else 1 - event.ask)
                break
    return opening


def won(case, side):
    if case.get("settled_at") is None:
        return None
    return int((side == "YES") == (case["yes_payoff"] == 1))


def stream(name):
    """A reproducible random stream per exhibit, so changing one never shifts another's draws."""
    return random.Random(f"{SEED}/{name}")


def calibration(rows, opening):
    """Does the opening favourite win as often as its opening price says?"""
    sample = []
    for case, _ in rows:
        quote = opening.get(case["key"])
        if not quote or not quote["side"]:
            continue
        outcome = won(case, quote["side"])
        if outcome is None:
            continue
        net = outcome - quote["ask"] - fee_per_share(quote["ask"], case["fee_case"]) - 0.001
        sample.append(dict(date=case["date"], p=quote["mid"], ask=quote["ask"], w=outcome, net=net,
                           type=TYPE_OF[case["key"].split("/")[0]]))
    n = len(sample)
    win_rate = mean([r["w"] for r in sample])

    def summary(field):
        values = [r["w"] - r[field] if field != "net" else r["net"] for r in sample]
        boot = group_bootstrap(
            sample, "date",
            lambda s: mean([r["w"] - r[field] if field != "net" else r["net"] for r in s]), 4000,
            stream("opening/" + field))
        return dict(mean=mean(values), se_iid=sample_sd(values) / math.sqrt(n),
                    boot_lo=quantile(boot, .025), boot_hi=quantile(boot, .975),
                    boot_share_positive=sum(v > 0 for v in boot) / len(boot))

    edges = [.5, .6, .7, .8, .9, .95, 1.0001]
    buckets = []
    for low, high in zip(edges, edges[1:]):
        members = [r for r in sample if low <= r["p"] < high]
        wins = sum(r["w"] for r in members)
        lo95, hi95 = wilson(wins, len(members))
        buckets.append(dict(lo=low, hi=min(high, 1.0), n=len(members), wins=wins,
                            mean_p=mean([r["p"] for r in members]),
                            mean_ask=mean([r["ask"] for r in members]),
                            win_rate=wins / len(members), lo95=lo95, hi95=hi95))

    sx = sum(r["p"] for r in sample)
    sy = sum(r["w"] for r in sample)
    sxx = sum(r["p"] ** 2 for r in sample)
    sxy = sum(r["p"] * r["w"] for r in sample)
    syy = sum(r["w"] ** 2 for r in sample)
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    intercept = (sy - slope * sx) / n
    price_outcome_corr = (n * sxy - sx * sy) / math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))

    # Standardized surprises: how far each outcome landed from its opening price.
    # Their same-night correlation is compared with what shuffled dates produce.
    z = [(r["w"] - r["p"]) / math.sqrt(r["p"] * (1 - r["p"])) for r in sample]
    dates = [r["date"] for r in sample]
    rho = intraclass(z, dates)
    shuffled = list(dates)
    null = []
    rng = stream("opening/shuffle")
    for _ in range(4000):
        rng.shuffle(shuffled)
        null.append(intraclass(z, shuffled))
    null.sort()
    nights = []
    for date in sorted(set(dates)):
        members = [r for r in sample if r["date"] == date]
        if len(members) >= 50:
            nights.append(dict(date=date, n=len(members), wins=sum(r["w"] for r in members),
                               mean_p=mean([r["p"] for r in members]),
                               gap_mid=mean([r["w"] - r["p"] for r in members])))

    by_year = []
    for year in ("2024", "2025", "2026"):
        members = [r for r in sample if r["date"].startswith(year)]
        by_year.append(dict(year=year, n=len(members), mean_p=mean([r["p"] for r in members]),
                            win_rate=mean([r["w"] for r in members])))
    by_type = []
    for index, (label, _) in enumerate(TYPES):
        members = [r for r in sample if r["type"] == index]
        if members:
            by_type.append(dict(type=label, n=len(members), mean_p=mean([r["p"] for r in members]),
                                win_rate=mean([r["w"] for r in members])))
    sizes = sorted((dates.count(d) for d in set(dates)), reverse=True)
    return dict(
        listed=sum(1 for case, _ in rows if case["ticker"]),
        quoted=len(opening), tied=sum(1 for q in opening.values() if not q["side"]),
        sided=sum(1 for q in opening.values() if q["side"]), settled=n,
        voting_dates=len(set(dates)), largest_nights=sizes[:3],
        mean_mid=mean([r["p"] for r in sample]), mean_ask=mean([r["ask"] for r in sample]),
        win_rate=win_rate, wins=sum(r["w"] for r in sample),
        gap_mid=summary("p"), gap_ask=summary("ask"), net_per_share=summary("net"),
        brier=mean([(r["p"] - r["w"]) ** 2 for r in sample]), brier_base_rate=win_rate * (1 - win_rate),
        slope=slope, intercept=intercept, price_outcome_corr=price_outcome_corr,
        same_night_corr=rho, same_night_null_lo=quantile(null, .025), same_night_null_hi=quantile(null, .975),
        same_night_null_share_above=sum(v >= rho for v in null) / len(null), big_nights=nights,
        buckets=buckets, by_year=by_year, by_type=by_type)


# ---------------------------------------------------------------- where the profit came from

def blank():
    return dict(fills=0, shares=0.0, cost=0.0, payout=0.0, markets=set(), markets_won=set())


def finish(cell):
    cell["net"] = cell["payout"] - cell["cost"]
    cell["avg_cost"] = cell["cost"] / cell["shares"] if cell["shares"] else 0.0
    cell["win_rate"] = cell["payout"] / cell["shares"] if cell["shares"] else 0.0
    cell["markets"] = len(cell["markets"])
    cell["markets_won"] = len(cell["markets_won"])
    return cell


def fill_breakdown(fills, by_key, opening):
    """Split every simulated fill by when it happened and what it cost."""
    by_day = defaultdict(blank)
    by_price = defaultdict(blank)
    by_anchor = defaultdict(blank)
    by_phase = defaultdict(blank)
    for fill in fills:
        case = by_key[fill["key"]]
        day = int((fill["ts"] - case["start"]) // DAY) - 3      # 0 is voting day (UTC)
        outcome = won(case, fill["side"]) or 0
        shares, cost = float(fill["shares"]), float(fill["cost"])
        price = float(fill["price"])
        anchor = "below" if price < opening[fill["key"]]["mid"] - 1e-9 else "at_or_above"
        for table, key in ((by_day, day), (by_price, min(int(price * 10 + 1e-9), 9)),
                           (by_anchor, anchor), (by_phase, "before" if day <= 0 else "after")):
            cell = table[key]
            cell["fills"] += 1
            cell["shares"] += shares
            cell["cost"] += cost
            cell["payout"] += shares * outcome
            cell["markets"].add(fill["key"])
            if outcome:
                cell["markets_won"].add(fill["key"])
    return dict(
        by_day=[dict(day=k, **finish(v)) for k, v in sorted(by_day.items())],
        by_price=[dict(lo=k / 10, hi=(k + 1) / 10, **finish(v)) for k, v in sorted(by_price.items())],
        by_anchor={k: finish(v) for k, v in by_anchor.items()},
        by_phase={k: finish(v) for k, v in by_phase.items()})


def position_tables(positions, by_key):
    held = [p for p in positions if p["shares"] > 0]
    rows = []
    for p in held:
        case = by_key[p["key"]]
        shares, cost = float(p["shares"]), float(p["cost"])
        price = (cost - float(p["fees"]) - float(p["friction"])) / shares
        rows.append(dict(key=p["key"], date=p["date"], side=p["side"], shares=shares, cost=cost,
                         price=price, net=float(p["net"]), w=won(case, p["side"]),
                         type=TYPE_OF[p["key"].split("/")[0]]))
    by_type = []
    for index, (label, _) in enumerate(TYPES):
        members = [r for r in rows if r["type"] == index]
        scheduled = sum(1 for key in by_key if TYPE_OF[key.split("/")[0]] == index)
        listed = sum(1 for key, case in by_key.items() if TYPE_OF[key.split("/")[0]] == index and case["ticker"])
        by_type.append(dict(type=label, scheduled=scheduled, listed=listed, positions=len(members),
                            won=sum(r["w"] or 0 for r in members), shares=sum(r["shares"] for r in members),
                            cost=sum(r["cost"] for r in members), net=sum(r["net"] for r in members)))
    by_year = []
    for year in ("2024", "2025", "2026"):
        members = [r for r in rows if r["date"].startswith(year)]
        by_year.append(dict(year=year, positions=len(members), won=sum(r["w"] or 0 for r in members),
                            shares=sum(r["shares"] for r in members), cost=sum(r["cost"] for r in members),
                            net=sum(r["net"] for r in members)))
    ranked = sorted(rows, key=lambda r: r["net"])
    pick = lambda r: dict(key=r["key"], side=r["side"], shares=r["shares"], cost=r["cost"], net=r["net"])
    settled = [r for r in rows if r["w"] is not None]
    return rows, dict(
        positions=len(rows), settled=len(settled), won=sum(r["w"] for r in settled),
        by_type=by_type, by_year=by_year,
        largest_losses=[pick(r) for r in ranked[:5]], largest_gains=[pick(r) for r in ranked[::-1][:5]])


# ---------------------------------------------------------------- how sure can we be?

def risk(rows, dates, summary, costs, scenario):
    """Two views of luck: a correlation model and a resampling of voting dates."""
    settled = [r for r in rows if r["w"] is not None]
    spread = [r["shares"] * math.sqrt(r["price"] * (1 - r["price"])) for r in settled]
    own = sum(s * s for s in spread)
    night = defaultdict(float)
    for s, r in zip(spread, settled):
        night[r["date"]] += s
    cross = sum(v * v for v in night.values()) - own
    z = [(r["w"] - r["price"]) / math.sqrt(r["price"] * (1 - r["price"])) for r in settled]
    rho = intraclass(z, [r["date"] for r in settled])

    net = float(summary["net"])
    active = [d for d in dates if d["shares"] > 0]
    nets = [float(d["net"]) for d in active]
    per_date = [dict(date=d["date"], net=float(d["net"])) for d in dates]
    boot = group_bootstrap(per_date, "date", lambda s: sum(r["net"] for r in s), 20000, stream("dates/" + scenario))
    ranked = sorted(active, key=lambda d: -float(d["net"]))
    top = ranked[0]
    width = 50
    low = math.floor(boot[0] / width) * width
    bins = [0] * (int((boot[-1] - low) // width) + 1)
    for value in boot:
        bins[int((value - low) // width)] += 1
    return dict(
        own_variance=own, same_night_cross=cross, null_mean=-costs, net=net,
        sd_independent=math.sqrt(own), z_independent=(net + costs) / math.sqrt(own),
        rho_positions=rho,
        active_dates=len(active), winning_dates=sum(v > 0 for v in nets), losing_dates=sum(v < 0 for v in nets),
        date_mean=mean(nets), date_sd=sample_sd(nets),
        date_t=mean(nets) / (sample_sd(nets) / math.sqrt(len(nets))),
        boot_lo=quantile(boot, .05), boot_median=quantile(boot, .5), boot_hi=quantile(boot, .95),
        boot_share_positive=sum(v > 0 for v in boot) / len(boot),
        boot_draws=len(boot), boot_hist=dict(start=low, width=width, counts=bins),
        top_date=top["date"], top_date_net=float(top["net"]), top_date_share=float(top["net"]) / net,
        net_without_top_date=net - float(top["net"]),
        largest_position_sd=max(spread))


# ---------------------------------------------------------------- the account through time

def equity_curve(fills, positions, by_key):
    """Realized equity and capital at work, sampled at the end of each UTC day that changes."""
    changes = defaultdict(lambda: [0.0, 0.0])          # day -> [realized change, deployed change]
    for fill in fills:
        changes[int(fill["ts"] // DAY)][1] += float(fill["cost"])
    for p in positions:
        case = by_key[p["key"]]
        if p["shares"] > 0 and case.get("settled_at") is not None:
            day = int(case["settled_at"] // DAY)
            changes[day][0] += float(p["net"])
            changes[day][1] -= float(p["cost"])
    realized = deployed = 0.0
    peak = (0.0, 0)
    series = []
    for day in sorted(changes):
        realized += changes[day][0]
        deployed += changes[day][1]
        if deployed > peak[0]:
            peak = (deployed, day)
        series.append([day * DAY, round(1000 + realized, 4), round(max(deployed, 0.0), 4)])
    series.append([int(ASOF), round(1000 + realized, 4), round(max(deployed, 0.0), 4)])
    return dict(series=series, peak_deployed=peak[0], peak_day=peak[1] * DAY)


def lockup(rows, positions):
    """Days between the start of voting day (UTC) and settlement: how long cash stays tied up."""
    held = {p["key"]: float(p["cost"]) for p in positions if p["shares"] > 0}
    days, weighted, weight = [], 0.0, 0.0
    by_type = defaultdict(list)
    for case, _ in rows:
        if not case["ticker"] or case.get("settled_at") is None:
            continue
        wait = (case["settled_at"] - case["start"]) / DAY - 3
        days.append(wait)
        by_type[TYPE_OF[case["key"].split("/")[0]]].append(wait)
        if case["key"] in held:
            weighted += wait * held[case["key"]]
            weight += held[case["key"]]
    days.sort()
    return dict(
        contracts=len(days), median_days=quantile(days, .5), p90_days=quantile(days, .9), longest_days=days[-1],
        cost_weighted_days=weighted / weight,
        by_type=[dict(type=TYPES[index][0], median_days=quantile(sorted(by_type[index]), .5),
                      longest_days=max(by_type[index])) for index in sorted(by_type)])


def universe(rows, positions):
    """One compact record per scheduled opportunity, in roster order, for the calendar exhibit."""
    held = {p["key"]: p for p in positions}
    dates = sorted({case["date"] for case, _ in rows})
    index = {d: i for i, d in enumerate(dates)}
    cells = []
    for case, _ in rows:
        p = held[case["key"]]
        outcome = won(case, p["side"]) if p["side"] else None
        cells.append([index[case["date"]], TYPE_OF[case["key"].split("/")[0]], int(bool(case["ticker"])),
                      {"": 0, "YES": 1, "NO": 2}[p["side"]], round(float(p["shares"]), 2),
                      0 if outcome is None else 2 - outcome, round(float(p["net"]), 2)])
    return dict(dates=dates, fields=["date", "type", "listed", "side", "shares", "result", "net"], cells=cells)


# ---------------------------------------------------------------- assembly

def frozen(name):
    with (ROOT / "results" / name).open() as f:
        return list(csv.DictReader(f))


def tidy(value, digits=6):
    """Round floats and convert Decimals so the JSON is stable and compact."""
    if isinstance(value, dict):
        return {k: tidy(v, digits) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [tidy(v, digits) for v in value]
    if isinstance(value, D):
        value = float(value)
    if isinstance(value, float):
        return round(value, digits)
    return value


def build(rows):
    selected = window(rows)
    events = collect(selected)
    by_key = {case["key"]: case for case, _ in selected}
    opening = opening_quotes(selected)
    out = dict(
        cutoff="2026-11-20T00:00:00Z",
        tapes=dict(listed=sum(1 for case, _ in rows if case["ticker"]), verified=True),
        types=[label for label, _ in TYPES],
        opening=calibration(selected, opening),
        scenarios={})
    for scenario, setting in MODES.items():
        summary, positions, fills, batches = simulate(selected, events, setting=setting)
        account, = [r for r in frozen("accounts.csv")
                    if r["period"] == "2024–2026" and r["scenario"] == scenario]
        if D(account["net"]) != summary["net"]:
            raise ValueError("Replay differs from the frozen account: " + scenario)
        sides = {p["key"]: p["side"] for p in positions}
        if any(sides[key] != quote["side"] for key, quote in opening.items()):
            raise ValueError("Opening sides differ from the simulator")
        totals = {f: float(sum((p[f] for p in positions), D(0)))
                  for f in ("shares", "cost", "fees", "friction", "redemption")}
        principal = totals["cost"] - totals["fees"] - totals["friction"]
        identity = dict(
            **totals, principal=principal, net=float(summary["net"]),
            avg_price=principal / totals["shares"], avg_cost=totals["cost"] / totals["shares"],
            win_rate=totals["redemption"] / totals["shares"],
            edge_per_share=float(summary["net"]) / totals["shares"],
            margin=float(summary["net"]) / totals["cost"], turnover=totals["cost"] / 1000,
            return_pct=float(summary["net"]) / 10)
        dates = [dict(date=d["date"], scheduled=int(d["scheduled"]), filled=int(d["filled"]),
                      shares=float(d["shares"]), cost=float(d["cost"]), net=float(d["net"]))
                 for d in frozen("voting_dates.csv") if d["scenario"] == scenario]
        position_rows, tables = position_tables(positions, by_key)
        orders = sum(p["orders"] for p in positions)
        capital = dict(
            orders=orders, fills=len(fills),
            requested_shares=float(sum((p["requested_order_shares"] for p in positions), D(0))),
            funded_shares=float(sum((p["funded_order_shares"] for p in positions), D(0))),
            constrained_batches=summary["constrained_batches"], rejected_requests=summary["rejected_requests"],
            maximum_live_orders=summary["maximum_live_orders"],
            minimum_free_cash=float(summary["minimum_free_cash"]),
            maximum_order_cash=float(summary["maximum_order_cash"]))
        entry = dict(identity=identity, capital=capital, dates=dates, positions=tables,
                     fills=fill_breakdown(fills, by_key, opening),
                     risk=risk(position_rows, dates, summary, totals["fees"] + totals["friction"], scenario),
                     equity=equity_curve(fills, positions, by_key))
        if scenario == "normal":
            out["universe"] = universe(selected, positions)
            out["lockup"] = lockup(selected, positions)
        out["scenarios"][scenario] = entry
    out["accounts"] = [dict(period=r["period"], scenario=r["scenario"], net=float(r["net"]),
                            return_pct=float(r["return_pct"]), filled=int(r["filled"]),
                            elections=int(r["elections"])) for r in frozen("accounts.csv")]
    out["start_days"] = [dict(days=int(r["days_before_vote"]), scenario=r["scenario"], net=float(r["net"]),
                              filled=int(r["filled"])) for r in frozen("start_days.csv")]
    return tidy(out)


def main():
    cli = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    source = cli.add_mutually_exclusive_group(required=True)
    source.add_argument("--tapes", type=Path, help="directory of verified tapes named <sha256>.json")
    source.add_argument("--archives", type=Path, help="directory holding the 15 source archives")
    source.add_argument("--kalshi", action="store_true", help="request the frozen records from the public API")
    cli.add_argument("--save-tapes", type=Path, help="write the verified tapes here for later runs")
    cli.add_argument("--out", type=Path, default=OUT)
    cli.add_argument("--check", action="store_true", help="compare with the committed file instead of writing")
    args = cli.parse_args()
    print("Loading and checking market tapes…", flush=True)
    rows = cached_population(args.tapes) if args.tapes else population(args.archives)
    if args.save_tapes:
        save_tapes(rows, args.save_tapes)
    text = json.dumps(build(rows), indent=1, ensure_ascii=False) + "\n"
    # Keep each array of plain numbers on one line so the file stays small and diffs stay readable.
    text = re.sub(r"\[\s+((?:-?[\d.e+-]+,\s+)*-?[\d.e+-]+)\s+\]",
                  lambda m: "[" + re.sub(r"\s+", " ", m.group(1)) + "]", text)
    if args.check:
        if args.out.read_text() != text:
            raise SystemExit("Exhibits differ from the committed file")
        print("Exhibits match the committed file.")
        return
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text)
    print("Wrote", args.out)


if __name__ == "__main__":
    main()
