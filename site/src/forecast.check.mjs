// Known-answer self-check, run by `npm run build`: node src/forecast.check.mjs
// Reproduces the notebook's recorded statsmodels numbers from the committed CSV and parameters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCsv, holtWinters, metrics, decompose, rollingOrigin, seasonalNaive } from './forecast.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const rows = parseCsv(read('../../data/airline-passengers.csv'));
const R = JSON.parse(read('../../results/holt_winters_recorded.json'));
const y = rows.map((r) => r.value);

// 1. Data: 144 months, head and tail as printed in notebook cell 3.
assert.equal(y.length, 144);
assert.equal(rows[0].month, '1949-01');
assert.equal(rows.at(-1).month, '1960-12');
assert.deepEqual(y.slice(0, 5), [112, 118, 132, 129, 121]);
assert.deepEqual(y.slice(-5), [606, 508, 461, 390, 432]);

// 2. Replay: the JS recursion with the recorded parameters reproduces statsmodels' training SSE.
const train = y.slice(0, R.setup.train_months), test = y.slice(R.setup.train_months);
const out = {};
for (const [key, seasonal] of [['multiplicative', 'mul'], ['additive', 'add']]) {
  const r = holtWinters(train, { seasonal, ...R[key] }, R.setup.test_months);
  assert.ok(Math.abs(r.sse - R[key].sse) < 0.01, `${key} SSE ${r.sse} vs recorded ${R[key].sse}`);
  out[key] = { sse: r.sse, ...metrics(test, r.forecast) };
}
// The recorded figure's legend prints MAE/RMSE to one decimal; the recomputed forecast must round to them.
const r1 = (v) => Math.round(v * 10) / 10;
assert.deepEqual([r1(out.multiplicative.mae), r1(out.multiplicative.rmse)], [27.7, 37.1]);
assert.deepEqual([r1(out.additive.mae), r1(out.additive.rmse)], [41.6, 58.5]);

// 3. Decomposition: components add (or multiply) back to the observed series; indices centre.
for (const model of ['add', 'mul']) {
  const d = decompose(y, 12, 12, model);
  y.forEach((v, t) => {
    if (d.trend[t] == null) return;
    const back = model === 'add' ? d.trend[t] + d.seasonal[t] + d.resid[t] : d.trend[t] * d.seasonal[t] * d.resid[t];
    assert.ok(Math.abs(back - v) < 1e-9, `${model} decomposition at ${t}`);
  });
  const s = d.indices.reduce((a, b) => a + b, 0);
  assert.ok(model === 'add' ? Math.abs(s) < 1e-9 : Math.abs(s - 12) < 1e-9, `${model} indices sum ${s}`);
}

// 4. Baseline and rolling-origin evaluation run and are finite.
const sn = metrics(test, seasonalNaive(train, R.setup.test_months));
const ro = rollingOrigin(y);
assert.equal(ro.rows.length, 12);
for (const k of ['mul', 'add', 'snaive']) assert.ok(Number.isFinite(ro.summary[k].mae));

console.log('forecast ok', { mulSSE: out.multiplicative.sse.toFixed(3), addSSE: out.additive.sse.toFixed(3), mulMAE: r1(out.multiplicative.mae), addMAE: r1(out.additive.mae), snaiveMAE: r1(sn.mae), rollingMAE: Object.fromEntries(Object.entries(ro.summary).map(([k, v]) => [k, r1(v.mae)])) });
