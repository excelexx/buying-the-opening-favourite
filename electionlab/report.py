"""Validate and print the committed results without downloading market data."""
import csv
from decimal import Decimal as D
from .inputs import ROOT


def read(name):
    with (ROOT / "results" / name).open() as f:
        return list(csv.DictReader(f))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate():
    accounts = read("accounts.csv")
    positions = read("positions.csv")
    dates = read("voting_dates.csv")
    starts = read("start_days.csv")
    require(len(accounts) == 8 and len(starts) == 8, "Missing account/start-day runs")
    require({(r['period'], r['scenario']) for r in accounts} ==
            {(p, s) for p in ('2024–2026', '2024', '2025', '2026')
             for s in ('normal', 'stressed')}, 'Unexpected annual coverage')
    require({(r['days_before_vote'], r['scenario']) for r in starts} ==
            {(str(d), s) for d in range(4) for s in ('normal', 'stressed')},
            'Unexpected start-day coverage')
    for row in accounts + starts:
        require(D(row['starting_cash']) == 1000, 'Wrong starting cash')
        require(D(row['ending_cash']) - D(row['starting_cash']) == D(row['net']), 'Cash mismatch')
        require(D(row['redemption']) - D(row['cost']) == D(row['net']), 'Payout mismatch')
        require(100 * D(row['net']) / D(row['starting_cash']) == D(row['return_pct']), 'Return mismatch')
    for scenario in ('normal', 'stressed'):
        full, = [r for r in accounts if r['scenario'] == scenario and r['period'] == '2024–2026']
        baseline, = [r for r in starts if r['scenario'] == scenario and r['days_before_vote'] == '3']
        require(full == baseline, 'D−3 account differs from full-period account')
        pp = [r for r in positions if r['scenario'] == scenario]
        dd = [r for r in dates if r['scenario'] == scenario]
        require(len(pp) == 1780 and len({r['key'] for r in pp}) == 1780, 'Wrong opportunity count')
        require(len(dd) == 52 and len({r['date'] for r in dd}) == 52, 'Wrong date count')
        require(sum(D(r['shares']) > 0 for r in pp) == int(full['filled']), 'Filled count mismatch')
        for row in pp:
            require(D(row['redemption']) - D(row['cost']) == D(row['net']), 'Position mismatch')
            require(0 <= D(row['shares']) <= 100, 'Position cap exceeded')
        for field in ('net', 'cost', 'fees', 'friction', 'redemption', 'shares'):
            require(sum((D(r[field]) for r in pp), D(0)) == D(full[field]), 'Positions do not sum: '+field)
            require(sum((D(r[field]) for r in dd), D(0)) == D(full[field]), 'Dates do not sum: '+field)
            for day in dd:
                total = sum((D(r[field]) for r in pp if r['date'] == day['date']), D(0))
                require(total == D(day[field]), 'Date breakdown mismatch: '+day['date'])
    return accounts, starts


def main():
    accounts, starts = validate()
    print('Buy immediately and hold: frozen results, reconciled from committed tables')
    print('Each account starts with $1,000. Annual runs restart cash separately.\n')
    print(f"{'Period':12} {'Scenario':10} {'Net profit':>12} {'Return':>9} {'Markets bought':>15}")
    for r in accounts:
        print(f"{r['period']:12} {r['scenario']:10} ${D(r['net']):>11.2f} {D(r['return_pct']):>8.2f}% {r['filled']:>15}")
    print('\nStart-day sensitivity: observation and purchases both move')
    for r in starts:
        print(f"{r['days_before_vote']} day(s) before voting  {r['scenario']:10} ${D(r['net']):.2f}")
    print('\nThis validates saved results. Run electionlab.replay to resimulate market events.')


if __name__ == '__main__':
    main()
