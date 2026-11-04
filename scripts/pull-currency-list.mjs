// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Pradeep Mouli
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

assert.ok(process.env.RUNE_TOOLCHAIN, 'Set RUNE_TOOLCHAIN to a built rune-langium checkout.');
const toolchain = resolve(process.env.RUNE_TOOLCHAIN);
const load = (path) => import(pathToFileURL(resolve(toolchain, path)).href);
const { BuildConfigSchema, PortableProjectPathSchema } = await load('packages/project-config/dist/index.js');
const { readReferenceCodeList } = await load('packages/project-runtime/dist/index.js');
const { parse } = createRequire(resolve(toolchain, 'packages/project-config/package.json'))('yaml');
const root = new URL('../', import.meta.url);
const build = BuildConfigSchema.parse(parse(await readFile(new URL('build-config.yml', root), 'utf8')));
const resource = build.overrides?.find(
  (entry) => entry.kind === 'resource' && entry.source.id === 'example.starter.CurrencyCode#RosettaTypeAlias'
);
assert.ok(
  resource?.kind === 'resource' && resource.provenance && resource.codeList,
  'Configure the currency resource and its exact origin.'
);
const staged = await readReferenceCodeList(resource.provenance, new AbortController().signal, resource.codeList);
assert.ok(staged.values.length, 'Do not replace the resource with an empty list.');
await writeFile(resolve(fileURLToPath(root), PortableProjectPathSchema.parse(resource.path)), staged.content);
console.log(`Pulled ${staged.values.length} currency codes at ${staged.provenance.commit}.`);
