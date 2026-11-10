# Bundled native code implementation

`model/current-date.rosetta` calls the original CDM
`cdm.base.datetime.Today`, which is marked `[codeImplementation]`.
The locked CDM bundle supplies handwritten TypeScript and Python implementations
for this declaration. The toolchain consumes those selected target bindings
when it emits each module.

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

The separate host workspace binds `Today` to an injectable clock and returns the
same Temporal date type. [Host provider example](host/README.md)
