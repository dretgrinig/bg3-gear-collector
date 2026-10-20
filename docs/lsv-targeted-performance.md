# Targeted evidence performance and stability (synthetic only)

This uncommitted research checkpoint preserves ownership and instance continuity
as **unknown**. It does not authorize another private measurement. Owned Gear
Import Preview remains blocked.

## Scope and baseline

The inspector is already committed at
`30e70bb6e4f2ff65efb78bd495d79751ffdedf55`. Its `resource.cjs`, the
parser, codecs, controller, Worker protocol and all limits remain byte-identical.
The approved six-file evidence checkpoint was preserved, not restarted.
Only its Node adapter's trusted Worker bootstrap changed; its source verification,
exact selection, cancellation/error handling, B-before-A gates and projection did
not change. A SHA-256-locked copy of the approved adapter is a test-only oracle.

## Retained changes

1. The restricted Node VM loader binds the **same** Math, Number, Date, Array,
   Object and String objects as lexical parameters of each fixed source module.
   It does not supply new privileges, change intrinsic implementations, execute
   payload text, remove the VM, or modify parser/codec bytes. Ordinary global
   object lookup overhead was material in the isolated pipeline. Clock/check
   functions are still called at every original site.
2. The Node-only yield host uses `setImmediate` for zero-delay awaits, retaining
   every yield site/cadence and all deadline/cancellation checks. Positive delays
   use timers. There is one opaque live handle reservation; it is released before
   invoking the callback or when cancelled. No payload, index or data-derived
   cache is held. A WeakMap holds at most one live entry; callbacks/handles are
   attempt-local and disappear when the disposable Worker terminates.

