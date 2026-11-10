# Reference model provenance and notices

The root workspace locks these released references.

| Model | Release | Commit |
| --- | --- | --- |
| [FINOS Common Domain Model](https://github.com/finos/common-domain-model/tree/0f1f99aef829c23910476981bb91256544cb8569) | 7.9.0 | `0f1f99aef829c23910476981bb91256544cb8569` |
| [Rune FpML](https://github.com/rosetta-models/rune-fpml/tree/ffda7dffda7cec97f9648123a1ba3cb8aad4e568) | 3.13.0 | `ffda7dffda7cec97f9648123a1ba3cb8aad4e568` |
| [Rune DSL](https://github.com/finos/rune-dsl/tree/c0251abb7ed07b1f2d2fe248f0b7f3aa9df7c5f6) | 10.15.3 | `c0251abb7ed07b1f2d2fe248f0b7f3aa9df7c5f6` |

The separate `host/` workspace retains CDM 7.8.0, Rune FpML 3.8.0,
and Rune DSL 10.15.1 at the commits in its own lockfile.

## Redistributed swap data

`examples/vanilla-swap.json` is an exact copy of the FINOS CDM 7.9.0 FpML
5.13 vanilla-swap trade state. Its SHA-256 is
`b414e60b00add693c36f84522513b3afa766790ddf6351cde0c5f13fa75879df`.
The payload's `@version` header is preserved as published. The lockfile and the
example descriptors identify the pinned release. [Upstream trade fixture](https://github.com/finos/common-domain-model/blob/0f1f99aef829c23910476981bb91256544cb8569/rosetta-source/src/main/resources/ingest/output/fpml-confirmation-to-trade-state/fpml-5-13-products-interest-rate-derivatives/ird-ex01a-vanilla-swap.json)

`examples/fixed-leg-dates.json` extracts the fixed payout's calculation dates and
adds its type header. `examples/fixed-leg.json` extracts the fixed payout and
inlines the trade's `quantity-2` and `price-1` scoped references using the
matching definitions in the original trade. The standalone inputs retain the
original economics and the same CDM license.

The upstream [license](LICENSE-CDM.md) and [notice](NOTICE-CDM.md) are retained
without modification. The MIT license applies to the original workspace
source and synthetic example material. Preserve applicable upstream licenses,
notices, and provenance when redistributing model material or generated output.

## Currency code-list resource

`resources/currency.json` is an unmodified copy of the code-to-label list from
`umpirsky/currency-list` at commit `4ab0b8244b44aa41fc859809e90d6e9fe00ae59e`.
The payload SHA-256 is `7d97c00a7f423b1758ff4022e4fabf6d2817600146a5b507bb062606149e4dbf`.
The list includes historical currencies. [Upstream data](https://github.com/umpirsky/currency-list/blob/4ab0b8244b44aa41fc859809e90d6e9fe00ae59e/data/en/currency.json) · [Retained MIT license](resources/LICENSE-currency-list)
