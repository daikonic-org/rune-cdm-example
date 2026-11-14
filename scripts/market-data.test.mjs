// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMarketData } from './market-data.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'rune-example-data-'));
  const directory = join(root, 'data');
  try {
    await cp(new URL('../model/benchmark-data/', import.meta.url), directory, { recursive: true });
    await run(directory);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('reopens all six official captures and verifies the canonical offline provider', async () => {
  const manifest = await verifyMarketData();
  assert.equal(manifest.captures.length, 6);
  assert.ok(manifest.captures.every((capture) => capture.observations === 6));
});

test('refuses altered response bytes without rewriting captures or authored provider text', async () =>
  fixture(async (directory) => {
    const path = join(directory, 'sofr.json');
    const snapshot = JSON.parse(await readFile(path, 'utf8'));
    snapshot.content += '\n';
    await writeFile(path, JSON.stringify(snapshot));
    const before = await readFile(path, 'utf8');
    await assert.rejects(verifyMarketData(directory), /checksum/i);
    assert.equal(await readFile(path, 'utf8'), before);
  }));

test('detects drift between captures and the Rune source used for execution', async () =>
  fixture(async (directory) => {
    const path = join(directory, 'market-observations.rosetta');
    const edited = (await readFile(path, 'utf8')) + '\n// retained authored edit\n';
    await writeFile(path, edited);
    await assert.rejects(verifyMarketData(directory), /Canonical benchmark provider/);
    assert.equal(await readFile(path, 'utf8'), edited);
  }));

test('refuses a mismatched result provenance identity', async () =>
  fixture(async (directory) => {
    const path = join(directory, 'captures.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.captureSetId = '0'.repeat(64);
    await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(verifyMarketData(directory), /Capture manifest/);
  }));
