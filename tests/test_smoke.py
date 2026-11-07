"""Smoke test (stdlib only): python3 -m unittest discover tests

Re-runs the extractor and checks that the committed results and data are what
the notebook recorded. The JavaScript maths is checked by site/src/forecast.check.mjs.
"""
import csv
import hashlib
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Smoke(unittest.TestCase):
    def test_extractor_reproduces_committed_results(self):
        path = ROOT / "results" / "holt_winters_recorded.json"
        before = path.read_text()
        subprocess.run([sys.executable, str(ROOT / "scripts" / "extract_recorded.py")], check=True, capture_output=True)
        self.assertEqual(path.read_text(), before, "extractor output differs from the committed results file")
        r = json.loads(before)
        self.assertEqual(r["multiplicative"]["sse"], 3966.339)
        self.assertEqual(r["additive"]["sse"], 7121.035)
        self.assertEqual(len(r["multiplicative"]["s0"]), 12)

    def test_data_matches_readme_hash_and_notebook(self):
        raw = (ROOT / "data" / "airline-passengers.csv").read_bytes()
        self.assertIn(hashlib.sha256(raw).hexdigest(), (ROOT / "data" / "README.md").read_text())
        rows = list(csv.DictReader(raw.decode().splitlines()))
        self.assertEqual(len(rows), 144)
        values = [int(r["Passengers"]) for r in rows]
        self.assertEqual(values[:5], [112, 118, 132, 129, 121])
        self.assertEqual(values[-5:], [606, 508, 461, 390, 432])


if __name__ == "__main__":
    unittest.main()
