# Market-data calculations in Compose and Prototype

Open this workspace in Studio. In **Compose**, select `AnalyseFloatingRateNote`
or `AnalyseSoniaFacility` to inspect their function calls and variable bindings.
Both are ordinary Rune functions marked with `rune.studio.composition`.
In **Prototype**, choose either saved workflow below and **Execute**. Editable
examples, output tables and form layouts are included in the repository.

| Saved workflow                                                    | Inputs                                                              | Results                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Value a SOFR note: bootstrap, accrual, yield and quote DV01**   | CDM security and payout, dated illustrative OIS quotes, clean price | Calibrated discount/forward curve, residuals, coupon cashflows, accrued interest, PV, clean price, settlement-relative NPV, yield and parallel quote DV01                     |
| **Accrue a SONIA facility: drawdowns, compounding and principal** | Existing FpML facility and two funded loan contracts, as-of date    | Capacity/utilization schedule, daily observations and weekend weights, benchmark and margin interest, published-index comparison and scheduled principal/interest obligations |

The note's security and payout are CDM types. The facility scenario directly uses
`fpml.consolidated.loan.FacilitySummary` and `LoanContract` from the locked FpML
3.13.0 Rune dependency. `SoniaFacility` groups those objects; it does not redefine
their schema. The pinned model flattens the XML schema's model groups into direct
attributes. Identifiers include explicit example schemes. The loan contracts
are funded drawings within one facility, consistent with
[FpML's loan model](https://cdn.fpml.org/spec/fpml-5-13-5-lcwd-1/html/confirmation/schemaDocumentation/schemas/fpml-loan-5-13_xsd/complexTypes/LoanContract.html).

## Official observations and illustrative curve quotes

[`model/benchmark-data`](model/benchmark-data) contains six official-feed
captures for **November 2–9, 2026**: SOFR, SONIA, €STR and their published
compounded indices. Each includes the exact response text, URL, retrieval time
and SHA-256 checksum. `captures.json` binds their complete snapshot identities.
The result's `benchmarkCaptureId` identifies this saved capture set.
The executable provider is materialized by the toolchain's shared decoder.
Execution performs no feed parsing and uses no default or nearest-date fixing.

The **OIS quotes are separately labeled illustrative**. They are annual decimal
par rates, not published market quotes, term benchmarks or estimates reconstructed
from past fixings. Historical overnight observations alone cannot specify a
forward curve. The quote set has an as-of date and an explicit identity.
Changing it changes the projected coupons, valuation and risk.

Captures were retrieved after their observation dates. These are reproducible
historical-observation scenarios, not a claim to reconstruct the exact data
vintage available on an earlier valuation date. Each calculation consumes only
fixings before its as-of/accrual endpoint. Source revisions remain in the captures.

## Floating-rate note

The USD 1,000,000 note runs from November 2, 2026 to November 2, 2027. It pays
quarterly compounded SOFR plus 25 bp with ACT/360 and bullet principal. Its
payment dates use the selected USGS calendar. The saved valuation is November 6,
2026 at a clean input price of 99.75 per 100.

The composition bootstraps a single discount/forecast curve from a common-grid
par OIS ladder. Every quote has fixed coupons on all preceding pillars. The
bootstrap solves `DF(n) = (1 - rate(n) * priorAnnuity) / (1 + rate(n) * accrual(n))`
and reports each quote's repricing residual. Discount factors interpolate
log-linearly on calendar time. Requests beyond the last pillar fail.
This is an explicit educational calibration convention; see the broader
[Strata curve-calibration model](https://strata.opengamma.io/curve_calibration_loader/)
for production instrument/convention choices.

Realized growth comes from the official fixings and CDM's compounding functions.
Future growth comes from discount-factor ratios. CDM applies the contractual
spread, day count, notional and final rate rounding. PV includes bullet redemption;
NPV subtracts the clean-price settlement amount plus accrued interest.
The annual effective yield reprices the projected cashflows using ACT/365 Fixed
times. It is not a vendor-specific street-convention bond yield. The bounded
solver requires positive cashflows and a root between -95% and 100%.

Quote DV01 is `(PV(quotes - 1bp) - PV(quotes + 1bp)) / 2`. Each side recalibrates
and reprojects the coupons as well as discounting. It is not discount-only risk.
The small result is consistent with a floater's forecast/discount offset.

The saved result is approximately USD **466.18 accrued**, **1,002,914.02 PV**,
**4,947.83 NPV**, **4.333279% annual effective yield** and **0.1466 quote DV01**.
These values use the explicitly supplied illustrative curve quotes.

## SONIA facility

The GBP 2,000,000 facility has drawings of GBP 1,000,000 on November 2 and
GBP 500,000 on November 4, both maturing November 9. Their contractual margins
are 1.5% and 1.75%. The facility's peak scheduled utilization is GBP 1,500,000.
Capacity, borrower/facility references, unique contract IDs, dates, currency and
supported accrual terms are checked before results are accepted.

Interest uses ACT/365 Fixed, GBLO business days, daily compounded SONIA and a
simple contractual margin. Friday contributes three days at Monday's maturity,
but one day at a Saturday as-of date. CDM generates both the observation dates
and the endpoint-bounded weights. A local `IsHoliday` override compares the same
pinned Strata day offsets directly, avoiding full-calendar date conversion on
every lookup; CDM's weekend and observation rules remain in use. No future fixing is used for a partial accrual.
Published index ratios provide an independent cross-check, following the
[Bank of England's SONIA methodology](https://www.bankofengland.co.uk/markets/sonia-benchmark/sonia-key-features-and-policies).
If an endpoint has no published index, `indexComparisonAvailable` is false;
the index is not filled. Required missing daily fixings still fail.

The two maturity-date interest amounts round through CDM to **GBP 1,031.46** and
**389.38**. Total scheduled principal and interest is **GBP 1,501,420.84**.
Scheduled balances and amounts due do not assert that a payment was executed.
Earned interest is not a ledger of unpaid interest.
This example supports one complete accrual period per drawing, constant
principal and scheduled bullet repayment. PIK/default/funding-loss spreads,
FX conversion, caps/floors, lookbacks, shifts and lockouts are rejected.

## Refresh from the colocated catalog service

The catalog and daily ingestion belong to the main `rune-langium` repository.
The example remains an ordinary project/provider consumer. Once the example-data
Worker's D1/R2 bindings and same-origin route are activated, explicitly download
a selection into a **new staging directory**:

```sh
RUNE_TOOLCHAIN=../rune-langium node scripts/market-data.mjs pull \
  --catalog https://www.daikonic.dev --output .studio/acquisitions/review
```

`CDM_EXAMPLE_DATA_ORIGIN` can supply the catalog origin. The wrapper calls the
canonical CLI selection downloader, validates its capture/date assignments,
reopens the saved snapshots and records the exact identity used in results.
The default window is the active example's window; `--start`/`--end` select
another historical window. Acquisition is allowed to download from the service;
the calculation subsequently uses the selected data.

Review the staged diff, replace the active `model/benchmark-data` directory
through normal project Save/Git, and rerun verification. Keep one selected
provider. A new date window may also require changing the dated product/scenario
terms. Existing captures and authored edits are never overwritten by `pull`.

To explicitly acquire directly from official endpoints instead:

```sh
RUNE_TOOLCHAIN=../rune-langium node scripts/market-data.mjs pull \
  --official --output .studio/acquisitions/official-review
```

Cloud service activation is separate from merging the catalog implementation;
the captured examples already execute without it. Source attribution remains
in each response/provider, including the prescribed SONIA notice. The
[catalog operations guide](https://github.com/daikonic-org/rune-langium/blob/102c8e3855994ad22ae52d0417d0d01059737372/apps/cdm-example-data-worker/README.md)
documents D1/R2 setup and the gated daily refresh.

## Verification

```sh
RUNE_TOOLCHAIN=../rune-langium node --test scripts/market-data.test.mjs
RUNE_TOOLCHAIN=../rune-langium PYTHON_BINARY=python3.13 node scripts/check-product-calculations.mjs
```

The existing checker covers all saved workflows and strict generated TypeScript.
The added cases independently reprice OIS quotes, verify discount interpolation,
coupons, settlement, yield, bumped risk, SONIA weights/margins/index precision,
partial/weekend accruals, immutable inputs and failure conditions. The same
successful and failing scenarios run through generated Python. Offline capture
checks detect altered bytes, materialized-provider drift and identity mismatch.