The scheduler is a next-event-loop-turn mechanism, **not** a microtask chain.
Node documents the event-loop and cancellation contract in its
[v24.19.0 timer documentation](https://nodejs.org/download/release/v24.19.0/docs/api/timers.html#setimmediatecallback-args).
The host reservation is not a second decoding/work allowance. No data prepass,
name cache, structural index or new bookkeeping allocation was introduced. Logical
record/byte/evidence charges and memory reports are identical to the oracle.

The implementation remains Node research-only. Browser resource/Worker bytes
are unchanged; no browser performance gain is claimed from this Node host change.
The VM is a restriction around fixed trusted research code, not a security
sandbox for arbitrary hostile JavaScript.

## Method and reproducibility

`profile-lsv-targeted.cjs` fabricates its own temporary read-only measurement
source; it accepts workload enums, never private source paths/bytes/selectors.
The ordinary adapter's complete `measure()` path is used, with a new Worker/VM
per attempt. Baseline uses pinned inspector source and the frozen adapter;
current uses current code. Fabrication, encoding and profiling-harness setup are
reported separately, outside the measurement. Source read/hash, Worker startup,
cloning, extraction, validation, projection and final verification are inside the
same ordinary adapter elapsed/deadline interval. Worker termination latency is
reported separately. All sources are verified unchanged and removed afterward.

Only the synthetic harness rewrites an in-memory code copy for optional timing.
Every transformation rejects marker drift. There is no instrumentation switch
in the ordinary measurement adapter. Fixed numeric stage aggregates are capped
at 32; no per-record or scalar logs exist. Synthetic phase messages are intercepted
by the harness and never delivered to the ordinary controller as results.
CPU profiling emits only the top 24 function-name/sample-duration aggregates.
No private source or diagnostic was read.

Stages include archive validation/member lookup, outer extraction/decompression,
LSF layout/framing preflight, each section decode, names, typed bookkeeping,
nodes, attributes/values, parent/cycle/depth checks, duplicate resolved names,
coverage, selection, contexts, selected descriptors and serialization.
Host timings cover source preparation/verification, projection, Worker
construction, first phase delivery, request posting and result arrival.
Fine value validation uses deterministic 1/1024 samples, reported as **sampled
durations only**, not extrapolated totals. Context spans are nested in selection.
Yield count/wait is also recorded per stage. CPU samples are observations of
sampled execution, not instruction counts or exact CPU consumption.

Stage wall spans include waits. Wall minus measured yield waits is an exclusive
estimate with respect to those waits only, not CPU time. Outer extraction includes
the in-memory member read and decoder; archive validation includes lookup.
Clone/delivery residuals are not presented as precisely separable CPU costs.
No peak heap/RAM measurement is claimed.

Benchmarks run sequentially, without competing heavy jobs. All Workers are fresh;
there are **no warm reused Worker** samples. First/repeat samples refer to a warm
host/module/file-cache environment, not proven cold OS caches or CPU conditions.
Each primary workload has three uninstrumented samples per variant: first sample
plus two repeats. These are small experimental samples, not a population p95.

Commands (Node 24.19.0 supplies the synthetic Zstd encoder):

```sh
node scripts/benchmark-lsv-targeted.cjs repeat
node scripts/benchmark-lsv-targeted.cjs matrix
node scripts/benchmark-lsv-targeted.cjs shapes
node scripts/benchmark-lsv-targeted.cjs overhead
node scripts/benchmark-lsv-targeted.cjs stability
```

The committed decoder remains the oracle-independent decoder under test;
encoding uses fabricated recipes/native Zstd, not decoder-produced expected data.

## Repeated end-to-end timings

Milliseconds; uninstrumented actual isolated adapter:

| Workload | Baseline samples | Baseline median | Optimized samples | Optimized median | Improvement |
|---|---|---:|---|---:|---:|
| medium Stats sparse | 2931.14, 2905.36, 2969.46 | 2931.14 | 418.54, 444.08, 493.52 | 444.08 | 84.85% |
| observed Stats sparse | 27930.82, 27909.53, 29015.24 | 27930.82 | 3177.30, 3305.49, 3243.01 | 3243.01 | 88.39% |

Observed scale is 543,108 nodes / 1,024,178 attributes. Primary baseline range:
27,909.53–29,015.24 ms; optimized: 3,177.30–3,305.49 ms. Optimized spread is
128.19 ms. The primary worst run retains 26,694.51 ms of the existing deadline.
The heavier combined/repeated optimized case took 5,020.58 ms; its baseline
hit TIMEOUT. Genuine match-bearing LZ4 observed scale contained 818,114 authored
matches: baseline TIMEOUT, optimized 3,900.64 ms. Those timed-out baselines are
failures, not censored successful timings or evidence that they nearly finished.
No optimized normal matrix case timed out.

Direct resource and ordinary Node Worker controls stayed approximately
7.5–7.7 seconds at observed scale. They are diagnostic controls, not substitutes
for the actual isolated adapter. Their existing timer waits remain unchanged.
The improvement is in the actual isolated adapter, not a microbenchmark-only win.

## Stage and work evidence

Single instrumented observed-scale profiles, milliseconds; nested totals must not
be added again. These explain cost direction, not the repeated timing statistic:

| Stage | Baseline wall | Optimized wall |
|---|---:|---:|
| setup | 15.75 | 13.50 |
| archive | 3.57 | 2.89 |
| outerDecompression | 11759.52 | 747.08 |
| layout | 0.57 | 0.41 |
| framePreflight | 25.11 | 2.50 |
| decode_strings | 0.13 | 0.06 |
| decode_nodes | 134.33 | 9.68 |
| decode_attributes | 269.05 | 17.23 |
| decode_values | 403.38 | 28.30 |
| names | 0.32 | 0.39 |
| indexes | 2.62 | 2.53 |
| nodes | 1600.50 | 141.62 |
| attributesValues | 4384.36 | 919.44 |
| parents | 1219.61 | 121.79 |
| duplicates | 3192.09 | 424.66 |
| coverage | 1308.42 | 83.11 |
| selection | 3858.62 | 584.73 |
| selectedDescriptors | 1394.18 | 117.01 |
| serialization | 0.23 | 0.15 |

- Yields: **3,449 → 3,449**. Summed scheduled-to-resumed wait:
  **4,063.85 → 121.89 ms**. No cadence reduction occurred.
- Primary work: **19,633,126** including **48** projection steps, unchanged.
- Expansion: **75,945,210 bytes**; decoded sections **37,909,852 bytes**.
- Bookkeeping peak accounting: **7,483,831 bytes**; retained evidence **4,096 bytes**.
  These are implementation accounting, not measured peak heap/RAM.
- Combined/repeated work: **20,114,759**, unchanged where the oracle finishes
  (same conservative algorithm; the observed baseline timed out before a report).
- No 24M work, 30s time, structural, evidence, output or generic cap was raised.

The baseline outer path used 11.76 s (about 40% of its instrumented interval),
attribute/value checks 4.38 s, selection 3.86 s and duplicate checks 3.19 s.
These scale primarily with compressed content, attributes and nodes respectively.
CPU sampling pointed to guard calls and decoder bit operations under VM global
lookup. Binding the identical intrinsics removes physical lookup overhead, not
validation. Required attribute/value checking now leads the profile (~0.92 s),
followed by outer decoding (~0.75 s), selection (~0.58 s) and duplicates (~0.42 s).
Serialization/projection/startup are not dominant at this evidence size.

## Instrumentation overhead

Three paired medium samples per mode/variant, with ordinary fresh Workers:

| Variant | Off median/range ms | On median/range ms | Median difference |
|---|---:|---:|---:|
| Baseline | 2948.63 / 2922.19–2994.09 | 2998.00 / 2911.54–3000.79 | +49.37 ms / 1.67% |
| Optimized | 428.96 / 427.81–505.99 | 432.58 / 426.09–433.27 | +3.62 ms / 0.84% |

Ranges overlap; these are observed differences, not exact causal overhead or
confidence bounds. CPU sampling is a separate diagnostic sample and excluded
from those statistics. The headline result uses instrumentation OFF.

## Experiments and stopping point

- Lazy value views plus reusable duplicate-name Sets: medium median 2933.17 ms
  versus baseline 2931.14 ms, within noise. **Reverted**, no claimed benefit.
- Local guard intrinsic references: medium median 2293.79 ms, initially useful.
  **Reverted as redundant** once loader bindings supplied the benefit while
  preserving inspector bytes entirely.
- Fixed lexical loader bindings and next-turn host scheduling: retained after
  repeated actual-path improvement and differential/stability tests.
- Name interning, larger caches, merged validation passes, reduced yield cadence
  and codec algorithm changes: not justified by remaining cost/risk; not added.

Every logical work charge and every structural validation remains. Malformed or
unsupported selected/unselected data still rejects. Different name references
resolving to the same text still reject as duplicates. No candidate selection
moves before global validation. No identity, holder or ownership semantics change.

## Stability and adversarial review

Three measured cancellations per variant: baseline caller rejection
0.90–1.82 ms; optimized 0.73–1.14 ms. Actual Worker termination was separately
observed: baseline 1.23–6.77 ms, optimized 1.25–5.01 ms. These small samples show
no observed regression, not a universal latency guarantee.

Actual validated Worker responses were deliberately held past a lower 1,000 ms
parent deadline: both variants returned TIMEOUT without observations, before
accepting overdue success. Fresh-attempt recovery, cancellation races, source
changes/replacement, detached input, accessor rejection, limit boundaries,
prototype-sensitive names, multiplicity and schema privacy remain covered.

Self-review strengthened three synthetic-only issues: a sparse UUID fixture
initially had no UUID hit; match-bearing workloads initially made only literals;
and permissive source-marker replacements could silently omit instrumentation.
Positive-hit/match assertions and fail-closed transforms now guard those cases.
Preset sizes are deeply frozen. Delay coercion cannot invoke getters or leak a
scheduler reservation. No quadratic record pairing or unbounded data cache exists.

## Verification

- New permanent performance/stability regressions: **90/90**.
- Combined targeted inspector/evidence/performance: **267/267**.
- Structural/resource/relation/pair: **178/178**.
- Full LSV: **894/894**; complete repository: **5,719/5,719**.
- Packaging: **15/15**, exactly **42** public files identical to HEAD/source/dist.
- Native Chrome 150.0.7871.115: **70/70** (41 inspector, 21 evidence,
  8 scale/stability), zero runtime/console errors or unexpected requests.
- Native observed-scale baseline/current outputs matched exactly. Existing
  browser timings were 21.54–23.61 seconds; there is no browser speedup claim.
  Browser cancellation rejection was 0.30 / 0.10 ms (one sample per variant).
- Offline synthetic result audit: 18 equivalent validated matrix/shape pairs,
  3 equivalent intentional failure pairs, 2 baseline timeout/current success
  cases, and 3 identical primary repeated-output pairs. No timed-out result is
  treated as validated evidence.
- All final groups ran once on the frozen final code. Tests used fabricated
  data; Native QA used fresh contexts with storage disabled and loopback only.
- All tracked files unchanged. Diff/whitespace/privacy checks pass, including
  untracked files. No private saves/diagnostics/selectors were read.
- Code self-review completed: fixed intrinsic identities, same guards/charges,
  bounded single-live-yield state, no source-integrity or validation shortcut.
- Whole-checkpoint verdict: **ready for Work review**, not authorization for a
  private run. Ordinary adapter instrumentation remains disabled/absent.

## Remaining limitations and next gate

Synthetic compressed data does not reproduce private entropy or every real
schema/value distribution. No private save, diagnostic payload or selector file
was read. The previous private B timeout remains the only private measurement.
No A read occurred. Supported-surface findings, ownership and instance continuity
remain unknown; no ECS/holder contract or Owned Gear Import Preview is enabled.

The repeated synthetic headroom is substantial, not a proof about B. Keep 30s
and 24M unchanged. Work approval must precede one separately authorized B
remeasurement of the already caller-confirmed exact member. No automatic A read
or retry is authorized by these benchmarks. A future B failure must stop normally.
No architectural hard stop was reached; no generic parser/codec change is needed
for this checkpoint. Private input complexity could still hit an unchanged limit.

## Files

- `docs/lsv-targeted-evidence.md`
- `docs/lsv-targeted-performance.md`
- `experiments/lsv/targeted-evidence.cjs`
- `experiments/lsv/worker-scheduling.cjs`
- `scripts/benchmark-lsv-targeted.cjs`
- `scripts/measure-lsv-targeted-evidence.cjs`
- `scripts/profile-lsv-targeted.cjs`
- `scripts/qa-lsv-targeted-evidence.cjs`
- `scripts/qa-lsv-targeted-performance.cjs`
- `tests/fixtures/lsv-evidence-adapter-baseline.cjs`
- `tests/helpers/lsv-performance-fixtures.cjs`
- `tests/lsv-targeted-evidence-worker.test.cjs`
- `tests/lsv-targeted-evidence.test.cjs`
- `tests/lsv-targeted-performance-worker.test.cjs`
- `tests/lsv-targeted-performance.test.cjs`

All work stays uncommitted/unpushed. No PR, deployment, backend/Supabase,
Story/progress/ownership write, product change or main change occurred.
