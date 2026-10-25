// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checked, compileOutputs, openLocalProject, runtime, config, codegen } from './check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'rune-implementation-check-'));
try {
  const { snapshot } = await openLocalProject(root, { privateRoot: join(scratch, 'private') });
  const loaded = await runtime.loadLockedReferences(
    snapshot.lock,
    runtime.createReferenceTransport(),
    runtime.createMemoryReferenceCache(),
    new AbortController().signal
  );
  checked(loaded.diagnostics, 'Rune reference closure');
  async function compile(snapshot, label) {
    const graph = await runtime.buildEffectiveProject(snapshot, loaded.documents);
    checked(graph.diagnostics, 'Rune implementation graph');
    const generated = await codegen.generateSelected(
      graph.documents,
      { namespaces: ['example.cdm.implementation'], declarations: [] },
      {
        target: 'typescript',
        typescript: { layout: 'single-file' },
        strict: true,
        projectBindings: graph.implementationBindings,
        projectResources: graph.bindings
      }
    );
    checked(
      generated.outputs.flatMap((output) => output.diagnostics),
      'Rune implementation generation'
    );
    const require = await compileOutputs(generated.outputs, join(scratch, label));
    const fn = generated.outputs.flatMap((output) => output.funcs).find((fn) => fn.name === 'TrimLastDate');
    assert.ok(fn);
    return require(join(scratch, label, fn.relativePath.replace(/\.ts$/, '.js')))[fn.exportName ?? fn.name];
  }
  const trim = await compile(snapshot, 'with-override');
  const a = '2026-01-15',
    b = '2026-02-15',
    c = '2026-03-15';
  for (const dates of [[], [a], [a, b], [a, a], [a, b, b], [a, a, a], [c, a, b]]) {
    const input = { dates: [...dates] };
    assert.deepEqual(JSON.parse(JSON.stringify(trim(input))), { dates: dates.slice(0, -1) });
    assert.deepEqual(input, { dates });
  }
  assert.deepEqual(trim({}), { dates: [] });
  assert.deepEqual(trim({ dates: null }), { dates: [] });
  const overrides = snapshot.project.build.overrides.filter(
    (mapping) =>
      !(
        mapping.kind === 'declaration' &&
        mapping.source.model === 'cdm' &&
        mapping.source.namespace === 'cdm.base.datetime' &&
        mapping.source.name === 'PopOffDateList'
      )
  );
  const removed = await config.createProjectDraftSnapshot(
    snapshot,
    new Map([['build-config.yml', JSON.stringify({ ...snapshot.project.build, overrides })]]),
    runtime.validateProjectTarget
  );
  const unavailable = await compile(removed, 'without-override');
  assert.throws(() => unavailable({ dates: [a, b, b] }), /implemented|implementation|unavailable/i);
  console.log(
    'PASS PopOffDateList: order, duplicates, empty/singleton/absent/null lists, unchanged input and removed-override checks.'
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
