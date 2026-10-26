// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Pradeep Mouli
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
assert.ok(process.env.RUNE_TOOLCHAIN, 'Set RUNE_TOOLCHAIN to a built rune-langium checkout; see README.md.');
const toolchain = resolve(process.env.RUNE_TOOLCHAIN);
const load = (path) => import(pathToFileURL(join(toolchain, path)).href);
const config = await load('packages/project-config/dist/index.js');
const runtime = await load('packages/project-runtime/dist/index.js');
const { openLocalProject } = await load('packages/project-runtime/dist/node.js');
const { projectTargetNamespaces } = await load('packages/project-runtime/dist/project-build.js');
const core = await load('packages/core/dist/index.js');
const codegen = await load('packages/codegen/dist/src/export.js');
const requireToolchain = createRequire(join(toolchain, 'packages/codegen/package.json'));
const ts = requireToolchain('typescript-classic');

function checked(diagnostics, context) {
  assert.deepEqual(
    diagnostics.filter((issue) => issue.severity === 'error'),
    [],
    context
  );
}

export { toolchain, config, runtime, openLocalProject, projectTargetNamespaces, core, codegen, checked };

export async function compileOutputs(outputs, compiled) {
  await mkdir(compiled);
  await symlink(join(toolchain, 'packages/codegen/node_modules'), join(compiled, 'node_modules'), 'dir');
  await writeFile(join(compiled, 'package.json'), '{"type":"commonjs"}');
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    types: [],
    paths: { '@rune-langium/project-runtime': [join(toolchain, 'packages/project-runtime/dist/index.d.ts')] }
  };
  for (const output of outputs.filter((entry) => entry.relativePath.endsWith('.ts'))) {
    const path = join(compiled, output.relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output.content);
    await writeFile(
      path.replace(/\.ts$/, '.js'),
      ts.transpileModule(output.content, { compilerOptions: { ...options, noEmit: false } }).outputText
    );
  }
  const program = ts.createProgram(
    outputs.filter((entry) => entry.relativePath.endsWith('.ts')).map((entry) => join(compiled, entry.relativePath)),
    options
  );
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((issue) => ts.flattenDiagnosticMessageText(issue.messageText, '\n')),
    [],
    'Strict generated TypeScript'
  );
  return createRequire(join(compiled, 'entry.js'));
}

export async function checkWorkspace() {
  const scratch = await mkdtemp(join(tmpdir(), 'rune-workspace-check-'));

  try {
    const { snapshot, adapter } = await openLocalProject(root, { privateRoot: join(scratch, 'private') });
    checked(snapshot.project.diagnostics, 'Project configuration');
    const signal = new AbortController().signal;
    const transport = runtime.createReferenceTransport();
    const cache = runtime.createMemoryReferenceCache();
    const references = snapshot.lock
      ? await runtime.loadLockedReferences(snapshot.lock, transport, cache, signal)
      : { documents: [], diagnostics: [] };
    checked(references.diagnostics, 'Locked reference artifacts');
    const built = await runtime.buildProject(
      snapshot,
      { targets: 'all', referenceTransport: transport, referenceCache: cache },
      adapter
    );
    assert.equal(built.status, 'success', JSON.stringify(built.diagnostics, null, 2));
    const graph = await runtime.buildEffectiveProject(snapshot, references.documents);
    const known = new Set(
      graph.documents.flatMap((doc) =>
        doc.parseResult.value.elements.flatMap((node) => {
          const identity = core.projectDeclarationIdentity(graph.services, node);
          return identity ? [core.declarationKey(identity)] : [];
        })
      )
    );
    const examples = config.readExamples(snapshot, known);
    const workflows = config.readWorkflows(snapshot, known);
    const layouts = config.readPresentations(snapshot, known);
    for (const records of [examples, workflows, layouts]) checked(records.diagnostics, 'Portable workspace records');
    assert.ok(workflows.documents.length, 'Include a saved workflow to exercise.');
    const target = Object.values(snapshot.project.build.targets).find((entry) => entry.generator === 'typescript');
    assert.ok(target, 'Include an explicit TypeScript build target.');
    const namespaces = projectTargetNamespaces(
      snapshot,
      target,
      new Set(graph.documents.map((doc) => core.namespaceFromModelName(doc.parseResult.value.name)).filter(Boolean))
    );
    const generated = await codegen.generateSelected(
      graph.documents,
      { namespaces, declarations: [] },
      {
        target: 'typescript',
        typescript: target.options,
        strict: true,
        projectBindings: graph.implementationBindings,
        projectResources: graph.bindings
      }
    );
    checked(
      generated.outputs.flatMap((output) => output.diagnostics),
      'Generated TypeScript'
    );
    const outputs = [...generated.outputs];
    const schemas = workflows.documents.map(({ value }, index) => {
      const emitted = codegen.emitStandaloneZodSchema(
        graph.documents,
        value.function.namespace + '.' + value.function.name,
        { functionInputs: true }
      );
      checked(emitted.diagnostics, 'Canonical function input schema');
      assert.ok(emitted.schemaName);
      const path = '__workflow_inputs_' + index + '.ts';
      outputs.push({ relativePath: path, content: emitted.code });
      return { path, name: emitted.schemaName };
    });
    const compiled = join(scratch, 'compiled');
    const requireCompiled = await compileOutputs(outputs, compiled);
    for (const [index, { value: workflow }] of workflows.documents.entries()) {
      const inputs = {},
        expected = new Set();
      for (const [name, binding] of Object.entries(workflow.inputs)) {
        if (binding.kind === 'literal') inputs[name] = binding.value;
        else {
          assert.equal(binding.kind, 'example', 'Sample checks support saved-example and literal inputs.');
          const example = examples.documents.find((entry) => entry.descriptor.id === binding.exampleId);
          assert.ok(example, 'Missing workflow example: ' + binding.exampleId);
          inputs[name] = example.payload;
          if (example.descriptor.expected) expected.add(example.descriptor.expected);
        }
      }
      assert.equal(expected.size, 1, 'Each sample workflow needs one expected-output fixture on its bound example.');
      const functions = generated.outputs
        .flatMap((entry) => entry.funcs)
        .filter((fn) => fn.name === workflow.function.name);
      assert.equal(functions.length, 1, 'Sample function names must be unambiguous in the selected output.');
      const fn = functions[0],
        schema = schemas[index];
      const validated = requireCompiled(join(compiled, schema.path.replace(/\.ts$/, '.js')))[schema.name].parse(inputs);
      const callable = requireCompiled(join(compiled, fn.relativePath.replace(/\.ts$/, '.js')))[
        fn.exportName ?? fn.name
      ];
      const result = callable(...fn.parameterNames.map((name) => validated[name]));
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        JSON.parse(snapshot.files.get([...expected][0])),
        workflow.name
      );
      console.log('PASS ' + workflow.name);
    }
    console.log(`Verified ${built.outputs.length} generated files and ${workflows.documents.length} workflows.`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await checkWorkspace();
