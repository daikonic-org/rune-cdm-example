// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daikonic contributors
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkWorkspace, codegen, checked } from './check.mjs';

function close(actual, expected, label = 'number') {
  assert.ok(Number.isFinite(actual), `${label}: ${actual} must be finite`);
  assert.ok(
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`
  );
}

function equivalent(actual, expected, path = '') {
  if (typeof expected === 'number') return close(actual, expected, path);
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), path);
    assert.equal(actual.length, expected.length, path);
    expected.forEach((value, index) => equivalent(actual[index], value, `${path}[${index}]`));
  } else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
    for (const key of Object.keys(expected)) equivalent(actual[key], expected[key], `${path}.${key}`);
  } else assert.equal(actual, expected, path);
}

function productLegs(inputs) {
  return inputs.product.nonTransferableProduct.economicTerms.payout.map((payout) => payout.interestRatePayout);
}

async function verifyCalculations({ executions, graph, scratch }) {
  const cases = [];
  function run(id, edit = () => {}, error) {
    const entry = executions.get(id);
    assert.ok(entry, id);
    const inputs = structuredClone(entry.inputs);
    edit(inputs);
    const before = structuredClone(inputs);
    let result;
    if (error) assert.throws(() => entry.execute(inputs), error, id);
    else result = entry.execute(inputs);
    assert.deepEqual(inputs, before, 'Calculation must not mutate saved input: ' + id);
    cases.push({ id, inputs, result, error: error?.source });
    return result;
  }

  const repayments = run('product-repayments');
  equivalent(
    run('product-repayments', (input) => {
      input.product = {
        transferableProduct: {
          asset: {
            cash: {
              identifier: [{ identifier: { value: 'USD', meta: {} }, identifierType: 'CurrencyCode' }],
              assetType: 'Cash'
            }
          },
          economicTerms: input.product.nonTransferableProduct.economicTerms,
          productPartyRole: 'Party1'
        }
      };
    }),
    repayments,
    'transferable-product asset economics'
  );
  assert.deepEqual(
    repayments.map((row) => row.principal),
    [200000, 200000, 600000]
  );
  assert.deepEqual(
    repayments.map((row) => row.closingNotional),
    [800000, 600000, 0]
  );
  repayments.forEach((row, index) => {
    close(row.coupon.amount, [3875, 2800, 2325][index], 'fixed coupon');
    close(row.totalPayment, row.principal + row.coupon.amount);
  });
  const accruals = run('product-accruals');
  close(
    accruals.reduce((sum, row) => sum + row.accruedAmount, 0),
    5175,
    'as-of accrual'
  );
  close(accruals[0].comparisons[1].yearFraction, 31 / 365);
  close(accruals[0].comparisons[2].amount, 3750, '30E/360 comparison');
  assert.deepEqual(
    run('product-accruals', (input) => {
      input.context.valuationDate = '2025-01-01';
    }),
    []
  );
  close(
    run('product-accruals', (input) => {
      input.context.valuationDate = '2025-02-07';
    })[0].accruedAmount,
    3875
  );
  close(
    run('product-accruals', (input) => {
      input.context.valuationDate = '2025-04-30';
    }).reduce((sum, row) => sum + row.accruedAmount, 0),
    9000,
    'accrual capped at termination'
  );

  const resets = run('product-resets');
  assert.deepEqual(
    resets.map((row) => row.fixingDate),
    ['2025-02-05', '2025-03-05', '2025-04-03']
  );

  for (const [id, base, basis] of [
    ['sofr-overnight', 0.043, 360],
    ['sonia-overnight', 0.046, 365]
  ]) {
    const [coupon] = run(id);
    const weights = [1, 1, 1, 1, 3];
    const rates = weights.map((_, index) => base + index * 0.00001);
    const factor = rates.reduce((value, rate, index) => value * (1 + (rate * weights[index]) / basis), 1);
    const annualRate = ((factor - 1) * basis) / 7;
    assert.deepEqual(coupon.observations.weights, weights);
    assert.deepEqual(coupon.observations.observationDates, [
      '2025-01-06',
      '2025-01-07',
      '2025-01-08',
      '2025-01-09',
      '2025-01-10'
    ]);
    close(coupon.yearFraction, 7 / basis);
    close(coupon.calculatedRate, annualRate, 'raw compounded rate');
    close(coupon.rate, Math.round(annualRate * 1e7) / 1e7, 'CDM default final rate rounding');
    close(
      coupon.amount,
      1000000 * (7 / basis) * (Math.round(annualRate * 1e7) / 1e7),
      'independent weekly compound interest'
    );
    const changed = run(id, (input) => {
      const series = input.context.rates[id === 'sofr-overnight' ? 0 : 1];
      series.observations[0].value += 0.01;
    });
    assert.ok(changed[0].amount > coupon.amount, 'Editing an observation changes the floating output.');
  }
  for (const id of ['sofr-index', 'sonia-index']) close(run(id)[0].rateDifference, 0, 'daily/index rate agreement');
  const [spreadCoupon] = run('sofr-overnight', (input) => {
    const [fixed, floating] = productLegs(input);
    const spread = structuredClone(fixed.rateSpecification.fixedRateSpecification.rateSchedule);
    spread.price.value.value = 0.001;
    floating.rateSpecification.floatingRateSpecification.spreadSchedule = spread;
  });
  close(spreadCoupon.rate - run('sofr-overnight')[0].rate, 0.001, 'contractual spread is applied');
  const summary = run('product-cashflows');
  close(summary.fixedTotal, 9000);
  close(
    summary.floatingTotal,
    summary.floatingCoupons.reduce((sum, row) => sum + row.amount, 0)
  );
  close(summary.fixedMinusFloating, summary.fixedTotal - summary.floatingTotal);

  run(
    'sofr-overnight',
    (input) => {
      input.context.rates[0].observations.shift();
    },
    /MarketObservationMissing/
  );
  run(
    'sofr-overnight',
    (input) => {
      input.context.rates[0].observations.push(input.context.rates[0].observations[0]);
    },
    /MarketObservationAmbiguous/
  );
  run(
    'sofr-overnight',
    (input) => {
      input.context.rates.shift();
    },
    /RateSeriesMissing/
  );
  run(
    'sofr-overnight',
    (input) => {
      input.context.rates.push(structuredClone(input.context.rates[0]));
    },
    /RateSeriesAmbiguous/
  );
  run(
    'sofr-overnight',
    (input) => {
      input.context.rates[0].index.floatingRateIndex.indexTenor = { period: 'D', periodMultiplier: 1 };
    },
    /RateSeriesMissing/
  );
  run(
    'sofr-index',
    (input) => {
      input.context.rates[0].indexLevels = [];
    },
    /MarketObservationMissing/
  );
  run(
    'sofr-index',
    (input) => {
      input.context.rates[0].indexLevels[0].value = 0;
    },
    /PositiveIndexLevels/
  );
  run(
    'product-repayments',
    (input) => {
      input.context.principalRepayments = [];
    },
    /ConsistentPrincipalPlan/
  );
  run(
    'product-repayments',
    (input) => {
      input.context.principalRepayments[0].value = -1;
    },
    /ConsistentPrincipalPlan/
  );
  run(
    'product-repayments',
    (input) => {
      input.context.principalRepayments.push(input.context.principalRepayments[0]);
    },
    /OnePrincipalPaymentPerDate/
  );
  run(
    'product-repayments',
    (input) => {
      input.context.principalRepayments[0].date = '2025-02-08';
    },
    /RepaymentDatesInSchedule/
  );
  run(
    'product-repayments',
    (input) => {
      productLegs(input)[0].paymentDates.payRelativeTo = 'CalculationPeriodStartDate';
    },
    /RegularPeriodEndPayments/
  );
  run(
    'product-repayments',
    (input) => {
      productLegs(input)[0].priceQuantity.quantitySchedule.value.datedValue[0].date = '2025-02-10';
    },
    /NotionalStepsAtBoundaries/
  );
  run(
    'product-repayments',
    (input) => {
      productLegs(input)[0].priceQuantity.quantitySchedule.value.datedValue.reverse();
    },
    /OrderedNotionalSteps/
  );
  run(
    'sofr-overnight',
    (input) => {
      productLegs(input)[1].rateSpecification.floatingRateSpecification.rateTreatment = 'MoneyMarketYield';
    },
    /UnsupportedUSRateTreatment/
  );

  const selection = {
    namespaces: [],
    declarations: [...new Set(cases.map((entry) => executions.get(entry.id).functionName))].map((qualified) => ({
      namespace: qualified.slice(0, qualified.lastIndexOf('.')),
      name: qualified.slice(qualified.lastIndexOf('.') + 1),
      kind: 'RosettaFunction'
    }))
  };
  const python = codegen.generatePythonModule(
    codegen.resolveExportSelection(graph.services.shared.workspace.LangiumDocuments.all.toArray(), selection).documents
  );
  checked(python.diagnostics, 'Python product calculation projection');
  const invocations = cases.map((entry) => {
    const execution = executions.get(entry.id);
    const binding = python.bindings.get(execution.functionName);
    assert.ok(binding, execution.functionName);
    return { binding, args: execution.parameterNames.map((name) => entry.inputs[name]) };
  });
  await writeFile(join(scratch, 'product-cases.json'), JSON.stringify(invocations));
  const path = join(scratch, 'product-calculations.py');
  await writeFile(
    path,
    python.code +
      `
import ast, json, sys
if sys.version_info < (3, 13):
    raise RuntimeError('Use Python >=3.13 (PYTHON_BINARY).')
results = []
with open(sys.argv[1]) as source:
    for case in json.load(source):
        try:
            results.append({'value': globals()[case['binding']](*case['args'])})
        except Exception as error:
            results.append({'error': str(error)})
print(json.dumps(results, allow_nan=False, default=str))
`
  );
  const pythonRun = spawnSync(process.env.PYTHON_BINARY ?? 'python3', [path, join(scratch, 'product-cases.json')], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024
  });
  assert.equal(pythonRun.status, 0, pythonRun.error?.message ?? pythonRun.stderr);
  const results = JSON.parse(pythonRun.stdout);
  assert.equal(results.length, cases.length);
  cases.forEach((entry, index) => {
    if (entry.error) assert.match(results[index].error ?? '', new RegExp(entry.error), entry.id);
    else {
      assert.equal(results[index].error, undefined, entry.id + ': ' + results[index].error);
      equivalent(results[index].value, entry.result, 'Python parity ' + entry.id);
    }
  });
  console.log(
    `PASS ${cases.length} TypeScript/Python product scenarios: independent amounts, changed inputs, no mutation and named failures.`
  );
}

await checkWorkspace({ verify: verifyCalculations });
