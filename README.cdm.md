# CDM cash example

This repository extends the [Rune starter template](https://github.com/daikonic-org/rune-starter).
The starter's **Double quote** workflow stays available. **Increase cash** adds a
released CDM reference, an original local Rune function, input data, expected
output, and saved form layouts.

Two further examples demonstrate real `[codeImplementation]` integration:

- [Local Rune replacement](README.rune-implementation.md): the saved
  **Remove final date with local Rune** workflow calls the original CDM
  `PopOffDateList` symbol through an explicit declaration mapping.
- [Handwritten TypeScript provider](host/README.md): a separate host workspace
  binds CDM `Today` to an explicit UTC clock provider. Its runner registers the
  provider; the browser does not load executable code from this repository.

## Run the CDM workflow

Open this repository as a workspace in [Rune Studio](https://www.daikonic.dev/rune-studio/studio/).
Allow its pinned reference models to load, then open **Prototype** and choose
**Increase cash** from **Saved workflow**. Choose **Execute**.

The workflow binds these inputs:

| Parameter | Type | Value |
| --- | --- | --- |
| cash | CDM `cdm.base.math.Schedule` | `{ "value": 1000 }` |
| currency | Rune string | `"USD"` |
| change | Rune number | `250` |

The local function `example.cdm.IncreaseCash` calls the actual upstream
`cdm.base.math.UpdateAmount` function with its `Increase` direction, then returns
CDM `cdm.observable.asset.Money`:

```json
{
  "value": 1250,
  "unit": {
    "currency": {
      "value": "USD",
      "meta": {}
    }
  }
}
```

Currency uses CDM's metadata-bearing string representation. The checked fixture
retains that representation, including the empty metadata object, in
`fixtures/expected/increased-cash.json`. Execute does not overwrite the input
example. Use **Save as example…** to retain a result.

## What the example demonstrates

- `model/cash.rosetta` is ordinary editable local Rune source.
- `build-config.yml` selects the exact CDM release and names independent
  TypeScript and JSON Schema targets. There is no default target.
- `build-config.lock.json` records verified commits, checksums, dependency
  releases, artifact cohort, and toolchain versions. Keep it in the repository.
- `examples/cash.example.json` binds JSON data to the upstream CDM type identity.
- `workflows/increase-cash.workflow.json` stores the example binding and two
  literal controls. `layouts/` stores presentation without changing Rune values.
- Build target namespace selection includes only the starter and local CDM
  wrapper; the generator follows their required CDM type/function closure.

The CDM `Schedule` type is a general value-or-dated-values container. This sample
uses only one supplied numeric value. Its `SingleCashValue` precondition rejects
a missing value or supplied dated values. It **does not generate a payment
schedule**, derive dates, perform business-day adjustment, fetch observations,
price an instrument, or promise decimal/Java implementation parity. No Java
implementation or host provider is needed for this selected Rune function.

## Pinned reference releases

| Model | Release | Upstream commit |
| --- | --- | --- |
| FINOS Common Domain Model | 7.8.0 | `5b852ed61573467c8f8e6bb5cc02779a70df032d` |
| Rune FpML | 3.8.0 | `ab92e75df45e882e6775a5ce94dc6f520fe446f6` |
| Rune DSL | 10.15.1 | `4fa22a75f957940ee2c70a6ead5d53597dbd97a1` |

CDM's published release determines its dependency releases. This example does
not consume Nightly or an upstream moving branch. Upgrading references is an
explicit reviewed workspace change, rather than an incidental build side effect.

For local/CI checking, use the shared template instructions in [README](README.md).
Its checker verifies both saved workflows against their expected fixtures. The
original example code is covered by the repository's MIT license. The reference
models retain their upstream licenses; see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)
and [the retained CDM license](LICENSE-CDM.md).
