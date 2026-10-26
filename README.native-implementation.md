# Bundled native code implementation

`model/current-date.rosetta` calls the original CDM
`cdm.base.datetime.Today`, which is marked `[codeImplementation]`.
Rune-langium's generator supplies handwritten implementations for TypeScript and
Python from its shared `packages/codegen/src/implementations/` catalog. Each entry
checks the qualified declaration, standard annotation, signature and target.

Today means the **UTC calendar date**. Standalone TypeScript returns
`Temporal.PlainDate` using the generated runtime's Temporal polyfill; standalone
Python returns the backend's ISO date string using Python's standard library.
Neither needs Java, OpenGamma, a registered provider, or loading code from this
repository. The generated wrapper still checks function conditions/cardinality.

From the repository root, after the toolchain build described in [README](README.md):

```sh
RUNE_TOOLCHAIN=../rune-langium PYTHON_BINARY=python3.13 node scripts/check-native-implementation.mjs
```

The checker loads the locked CDM release, selects the caller's dependency closure,
strictly compiles and executes standalone TypeScript, and executes the generated
Python module. It checks the current UTC date in both outputs without registering
any callback. Deterministic UTC-midnight, leap-day, signature and override tests
live with the implementations in rune-langium.

Workspace declaration replacements remain available, as shown by the
[pure Rune example](README.rune-implementation.md). The separate
[host example](host/README.md) explicitly overrides the bundled TypeScript default
with an injectable clock. Its provider returns the same Temporal date type.
Unavailable target bodies produce explicit diagnostics; a body for one language
does not imply support for another.
