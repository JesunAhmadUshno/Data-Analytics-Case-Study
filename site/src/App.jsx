import { useMemo, useState, useEffect, useId } from 'react';
import csv from '../../data/airline-passengers.csv?raw';
import rec from '../../results/holt_winters_recorded.json';
import { parseCsv, holtWinters, fitGrid, seasonalNaive, metrics, decompose, rollingOrigin, rolling, mean, sd } from './forecast.js';

const REPO = 'https://github.com/JesunAhmadUshno/Data-Analytics-Case-Study';
const NB = 'time_series_airline_passengers_dataset_using_stl.ipynb';
const NB2 = 'time_series_airline_passengers_dataset_using_STL.ipynb';
const blob = (p) => `${REPO}/blob/main/${p}`;
const colab = (p) => `https://colab.research.google.com/github/JesunAhmadUshno/Data-Analytics-Case-Study/blob/main/${p}`;
const BASE = import.meta.env.BASE_URL;
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const rows = parseCsv(csv);
const Y = rows.map((r) => r.value);
const N = Y.length;
const TRAIN = rec.setup.train_months, TEST = rec.setup.test_months;
const YEARS = [...new Set(rows.map((r) => r.month.slice(0, 4)))];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KEY = { mul: 'multiplicative', add: 'additive' };

// Recorded parameters, forecast recomputed here (forecast.check.mjs asserts the SSE match at build time).
const replay = Object.fromEntries(['mul', 'add'].map((s) => {
  const r = holtWinters(Y.slice(0, TRAIN), { seasonal: s, ...rec[KEY[s]] }, TEST);
  return [s, { ...r, ...metrics(Y.slice(TRAIN), r.forecast) }];
}));
const snaive60 = metrics(Y.slice(TRAIN), seasonalNaive(Y.slice(0, TRAIN), TEST));

const SECTIONS = [['top', 'Overview', '◎'], ['series', 'Series', '∿'], ['decompose', 'Decompose', '≡'], ['recorded', 'Recorded fit', '▤'], ['lab', 'Forecast lab', '⚙'], ['notes', 'Limits', '!']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">Airline Forecast Lab</a>
      <a className="m" href={blob(NB)}>Notebook</a>
      <a className="m" href={blob('data/README.md')}>Data</a>
      <a className="m" href={blob('docs/research-review.md')}>Review</a>
      <span className="spacer" />
      <span className="status"><i /> Replay matches recorded SSE</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

// One hand-written SVG line chart: series of {values (null = gap), color, dash, width}, over x = 0..n-1.
function useNarrow() {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return narrow;
}

function LineChart({ series, n, label, W: Wd = 960, H: Hd = 280, x0 = 0, yZero = false, onHover, hover, ticks, band, marks = [] }) {
  // Wide charts get a narrower viewBox on phones so axis text stays legible.
  const narrow = useNarrow(), squeeze = narrow && Wd > 600;
  const W = squeeze ? 420 : Wd, H = squeeze ? Math.round(Hd * 0.75) : Hd;
  const pad = { l: 46, r: 12, t: 12, b: 26 };
  const all = series.flatMap((s) => s.values.filter((v) => v != null));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (yZero) { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
  const span = hi - lo || 1; lo -= span * 0.06; hi += span * 0.06;
  const x = (i) => pad.l + ((i - x0) / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const step = niceStep((hi - lo) / (H < 150 ? 2 : 4));
  const yt = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) yt.push(+t.toFixed(6));
  const path = (vals) => { let d = '', pen = false; vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i + x0).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return d; };
  const move = onHover && ((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width * W - pad.l) / (W - pad.l - pad.r) * (n - 1)) + x0;
    onHover(Math.max(x0, Math.min(x0 + n - 1, i)));
  });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseMove={move} onMouseLeave={onHover && (() => onHover(null))}>
      {yt.map((t) => <g key={t}><line className="axis" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} strokeWidth={t === 0 && yZero ? 1.5 : 1} /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{fmt(t, step < 1 ? 2 : 0)}</text></g>)}
      {band && <rect x={x(band[0])} width={x(band[1]) - x(band[0])} y={pad.t} height={H - pad.t - pad.b} fill="var(--primary)" opacity="0.06" />}
      {(ticks || []).map(([i, t]) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === x0 + n - 1 ? 'end' : i === x0 && n > 12 ? 'start' : 'middle'}>{t}</text>)}
      {marks.map(([i, t]) => <g key={t}><line x1={x(i)} x2={x(i)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="4 4" opacity="0.6" /><text x={x(i) + 6} y={pad.t + 12}>{t}</text></g>)}
      {series.map((s, k) => <path key={k} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash} strokeLinejoin="round" opacity={s.opacity ?? 1} />)}
      {hover != null && <g>
        <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--text)" opacity="0.3" />
        {series.map((s, k) => s.values[hover - x0] != null && <circle key={k} cx={x(hover)} cy={y(s.values[hover - x0])} r="4" fill={s.color} stroke="var(--surface-strong)" strokeWidth="1.5" />)}
      </g>}
    </svg>
  );
}
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)); const f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
const yearTicks = (from = 0, to = N, every = 2) => YEARS.map((yr, k) => [k * 12, yr]).filter(([i], k) => i >= from && i < to && k % every === 0);

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Series />
      <Decompose />
      <Recorded />
      <Lab />
      <Notes />
      <Dock />
      <footer>
        Data: Box, Jenkins and Reinsel, Series G (monthly airline passengers, 1949-1960), via the <a href="https://github.com/jbrownlee/Datasets">jbrownlee/Datasets</a> mirror the notebook reads.
        {' '}Notebooks: <a href={blob(NB)}>STL + Holt-Winters</a> (<a href={colab(NB)}>Colab</a>) and <a href={blob(NB2)}>STL only</a> (<a href={colab(NB2)}>Colab</a>).
        {' '}Every number here is read from <code>data/</code> and <code>results/</code> at build time or computed in your browser. Built from commit <code>{__COMMIT__}</code>.
      </footer>
    </div>
  );
}

