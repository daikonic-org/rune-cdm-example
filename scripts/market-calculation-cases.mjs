// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toolchain } from './check.mjs';
import { verifyMarketData } from './market-data.mjs';

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

/** Independent numeric checks join the same mutation/error and Python-parity runner as the earlier product cases. */
export async function verifyMarketCalculations({ executions, run, close }) {
  const manifest = await verifyMarketData();
  const marketData = await import(pathToFileURL(join(toolchain, 'packages/project-runtime/dist/market-data.js')));
  async function observations(series) {
    return (
      await marketData.readBenchmarkSnapshot(
        JSON.parse(await readFile(new URL(`../model/benchmark-data/${series}.json`, import.meta.url), 'utf8'))
      )
    ).observations;
  }
  const sofr = new Map((await observations('sofr')).map((row) => [row.date, row.value]));
  const sonia = new Map((await observations('sonia')).map((row) => [row.date, row.value]));
  const basis = 360;
  const { note, market, cleanPricePer100 } = executions.get('floating-note-valuation').inputs;
  const notional = note.payout.priceQuantity.quantitySchedule.value.value;
  const spread = note.payout.rateSpecification.floatingRateSpecification.spreadSchedule.price.value.value;
  assert.ok(Number.isFinite(notional) && Number.isFinite(spread));
  function calibrated(shift = 0) {
    const pillars = [];
    let annuity = 0,
      start = market.asOf;
    for (const quote of market.quotes) {
      const fraction = days(start, quote.maturityDate) / basis;
      const rate = quote.parRate + shift;
      const discount = (1 - rate * annuity) / (1 + rate * fraction);
      pillars.push({ date: quote.maturityDate, discount, fraction });
      annuity += discount * fraction;
      close(rate * annuity, 1 - discount, 'OIS quote repricing');
      start = quote.maturityDate;
    }
    return pillars;
  }
  function discount(pillars, date) {
    if (date === market.asOf) return 1;
    const right = pillars.find((p) => p.date >= date);
    assert.ok(right, 'No curve extrapolation in the independent check');
    const left = pillars.filter((p) => p.date < date).at(-1) ?? { date: market.asOf, discount: 1 };
    const weight = days(left.date, date) / days(left.date, right.date);
    return left.discount ** (1 - weight) * right.discount ** weight;
  }
  const realized = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].reduce(
    (growth, date) => growth * (1 + sofr.get(date) / basis),
    1
  );
  const starts = ['2026-11-02', '2027-02-02', '2027-05-02', '2027-08-02'];
  const ends = ['2027-02-02', '2027-05-02', '2027-08-02', '2027-11-02'];
  const payments = ['2027-02-02', '2027-05-03', '2027-08-02', '2027-11-02'];
  function expectedCashflows(shift = 0) {
    const pillars = calibrated(shift);
    return ends.map((end, i) => {
      const fraction = days(starts[i], end) / basis;
      const futureStart = starts[i] < market.asOf ? market.asOf : starts[i];
      const forwardGrowth = discount(pillars, futureStart) / discount(pillars, end);
      const rawRate = ((i ? 1 : realized) * forwardGrowth - 1) / fraction;
      const appliedRate = Math.round((rawRate + spread) * 1e7) / 1e7;
      const interest = notional * fraction * appliedRate;
      const principal = i === 3 ? notional : 0;
      return {
        interest,
        principal,
        total: interest + principal,
        discount: discount(pillars, payments[i]),
        appliedRate
      };
    });
  }
  const result = run('floating-note-valuation');
  assert.equal(result.benchmarkCaptureId, manifest.captureSetId);
  assert.deepEqual(
    result.cashflows.map((c) => c.paymentDate),
    payments
  );
  const expected = expectedCashflows();
  result.curve.pillars.forEach((p, i) => {
    close(p.discountFactor, calibrated()[i].discount, 'bootstrapped discount factor');
    close(p.calibrationResidual, 0, 'published calibration residual');
  });
  result.cashflows.forEach((c, i) => {
    close(c.interest, expected[i].interest, 'independent FRN coupon');
    close(c.discountFactor, expected[i].discount, 'log-linear discount interpolation');
    close(c.presentValue, expected[i].total * expected[i].discount, 'independent cashflow PV');
    close(c.principal, expected[i].principal, 'bullet principal');
  });
  const presentValue = expected.reduce((sum, c) => sum + c.total * c.discount, 0);
  const accruedRate = Math.round(((realized - 1) / (4 / basis) + spread) * 1e7) / 1e7;
  const accrued = (notional * accruedRate * 4) / basis;
  close(result.accruedInterest, accrued, 'realized-only accrual');
  close(result.presentValue, presentValue, 'independent note PV');
  close(result.settlementAmount, (notional * cleanPricePer100) / 100 + accrued, 'dirty settlement amount');
  close(result.netPresentValue, presentValue - result.settlementAmount, 'settlement-relative NPV');
  const atYield = result.cashflows.reduce(
    (sum, c) => sum + c.total / (1 + result.annualEffectiveYield) ** (days(market.asOf, c.paymentDate) / 365),
    0
  );
  close(atYield, result.settlementAmount, 'independent yield repricing');
  for (const [shift, field] of [
    [-0.0001, 'downPresentValue'],
    [0.0001, 'upPresentValue']
  ])
    close(
      result[field],
      expectedCashflows(shift).reduce((sum, c) => sum + c.total * c.discount, 0),
      'joint projection/discount quote bump'
    );
  close(result.quoteDv01, (result.downPresentValue - result.upPresentValue) / 2, 'central quote DV01');
  const cheaper = run('floating-note-valuation', (input) => {
    input.cleanPricePer100 = 98;
  });
  close(cheaper.presentValue, result.presentValue, 'market price does not alter model PV');
  assert.ok(cheaper.annualEffectiveYield > result.annualEffectiveYield);
  assert.ok(cheaper.netPresentValue > result.netPresentValue);
  assert.ok(
    run('floating-note-valuation', (input) => {
      input.market.quotes.forEach((q) => {
        q.parRate += 0.01;
      });
    }).cashflows[0].interest > result.cashflows[0].interest
  );
  close(
    run('floating-note-valuation', (input) => {
      input.market.asOf = '2026-11-02';
    }).accruedInterest,
    0,
    'issue-date accrual'
  );
  for (const [edit, error] of [
    [(input) => input.market.quotes.reverse(), /IncreasingPillars/],
    [
      (input) => {
        input.market.quotes[0].parRate = -10;
      },
      /PositiveCurveDenominator|PositiveDiscountFactor/
    ],
    [
      (input) => {
        input.market.currency = 'GBP';
      },
      /MatchingMarket/
    ],
    [
      (input) => {
        input.market.benchmark = 'GBP_SONIA';
      },
      /MatchingMarket/
    ],
    [
      (input) => {
        input.market.asOf = '2026-11-11';
      },
      /MarketObservationMissing/
    ],
    [
      (input) => {
        input.market.illustrative = false;
      },
      /ExplicitIllustrativeQuotes/
    ],
    [(input) => input.market.quotes.pop(), /WithinCurve/],
    [
      (input) => {
        input.cleanPricePer100 = 0;
      },
      /PositivePriceAndPrincipal|YieldBracket/
    ]
  ])
    run('floating-note-valuation', edit, error);

  const facility = run('sonia-facility-accrual');
  assert.equal(facility.benchmarkCaptureId, manifest.captureSetId);
  assert.deepEqual(
    facility.balances.map((row) => row.scheduledBalance),
    [1000000, 1500000, 0]
  );
  assert.deepEqual(
    facility.balances.map((row) => row.availableCommitment),
    [1000000, 500000, 2000000]
  );
  close(facility.scheduledPrincipalDue, 1500000);
  function checkLoanRow(row, dates, weights) {
    assert.deepEqual(row.observations.observations.observationDates, dates);
    assert.deepEqual(row.observations.observations.weights, weights);
    const growth = dates.reduce((value, date, i) => value * (1 + (sonia.get(date) * weights[i]) / 365), 1);
    const fraction = weights.reduce((a, b) => a + b, 0) / 365;
    close(row.growth, growth, 'independent SONIA growth');
    close(row.benchmarkInterest, row.notional * (growth - 1));
    close(row.marginInterest, row.notional * row.margin * fraction);
    close(row.earnedInterest, row.notional * (growth - 1 + row.margin * fraction));
    close(row.roundedInterest, Math.round(row.earnedInterest * 100) / 100);
  }
  checkLoanRow(
    facility.contracts[0],
    ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
    [1, 1, 1, 1, 3]
  );
  checkLoanRow(facility.contracts[1], ['2026-11-04', '2026-11-05', '2026-11-06'], [1, 1, 3]);
  facility.contracts.forEach((row) => {
    assert.equal(row.indexComparisonAvailable, true);
    assert.ok(
      Math.abs(row.indexGrowthDifference) < 1e-9,
      'published SONIA index agrees within its published precision'
    );
  });
  const partial = run('sonia-facility-accrual', (input) => {
    input.asOf = '2026-11-06';
  });
  checkLoanRow(partial.contracts[0], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], [1, 1, 1, 1]);
  close(partial.scheduledPrincipalDue, 0);
  close(partial.totalScheduledDue, 0);
  const weekend = run('sonia-facility-accrual', (input) => {
    input.asOf = '2026-11-07';
  });
  checkLoanRow(
    weekend.contracts[0],
    ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
    [1, 1, 1, 1, 1]
  );
  assert.equal(weekend.contracts[0].indexComparisonAvailable, false);
  assert.equal(weekend.contracts[0].officialIndexGrowth, undefined);
  close(
    run('sonia-facility-accrual', (input) => {
      input.asOf = '2026-11-01';
    }).earnedInterest,
    0,
    'no accrual before drawdown'
  );
  assert.ok(
    run('sonia-facility-accrual', (input) => {
      input.book.contracts[0].floatingRateAccrual.rate.spreadSchedule[0].initialValue += 0.01;
    }).earnedInterest > facility.earnedInterest
  );
  for (const [edit, error] of [
    [
      (input) => {
        input.book.facility.currentCommitment.totalCommitmentAmount.amount = 1200000;
      },
      /CommitmentCapacity/
    ],
    [
      (input) => {
        input.book.contracts[0].facilityReference.href = 'other-facility';
      },
      /MatchingFacilityContracts/
    ],
    [
      (input) => {
        input.book.contracts[1].id = input.book.contracts[0].id;
      },
      /MatchingFacilityContracts/
    ],
    [
      (input) => {
        input.book.contracts[0].amount.currency.value = 'USD';
      },
      /SupportedSoniaLoan/
    ],
    [
      (input) => {
        input.book.contracts[0].floatingRateAccrual.rate.isCompoundingBalance = true;
      },
      /SupportedSoniaLoan/
    ],
    [
      (input) => {
        input.book.contracts[0].floatingRateAccrual.pikSpread = 0.01;
      },
      /SimpleContractualMargin/
    ],
    [
      (input) => {
        input.book.contracts[0].floatingRateAccrual.numberOfDays = 99;
      },
      /FundedBulletPeriod/
    ]
  ])
    run('sonia-facility-accrual', edit, error);
  console.log(
    'PASS independent OIS repricing, FRN yield/NPV/quote DV01, SONIA weights/margins/indices, no lookahead, limits and errors.'
  );
}
