# Product calculations in Prototype

In **Prototype**, choose one of these **Saved workflows**, then **Execute**.
Each workflow takes a CDM `Product` object. Its Rune function extracts the
interest-rate payouts and their contractual dates, notionals, rates and day counts.
The calculation context supplies the as-of date and saved observations.

| Saved workflow | Saved product | Output |
| --- | --- | --- |
| **Generate product reset and fixing dates** | Amortising USD product | Accrual boundaries, reset dates, fixing dates, payment dates and index identity |
| **Calculate amortising principal and interest** | Same product | Opening notional, fixed interest, explicit principal repayment, closing notional and total payment |
| **Accrue product interest as of 20 February** | Same product | Completed and partial-period interest, with ACT/360, ACT/365 Fixed and 30E/360 comparisons |
| **Compound one week of illustrative SOFR** | One-week USD product | Observation dates, daily rates, weekend weights, growth factors, raw/applied rates and coupon |
| **Compound one week of illustrative SONIA** | One-week GBP product | The same calculation using the supplied SONIA series and ACT/365 Fixed |
| **Cross-check SOFR daily and index compounding** | One-week USD product | Supplied start/end index levels, implied raw rate, daily raw rate and their difference |
| **Cross-check SONIA daily and index compounding** | One-week GBP product | The same cross-check using the supplied SONIA levels |
| **Calculate fixed and floating product cashflows** | Amortising USD product | Both coupon schedules, per-leg totals and a signed comparison in one currency |

## Edit terms or observations

The amortising product starts on January 7, 2025 and ends on April 7, 2025.
Its monthly notionals are USD 1,000,000, USD 800,000 and USD 600,000; its fixed
rate is 4.5% with ACT/360. The three fixed coupons are USD 3,875, USD 2,800 and
USD 2,325. The February 20 accrued-interest result is USD 5,175, including the
completed first period. It is an earned-interest calculation, not a balance
of unpaid interest.

The context explicitly instructs principal repayments of USD 200,000,
USD 200,000 and USD 600,000. These are a repayment-schedule demonstration
alongside the product's notional schedule; they do not assert that the source
interest-rate swap exchanges principal. The repayment workflow verifies the
instructions against each closing notional. Omitting a repayment does not
silently turn a notional reduction into a cash payment.

Change a product term or a saved observation in the input form and execute
again. The input still contains the complete typed product and context; the
workflows do not ask for duplicate scalar versions of those terms. Execution
does not save edited inputs automatically. Use Studio's save-example controls
to retain a new scenario.

## Illustrative rates, not market data

[`examples/illustrative-market.json`](examples/illustrative-market.json) stores
`illustrative-sofr-sonia-2025-v1`. Every value is synthetic. Neither the rates
nor the dimensionless index levels are official, historical, live or forecast
market data. They are not downloaded from the Federal Reserve or Bank of England.
The context includes observations through April even though the separate
accrual example uses a February as-of date: the floating outputs are complete
illustrative scenarios, not statements about rates known on that as-of date.

Rates are annual decimals: `0.043` means 4.3%. The SOFR series begins at 4.3%
and SONIA at 4.6%; successive stored weekdays add 0.001 percentage points in a
seven-observation cycle. Index levels start at 100 and compound those same
observations. The USD example explicitly uses the pinned **USNY** calendar;
the GBP example uses **GBLO**. These are example contract choices, not a claim
to reproduce every official publication-calendar convention. The index-level
fixtures use those same calendars, including the January 20 and February 17
USNY holidays in the sample window.

An exact CDM index identity selects a series. A missing series or fixing,
duplicate series or fixing, or missing index endpoint fails a named condition.
There is no current-rate, zero-rate or nearest-date fallback. The overnight
results include every date/rate/weight used, plus the snapshot id and
`illustrative: true`. Extra observations outside the requested window are unused.

The one-week examples accrue January 6 through January 13, excluding the end
date. Friday's observation has weight 3. The index calculation uses the same
seven-day window and `ApplyCompoundedIndexFormula`; it does not copy the
different inclusive-end convention of CDM's separate compounded-index reset
dispatch. Raw rates should agree to floating-point precision. CDM's final
rate rounding applies before calculating payable coupon amounts; this can make
the applied rate differ from the raw compounded rate.

## Shared calculation path and limits

[`model/product-calculations.rosetta`](model/product-calculations.rosetta)
orchestrates the installed CDM implementations: `CalculationPeriods`,
`DetermineResetDate`, `DetermineFixingDate`, `GetNotionalAmount`,
`FixedAmountCalculation`, `CalculateYearFraction`,
`GenerateObservationDatesAndWeights`, `ProcessObservations`,
`ApplyCompoundingFormula`, `ApplyCompoundedIndexFormula` and
`ApplyFloatingRateSetting`. No Java or live provider is needed to execute them.

The product input is CDM's `Product` choice. Non-transferable products and
transferable-product assets must contain applicable interest-rate economics.
This is not a cashflow calculator for an arbitrary asset without contract terms.
The Prototype runner selects one orchestration function per workflow; the
multiple stages are Rune calls within that function.

These examples support regular schedules, one payment per calculation period,
period-end payments with calendar adjustment, and notionals that step only at
period boundaries in increasing date order. `CalculationPeriods` preserves
unadjusted interior boundaries; the saved scenarios use business-day interiors.
Stubs, payment lags, combined
payment periods, discounting and additional payout kinds are rejected. The
overnight route requires modular compounding parameters and no initial/fallback
rate. The index cross-check requires an unshifted window without observation
caps/floors; it compares supplied levels rather than manufacturing them at runtime.
The coupon summary requires one fixed and one floating leg in the same currency
with opposing payer/receiver directions. Its difference is not a legal netting
or settlement instruction, and excludes the separate principal demonstration.

[`model/floating-processing-implementation.rosetta`](model/floating-processing-implementation.rosetta)
is an ordinary local Rune override. It guards optional schedule lookups before
calling the unchanged CDM spread/multiplier/cap/floor functions. The companion
[`floating-rate-treatment-implementation.rosetta`](model/floating-rate-treatment-implementation.rosetta)
preserves the pinned CDM processing body, skips the US treatment call when no
treatment is specified, and rejects specified treatments: the upstream
`ApplyUSRateTreatment` body is a passthrough stub. These guards avoid inventing
contractual terms to satisfy required arguments. The processing formula,
rounding helpers and cashflow arithmetic retain the CDM calculation path.

## Verification

Follow the [pinned toolchain setup](README.md#check-locally), then run:

```sh
RUNE_TOOLCHAIN=../rune-langium PYTHON_BINARY=python3.13 node scripts/check-product-calculations.mjs
```

This builds the saved targets, validates all portable records and workflow
inputs, strictly compiles generated TypeScript, and compares every workflow with
its checked fixture. It independently checks weekly compounding, fixed amounts,
as-of boundaries, changed observations, unchanged inputs and named failure cases.
The same scenarios run through generated Python and are compared with the
TypeScript outputs using a numeric tolerance. CI uses the same checker.
