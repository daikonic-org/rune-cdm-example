# A handwritten TypeScript provider for CDM Today

This is a separate, small workspace demonstrating a genuine host responsibility:
reading the current date. It pins the same CDM release as the main example and
needs no Java, OpenGamma, network time service, or financial calendar library.

`model/clock.rosetta` calls the original `cdm.base.datetime.Today` declaration,
which is marked `[codeImplementation]`. Its `build-config.yml` explicitly maps
that exact model/namespace/kind/name identity to the provider ID
`example.utc-clock`. The configuration contains no executable module path.

`providers/utc-clock.ts` implements the shared `ImplementationProvider` contract.
It defines **Today as the UTC calendar date**. Its clock is injectable; production
hosts can use the default real clock, while tests supply fixed instants. It
rejects invalid clocks and unexpected arguments.

## Run the example

Follow the toolchain setup in the parent [README](../README.md), then run from
the repository root:

```sh
RUNE_TOOLCHAIN=../rune-langium node host/check.mjs
```

The explicit runner strictly compiles the handwritten TypeScript, registers its
callback with the canonical project runtime, generates and strictly compiles the
Rune caller, and binds the generated module to that runtime. Tests cover leap
day, UTC midnight, an offset crossing the year boundary, expanded ISO years, invalid clock values,
wrong symbol identities, and missing provider registration. The compiler helper
is shared with the main workspace checker; there is no second Rune evaluator.

## Opening this workspace in Studio

Open this directory separately to inspect the mapping. A host that has not
installed `example.utc-clock` must report the implementation as unavailable.
Studio does not load or execute `utc-clock.ts` just because it is present in a
repository. The current browser host does not install this example provider.
The main workspace's Rune replacement works without this host example.

An installed provider is synchronous and scoped to its project runtime. A
different clock/time-zone policy requires a different explicit host decision;
this sample does not infer a trade's business date from a system clock.
