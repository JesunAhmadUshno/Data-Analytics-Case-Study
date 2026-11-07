# Data-Analytics-Case-Study

Live dashboard: https://jesunahmadushno.github.io/Data-Analytics-Case-Study/

A time-series forecasting case study for DA510 / CS510 / BI510. It decomposes the classic monthly airline-passengers series (144 months, 1949-1960, Box-Jenkins Series G) with STL, then compares additive and multiplicative Holt-Winters models on an 84-month training / 60-month test split.

## What is in the repo

| Path | What it is |
| --- | --- |
| `time_series_airline_passengers_dataset_using_stl.ipynb` | Main notebook: STL decomposition, then additive vs multiplicative Holt-Winters (statsmodels), then an abandoned Chronos attempt (see caveats). |
| `time_series_airline_passengers_dataset_using_STL.ipynb` | Earlier, STL-only version of the same notebook. |
| `data/airline-passengers.csv` | The exact 144-row file the notebooks read, with source and SHA-256 in `data/README.md`. |
| `results/holt_winters_recorded.json` | Fitted parameters and SSE/AIC/BIC/AICc parsed from the notebook's recorded output by `scripts/extract_recorded.py`. |
| `site/` | The live dashboard (React + Vite, hand-written SVG charts). |
| `docs/research-review.md` | An honest grading of the study and what it would take to strengthen it. |

## Recorded result

On the training months, the multiplicative model fits with about half the error of the additive one (SSE 3,966.339 vs 7,121.035; AIC 355.802 vs 404.959, comparable because both are fitted to the same data). The numbers come from `results/holt_winters_recorded.json`.

## Reproduce

```bash
python3 scripts/extract_recorded.py          # re-parse the recorded results (stdlib only)
cd site && npm ci && npm run build           # runs the known-answer check, then builds
```

`npm run build` first runs `site/src/forecast.check.mjs`. It confirms that the JavaScript Holt-Winters recursion, fed the recorded parameters, reproduces the notebook's training SSE to three decimals and the MAE/RMSE printed in the recorded figure. It also checks the data against the notebook's printed head and tail.

## Caveats

- **One split.** The comparison rests on a single 84/60 split with no prediction intervals. The dashboard adds a seasonal-naive baseline and a 12-origin rolling evaluation, both computed in the browser.
- **Chronos section is not a result.** The notebook's Chronos attempt could not find its stock-price file, generated a 5-row dummy file and forecast that. Treat it as abandoned, not as evidence.
- **Buggy earlier cell.** An earlier cell sets `test_df` to the training slice. The later cell that produces the recorded results splits correctly.
- **Notebook names differ only by letter case.** On macOS or Windows checkouts only one of them will appear. Renaming one is a decision left to the owner.
- Earlier versions of this README listed SQL, Excel, Power BI and `/models`, `/sql`, `/visualizations` folders. None of those exist, so they have been removed from the description.

## Contributors

Jesun
