# Buying the opening favourite

[Slides (PDF)](us-election-opening-favorite.pdf) · [Editable PowerPoint](us-election-opening-favorite.pptx)

This repository reproduces the presentation’s main strategy: buy the market-favoured YES or NO side as soon as the strategy starts, build the position in orders of up to 10 shares, and hold until settlement. The code implements only this strategy, with normal and stressed execution. The presentation retains its appendix comparisons, but their strategy implementations are outside this repository.

## Results

| Period | Normal net profit | Normal return | Stressed net profit | Stressed return |
| --- | ---: | ---: | ---: | ---: |
| 2024 only | $165.11 | 16.51% | $148.55 | 14.86% |
| 2025 only | $36.20 | 3.62% | $28.51 | 2.85% |
| 2026 only | $72.52 | 7.25% | $40.17 | 4.02% |
| 2024–2026 continuous | $301.55 | 30.16% | $229.94 | 22.99% |

Each annual run starts with a fresh $1,000. The continuous run starts with $1,000 once and carries settled proceeds forward. Annual profits therefore do not add to the continuous result. Returns are cumulative, not annualized. Results include modeled exchange fees and execution costs and stop at November 20, 2026, 00:00 UTC. Unsettled holdings contribute no received payout at the cutoff.

The continuous run considers 1,780 scheduled opportunities on 52 voting dates, including 530 listed contracts. It actually buys shares in 285 markets under normal assumptions and 279 under stressed assumptions.

## Check the saved results

Use Python 3.10 or later. The report, simulator and tests use only the standard library. From the repository root:

```sh
python -m electionlab.report
python -m unittest discover -s tests -v
```

The report reconciles cash, acquisition costs and redemptions, checks every full-period position against its voting-date total, and prints the annual and start-day results. It reads the committed CSVs and does not rerun market events. The tests cover partial fills, order expiry, simultaneous cash allocation, the 100-share cap, fixed side selection, and the absence of a discount condition. They also check that the presentation's numbers agree with the frozen tables.

## The presentation

The web presentation lives in [artifacts/opening-favourite](artifacts/opening-favourite). It keeps the nine chapters of the slide deck with their wording unchanged, and adds eight chapters that set out the math: why the favourite, the value of one share, the account identity, how one account is shared between markets, where the profit came from, what correlation does to the evidence, how sure we can be, and the limits.

```sh
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/opening-favourite run dev
```

Arrows or Space move between chapters. `G` lists all chapters, `N` shows presenter notes, `M` switches between the full deck and the original nine chapters, `P` presents on a timer, `F` is full screen and `?` lists the keys. Every chapter has its own address, for example `#correlation`.

## The numbers behind the math chapters

The results in the added chapters are generated, not typed in. [electionlab/exhibits.py](electionlab/exhibits.py) rebuilds them from the same verified tapes and the same simulator as the replay, and writes [exhibits.json](artifacts/opening-favourite/src/data/exhibits.json), which the presentation imports. Where a chapter states a finding in words, a test holds the data to it.

```sh
python -m electionlab.exhibits --kalshi --save-tapes local-data/tapes
python -m electionlab.exhibits --tapes local-data/tapes --check
```

The first command requests the records, checks every digest and keeps the verified tapes so later runs need no network. The second confirms the committed file. `--archives` works as it does for the replay. The output is deterministic because resampling uses a fixed seed.

