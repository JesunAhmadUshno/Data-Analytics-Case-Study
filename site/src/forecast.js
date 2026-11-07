// Forecasting maths for the dashboard. Pure functions, shared by the page and forecast.check.mjs.

export function parseCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [m, v] = line.split(',');
    return { month: m.replace(/"/g, ''), value: +v };
  });
}

// Holt-Winters with additive trend, following statsmodels' ExponentialSmoothing recursion:
// one-step fit for y[t] is (l + b) * s[t] (mul) or (l + b) + s[t] (add), where s[t] is the
// seasonal state from one cycle earlier; s0 holds the 12 initial seasons for t = 0..m-1.
export function holtWinters(y, { seasonal, alpha, beta, gamma, l0, b0, s0 }, horizon = 0) {
  const m = s0.length, mul = seasonal === 'mul';
  const s = [...s0];
  let l = l0, b = b0, sse = 0;
  const fitted = [];
  for (let t = 0; t < y.length; t++) {
    const st = s[t], base = l + b;
    const f = mul ? base * st : base + st;
    fitted.push(f);
    sse += (y[t] - f) ** 2;
    const lNew = alpha * (mul ? y[t] / st : y[t] - st) + (1 - alpha) * base;
    b = beta * (lNew - l) + (1 - beta) * b;
    s.push(gamma * (mul ? y[t] / base : y[t] - base) + (1 - gamma) * st);
    l = lNew;
  }
  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    const st = s[y.length + ((h - 1) % m)];
    forecast.push(mul ? (l + h * b) * st : l + h * b + st);
  }
  return { fitted, forecast, sse };
}

// Heuristic start values (first two cycles), used by the playground's fit.
export function initState(y, seasonal, m = 12) {
  const c1 = mean(y.slice(0, m)), c2 = mean(y.slice(m, 2 * m));
  const s0 = y.slice(0, m).map((v) => (seasonal === 'mul' ? v / c1 : v - c1));
  return { l0: c1, b0: (c2 - c1) / m, s0 };
}

// Coarse grid over alpha/beta/gamma minimising training SSE with heuristic start values.
// ponytail: grid, not Nelder-Mead over all 17 parameters like statsmodels; refine if the gap matters.
export function fitGrid(y, seasonal, m = 12) {
  const init = initState(y, seasonal, m);
  const grid = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  let best = null;
  for (const alpha of grid.slice(1)) for (const beta of grid.slice(0, 6)) for (const gamma of grid.slice(0, 8)) {
    const { sse } = holtWinters(y, { seasonal, alpha, beta, gamma, ...init });
    if (!best || sse < best.sse) best = { alpha, beta, gamma, sse };
  }
  return { ...init, ...best, seasonal };
}

export const seasonalNaive = (train, h, m = 12) => Array.from({ length: h }, (_, i) => train[train.length - m + (i % m)]);

export function metrics(actual, pred) {
  const e = actual.map((a, i) => a - pred[i]);
  return {
    mae: mean(e.map(Math.abs)),
    rmse: Math.sqrt(mean(e.map((x) => x * x))),
    mape: 100 * mean(e.map((x, i) => Math.abs(x / actual[i]))),
  };
}

// Classical decomposition: centred moving-average trend (2xW for even W), seasonal = mean
// detrended value per phase, centred to sum to 0 (add) or average 1 (mul); residual is the rest.
export function decompose(y, period = 12, window = period, model = 'add') {
  const n = y.length, half = Math.floor(window / 2), even = window % 2 === 0;
  const trend = y.map((_, t) => {
    if (t - half < 0 || t + half >= n) return null;
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += (even && Math.abs(k) === half ? 0.5 : 1) * y[t + k];
    return sum / window;
  });
  const mul = model === 'mul';
  const phase = Array.from({ length: period }, () => []);
  y.forEach((v, t) => trend[t] != null && phase[t % period].push(mul ? v / trend[t] : v - trend[t]));
  let idx = phase.map(mean);
  const c = mean(idx);
  idx = idx.map((v) => (mul ? v / c : v - c));
  const seasonal = y.map((_, t) => idx[t % period]);
  const resid = y.map((v, t) => (trend[t] == null ? null : mul ? v / (trend[t] * seasonal[t]) : v - trend[t] - seasonal[t]));
  return { trend, seasonal, resid, indices: idx };
}

// Rolling-origin evaluation: refit at each origin, forecast `h` ahead, average the errors.
export function rollingOrigin(y, { origins = 12, h = 12, step = 1, m = 12 } = {}) {
  const rows = [];
  for (let k = 0; k < origins; k++) {
    const cut = y.length - h - (origins - 1 - k) * step;
    const train = y.slice(0, cut), test = y.slice(cut, cut + h);
    const row = { cut };
    for (const seasonal of ['mul', 'add']) {
      const p = fitGrid(train, seasonal, m);
      row[seasonal] = metrics(test, holtWinters(train, p, h).forecast);
    }
    row.snaive = metrics(test, seasonalNaive(train, h, m));
    rows.push(row);
  }
  const avg = (key, f) => mean(rows.map((r) => r[key][f]));
  return { rows, summary: Object.fromEntries(['mul', 'add', 'snaive'].map((k) => [k, { mae: avg(k, 'mae'), rmse: avg(k, 'rmse'), mape: avg(k, 'mape') }])) };
}

export const rolling = (y, w, f) => y.map((_, t) => (t + 1 < w ? null : f(y.slice(t + 1 - w, t + 1))));
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const sd = (a) => { const mu = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / (a.length - 1)); };
