# Run an editable CDM implementation

The CDM bundle supplies Rune source for `cdm.base.datetime.PopOffDateList`.
The workspace installs it as `model/implementations/cdm/date-list.rosetta`,
where it is editable like other workspace overrides. The `override namespace`
declaration preserves the original CDM function's name and signature.
`model/date-list-implementation.rosetta` calls that original symbol.

Open **Prototype**, select **Remove final date with CDM Rune**, and choose
**Execute**. The saved dates deliberately repeat the final element.

```json
{ "dates": ["2026-01-15", "2026-02-15", "2026-02-15"] }
```

The result keeps the first two dates in order.

```json
{ "dates": ["2026-01-15", "2026-02-15"] }
```

Empty and single-element lists return an empty list. The checker verifies
duplicates, ordering, unchanged inputs, and behavior after removing the
override from a draft snapshot. [CDM's handwritten Java reference](https://github.com/finos/common-domain-model/blob/0f1f99aef829c23910476981bb91256544cb8569/rosetta-source/src/main/java/cdm/base/datetime/functions/PopOffDateListImpl.java)

```sh
RUNE_TOOLCHAIN=../rune-langium node scripts/check-rune-implementation.mjs
```

For an example of an explicit mapping to a differently named local function,
see the [earlier workspace walkthrough](https://github.com/daikonic-org/rune-cdm-example/blob/66d27772cb0c281f0055e695a5de537ffe973fc3/README.rune-implementation.md).
