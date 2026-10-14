# .lsv save import research — Phase A

This is an isolated read-only tooling spike. It is not a production importer. Only an explicitly selected file is inspected; selected member bytes remain in memory. There is no Story/progress, cloud, Supabase, persistent parser history, automatic directory scanning, save writing, archive extraction, or product entry-point integration. A package result, a decoded LSF result, and understood ECS data are separate outcomes.

## Format reference and implementation boundary

The independent implementation uses [Norbyte/LSLib](https://github.com/Norbyte/lslib/tree/6f5f6987d10d8485876b8368431c948e4dea4f83), pinned at `6f5f6987d10d8485876b8368431c948e4dea4f83`. The package reference is [PackageFormat.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/PackageFormat.cs) and [PackageReader.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/PackageReader.cs). Phase A accepts LSPK v18 only, with one archive part and without solid compression. Other versions and layouts return explicit unsupported results; they are not assumed equivalent.

The LSF probe accepts LSOF versions 6 and 7. Its 64-byte header contains a packed 64-bit engine version, five expanded/on-disk size pairs, compression metadata, and a layout indicator. The key size pair appears second in the header, while the payload order is strings, nodes, attributes, values, keys. Compact node/attribute records are 12 bytes; the adjacency records are 16 bytes. Key records are 8 bytes. These layouts come from [LSFCommon.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Resources/LSF/LSFCommon.cs) and the version boundary from [LSFVersion.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Enums/LSFVersion.cs).

The names table contains hash buckets, chains, and length-prefixed UTF-8 names. Node and attribute references resolve through that table. The resource implementation validates node ancestry, sibling links, attribute chains, value ranges, key references, and supported attribute encodings. Ordinary strings must terminate and decode as UTF-8; formatted translated strings have a bounded nested structure. It returns root names and structural counters, not attribute values. ScratchBuffer values remain opaque. The resource behavior was checked against [LSFReader.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Resources/LSF/LSFReader.cs) and [BinUtils.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/BinUtils.cs). The reported engine version reflects the header bits without a missing-version heuristic. Empty tables may contain nonzero compressed framing with an expanded length of zero, as emitted by the pinned LSLib writer. Supported zlib and raw/RLE Zstandard sections are decoded normally and must return exactly zero bytes; nonzero output, invalid framing and unsupported codecs still fail closed.

`SaveInfo.json` is fully validated by a bounded JSON scanner. It requires an object root and rejects duplicate keys after escape decoding, invalid UTF-8, malformed syntax, isolated surrogate escapes, nonfinite numbers, and unsafe integer conversions. It only reports top-level key names, value count, and maximum container depth. Prototype-shaped keys are safely stored in a `Set`; untrusted data never becomes property access or executable getters.

`Globals.lsf` decoding proves the outer resource framing and node/attribute layout only. It does not prove LSMF/ECS interpretation, character identity, equipment ownership, inventory extraction, Story state, or item acquisition. StorySave and LevelCache payload semantics are outside Phase A. Unsupported resource versions, layouts, attributes, and codecs remain explicit failures.

## Codec findings

| Codec | Phase A implementation | Limits / exclusions |
| --- | --- | --- |
| Uncompressed | Independent bounded byte reader | Exact declared length must match. |
| zlib | Runtime `DecompressionStream('deflate')` | Runtime support is feature checked; chunks are copied into a pre-sized bounded result. No JS zlib dependency is bundled. |
| LZ4 raw block | Independently authored bounded decoder | Used by v18 manifests and compressed package members; exact expanded length and valid match offsets required. A terminal match without a final literal sequence is rejected. |
| LZ4 frame | Not implemented | LSF non-string sections use framed/chunked LZ4. The resource probe rejects these instead of applying the package block decoder. |
| Zstandard raw/RLE subset | Vendored fzstd 0.1.1, preceded by exact frame/block/output-size validation | One standard frame containing only raw (type 0) or RLE (type 1) blocks. Compressed block type 2 is unsupported in Phase A, even for otherwise valid frames. Dictionaries, checksums, skippable frames, concatenation and trailing data are also unsupported. |

Zstandard compressed block type 2 fails with `unsupported-codec` before vendored decoder construction. Work review reproduced malformed compressed blocks that fzstd could accept with apparently correct-length output. The restricted subset is a fail-closed security/correctness decision: raw/RLE headers allow exact regenerated-length validation before decoding. No heuristic validation after decoding, silent fallback, or claim of general compressed-Zstandard compatibility is made.

The LSF string table uses raw LZ4, whereas other LSF sections may use framed LZ4, as shown in [LSLib Compression.cs](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Compression.cs). The `deflate` API format is the zlib wrapper rather than raw DEFLATE; its definition is in the [WHATWG Compression Standard](https://compression.spec.whatwg.org/#supported-formats). No WASM is added. There is no measurement supporting a need for WASM or a mobile-feasibility claim.

## Dependency and licensing report

Research and license findings are documented here separately from the implementation. This is a redistribution assessment of the exact inspected inputs, not a blanket claim about all code in these repositories.

| Considered dependency / reference | Exact inspected version | License and redistribution | Notices / browser bundling | Adoption |
| --- | --- | --- | --- | --- |
| [Norbyte/LSLib](https://github.com/Norbyte/lslib) | `6f5f6987d10d8485876b8368431c948e4dea4f83` | [MIT](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LICENSE); redistribution of licensed code is permitted. | Copied code requires the copyright and permission notice. No browser-specific prohibition; C# runtime itself is not adopted. Reference acknowledged here. | Authoritative format reference only; no LSLib source is vendored. Independent JS implementation. |
| [101arrowz/fzstd](https://github.com/101arrowz/fzstd) | npm `0.1.1` (UMD build) | [MIT, Copyright 2020 Arjun Barrett](https://github.com/101arrowz/fzstd/blob/4527daeb1fd8e5c3cff89262fc0d779593e5f2fd/LICENSE); redistribution is clearly permitted under its notice conditions. | MIT notice retained beside the unchanged vendored build; UMD browser bundling is permitted. No runtime transitive dependencies. | Adopted only for the restricted Zstandard raw/RLE subset, behind exact preflight and output accounting. |
| [DanFinchUK/bg3-savefile-parser](https://github.com/DanFinchUK/bg3-savefile-parser) | `9578ff7c46a1aa40c805f6b7beecf907f10fb3b8` | Python [`pyproject.toml`](https://github.com/DanFinchUK/bg3-savefile-parser/blob/9578ff7c46a1aa40c805f6b7beecf907f10fb3b8/pyproject.toml) declares MIT. No repository LICENSE covering the browser/TypeScript code was established; [`ts/parser/package.json`](https://github.com/DanFinchUK/bg3-savefile-parser/blob/9578ff7c46a1aa40c805f6b7beecf907f10fb3b8/ts/parser/package.json) is private and has no license field. | A defensible copyright/permission notice and explicit browser-code coverage remain unresolved. Browser source bundling is therefore not approved by this spike. Public source visibility is not sufficient redistribution permission. | Browser-parser research candidate only. No source, generated code, fixtures, semantic mapping data, or UI from it is adopted. |
| External JS LZ4 dependency | None selected | No dependency license to carry; raw block decoder is original code written against public format behavior. | No vendored third-party LZ4 implementation. | Not adopted. |
| External JS zlib dependency | None selected | Runtime API; no redistributed decoder dependency. | No bundled third-party zlib source. Platform implementation license remains with the platform. | Runtime `DecompressionStream` used where available. |
| WASM codec dependencies | None selected | Not downloaded or adopted. | No notices or browser bundle additions needed. | Deferred pending evidence. |

fzstd acquisition provenance: npm tarball integrity `sha512-dkuVSOKKwh3eas5VkJy1AW1vFpet8TA/fGmVA5krThl8YcOVE/8ZIoEA1+U1vEn5ckxxhLirSdY837azmbaNHA==`; vendored UMD SHA-256 `fbea1c25c4413b620ca3f59e6037d9f6c675c5c7f690e4d660143188f686461d`. The build is retained unchanged with its MIT notice. No package install hooks execute as part of vendoring.

## Security and resource limits

| Bound | Provisional cap |
| --- | --- |
| Selected file | 128 MiB |
| Manifest entries | 512 |
| Expanded single member / resource section | 128 MiB |
| Cumulative expansion per attempt | 512 MiB |
| Individual string | 1 MiB |
| Traversal / container depth | 64 |
| Worker execution | 30 seconds |
| Structural report | 10 MiB |

Overrides may only lower these caps and must be safe integers. Offsets, sizes, entry multiplication, table alignment, payload boundaries, decoded lengths, and cumulative expansion are validated before output allocation. The resource probe additionally caps names, name buckets, nodes, attributes, keys and JSON values at 65,536 each, and limits the aggregate LSF name bytes to the report cap. These extra conservative research bounds may exclude real Globals resources and need consent-based measurement before revision.

Duplicate package names, unsafe paths, overlapping archive members, split/solid packages, unsupported layouts, truncated data, malformed strings, graph cycles, shared/unreachable attributes, duplicate root/attribute names, invalid key references, and decompression-size disagreements fail closed. Resource limits are also applied to nested translated strings. JSON keys are never evaluated or attached to a general object prototype. Reader operations use checked subtraction for boundaries and BigInt for wide header values.

A worker improves responsiveness and lets cancellation terminate synchronous decoder work. It is not a hard memory sandbox. A runtime codec may have its own bounded-window/chunk allocations before application output accounting, and the selected payload plus JS strings/tables/results remain resident concurrently. Direct synchronous JSON scanning checks cancellation/time between bounded operations; the dedicated worker must still provide the outer wall-clock deadline. Exact peak memory cannot be claimed from process RSS snapshots.

Deferred localized hardening: the JSON scanner currently parses and re-encodes a string before enforcing its decoded per-string byte cap. Temporary string/encoding allocations can exceed that individual cap, although the whole-input cap and worker deadline still apply. A bounded escape-aware precheck is deferred to a separate checkpoint rather than changing JSON validation in this codec fix.

## Fixtures and validation

Permanent fixtures are generated entirely from authored synthetic bytes. No private save, thumbnail, personal character name, campaign UUID, or extracted personal metadata is included. Minimal LSF fixtures have synthetic root and attribute names and a synthetic terminated string; versions 6 and 7 both exercise a real node, attribute and key record. The compact layout, zlib sections and supported raw/RLE Zstandard frames are exercised separately, including compressed-empty attribute/value/key tables. The shared fixture builder declares header pairs in strings/keys/nodes/attributes/values order and emits physical payloads independently in strings/nodes/attributes/values/keys order. A fixed five-nonempty-section vector checks exact offsets and is parsed by both LSF v6 and v7 readers.

The resource tests cover JSON prototype-shaped keys, escaped-equivalent duplicates, unsafe numbers, malformed syntax, invalid encoding, cancellation and limits; LSF header/version/codec/layout rejection, malformed table/value references, truncated sections, extra bytes, attribute byte lengths and UTF-8 strings, parent/sibling/attribute cycles, nesting, shared expansion budgeting, and supported decoding. Package/worker tests and benchmark results are recorded below after the final verification run.

No real-save fixture was explicitly supplied for this spike. No real-save benchmark or gameplay-semantic claim is made. A future consent-based fixture must remain outside the repository, with only sanitized structural measurements recorded. The current proof does not establish representative real-save compatibility or phone/tablet memory feasibility.


## Running the isolated tooling

Run the synthetic runtime benchmark from the repository root:

```sh
node experiments/lsv/benchmark.cjs
node --test tests/lsv-spike.test.cjs tests/lsv-resource.test.cjs tests/lsv-worker.test.cjs tests/lsv-fixtures.test.cjs
```

The benchmark only generates synthetic data and writes its report to stdout. It has no real-save path argument or save discovery. Its medium fixture always uses authored raw Zstandard blocks within the supported subset, regardless of native encoder availability. It no longer measures compressed block type 2. The changed fixture is larger than the pre-fix native-compressed fixture, so earlier timings and memory samples are not directly comparable.

The browser workbench needs a localhost static server with `.cjs` served as JavaScript; `file://` is not the supported worker-launch path. This development-only command serves a fixed set of spike assets, allows GET only, binds loopback, and does not accept uploads or inspect filesystem directories:

```sh
node - <<'NODE'
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const base = path.resolve('experiments/lsv');
const files = new Set(['workbench.html','controller.cjs','worker.cjs','parser.cjs','resource.cjs','vendor/fzstd-0.1.1.js']);
http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname.slice(1);
  if (req.method !== 'GET' || !files.has(name)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type':name.endsWith('.html')?'text/html':'text/javascript','Cache-Control':'no-store'});
  res.end(fs.readFileSync(path.join(base,name)));
}).listen(8765,'127.0.0.1',()=>console.log('http://127.0.0.1:8765/workbench.html'));
NODE
```

The controller creates a dedicated worker for each selection. Cancellation, file replacement and page exit terminate it. Responses must match the active worker, attempt ID, request ID and unexpired execution deadline. The 30-second budget accumulates active request time and excludes idle time while waiting for explicit member selection. A late response is rejected even if the timeout callback has not yet run. No polling/retry loop is used.

For File/Blob input, structured cloning retains immutable file contents and the parser slices only header/manifest and explicitly selected payload ranges. For an ArrayBuffer or full typed-array view, the controller transfers ownership and detaches the supplied buffer; a partial view is copied to its exact range before transfer. This does not modify the original file on disk. Selected output buffers are transferred back. The workbench displays member names and structural counters, never attribute values, thumbnails, or character/inventory interpretations; results are cleared on cancellation and page exit.

The package header MD5 is not verified in Phase A. Successful inspection is a bounded structural result within the supported subset; it is not authenticated package integrity, game-load compatibility, or proof of gameplay semantics. Checksummed Zstandard frames are rejected rather than silently treating skipped checksum bytes as verified.

## Observed verification and benchmarks

Tests-first baseline: 77 package regressions failed before the core existed. Worker/resource tests were also introduced before their modules. The focused blocker checkpoint added 26 permanent cases and exposed 20 failures across the separately run codec/resource/fixture baselines (17 new cases, one changed codec-policy expectation, and two existing compressed-LSF cases exposed by removing the empty-compression bypass). Final permanent coverage adds 165 tests: 108 package/codec/security, 33 resource, 16 worker/controller and 8 independent fixture-layout tests. The complete suite passed **1,664/1,664**. The original tracked suite was also run independently and passed **1,499/1,499**. Both runs had zero failures, skips or cancellations. All existing tracked product files remain byte-identical to HEAD.

Synthetic fixtures include genuine raw LZ4 matches, zlib streams with checksum checks, standard raw/RLE Zstandard frames and an independent native-encoded compressed-block vector that is now explicitly rejected. Both exact malformed compressed frames from review are rejected before vendored decoder construction through direct decoding and package-member reads. Supported raw/RLE block output sizes are checked before decoding even when the frame has no content-size field. Worker tests execute actual classic-worker imports, transfer buffers and probe forbidden network/storage/extraction APIs.

A disposable Chrome 150.0.7871.115 profile served only the fixed localhost spike assets. **34/34 native-browser checks passed**, including both exact malformed compressed-block rejections, supported compressed-empty LSF tables, declared-zero/nonzero output rejection, corrected five-section fixture parsing, terminal-match LZ4 rejection, normal member reads, cancellation and replaced attempts. No existing profile or auth session was reused. Persistent storage and cookie access were blocked; only static localhost GET requests were allowed. No Supabase or network writes occurred.

The medium benchmark now uses raw Zstandard blocks. Every Node selected-member output matched its expected synthetic hash. No pre-fix compressed-block benchmark is presented as evidence for the narrowed implementation.

| Synthetic fixture | Package size | Browser manifest parse | Cumulative active worker time | Node manifest parse | Node read/benchmark completion |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tiny: 6 named member families | 1,955 bytes | 6.1 ms | 398.4 ms | 1.6 ms | 2.1 ms |
| Medium: 4 codec members, each 8 MiB | 25,300,762 bytes | 5.7 ms | 1,069.6 ms | 16.8 ms | 188.4 ms |

Browser selected-member read/decompression for medium 8 MiB outputs: uncompressed 33.8 ms; zlib 36.9 ms; raw LZ4 54.3 ms; raw-block Zstandard 576.0 ms. The browser run overlapped two CPU-intensive test suites, so these are contended single-run observations, not performance guarantees or comparisons with the old compressed-block fixture. Active worker time includes startup/message delivery and excludes idle member selection. The full automated medium exercise took approximately 32.3 seconds, including those idle/automation delays.

Node v24.19.0 on this macOS x64 runtime sampled process RSS at 136.0 MB near the tiny run and a maximum sample of 161.8 MB during the medium run. Fixture generation and retained inputs are included. This is not a true peak, not a worker-specific measurement and not a mobile memory budget. No reliable native-browser worker peak-memory measurement was available. Real-save and phone/tablet benchmarks remain unperformed: no real/private save was parsed and no physical mobile test was performed.

## Phase B recommendation

Proceed only to a separate isolated compatibility/hardening checkpoint. Obtain explicitly consented save copies outside the repository, measure actual package/resource shapes and memory, and implement bounded framed-LZ4 support where needed before claiming real-save resource coverage. Phase B may expose additional unsupported codec/layout cases, including ordinary Zstandard compressed blocks; supporting them requires a separately reviewed strict bounded decoder, not restoring the permissive path. Keep unknown versions/codecs explicit. Retain the current research table limits until measurements justify reviewed adjustments. Parser history, uploads, directory watching, Story mapping, progress application and optimizer integration remain deferred. No production integration or dependency on DanFinch's ambiguously covered browser code is approved by this spike.
