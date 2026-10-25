# Implement a CDM function in Rune

`model/date-list-implementation.rosetta` supplies an original local Rune body for
the released CDM `cdm.base.datetime.PopOffDateList` function. The upstream
declaration has `[codeImplementation]`; this example implements it in Rune
instead of installing a Java or financial-library provider.

## Try the saved workflow

Open **Prototype**, choose **Remove final date with local Rune** from **Saved
workflow**, and choose **Execute**. The supplied input deliberately repeats the
last date:

```json
{ "dates": ["2026-01-15", "2026-02-15", "2026-02-15"] }
```

The expected result is:

```json
{ "dates": ["2026-01-15", "2026-02-15"] }
```

Only the final element is removed. Earlier equal dates and their order remain
unchanged; the input is not mutated. Empty and single-element lists produce an
empty list. This matches the [CDM 7.8.0 implementation](https://github.com/finos/common-domain-model/blob/7.8.0/rosetta-source/src/main/java/cdm/base/datetime/functions/PopOffDateListImpl.java)
and its [upstream tests](https://github.com/finos/common-domain-model/blob/7.8.0/rosetta-source/src/test/java/cdm/base/datetime/functions/PopOffDateListImplTest.java).

This is list processing, not payment-date generation or calendar adjustment.

## The explicit workspace mapping

The original and replacement have the same parameter/output names, types, and
cardinalities: `dates date (0..*)` to `newList date (0..*)`. The replacement is
deliberately named `PopOffDateListRune`, so it cannot accidentally shadow the
upstream function by name.

The workspace's `build-config.yml` already contains this declaration mapping:

```yaml
overrides:
  - kind: declaration
    source:
      model: cdm
      namespace: cdm.base.datetime
      kind: RosettaFunction
      name: PopOffDateList
    replacement:
      model: local
      namespace: example.cdm.implementation
      kind: RosettaFunction
      name: PopOffDateListRune
```

Both named build targets include `example.cdm.implementation` in their
namespace selections. Other configured namespaces and override entries remain.

The saved workflow calls `TrimLastDate`, whose authored source calls the
**original** `PopOffDateList` symbol. The project resolver applies the mapping
while composing the effective model. Removing the mapping makes that call
unavailable even though the local replacement file is still present. The
curated reference source is never edited.

## How the Rune body preserves duplicate dates

Each date becomes a typed chunk containing an empty leading list and a final
date. A reduction joins two chunks by appending the left chunk's final date to
its leading dates, followed by the right chunk's leading dates. The right
chunk's final date remains separate. Returning the completed leading list
therefore removes precisely one element by position.

There is no comparison against the final date's value. A value filter would
incorrectly discard earlier duplicates. The small `DateListChunk` helper also
gives the empty leading list its declared date-list type during generation.

The repository checker strictly compiles the generated TypeScript and the
canonical function-input schema, then executes this workflow against
`fixtures/expected/date-list-prefix.json`. Additional boundary checks cover
empty, singleton, duplicate-only and unsorted lists, absent lists, unchanged
inputs, and removal of the override mapping.

Run those boundary and negative checks explicitly with:

```sh
RUNE_TOOLCHAIN=../rune-langium node scripts/check-rune-implementation.mjs
```

For comparison, Rune's `contains` operator checks collection membership;
it is not scalar substring matching. The [upstream Rune runtime](https://github.com/finos/rune-dsl/blob/10.15.1/rune-runtime/src/main/java/com/rosetta/model/lib/expression/ExpressionOperators.java)
implements it with collection containment. It therefore cannot replace CDM's
Java `StringContains` implementation merely by spelling `input contains str`.

The local Rune source is MIT licensed. Referenced CDM material retains its
upstream license and provenance described in `THIRD_PARTY_NOTICES.md`.
