// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { toolchain } from './check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = await import(pathToFileURL(join(toolchain, 'packages/project-runtime/dist/market-data.js')));

function identitySource(captureSetId) {
  return `// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Daikonic contributors\nnamespace example.cdm.markets\nversion "1.0.0"\n\nfunc BenchmarkCaptureSetId:\n  output:\n    id string (1..1)\n  set id: "${captureSetId}"\n`;
}

async function materialization(directory) {
  const names = await readdir(directory);
  const hasSelection = names.includes('selection.json');
  const selection = hasSelection
    ? data.BenchmarkSelectionSchema.parse(JSON.parse(await readFile(join(directory, 'selection.json'), 'utf8')))
    : undefined;
  const snapshots = [];
  for (const name of names.filter(
    (name) =>
      data.BenchmarkSeriesSchema.options.some((series) => name === `${series}.json`) ||
      /^snapshot-[a-f0-9]{64}\.json$/.test(name)
  ))
    snapshots.push(
      (await data.readBenchmarkSnapshot(JSON.parse(await readFile(join(directory, name), 'utf8')))).snapshot
    );
  assert.ok(snapshots.length, 'No versioned benchmark snapshots were found.');
  snapshots.sort(
    (a, b) =>
      data.BenchmarkSeriesSchema.options.indexOf(a.series) - data.BenchmarkSeriesSchema.options.indexOf(b.series)
  );
  const captures = [];
  for (const snapshot of snapshots) {
    const decoded = await data.readBenchmarkSnapshot(snapshot);
    captures.push({
      series: snapshot.series,
      id: await data.benchmarkSnapshotId(snapshot),
      sourceHash: snapshot.source.sha256,
      observations: decoded.observations.length
    });
  }
  const captureSetId = createHash('sha256')
    .update(JSON.stringify(selection ? { selection, captures } : captures))
    .digest('hex');
  const window = selection?.window ?? snapshots[0].window;
  if (!selection)
    for (const snapshot of snapshots)
      assert.deepEqual(snapshot.window, window, 'Direct acquisition uses one common observation window.');
  return {
    manifest: { schemaVersion: 1, captureSetId, window, captures },
    provider: selection
      ? await data.renderBenchmarkSelection(selection, snapshots)
      : await data.renderBenchmarkProvider(snapshots),
    identity: identitySource(captureSetId)
  };
}

/** Verify saved responses, exact materialized Rune and the identity exposed in calculation results, without network I/O. */
export async function verifyMarketData(directory = join(root, 'model/benchmark-data')) {
  const expected = await materialization(directory);
  assert.deepEqual(
    JSON.parse(await readFile(join(directory, 'captures.json'), 'utf8')),
    expected.manifest,
    'Capture manifest'
  );
  assert.equal(
    await readFile(join(directory, 'market-observations.rosetta'), 'utf8'),
    expected.provider,
    'Canonical benchmark provider'
  );
  assert.equal(
    await readFile(join(directory, 'capture-identity.rosetta'), 'utf8'),
    expected.identity,
    'Calculation capture identity'
  );
  return expected.manifest;
}

async function pull(args) {
  const { values } = parseArgs({
    args,
    options: {
      output: { type: 'string' },
      catalog: { type: 'string' },
      official: { type: 'boolean' },
      start: { type: 'string' },
      end: { type: 'string' }
    }
  });
  const output = values.output;
  assert.ok(
    output,
    'Specify a new --output directory, e.g. .studio/acquisitions/review. Existing project data is never replaced.'
  );
  const active = JSON.parse(await readFile(join(root, 'model/benchmark-data/captures.json'), 'utf8'));
  assert.ok(!(values.official && values.catalog), 'Choose --catalog or --official.');
  const catalog = values.official ? undefined : (values.catalog ?? process.env.CDM_EXAMPLE_DATA_ORIGIN);
  assert.ok(
    catalog || args.includes('--official'),
    'Set CDM_EXAMPLE_DATA_ORIGIN/--catalog, or explicitly choose --official.'
  );
  const cli = [
    'market-data',
    '--start',
    values.start ?? active.window.startDate,
    '--end',
    values.end ?? active.window.endDate,
    '--output',
    resolve(output),
    '--json'
  ];
  if (catalog) cli.push('--catalog', catalog);
  const acquired = spawnSync(process.execPath, [join(toolchain, 'packages/cli/dist/index.js'), ...cli], {
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 1024 * 1024
  });
  assert.equal(acquired.status, 0, acquired.error?.message || acquired.stderr || acquired.stdout);
  const expected = await materialization(resolve(output));
  await writeFile(join(output, 'captures.json'), JSON.stringify(expected.manifest, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(output, 'capture-identity.rosetta'), expected.identity, { flag: 'wx' });
  await verifyMarketData(resolve(output));
  console.log(
    JSON.stringify(
      {
        status: 'verified',
        output: resolve(output),
        captureSetId: expected.manifest.captureSetId,
        source: catalog ? 'catalog' : 'official feeds',
        next: 'Review the capture/provider diff, then replace the active model/benchmark-data directory through normal project Save/Git. Keep only one provider selected.'
      },
      null,
      2
    )
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'pull') await pull(process.argv.slice(3));
  else {
    const manifest = await verifyMarketData();
    console.log(
      `Verified ${manifest.captures.length} benchmark captures and their Rune provider: ${manifest.captureSetId}`
    );
  }
}