function Hero() {
  const m = rec.multiplicative, a = rec.additive;
  return (
    <header className="card hero window" id="top" data-title="Data-Analytics-Case-Study — README">
      <div className="head">
        <p className="eyebrow">Coursework case study · time-series forecasting</p>
        <span className="pill info">● Recorded run, {rec.run_date}</span>
      </div>
      <h1>Twelve years of airline passengers, split into trend and <em>season</em>.</h1>
      <p className="sub">
        On the {N}-month series ({rows[0].month} to {rows.at(-1).month}, Box-Jenkins Series G), the multiplicative Holt-Winters model fits the {m.n_obs} training months with about half the error of the additive one
        (SSE {fmt(m.sse)} vs {fmt(a.sse)}). This page rebuilds that comparison in your browser from the committed data and the notebook’s recorded parameters, then lets you take the models apart.
        It is a single-split coursework exercise, and the limits are spelled out <a href="#notes">below</a>.
      </p>
      <div className="actions">
        <a className="btn primary" href="#lab">Open the forecast lab</a>
        <a className="btn ghost" href={blob(NB)}>Read the notebook</a>
        <span className="hint">Check it yourself: <code>cd site && npm ci && npm run build</code></span>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{fmt(m.sse)}</div><div className="cap">Training SSE, multiplicative seasonality (recorded)</div></div>
        <div className="tile"><div className="num">{fmt(a.sse)}</div><div className="cap">Training SSE, additive seasonality (recorded)</div></div>
        <div className="tile"><div className="num">{fmt(m.aic, 1)}</div><div className="cap">AIC multiplicative vs {fmt(a.aic, 1)} additive: lower is better, same data</div></div>
        <div className="tile"><div className="num">{fmt(replay.mul.mae, 1)}</div><div className="cap">Test MAE over 1956-1960, multiplicative (recomputed from recorded parameters)</div></div>
      </div>
    </header>
  );
}

