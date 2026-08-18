# Lecta performance baseline

Generated: 2026-08-18T17:37:49.159Z

This is an observational, reproducible baseline—not a product guarantee. It uses deterministic synthetic data, runs offline, and does not enable permanent production profiling. Run it with `pnpm benchmark:performance`; the command builds Lecta first and replaces `performance/results/latest.json` plus this report.

## Environment

- Host: DESKTOP-UP80P5A
- OS: win32 10.0.26200 (x64)
- CPU: 13th Gen Intel(R) Core(TM) i9-13900H (20 logical CPUs)
- RAM: 15.64 GiB
- Node: v24.13.0
- Electron: 43.4.0
- Lecta: 0.1.0
- Benchmark Electron flags: --disable-gpu (software rendering for headless/automated reproducibility)

## Results

| Metric                     |                  Dataset |   p50 ms |   p95 ms |              Memory |
| -------------------------- | -----------------------: | -------: | -------: | ------------------: |
| Startup → Home interactive | 5 cold isolated launches |   479.71 |   607.84 | 294.82 MiB idle p95 |
| FTS query                  |           1,000 sessions |    52.02 |    60.07 |           48.72 MiB |
| FTS query                  |          10,000 sessions | 14961.88 | 15655.51 |           52.18 MiB |
| Knowledge query            |             1,000 chunks |     4.13 |     4.55 |      50.01 MiB peak |
| Knowledge query            |            10,000 chunks |    38.06 |    38.69 |      67.39 MiB peak |
| Knowledge query            |           100,000 chunks |   350.59 |   355.86 |     203.04 MiB peak |
| Transcript read            |          10,000 segments |    23.21 |    30.61 |          111.35 MiB |

Recording fixture memory: p50 331.08 MiB, p95 332.53 MiB, growth 3.6 MiB over 4 seconds.

Knowledge index p50/p95 and coordinator event-loop lag are recorded in the JSON. Transcript write time and FTS fixture build time are also recorded separately from query latency.

## Initial budgets

- Home interactive: < 2,000 ms on target hardware.
- FTS p95: < 150 ms.
- Avoid avoidable synchronous work in Electron main > 50 ms.
- Recording memory should remain bounded and stable.

These budgets are recorded but are **not enforced** yet. Small differences do not fail CI. Hardware target, warm-up policy and run-to-run stability must be defined before introducing regression thresholds.

## Method and limitations

- Every Electron launch uses a unique temporary `userData` directory and deterministic E2E adapters. No real microphone, loopback, Whisper, AI, internet, or personal data is used.
- RAM is the sum of Electron process working sets reported by Electron; the short recording fixture detects obvious growth but does not replace a multi-hour soak test.
- FTS uses SQLite FTS5 with Lecta's tokenizer and representative pagination queries.
- Knowledge reproduces the current exact-vector SQLite scan in an isolated child process at 1k/10k/100k chunks; it measures architecture before selecting another vector store.
- Transcript measures insertion and complete ordered hydration of 10k segments in an isolated fixture process.
- Results vary with antivirus, thermal state, storage, and concurrent applications. Use several baselines on defined target hardware before treating them as regression gates.
