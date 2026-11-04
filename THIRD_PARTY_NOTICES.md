# Reference model provenance and notices

The local source and synthetic inputs in this repository are original example
material. No upstream Rune model files or serialized reference artifacts are
vendored. The workspace resolves the exact released reference models below from
its checked lockfile. Generated code and fetched caches are not repository files.

- **FINOS Common Domain Model 7.8.0**, commit
  `5b852ed61573467c8f8e6bb5cc02779a70df032d`, maintained by the FINOS Common
  Domain Model Working Group. Source:
  https://github.com/finos/common-domain-model/tree/7.8.0
  The complete upstream [LICENSE.md](https://github.com/finos/common-domain-model/blob/7.8.0/LICENSE.md)
  is retained without modification as [LICENSE-CDM.md](LICENSE-CDM.md).
  Its SHA-256 is `edbf99eb78c11a79ec3f4f669746877cbc9182e8c13699adff4369717c96de21`.
- **Rune FpML 3.8.0**, commit
  `ab92e75df45e882e6775a5ce94dc6f520fe446f6`. Source and notices:
  https://github.com/rosetta-models/rune-fpml/tree/3.8.0
- **Rune DSL 10.15.1**, commit
  `4fa22a75f957940ee2c70a6ead5d53597dbd97a1`. Source and notices:
  https://github.com/finos/rune-dsl/tree/10.15.1

Importing or generating from these models does not relicense them under this
repository's MIT license. Preserve their applicable source headers, licenses,
notices, and provenance when redistributing model material or generated output.

## Currency code-list resource

`resources/currency.json` is an unmodified copy of
[`data/en/currency.json`](https://github.com/umpirsky/currency-list/blob/4ab0b8244b44aa41fc859809e90d6e9fe00ae59e/data/en/currency.json)
from `umpirsky/currency-list`, commit `4ab0b8244b44aa41fc859809e90d6e9fe00ae59e`.
Its MIT license is retained in `resources/LICENSE-currency-list`.
Payload SHA-256: `7d97c00a7f423b1758ff4022e4fabf6d2817600146a5b507bb062606149e4dbf`.
The list includes historical currencies; it is not a claim of current legal tender.