function Series() {
  const [view, setView] = useState('line');
  const [hover, setHover] = useState(null);
  const [win, setWin] = useState(12);
  const rm = useMemo(() => rolling(Y, win, mean), [win]);
  const rs = useMemo(() => rolling(Y, win, sd), [win]);
  const ratio = rs.map((s, i) => (s == null ? null : s / rm[i]));
  const firstYr = Y.slice(0, 12), lastYr = Y.slice(-12);
  const swing = (a) => Math.max(...a) - Math.min(...a);
  const sdA = sd(firstYr), sdB = sd(lastYr), muA = mean(firstYr), muB = mean(lastYr);
  const palette = (k) => `color-mix(in srgb, var(--primary) ${20 + (k / (YEARS.length - 1)) * 80}%, var(--warn))`;
  const tip = hover == null ? null : view === 'yoy'
    ? `${MONTHS[hover]}: ${YEARS.map((yr, k) => `${yr.slice(2)}: ${Y[k * 12 + hover]}`).join(' · ')}`
    : view === 'roll'
      ? `${rows[hover].month}: ${Y[hover]} passengers (thousands)${rm[hover] != null ? `, ${win}-month mean ${fmt(rm[hover], 1)}, SD ${fmt(rs[hover], 1)}` : ''}`
      : `${rows[hover].month}: ${Y[hover]} thousand passengers`;
  return (
    <section id="series" className="card window reveal" data-title="airline-passengers.csv — 144 rows">
      <div className="head">
        <div>
          <p className="eyebrow">Series explorer · live</p>
          <h2>The seasonal swing grows as the level rises.</h2>
          <p className="sub">
            The peak-to-trough swing was {swing(firstYr)} thousand passengers in {YEARS[0]} and {swing(lastYr)} thousand in {YEARS.at(-1)}.
            When the swing scales with the level, seasonality is multiplicative, which is why the multiplicative Holt-Winters model fits better.
            Under additive seasonality the swing would stay the same size. Instead the within-year standard deviation went from {fmt(sdA, 1)} to {fmt(sdB, 1)} ({fmt(sdB / sdA, 1)}×) while the yearly mean went from {fmt(muA, 1)} to {fmt(muB, 1)} ({fmt(muB / muA, 1)}×).
          </p>
        </div>
        <Seg label="Series view" value={view} onChange={(v) => { setView(v); setHover(null); }} options={[['line', 'Timeline'], ['yoy', 'Year over year'], ['roll', 'Rolling mean and SD']]} />
      </div>
      {view === 'line' && <LineChart n={N} label="Monthly airline passengers, 1949 to 1960" series={[{ values: Y, color: 'var(--primary)' }]} ticks={yearTicks()} hover={hover} onHover={setHover} />}
      {view === 'yoy' && <LineChart n={12} label="Each year's monthly passengers overlaid by calendar month" series={YEARS.map((yr, k) => ({ values: Y.slice(k * 12, k * 12 + 12), color: palette(k), width: 1.8 }))} ticks={MONTHS.map((m, i) => [i, m])} hover={hover} onHover={setHover} />}
      {view === 'roll' && <>
        <div className="controls" style={{ gridTemplateColumns: 'minmax(0, 360px)' }}>
          <Range label="Rolling window (months)" value={win} min={3} max={36} step={1} onChange={setWin} show={win} />
        </div>
        <LineChart n={N} label={`Passengers with ${win}-month rolling mean`} series={[{ values: Y, color: 'var(--muted)', width: 1.2, opacity: 0.6 }, { values: rm, color: 'var(--primary)', width: 2.5 }]} ticks={yearTicks()} hover={hover} onHover={setHover} H={220} />
        <div className="grid2" style={{ marginTop: 8 }}>
          <div><h3>Rolling standard deviation</h3><LineChart W={460} H={170} n={N} label={`${win}-month rolling standard deviation`} series={[{ values: rs, color: 'var(--warn)' }]} ticks={yearTicks(0, N, 4)} hover={hover} onHover={setHover} /></div>
          <div><h3>SD ÷ mean (coefficient of variation)</h3><LineChart W={460} H={170} n={N} label="Rolling coefficient of variation" series={[{ values: ratio, color: 'var(--good)' }]} ticks={yearTicks(0, N, 4)} hover={hover} onHover={setHover} /></div>
        </div>
      </>}
      <div className="legend">
        {view === 'yoy' ? <><span><i style={{ background: palette(0) }} />{YEARS[0]}</span><span><i style={{ background: palette(YEARS.length - 1) }} />{YEARS.at(-1)}</span></> : view === 'roll' ? <><span><i style={{ background: 'var(--primary)' }} />rolling mean</span><span><i style={{ background: 'var(--warn)' }} />rolling SD</span></> : <span><i style={{ background: 'var(--primary)' }} />passengers (thousands)</span>}
      </div>
      <div className="tip" aria-live="polite">{tip || 'Hover the chart to read a month.'}</div>
    </section>
  );
}

