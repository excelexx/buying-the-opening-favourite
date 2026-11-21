"""Replay only the immediate-favourite strategy from verified market events."""
import argparse
import csv
from collections import defaultdict
from decimal import Decimal as D
from pathlib import Path

from .demand_funding import collect, simulate
from .inputs import ROOT, population

MODES = {"normal": "base", "stressed": "stress"}


def window(cases, *, year=None, days=3):
    """Move both observation and buying starts; retain the original buying end."""
    if days not in range(4):
        raise ValueError("Frozen input tapes support only starts 0–3 days before voting")
    result = []
    for case, tape in cases:
        if year is not None and not case["date"].startswith(str(year)):
            continue
        start = case["start"] + (3 - days) * 86400
        result.append((case | {"start": start}, [e for e in tape if e.ts >= start]))
    return result


def account(cases, events, period, days, scenario):
    # No entry filter: buy the initially favoured side on every usable quote
    # when there is no live order, the cap permits it, and cash is available.
    summary, positions, fills, _ = simulate(cases, events, setting=MODES[scenario])
    totals = {name: sum((p[name] for p in positions), D(0))
              for name in ("cost", "fees", "friction", "redemption", "shares")}
    row = dict(period=period, scenario=scenario, days_before_vote=days,
               **summary, **totals, fills=len(fills),
               return_pct=100 * summary["net"] / summary["starting_cash"])
    return row, positions


def voting_dates(positions, scenario):
    groups = defaultdict(list)
    for p in positions:
        groups[p["date"]].append(p)
    return [dict(scenario=scenario, date=date, scheduled=len(rows),
                 filled=sum(r["shares"] > 0 for r in rows),
                 **{f: sum((r[f] for r in rows), D(0)) for f in
                    ("cost", "fees", "friction", "redemption", "shares", "open_units", "net")})
            for date, rows in sorted(groups.items())]


def run(cases, suite="all"):
    tables = {}
    accounts, dates, positions, starts = [], [], [], []
    if suite in ("all", "full", "annual"):
        periods = ["2024–2026"] if suite == "full" else ["2024", "2025", "2026"]
        if suite == "all":
            periods = ["2024–2026", "2024", "2025", "2026"]
        for period in periods:
            selected = window(cases, year=None if period == "2024–2026" else int(period))
            events = collect(selected)
            for scenario in MODES:
                row, detail = account(selected, events, period, 3, scenario)
                accounts.append(row)
                print(f"{period:10} {scenario:8} {row['net']:>12.5f}", flush=True)
                if period == "2024–2026":
                    dates.extend(voting_dates(detail, scenario))
                    positions.extend(dict(scenario=scenario, **r) for r in detail)
                    starts.append(row)
        tables["accounts.csv"] = accounts
        if dates:
            tables["voting_dates.csv"] = dates
            tables["positions.csv"] = positions
    if suite in ("all", "start-days"):
        for days in ([2, 1, 0] if starts else [3, 2, 1, 0]):
            selected = window(cases, days=days)
            events = collect(selected)
            for scenario in MODES:
                row, _ = account(selected, events, "2024–2026", days, scenario)
                starts.append(row)
                print(f"D−{days:<7} {scenario:8} {row['net']:>12.5f}", flush=True)
        tables["start_days.csv"] = starts
    return tables


def write_csv(path, rows):
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def verify(directory, names):
    """Compare generated CSV records exactly with the committed results."""
    for name in names:
        with (directory / name).open() as f:
            actual = list(csv.DictReader(f))
        with (ROOT / "results" / name).open() as f:
            expected = list(csv.DictReader(f))
        # Annual-only/full-only runs produce subsets of accounts.csv.
        if name == "accounts.csv":
            periods = {r["period"] for r in actual}
            expected = [r for r in expected if r["period"] in periods]
        if actual != expected:
            raise ValueError(f"Replay differs from frozen results: {name}")


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    source = cli.add_mutually_exclusive_group(required=True)
    source.add_argument("--archives", type=Path, help="directory holding the 15 source archives")
    source.add_argument("--kalshi", action="store_true", help="request the frozen records from the public API")
    cli.add_argument("--suite", choices=("all", "full", "annual", "start-days"), default="all")
    cli.add_argument("--out", type=Path, default=ROOT / "replay-output")
    cli.add_argument("--verify", action="store_true", help="compare output to committed CSVs")
    args = cli.parse_args()
    if args.out.resolve() == (ROOT / "results").resolve():
        cli.error("Use a separate output directory to preserve the frozen results")
    args.out.mkdir(parents=True, exist_ok=True)
    print("Loading and checking market tapes…", flush=True)
    cases = population(args.archives)
    tables = run(cases, args.suite)
    for name, rows in tables.items():
        write_csv(args.out / name, rows)
    if args.verify:
        verify(args.out, tables)
        print("All generated tables match the frozen results.", flush=True)


if __name__ == "__main__":
    main()