| Exhibit | What is computed |
| --- | --- |
| Opening calibration | For each listed contract, the chosen side's midpoint at its first usable quote, against whether that side won. Grouped by price, with 95% Wilson intervals. |
| Per-share hurdle | The break-even win rate `p + 0.07·p·(1−p) + c`, where `c` is the scenario's extra cost per share. |
| Account identity | `net = shares × (share-weighted win rate − average all-in cost)` and `return = (net ÷ cost) × (cost ÷ 1,000)`. |
| Profit split | Every simulated fill, grouped by UTC day relative to its voting date, by price, and by whether its price was below the chosen side's opening midpoint. Each split sums to the account's net profit. |
| Same-night correlation | The intraclass correlation of standardized surprises `(W − p) ÷ √(p(1−p))` within a voting date, from a one-way analysis of variance for groups of unequal size, compared with 4,000 shuffles of the dates. |
| Risk model | Each position is one bet of `h` shares at average price `p`. `Var = Σ σᵢ² + ρ · Σ over nights Σ over pairs σᵢσⱼ`, with `σᵢ = hᵢ·√(pᵢ(1−pᵢ))`. A fair market expects a loss equal to fees and extra costs. |
| Resampled dates | 20,000 bootstrap accounts that draw the 52 voting dates whole, with replacement. |

Under normal execution, opening favourites were priced at 85.8% on average and won 89.5% of the time across 514 settled contracts. The account kept 3.43¢ on an average share costing 77.98¢, and spent its $1,000 6.86 times over. Shares bought below the opening midpoint made $413.80 and shares bought at or above it lost $112.25. The estimated same-night correlation of surprises is 0.02, while shuffled dates give estimates from −0.06 to 0.10, so it cannot be told apart from zero. The profit sits 1.18 standard deviations above a fair market at zero correlation and 1.01 at the estimate, and 86% of resampled accounts end above zero. This is evidence of an edge, not proof of one.

## Rerun the strategy from market events

The full replay needs the underlying historical quotes and trades. Raw exchange tapes are not bundled in this repository. The fixed input roster and the expected SHA-256 of every normalized tape are included in [data/us-calendar.json](data/us-calendar.json).

If you have the 15 source ZIP archives referenced by that roster, point `--archives` at the directory containing their subdirectories:

```sh
python -m electionlab.replay --archives /path/to/source-archives --verify
```

For example, the directory must contain `directional_consensus/native_tapes.zip` and the other archive paths in the roster. These names are input locations inherited from data collection; the replay reads only the pinned market tapes. It does not import other strategy code. ZIP members are read in place and checked against their hashes.

Alternatively, request the historical records from Kalshi’s public endpoints:

```sh
python -m electionlab.replay --kalshi --verify
```

This uses no API key. It can make many requests. Exact reproduction depends on Kalshi continuing to serve the same historical records. A missing record, API error or tape-hash mismatch stops the replay instead of silently changing its inputs. The full archived-data replay was verified for this release. The public-record path was checked on 27 November 2026: all 530 tapes rebuilt from Kalshi's public endpoints matched their digests, and all 14 runs replayed from those tapes matched the frozen tables.

Both commands generate `replay-output/` and compare it with the committed results. The default suite runs the continuous account, each year independently, and each start from three days before voting through voting day, under both execution settings. These are 14 distinct runs; the full-period D−3 run also supplies the D−3 sensitivity point.

To run a subset:

```sh
python -m electionlab.replay --archives /path/to/source-archives --suite full --verify
python -m electionlab.replay --archives /path/to/source-archives --suite annual --verify
python -m electionlab.replay --archives /path/to/source-archives --suite start-days --verify
```

Use `--out /path/to/output` to select another output directory. The CLI prevents overwriting the frozen `results/` directory.

## The exact buying rule

