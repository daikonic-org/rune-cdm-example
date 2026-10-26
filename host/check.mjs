// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checked, compileOutputs, codegen, runtime, openLocalProject } from '../scripts/check.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'rune-host-example-'));
try {
  // This trusted runner explicitly loads the provider; repository config never loads code.
  const requireProvider = await compileOutputs(
    [
      {
        relativePath: 'utc-clock.ts',
        content: await readFile(new URL('./providers/utc-clock.ts', import.meta.url), 'utf8')
      }
    ],
    join(scratch, 'provider')
  );
  const { createUtcClockProvider } = requireProvider(join(scratch, 'provider/utc-clock.js'));
  const beforeLive = new Date().toISOString().slice(0, 10);
  const liveDate = createUtcClockProvider().invoke([]).toString();
  const afterLive = new Date().toISOString().slice(0, 10);
  assert.ok(liveDate === beforeLive || liveDate === afterLive);
  let clock = new Date('2024-02-29T23:59:59.999Z'),
    calls = 0;
  const provider = createUtcClockProvider(() => {
    calls++;
    return clock;
  });
  assert.equal(
    provider.supports({ model: 'other', namespace: 'cdm.base.datetime', kind: 'RosettaFunction', name: 'Today' }),
    false
  );
  assert.equal(
    provider.supports({ model: 'cdm', namespace: 'cdm.base.datetime', kind: 'RosettaFunction', name: 'Now' }),
    false
  );
  assert.throws(() => provider.invoke([1]), /no arguments/);
  const { snapshot, adapter } = await openLocalProject(root, { privateRoot: join(scratch, 'private') });
  const signal = new AbortController().signal,
    cache = runtime.createMemoryReferenceCache(),
    transport = runtime.createReferenceTransport();
  const missing = await runtime.buildProject(
    snapshot,
    { targets: 'all', referenceCache: cache, referenceTransport: transport },
    adapter
  );
  assert.equal(missing.status, 'failed');
  assert.ok(missing.diagnostics.some((issue) => /provider|registered|unavailable/i.test(issue.message)));
  const built = await runtime.buildProject(
    snapshot,
    { targets: 'all', providers: [provider], referenceCache: cache, referenceTransport: transport },
    adapter
  );
  assert.equal(built.status, 'success', JSON.stringify(built.diagnostics));
  const loaded = await runtime.loadLockedReferences(snapshot.lock, transport, cache, signal);
  checked(loaded.diagnostics, 'Host reference closure');
  const graph = await runtime.buildEffectiveProject(snapshot, loaded.documents, [provider]);
  const generated = await codegen.generateSelected(
    graph.documents,
    { namespaces: ['example.host'], declarations: [] },
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
    'Host generation'
  );
  const fn = generated.outputs.flatMap((output) => output.funcs).find((fn) => fn.name === 'ReadToday');
  assert.ok(fn);
  const requireGenerated = await compileOutputs(generated.outputs, join(scratch, 'generated'));
  const module = requireGenerated(join(scratch, 'generated', fn.relativePath.replace(/\.ts$/, '.js')));
  const invoke = module[fn.exportName ?? fn.name];
  assert.throws(() => invoke(), /bound|implementation|runtime/i);
  codegen.bindGeneratedProjectModule(module, graph.bindings);
  assert.equal(Object.prototype.toString.call(invoke()), '[object Temporal.PlainDate]');
  assert.equal(invoke().toString(), '2024-02-29');
  clock = new Date('2024-03-01T00:00:00.000Z');
  assert.equal(invoke().toString(), '2024-03-01');
  clock = new Date('2025-01-01T00:30:00+14:00');
  assert.equal(invoke().toString(), '2024-12-31');
  clock = new Date('+010000-01-01T00:00:00.000Z');
  assert.equal(invoke().toString(), '+010000-01-01');
  clock = new Date('-000001-12-31T00:00:00.000Z');
  assert.equal(invoke().toString(), '-000001-12-31');
  const beforeInvalid = calls;
  clock = new Date('invalid');
  assert.throws(() => invoke(), /invalid instant/);
  assert.equal(calls, beforeInvalid + 1);
  console.log(
    'PASS Today: explicit provider binding, leap day, UTC midnight/year boundary, expanded ISO years, invalid clock and missing-provider checks.'
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
