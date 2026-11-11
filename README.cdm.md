# CDM example workflows

Open the **CDM example** workspace in Rune Studio, let the pinned reference
models load, then choose a **Saved workflow** in **Prototype** and select **Execute**.
Each workflow loads its saved inputs and displays the result.

The [product calculation walkthrough](README.calculations.md) adds reset/fixing
dates, explicit repayments, as-of accruals, overnight/index compounding and
fixed/floating coupon summaries. Its saved SOFR and SONIA series are clearly
labelled synthetic example data and can be edited in the typed context.

## One swap, three workflows

| Saved workflow | Input | CDM functions | Result |
| --- | --- | --- | --- |
| **Check the vanilla swap** | Original FpML vanilla-swap `TradeState` | `Qualify_InterestRate_IRSwap_FixedFloat` | `true` after structural input validation |
| **Generate the fixed-leg accrual schedule** | Fixed-leg `CalculationPeriodDates` from the same trade | `CalculationPeriods` | Five annual accrual periods from November 6, 2018 to November 6, 2023 |
| **Calculate fixed-leg coupons** | Fixed `InterestRatePayout` from the same trade | `CalculationPeriods`, `FixedAmountCalculation`, and `ResolveAdjustableDate` | Five SEK 60,800 coupon amounts with payment dates |

The first workflow validates the typed input and checks its CDM product
classification. The second uses the accrual schedule implementation delivered in
the pinned CDM bundle. The third applies the saved SEK 10 million notional,
0.608% fixed rate, and 30/360 convention to each period. Its Rune precondition
limits it to one fixed coupon per accrual period, paid at period end without
a lag, custom payment schedule, or business centers.

The accrual periods keep the sample's unadjusted interior boundaries.
For payments the sample specifies Modified Following with no business centers,
so the curated weekend adjustment moves the November 2021 and 2022 payments
to November 8 and November 7 respectively. The result models the fixed leg only.

The original trade payload is preserved byte for byte in
`examples/vanilla-swap.json`. The two smaller input examples reuse its fixed-leg
data, with the existing quantity and price values inlined for the standalone
payout. See the [source fixture and transformation notes](THIRD_PARTY_NOTICES.md).

## Cash amount and implementation examples

**Increase cash** calls the upstream `cdm.base.math.UpdateAmount`. With the
saved cash value of 1,000, USD currency, and a change of 250, it returns a CDM
`Money` value of USD 1,250. The input accepts a single supplied value.

**Remove final date with CDM Rune** uses an editable override installed from the
curated bundle. The separate host workspace demonstrates injecting a clock
provider. [Rune override walkthrough](README.rune-implementation.md) · [TypeScript host example](host/README.md)

## Reference releases

| Model | Release | Upstream commit |
| --- | --- | --- |
| FINOS Common Domain Model | 7.9.0 | `0f1f99aef829c23910476981bb91256544cb8569` |
| Rune FpML | 3.13.0 | `ffda7dffda7cec97f9648123a1ba3cb8aad4e568` |
| Rune DSL | 10.15.3 | `c0251abb7ed07b1f2d2fe248f0b7f3aa9df7c5f6` |

The lockfile pins the released models and their curated artifacts. The
TypeScript and JSON Schema targets start at the example namespaces and include
their dependencies. TypeScript uses one module per namespace to accommodate
the swap's dependency closure. The local checker builds both targets and
compares each saved workflow with its fixture in `fixtures/expected/`.
[Local setup and checker](README.md#check-locally)
