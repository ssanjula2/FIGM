# Stage 9 command log (exact commands run, in order)

```
git rev-parse HEAD
git rev-list -n 1 research-freeze-v5
git status --short
node --version
npx lighthouse --version
# (PowerShell) Chrome ProductVersion, CPU, RAM, machine model/manufacturer, Win32_Battery, OS caption

git diff --stat research-freeze-v5 HEAD          # confirmed docs-only diff before this stage began
git checkout research-freeze-v5                  # detached HEAD, byte-identical source tree to the tag

rm -rf .next
npm run build                                     # clean production build, exit 0

npx next start -p 4174                            # pre-flight server
curl http://localhost:4174/rq1-experiment
curl http://localhost:4174/rq1-experiment/csr-local
curl http://localhost:4174/rq1-experiment/csr-global
curl http://localhost:4174/rq1-experiment/ssr-local
curl http://localhost:4174/rq1-experiment/ssr-global
# all 200, no error/debug overlay content; pre-flight server killed (taskkill /T /F on the real listening PID)

node --import tsx research/rq1-experiment/scripts/run-experiment.ts --port 4173
# REAL measurement run, unmodified frozen runner, protocol.json defaults (1 warmup + 10 measured x 4
# conditions, sequential CSR_LOCAL -> CSR_GLOBAL -> SSR_LOCAL -> SSR_GLOBAL), exit 0, 44/44 OK, 0 FAILED

# Identify exactly the 44 new files (diffed against a pre-run snapshot of raw-results/*.json)
# Copy those 44 files into raw-results/STAGE9_REAL_RUN_20260903T192350Z/raw/ (originals left in place)

node --import tsx <scratchpad validate-and-manifest script>
# imports schema.ts's isValidRawResultRow (read-only) to validate all 44 new rows, checks for
# duplicate run ids, writes metrics.csv and run-manifest.json into the evidence dir

cp research/rq1-experiment/processed-results/summary.{json,md} <backup>   # back up the v1 baseline output first
node --import tsx research/rq1-experiment/scripts/analyze-results.ts --dir research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/raw
# unmodified frozen analysis pipeline; writes processed-results/summary.{json,md}
cp research/rq1-experiment/processed-results/summary.{json,md} research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/
cp <backup>/summary.{json,md} research/rq1-experiment/processed-results/            # restore v1 baseline output
sha256sum research/rq1-experiment/processed-results/summary.{json,md}              # confirmed identical to pre-run hashes
```

No file under `research/rq1-experiment/scripts/`, `app/rq1-experiment/`, or `research/rq1-experiment/protocol.json`
was modified at any point. All new content is additive: 44 raw JSON files (copies) plus this
evidence directory's own manifest/CSV/summary/environment files.
