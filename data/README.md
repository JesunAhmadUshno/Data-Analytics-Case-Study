# Data

`airline-passengers.csv`: monthly totals of international airline passengers (thousands), January 1949 to December 1960, 144 rows.

- Original source: Box, G. E. P., Jenkins, G. M. and Reinsel, G. C., *Time Series Analysis: Forecasting and Control*, Series G.
- Copy used: the mirror the notebooks read at runtime, `https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv`, fetched once on 7 Nov 2026 and committed byte for byte (CRLF line endings, no trailing newline).
- SHA-256: `8cb51be753a718d9be5d76d7e238cc224792754676adc21faa59e954b0201621`
- Check: the first five rows (112, 118, 132, 129, 121) and last five rows (606, 508, 461, 390, 432) match the table printed in cell 3 of `time_series_airline_passengers_dataset_using_stl.ipynb`.

Verify with `sha256sum data/airline-passengers.csv`.