function Decompose() {
  const [period, setPeriod] = useState(12);
  const [win, setWin] = useState(12);
  const [model, setModel] = useState('add');
  const [hover, setHover] = useState(null);
  const d = useMemo(() => decompose(Y, period, win, model), [period, win, model]);
  const absR = d.resid.map((v) => (v == null ? null : Math.abs(model === 'mul' ? v - 1 : v)));
  const early = mean(absR.slice(0, 36).filter((v) => v != null)), late = mean(absR.slice(N - 36).filter((v) => v != null));
  const show = (v) => (model === 'mul' ? `${fmt(v * 100, 1)}%` : fmt(v, 1));
  const panels = [
    ['Observed', Y, 'var(--text)'],
    ['Trend (centred moving average)', d.trend, 'var(--primary)'],
    ['Seasonal', d.seasonal, 'var(--good)'],
    ['Residual', model === 'mul' ? d.resid.map((v) => (v == null ? null : v - 1)) : d.resid, 'var(--bad)'],
  ];
  const ticks = yearTicks(0, N, 3);
  return (
    <section id="decompose" className="card window reveal" data-title="stl_decompose.py — classical decomposition, live">
      <div className="head">
        <div>
          <p className="eyebrow">Decomposition · live</p>
          <h2>Trend, season and what is left over.</h2>
          <p className="sub">
            Computed in your browser from the committed CSV. This is a classical moving-average decomposition, not the notebook’s STL (loess); the notebook’s STL figure is shown beside it, as recorded.
            Move the period off 12 and the seasonal panel stops lining up, so more structure leaks into the residual. The tile compares residual size in the first and last three years: additive residuals grow with the level, multiplicative ones (as a share of the level) do not.
          </p>
        </div>
        <Seg label="Decomposition model" value={model} onChange={setModel} options={[['add', 'Additive'], ['mul', 'Multiplicative']]} />
      </div>
      <div className="controls">
        <Range label="Seasonal period (months)" value={period} min={2} max={24} step={1} onChange={setPeriod} show={period === 12 ? '12 (yearly)' : period} />
        <Range label="Trend window (months)" value={win} min={3} max={36} step={1} onChange={setWin} show={win} />
        <div className="tile" style={{ padding: 12 }}><div className="hint">Mean |residual|, first vs last 3 years</div><b style={{ fontSize: 18 }}>{show(early)} → {show(late)}</b> <span className={`pill ${late > early ? 'warn' : 'good'}`}>{late > early ? 'fans out' : 'stable'}</span></div>
      </div>
      <div className="grid2">
        <div>
          {panels.map(([t, v, c]) => (
            <div key={t} style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 13 }}>{t}{t === 'Seasonal' && model === 'mul' ? ' (factor)' : ''}{t === 'Residual' && model === 'mul' ? ' (factor − 1)' : ''}</h3>
              <LineChart W={480} H={110} n={N} label={`${t} component`} series={[{ values: v, color: c, width: 1.6 }]} ticks={t === 'Residual' ? ticks : []} yZero={t === 'Residual'} hover={hover} onHover={setHover} />
            </div>
          ))}
          <div className="tip" aria-live="polite">{hover != null ? `${rows[hover].month}: observed ${Y[hover]}, trend ${d.trend[hover] == null ? 'n/a (edge)' : fmt(d.trend[hover], 1)}, seasonal ${fmt(d.seasonal[hover], model === 'mul' ? 3 : 1)}` : 'Hover any panel to read a month across all four.'}</div>
        </div>
        <figure style={{ margin: 0 }}>
          <img src={`${BASE}recorded/stl_decomposition.png`} alt="Recorded STL decomposition from the notebook: observed, trend, seasonal and residual panels" style={{ width: '100%', borderRadius: 10, background: '#fff' }} loading="lazy" />
          <figcaption className="hint">Recorded: statsmodels <code>STL(series, period=12)</code> with default settings, from <a href={blob(NB)}>cell 6</a> of the notebook. A static image, not recomputed.</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Recorded() {
  const [hover, setHover] = useState(null);
  const x0 = TRAIN - 24;
  const n = N - x0;
  const pad = (arr) => [...Array(TRAIN - x0).fill(null), ...arr];
  const params = [['alpha (level)', 'alpha'], ['beta (trend)', 'beta'], ['gamma (season)', 'gamma'], ['l0', 'l0'], ['b0', 'b0']];
  const num = (v) => (Math.abs(v) > 0 && Math.abs(v) < 1e-3 ? v.toExponential(2) : String(v));
  return (
    <section id="recorded" className="card window reveal" data-title="holt_winters.ipynb — recorded fit, recomputed forecast">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded parameters · recomputed forecast</p>
          <h2>The notebook’s fit, replayed exactly.</h2>
          <p className="sub">
            The table is recorded from the statsmodels summaries in the notebook run of {rec.run_date} (<a href={blob('results/holt_winters_recorded.json')}>holt_winters_recorded.json</a>).
            Feeding those parameters into this page’s Holt-Winters recursion reproduces the recorded training SSE to three decimals ({fmt(replay.mul.sse, 3)} and {fmt(replay.add.sse, 3)}), so the {TEST}-month forecasts below are the notebook’s forecasts, recomputed here.
            The test-set MAE and RMSE also agree with the legend of the recorded figure.
          </p>
        </div>
        <span className="pill good">✓ SSE match checked at build</span>
      </div>
      <LineChart n={n} x0={x0} label="Holt-Winters forecasts from recorded parameters against actual passengers, 1954 to 1960"
        series={[{ values: Y.slice(x0), color: 'var(--text)', width: 2 }, { values: pad(replay.mul.forecast), color: 'var(--good)', width: 2.2 }, { values: pad(replay.add.forecast), color: 'var(--bad)', width: 2.2, dash: '6 4' }]}
        ticks={yearTicks(x0, N, 1)} band={[TRAIN, N - 1]} marks={[[TRAIN, 'test starts']]} hover={hover} onHover={setHover} />
      <div className="legend"><span><i style={{ background: 'var(--text)' }} />actual</span><span><i style={{ background: 'var(--good)' }} />multiplicative</span><span><i style={{ background: 'var(--bad)' }} />additive</span></div>
      <div className="tip" aria-live="polite">{hover != null ? `${rows[hover].month}: actual ${Y[hover]}${hover >= TRAIN ? `, multiplicative ${fmt(replay.mul.forecast[hover - TRAIN], 1)}, additive ${fmt(replay.add.forecast[hover - TRAIN], 1)}` : ' (training data)'}` : 'Hover to compare forecasts with the actual month.'}</div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Recorded</th><th>Multiplicative</th><th>Additive</th></tr></thead>
            <tbody>
              {params.map(([l, k]) => <tr key={k}><td>{l}</td><td>{num(rec.multiplicative[k])}</td><td>{num(rec.additive[k])}</td></tr>)}
              {['sse', 'aic', 'bic', 'aicc'].map((k) => <tr key={k}><td>{k.toUpperCase()}</td><td>{fmt(rec.multiplicative[k], 3)}</td><td>{fmt(rec.additive[k], 3)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Test, {rows[TRAIN].month} to {rows.at(-1).month}</th><th>MAE</th><th>RMSE</th><th>MAPE</th></tr></thead>
            <tbody>
              <tr><td>Multiplicative</td><td>{fmt(replay.mul.mae, 1)}</td><td>{fmt(replay.mul.rmse, 1)}</td><td>{fmt(replay.mul.mape, 1)}%</td></tr>
              <tr><td>Additive</td><td>{fmt(replay.add.mae, 1)}</td><td>{fmt(replay.add.rmse, 1)}</td><td>{fmt(replay.add.mape, 1)}%</td></tr>
              <tr><td>Seasonal naive (baseline, added)</td><td>{fmt(snaive60.mae, 1)}</td><td>{fmt(snaive60.rmse, 1)}</td><td>{fmt(snaive60.mape, 1)}%</td></tr>
            </tbody>
          </table>
          <p className="hint">Recomputed in your browser. The seasonal-naive baseline repeats the last training year; it has no trend, so over a five-year horizon it is a weak bar, but it is the bar the notebook never set.</p>
          <p className="hint">Both fitted models have beta and gamma at or near zero: the optimiser froze the trend slope and the seasonal pattern at their start values. The notebook does not discuss this.</p>
        </div>
      </div>
      <details style={{ marginTop: 12 }}>
        <summary className="hint" style={{ cursor: 'pointer' }}>Show the recorded figure and the 12 initial seasonal indices</summary>
        <div className="grid2" style={{ marginTop: 12 }}>
          <img src={`${BASE}recorded/holt_winters_forecast.png`} alt="Recorded Holt-Winters forecast figure from the notebook, with MAE and RMSE in its legend" style={{ width: '100%', borderRadius: 10, background: '#fff' }} loading="lazy" />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Month</th><th>s (mul)</th><th>s (add)</th></tr></thead>
              <tbody>{MONTHS.map((m, i) => <tr key={m}><td>{m}</td><td>{rec.multiplicative.s0[i]}</td><td>{rec.additive.s0[i]}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  );
}

function Lab() {
  const [seasonal, setSeasonal] = useState('mul');
  const [holdout, setHoldout] = useState(TEST);
  const [p, setP] = useState({ alpha: rec.multiplicative.alpha, beta: rec.multiplicative.beta, gamma: rec.multiplicative.gamma });
  const [init, setInit] = useState({ ...rec.multiplicative, src: 'recorded' });
  const [fitInfo, setFitInfo] = useState(null);
  const train = Y.slice(0, N - holdout), test = Y.slice(N - holdout);
  const reset = (s, h) => {
    if (h === TEST) { const r = rec[KEY[s]]; setInit({ ...r, src: 'recorded' }); setP({ alpha: r.alpha, beta: r.beta, gamma: r.gamma }); }
    else { const f = fitGrid(Y.slice(0, N - h), s); setInit({ l0: f.l0, b0: f.b0, s0: f.s0, src: 'first-two-years heuristic, grid-fitted' }); setP({ alpha: f.alpha, beta: f.beta, gamma: f.gamma }); }
    setFitInfo(null);
  };
  const res = useMemo(() => holtWinters(train, { seasonal, ...p, l0: init.l0, b0: init.b0, s0: init.s0 }, holdout), [seasonal, p, init, holdout]); // eslint-disable-line react-hooks/exhaustive-deps
  const naive = useMemo(() => seasonalNaive(train, holdout), [holdout]); // eslint-disable-line react-hooks/exhaustive-deps
  const mm = metrics(test, res.forecast), mn = metrics(test, naive);
  const resid = test.map((v, i) => v - res.forecast[i]);
  const fit = () => {
    const t0 = performance.now();
    const f = fitGrid(train, seasonal);
    setP({ alpha: f.alpha, beta: f.beta, gamma: f.gamma });
    setInit({ l0: f.l0, b0: f.b0, s0: f.s0, src: 'first-two-years heuristic, grid-fitted' });
    setFitInfo({ sse: f.sse, ms: performance.now() - t0 });
  };
  const ro = useMemo(() => rollingOrigin(Y), []);
  const x0 = Math.max(0, N - holdout - 36);
  const pad = (arr) => [...Array(N - holdout - x0).fill(null), ...arr];
  const beats = mm.mae < mn.mae;
  return (
    <section id="lab" className="card window reveal" data-title="forecast_lab — live">
      <div className="head">
        <div>
          <p className="eyebrow">Holt-Winters playground · live</p>
          <h2>Tune the model, move the holdout, try to beat the baseline.</h2>
          <p className="sub">
            Every number here is computed in your browser on each change. At the notebook’s 60-month holdout the start values are the recorded ones; at any other holdout they come from the first two years (a simple heuristic, not statsmodels’ optimiser) and alpha, beta and gamma are grid-fitted.
            “Fit” searches a coarse grid of alpha, beta and gamma for the lowest training SSE.
          </p>
        </div>
        <Seg label="Seasonality" value={seasonal} onChange={(s) => { setSeasonal(s); reset(s, holdout); }} options={[['mul', 'Multiplicative'], ['add', 'Additive']]} />
      </div>
      <div className="controls">
        <Range label="alpha (level)" value={p.alpha} min={0} max={1} step={0.01} onChange={(v) => setP({ ...p, alpha: v })} show={p.alpha.toFixed(3)} />
        <Range label="beta (trend)" value={p.beta} min={0} max={1} step={0.01} onChange={(v) => setP({ ...p, beta: v })} show={p.beta.toFixed(3)} />
        <Range label="gamma (season)" value={p.gamma} min={0} max={1} step={0.01} onChange={(v) => setP({ ...p, gamma: v })} show={p.gamma.toFixed(3)} />
        <Range label="Holdout (months)" value={holdout} min={12} max={60} step={12} onChange={(h) => { setHoldout(h); reset(seasonal, h); }} show={`${holdout} (from ${rows[N - holdout].month})`} />
      </div>
      <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
        <button className="btn primary" onClick={fit}>Fit by grid search</button>
        <button className="btn ghost" onClick={() => reset(seasonal, holdout)}>Reset</button>
        <span className="hint">Start values: {init.src}. Training SSE {fmt(res.sse, 1)}{fitInfo ? ` · grid fit in ${fitInfo.ms.toFixed(0)} ms` : ''}.{fitInfo && holdout === TEST ? ' The recorded statsmodels fit, which optimises all 17 parameters, does better than this coarse grid; press Reset to restore it.' : ''}</span>
      </div>
      <div className="tiles" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="tile"><div className="num">{fmt(mm.mae, 1)}</div><div className="cap">Test MAE, Holt-Winters ({KEY[seasonal]})</div></div>
        <div className="tile"><div className="num">{fmt(mm.rmse, 1)}</div><div className="cap">Test RMSE</div></div>
        <div className="tile"><div className="num">{fmt(mm.mape, 1)}%</div><div className="cap">Test MAPE</div></div>
        <div className="tile"><div className="num">{fmt(mn.mae, 1)}</div><div className="cap">Seasonal-naive MAE <span className={`pill ${beats ? 'good' : 'bad'}`} style={{ marginLeft: 4 }}>{beats ? 'beaten' : 'not beaten'}</span></div></div>
      </div>
      <LineChart n={N - x0} x0={x0} label="Forecast lab: actual, Holt-Winters forecast and seasonal-naive baseline"
        series={[{ values: Y.slice(x0), color: 'var(--text)', width: 2 }, { values: pad(naive), color: 'var(--muted)', width: 1.6, dash: '3 4' }, { values: pad(res.forecast), color: 'var(--primary)', width: 2.4 }]}
        ticks={yearTicks(x0, N, 1)} band={[N - holdout, N - 1]} marks={[[N - holdout, 'holdout']]} />
      <div className="legend"><span><i style={{ background: 'var(--text)' }} />actual</span><span><i style={{ background: 'var(--primary)' }} />Holt-Winters</span><span><i style={{ background: 'var(--muted)' }} />seasonal naive</span></div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <h3>Forecast residuals (actual − forecast)</h3>
          <LineChart W={460} H={180} n={holdout} label="Residuals of the Holt-Winters forecast over the holdout" series={[{ values: resid, color: 'var(--bad)' }]} yZero ticks={[[0, rows[N - holdout].month], [holdout - 1, rows[N - 1].month]]} />
          <p className="hint">Residuals that drift above zero over the horizon mean the forecast under-shoots the growth; at the recorded settings they are largest in the last two summers.</p>
        </div>
        <div>
          <h3>Rolling-origin check (added)</h3>
          <p className="hint" style={{ marginTop: 4 }}>The notebook scores one split. Here each model is refit by grid search at 12 consecutive origins ({rows[ro.rows[0].cut].month} to {rows[ro.rows.at(-1).cut].month}) and scored 12 months ahead; errors are averaged.</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Model</th><th>Mean MAE</th><th>Mean RMSE</th><th>Mean MAPE</th></tr></thead>
              <tbody>
                {[['mul', 'Holt-Winters, multiplicative'], ['add', 'Holt-Winters, additive'], ['snaive', 'Seasonal naive']].map(([k, l]) => (
                  <tr key={k}><td>{l}</td><td>{fmt(ro.summary[k].mae, 1)}</td><td>{fmt(ro.summary[k].rmse, 1)}</td><td>{fmt(ro.summary[k].mape, 1)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">At a 12-month horizon the gap between the two seasonal forms is far smaller than on the single 60-month split. Origins overlap, so these are not independent tests.</p>
        </div>
      </div>
    </section>
  );
}

function Notes() {
  const items = [
    ['One split, long horizon', `The headline comparison rests on one train/test split: ${TRAIN} training months and a ${TEST}-month horizon. The rolling-origin table above is a partial fix, using this page's own grid-fitted models, not statsmodels.`, 'warn'],
    ['No uncertainty', 'There are no prediction intervals and no residual diagnostics (Ljung-Box, residual ACF). Point errors are all the notebook reports.', 'warn'],
    ['Frozen trend and season', 'Both fits put beta and gamma at about zero, so trend slope and seasonal shape never update. The notebook does not discuss it.', 'warn'],
    ['A buggy earlier cell', 'An earlier notebook cell sets test_df to the training slice, so its first pair of forecasts is never scored on real holdout data. The later cell, used here, splits correctly.', 'bad'],
    ['Chronos left out on purpose', 'The notebook’s Chronos section could not find its stock-price file, wrote a 5-row made-up one and “forecast” it. Those numbers are not evidence and are not shown.', 'bad'],
    ['Classical, not STL', 'The live decomposition is a classical moving-average method. It is not checked against the notebook’s STL, so the recorded STL figure is shown as an image only.', 'warn'],
  ];
  return (
    <section id="notes" className="card window reveal" data-title="notes.md — methods and limits">
      <p className="eyebrow">Methods and limits</p>
      <h2>What this does not show.</h2>
      <p className="sub">The forecasting exercise is textbook coursework on a well-known series. It is useful as a worked example, not as a new result. The full grading is in <a href={blob('docs/research-review.md')}>docs/research-review.md</a>.</p>
      <div className="grid2" style={{ marginTop: 16 }}>
        {items.map(([t, d, k]) => (
          <div className="tile" key={t}>
            <div className="head" style={{ marginBottom: 6 }}><h3>{t}</h3><span className={`pill ${k}`}>{k === 'bad' ? 'Excluded' : 'Caveat'}</span></div>
            <p className="hint" style={{ margin: 0, fontSize: 13 }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