1. Read the fixed election roster. It covers presidential results by state, congressional races, governor and attorney general elections, mayoral and other state or local contests, primaries, runoffs, and ballot measures. Each entry identifies one contract and its voting date. Unlisted opportunities remain in the calendar with no trades. This is a frozen research population, not an algorithm that discovers new markets from the whole exchange.
2. Start each contract at 00:00 UTC three days before its own voting date. The first usable minute-end YES bid and ask must satisfy `0 < bid < ask < 1`. Their midpoint defines the market-implied YES probability. Select YES above 50%, NO below 50%, and permanently skip an exact tie. Keep this side fixed. “Opening” means this strategy’s first usable quote, not the date the exchange originally listed the market.
3. At each usable quote, if there is no live order and fewer than 100 shares have been bought, request up to 10 more shares of the chosen side at its current ask. Round down to the contract’s lot size. There is no requirement for the price to fall.
4. Reserve enough cash for the full order and its modeled costs. All markets share one $1,000 starting account. If simultaneous requests exceed available cash, multiply each requested quantity by the same affordable fraction, then round down to native lots. Funds already reserved for pending orders are unavailable. Fills or settlements at that same timestamp cannot fund these requests.
5. A later eligible trade can partially fill the order. It must meet the execution delay, trade-direction and price tests. Its chosen-side price must lie between the latest usable ask and the submitted limit, and the quote must be at most 30 seconds old. Credit no more than the allowed fraction of that trade, rounded down to the native lot, or the remaining order quantity. Charge the dated exchange fee plus the scenario’s extra cost.
6. Expire the remainder after 30 seconds or earlier market/window closure. Once an order fills or expires, the next usable quote can trigger another order. There is no scheduled decision to buy on the dates shown in the illustrative holdings timeline.
7. Stop buying at the earlier of native close and 00:00 UTC two days after voting. Hold all purchased shares until settlement. Winning shares pay $1 each and losing shares pay $0. Settled cash can fund subsequent elections. There are no early sales.

| Execution | Delay | Maximum fraction of an eligible trade | Extra cost per filled share |
| --- | ---: | ---: | ---: |
| Normal | 2 seconds | 2.5% | 0.1¢ |
| Stressed | 5 seconds | 1% | 1.1¢ |

Historical exchange fees apply in addition to these extra costs. A fill in this model is a hypothetical allocation from a recorded trade, not proof that our order would have received that execution.

## What each file reproduces

- [results/accounts.csv](results/accounts.csv): the continuous account and three independent annual accounts, in both scenarios, at full precision.
- [results/start_days.csv](results/start_days.csv): the four start-day graph points in both scenarios. Both the first observation and buying start move. The original buying end stays fixed. These input tapes support only D−3, D−2, D−1 and D0.
- [results/voting_dates.csv](results/voting_dates.csv): the continuous account’s profit and costs for every voting date.
- [results/positions.csv](results/positions.csv): every scheduled opportunity’s chosen side, shares, orders, costs and settlement proceeds in the continuous run. Includes opportunities with no purchases.
- [electionlab/demand_funding.py](electionlab/demand_funding.py): shared cash, order submission, partial fills, expiry and settlement.
- [electionlab/replay.py](electionlab/replay.py): annual filtering, start-day changes and comparison to frozen output.
- [electionlab/inputs.py](electionlab/inputs.py) and [electionlab/kalshi.py](electionlab/kalshi.py): pinned archive loading and public-record normalization.
- [electionlab/exhibits.py](electionlab/exhibits.py): calibration, profit splits, correlation and resampling behind the presentation's math chapters.
- [artifacts/opening-favourite](artifacts/opening-favourite): the web presentation. Its order replay in `src/lib/simulation.ts` is a fictional teaching example and is never used for a result.
- [data/provenance.json](data/provenance.json): input-code provenance, result hashes and verification scope.

The Alice/Bob dates and the second-by-second fill example in the slides are illustrative, not historical positions. The numerical account and start-day results come from the replay.

## Validation and limits

All 14 runs reproduced the presentation’s figures using the archived market events. The annual and full-period results were compared with the independent frozen reference tables. All 104 full-period scenario/date profit totals matched that reference. The fixed roster and each normalized market tape pass their SHA-256 checks before simulation.

The universe and parameter choices developed retrospectively. This replay establishes what the fixed rules produce on the fixed data; it does not establish that those choices were made before observing outcomes. Recorded trades do not reveal our queue position or guaranteed available liquidity. The normal and stressed settings are execution assumptions, not observed live returns.
