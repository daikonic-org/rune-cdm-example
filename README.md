# Rune CDM example

A Rune workspace generated from the [rune-starter template](https://github.com/daikonic-org/rune-starter),
with a pinned CDM release and an **Increase cash** workflow using the upstream
CDM `UpdateAmount` function. Start with the [CDM walkthrough](README.cdm.md).
The inherited **Double quote** workflow remains available without a reference download.

## Start in Rune Studio

1. Fork this repository to keep your own writable copy, or clone it locally.
2. Open [Rune Studio](https://www.daikonic.dev/rune-studio/studio/) and open your
   GitHub repository from **Workspaces**. You can also clone it and open the folder.
3. In **Prototype**, choose **Double quote** from **Saved workflow**, then **Execute**.

The saved input is `{ "amount": 10, "currency": "USD" }`; the result is
`{ "amount": 20, "currency": "USD" }`. The Amount control formats USD for display;
formatting does not change the stored number. Use **Save as example…** to retain
another result. Execution alone does not create a saved example.

Ordinary Save updates working-copy files. Commit and push are separate actions
and require a repository you can write to. Template copies are independent
repositories; later template changes are not pulled automatically.

## Workspace files

| Path | Purpose |
| --- | --- |
| `rune-config.yml` | Upstream-compatible model name, version, and serialization defaults. |
| `build-config.yml` | Named native TypeScript and JSON Schema targets; no default target. |
| `studio-config.yml` | Portable example, workflow, and layout directories. |
| `model/` | Editable Rune declarations and implementations. |
| `examples/` | Typed example descriptors and JSON inputs. |
| `workflows/` | Saved function selection and input bindings. |
| `layouts/` | Shared form layout and control formatting. |
| `fixtures/expected/` | Intentional checked output fixtures. |
| `.rune-toolchain.json` | Exact source revision and runtime versions used by CI. |

Generated code, ordinary exports, installed dependencies, and private Studio
state are ignored by Git. Credentials and personal panel state do not belong in
the repository. This repository was generated from `daikonic-org/rune-starter`; its shared checker
and CI are inherited without modification. See the [CDM guide](README.cdm.md)
for the additional reference configuration, lockfile, inputs, and workflow.

## Check locally

The current toolchain is built from source rather than relying on unpublished
npm packages. Install the Node and pnpm versions in `.rune-toolchain.json`, clone
[`rune-langium`](https://github.com/daikonic-org/rune-langium) into a sibling
directory, and check out the exact commit recorded in that file. Then:

```sh
cd ../rune-langium
pnpm install --frozen-lockfile
pnpm --filter '@rune-langium/cli...' run build
cd ../rune-cdm-example
RUNE_TOOLCHAIN=../rune-langium node scripts/check.mjs
```

The checker uses the shared project runtime to build every named target, reads
portable records through the canonical schemas, strictly compiles the generated
TypeScript, validates workflow inputs with the generated schema, and compares
execution results with the expected fixture. It supports the saved-example and
literal bindings used by these sample workflows. GitHub Actions runs the same
checker against the pinned toolchain.

To build an individual target from the toolchain checkout:

```sh
node packages/cli/dist/index.js build --project ../rune-cdm-example --target typescript
node packages/cli/dist/index.js build --project ../rune-cdm-example --target schema
```

This example demonstrates local Rune execution, not financial scheduling or
calendar behavior. Original workspace content is MIT licensed; Rune Studio is
source-available under its own license.
