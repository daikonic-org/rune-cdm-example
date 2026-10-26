// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import type { ImplementationProvider } from '@rune-langium/project-runtime';
import { Temporal } from '@js-temporal/polyfill';

/** Explicit host policy: Today means the UTC calendar date. Tests inject the clock. */
export function createUtcClockProvider(now: () => Date = () => new Date()): ImplementationProvider {
  return {
    id: 'example.utc-clock',
    supports(symbol) {
      return (
        symbol.model === 'cdm' &&
        symbol.namespace === 'cdm.base.datetime' &&
        symbol.kind === 'RosettaFunction' &&
        symbol.name === 'Today' &&
        symbol.dispatch === undefined
      );
    },
    invoke(args) {
      if (args.length !== 0) throw new TypeError('Today takes no arguments.');
      const instant = now();
      if (!Number.isFinite(instant.getTime())) throw new TypeError('The clock returned an invalid instant.');
      const iso = instant.toISOString();
      return Temporal.PlainDate.from(iso.slice(0, iso.indexOf('T')));
    }
  };
}
