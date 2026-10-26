// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checked, compileOutputs, openLocalProject, runtime, codegen } from './check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'rune-native-example-'));
try {
  const { snapshot } = await openLocalProject(root, { privateRoot: join(scratch, 'private') });
  checked(snapshot.project.diagnostics, 'Project configuration');
  const loaded = await runtime.loadLockedReferences(
    snapshot.lock,
    runtime.createReferenceTransport(),
    runtime.createMemoryReferenceCache(),
    new AbortController().signal
  );
  checked(loaded.diagnostics, 'Locked CDM reference closure');
  const graph = await runtime.buildEffectiveProject(snapshot, loaded.documents);
  checked(graph.diagnostics, 'Effective project');
  const selection = {
    namespaces: [],
    declarations: [{ namespace: 'example.cdm', kind: 'RosettaFunction', name: 'ReadUtcToday' }]
  };
  const generated = await codegen.generateSelected(graph.documents, selection, {
    target: 'typescript',
    strict: true,
    typescript: { layout: 'single-file' }
  });
  checked(
    generated.outputs.flatMap((output) => output.diagnostics),
    'Standalone native generation'
  );
  assert.ok(
    !generated.outputs
      .flatMap((output) => output.diagnostics)
      .some((issue) => /abstract-func|native-implementation-unavailable/.test(issue.code))
  );
  const fn = generated.outputs.flatMap((output) => output.funcs).find((fn) => fn.name === 'ReadUtcToday');
  assert.ok(fn);
  const requireGenerated = await compileOutputs(generated.outputs, join(scratch, 'generated'));
  const module = requireGenerated(join(scratch, 'generated', fn.relativePath.replace(/\.ts$/, '.js')));
  const before = new Date().toISOString().slice(0, 10);
  const value = module[fn.exportName ?? fn.name]();
  assert.equal(Object.prototype.toString.call(value), '[object Temporal.PlainDate]');
  const python = codegen.generatePythonModule(codegen.resolveExportSelection(graph.documents, selection).documents);
  checked(python.diagnostics, 'Python native generation');
  const pythonName = python.bindings.get('example.cdm.ReadUtcToday');
  assert.ok(pythonName);
  const run = spawnSync(
    process.env.PYTHON_BINARY ?? 'python3',
    ['-c', python.code + `\nimport json\nprint(json.dumps(${pythonName}()))\n`],
    { encoding: 'utf8' }
  );
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  const pythonValue = JSON.parse(run.stdout);
  const after = new Date().toISOString().slice(0, 10);
  assert.ok([before, after].includes(value.toString()));
  assert.ok([before, after].includes(pythonValue));
  console.log(
    'PASS Today: locked CDM declaration, strict standalone TypeScript, standalone Python, UTC current date; no installed provider.'
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
