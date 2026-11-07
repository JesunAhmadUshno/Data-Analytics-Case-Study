"""Parse the recorded Holt-Winters summaries out of the notebook's saved text output.

Stdlib only, so it runs without statsmodels. Writes results/holt_winters_recorded.json
and the two recorded figures (STL plot, Holt-Winters forecast) to site/public/recorded/.

    python3 scripts/extract_recorded.py
"""
import base64
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
NB = ROOT / "time_series_airline_passengers_dataset_using_stl.ipynb"
STL_CELL, HW_CELL = 6, 14  # cell indices holding the STL plot and the Holt-Winters fit

cells = json.loads(NB.read_text())["cells"]


def text_out(cell):
    return "".join("".join(o.get("text", "")) for o in cell.get("outputs", []))


def png_out(cell):
    return next(o["data"]["image/png"] for o in cell["outputs"] if "image/png" in o.get("data", {}))


def parse_summary(block):
    num = r"(-?[0-9.]+(?:e-?[0-9]+)?)"
    head = lambda k: float(re.search(rf"{k}\s+{num}", block).group(1))
    coef = lambda k: float(re.search(rf"^{re.escape(k)}\s+{num}", block, re.M).group(1))
    return {
        "n_obs": int(head("No. Observations:")),
        "sse": head("SSE"), "aic": head("AIC"), "bic": head("BIC"), "aicc": head("AICC"),
        "alpha": coef("smoothing_level"), "beta": coef("smoothing_trend"), "gamma": coef("smoothing_seasonal"),
        "l0": coef("initial_level"), "b0": coef("initial_trend"),
        "s0": [coef(f"initial_seasons.{i}") for i in range(12)],
    }


text = text_out(cells[HW_CELL])
mul_txt, add_txt = text.split("Additive Model Summary:")
out = {
    "source": f"{NB.name}, cell {HW_CELL} text output (statsmodels ExponentialSmoothing.summary())",
    "run_date": re.search(r"Date:\s+(\w+, \d+ \w+ \d{4})", text).group(1),
    "setup": {"trend": "add", "seasonal_periods": 12, "train_months": 84, "test_months": 60},
    "multiplicative": parse_summary(mul_txt),
    "additive": parse_summary(add_txt),
}
(ROOT / "results").mkdir(exist_ok=True)
(ROOT / "results" / "holt_winters_recorded.json").write_text(json.dumps(out, indent=2) + "\n")

fig = ROOT / "site" / "public" / "recorded"
fig.mkdir(parents=True, exist_ok=True)
(fig / "stl_decomposition.png").write_bytes(base64.b64decode(png_out(cells[STL_CELL])))
(fig / "holt_winters_forecast.png").write_bytes(base64.b64decode(png_out(cells[HW_CELL])))
print("wrote results/holt_winters_recorded.json and site/public/recorded/*.png")
