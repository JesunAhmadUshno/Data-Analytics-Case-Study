# Research review

A grading of this repository against a doctoral-level bar for an empirical study, written so the gaps are visible and the cheap ones are fixed. It is coursework, so the bar is deliberately higher than the brief.

**Overall grade: C- (was D+ before the fixes below).** The question is sound but textbook. The original execution was a single Colab run: no committed data, no baseline, no uncertainty, no tests. The data, results, replay, baseline and rolling evaluation added here lift it a notch. Uncertainty and a stronger model class are still missing.

## Rubric

| Criterion | Grade | Evidence and gap |
| --- | --- | --- |
| Research question | C | "Is seasonality in the airline series additive or multiplicative, and which Holt-Winters form forecasts better?" It is clear and answerable, but it is a textbook example with a well-known answer (Box and Jenkins log-transform this series for the same reason). The notebook never states it as a question. |
| Hypotheses | D | None are stated. The implicit hypothesis is that multiplicative seasonality fits better because the swing grows with the level. The dashboard now tests this directly: the within-year SD rises faster than the mean, and additive decomposition residuals grow in later years while multiplicative ones do not. |
| Method | C | statsmodels `ExponentialSmoothing` (additive trend, additive or multiplicative season, period 12) and STL with default settings. These are reasonable choices. STL settings (`robust`, seasonal and trend windows) are not discussed. |
| Baselines | D → C | **Fixed:** a seasonal-naive baseline is now computed for the 60-month split and the rolling evaluation (dashboard, `forecast.js`). **Still missing:** naive with drift, SARIMA or ETS with automatic selection, and the log-transform plus additive model, the standard treatment for this series. |
| Statistics and uncertainty | F → D | The notebook reports point errors only (MAE/RMSE, and those only inside a figure legend). **Fixed:** MAE/RMSE/MAPE are now computed as data, and a 12-origin rolling evaluation (12-month horizon) replaces sole reliance on one split. **Still missing:** prediction intervals, residual diagnostics (Ljung-Box, ACF) and a forecast-accuracy test (Diebold-Mariano) between the two models. |
| Reproducibility | F → B- | **Fixed:** the dataset is committed with its SHA-256 and checked against the notebook's printed head and tail. The recorded parameters are parsed into `results/` by a stdlib script. A JavaScript re-implementation reproduces statsmodels' training SSE to three decimals (3,966.339 and 7,121.035) in a check that runs on every build, and `tests/test_smoke.py` runs in CI. **Still missing:** a pinned Python environment (`requirements.txt` with the statsmodels version), because the notebook itself has not been re-executed here. |
| Threats to validity | D → C | **Fixed in the docs and on the dashboard:** single split, five-year horizon from seven years of data, frozen beta and gamma (both fits put the trend slope and seasonal smoothing at about zero, never discussed), and the buggy early cell where `test_df` equals the training slice. |
| Related work | F | No citations. The minimum would be Box, Jenkins and Reinsel (the source of Series G), Holt (1957) and Winters (1960), Cleveland et al. (1990) for STL, and Hyndman and Athanasopoulos, *Forecasting: Principles and Practice*, for evaluation practice. These are standard references; they are named here rather than cited in the notebook. |
| Limitations | D → B | **Fixed:** stated in the README and in the dashboard's notes window, including the decision to exclude the Chronos section. |
| Engineering rigor | D → B- | **Fixed:** README now matches the repo. Data and results are versioned. There is a known-answer check, a smoke test and a CI workflow. **Open:** two notebooks whose names differ only by case. Renaming one is left to the owner. |

## What was invalid and is excluded

The Chronos section of the main notebook could not find `historical_stock_data.csv`, generated a 5-row dummy file and forecast that. Nothing from it is shown or claimed.

## Remaining gaps and exactly what each needs

| Gap | What closes it | Compute and data |
| --- | --- | --- |
| Prediction intervals | Simulated or analytic intervals from statsmodels `ExponentialSmoothing(...).fit().simulate()`, or ETS state-space intervals (`statsmodels.tsa.exponential_smoothing.ets.ETSModel`) | Laptop CPU, seconds. Needs `pip install statsmodels==<pinned>`. No new data. |
| Residual diagnostics | Ljung-Box on the training residuals (`acorr_ljungbox`, lags 12 and 24), residual ACF plot, Shapiro-Wilk or QQ plot | Laptop CPU, seconds, same environment. |
| Stronger baselines | SARIMA (for example the airline model (0,1,1)(0,1,1)12 on log data), auto-ETS, and log + additive Holt-Winters, all under the same rolling-origin protocol | Laptop CPU, under a minute. statsmodels only. |
| Model comparison test | Diebold-Mariano test on rolling-origin errors, multiplicative vs additive and each vs seasonal naive | Laptop CPU, seconds. A short DM implementation or `pip install` of a package that provides one. |
| Statsmodels-fitted rolling evaluation | Re-run the 12-origin evaluation with statsmodels' optimiser instead of the dashboard's grid search, and commit the per-origin errors to `results/` | Laptop CPU, under a minute. |
| Generalisation | Repeat on other monthly seasonal series (for example the M3 or M4 monthly subsets, or Tourism) to test whether the multiplicative advantage holds beyond one series | Laptop CPU, minutes. Public datasets (M4 monthly is about 48,000 series, so a sample of a few hundred is enough). |
| Environment pin | `requirements.txt` with the exact pandas, statsmodels and matplotlib versions, plus a re-execution of the notebook that is diffed against the recorded output | Laptop CPU, a few minutes including install. |
| Notebook hygiene | Remove or mark the buggy early cells and the Chronos section, and resolve the case-only filename clash | Owner decision. These are edits to or deletions of files this review did not create. |
