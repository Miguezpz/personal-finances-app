# Charts

Every chart amount must go through this folder (FR-045, Principle V):

- Axis ticks: `<MaskedYAxis />` instead of Recharts' `YAxis` when the axis shows money (a money X
  axis would wrap `XAxis` the same way).
- Tooltips: `<MaskedTooltip />` instead of `Tooltip`.
- Anything else (labels, legends, custom tooltip content): `useChartMoney()` → `tick(cents)` or
  `tooltip(cents)`.

They use `useMoneyFormatter`, the same formatter as `<Money>`: values are MXN cents, they are
converted to the display currency, and they become `••••` when privacy mode is on (or while
preferences hydrate with real data). Never pass a raw `tickFormatter` / `formatter` that prints
amounts — the privacy e2e (`tests/e2e/us9-privacy.spec.ts`) reads axes and tooltips too.
