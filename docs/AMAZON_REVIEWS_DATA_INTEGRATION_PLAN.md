# Amazon Reviews 2023 Dataset Integration

Status: DATA-00 through DATA-15 completed and verified on 2026-08-02. This document is the authoritative implementation record and operating runbook for the current dataset. It does not authorize PERS-03 through PERS-09 or any new recommender algorithm.

Audience: backend and frontend maintainers, course assessors, and operators of the classroom MongoDB database.

Source of truth: the committed manifest/configuration/aggregate summary under `data/amazon-reviews-2023/`, the dataset scripts in `scripts/`, the DATA models and repositories in `src/`, and the live verification commands in this document. Recheck upstream availability and terms before acquiring the source again.

## Executive Summary

The active MongoDB catalog is now a deterministic vinyl subset of Amazon Reviews 2023 `CDs_and_Vinyl` 5-core data. It contains 2,305 products and a separate historical-evidence collection with 20,288 ratings from 2,387 HMAC-pseudonymized users. The three Groovehaus showcase customers remain exactly `demo-jazz`, `demo-rock`, and `demo-soul`; historical identities are not customer accounts.

The integration is additive and reversible. The original 116 reviewed Groovehaus records remain stored and become active again when the dataset activation pointer is rolled back to `legacy`. Raw source files, staging outputs, reviewer identifiers, review text, and Amazon images are not committed. Dataset products use nullable store-specific fields and are non-purchasable when price or stock is unknown.

Historical data is ready for leakage-safe evaluation input, but this is a data-readiness result only. The deployed ranker remains `content-demo-v1`; saved preferences and behavior still do not affect ranking, and no recommendation-quality metric is claimed.

## Source, Terms, And Citation

- Dataset: [Amazon Reviews 2023](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023), `CDs_and_Vinyl` category.
- Pinned revision: `2b6d039ed471f2ba5fd2acb718bf33b0a7e5598e`.
- Benchmark input: the official [rating-only 5-core data](https://amazon-reviews-2023.github.io/data_processing/5core.html).
- Research paper: Hou et al., [Bridging Language and Items for Retrieval and Recommendation](https://arxiv.org/abs/2403.03952), published 2024-03-06.
- Terms boundary: the dataset publisher states that it cannot grant a dataset license in the official [license discussion](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/discussions/1). The repository therefore makes no permissive-license claim and commits no raw source data.

The pinned source manifest records exact URLs, byte counts, SHA-256 digests, retrieval time, terms status, and citation. A changed upstream file fails closed until the manifest and transformation decision are reviewed as a new version.

## Data Classification

| Data | Classification | Storage and exposure |
| --- | --- | --- |
| 116 Groovehaus records and reviewed artwork | Curated legacy demo data | Committed source/assets and preserved MongoDB records. |
| Amazon metadata and rating-only 5-core files | External research source | Local ignored `raw/` only; never committed. |
| 2,305 canonical products | Source-derived data | MongoDB `vinylRecords`, tagged by dataset key/version and field provenance. |
| 20,288 historical ratings | Source-derived evidence | MongoDB `historicalAmazonRatings`; no TTL because this is a versioned offline evidence asset. |
| 2,387 historical user keys | Derived pseudonyms | HMAC-SHA-256 keys only; not `User` records and not public. |
| Missing artist, store price, stock, condition, and format | Unknown, not simulated | Stored as `null`; UI labels the limitation and blocks purchase where required. |
| Three showcase customers | Curated demo identities | Unchanged `User` records: `demo-jazz`, `demo-rock`, `demo-soul`. |

Review titles, review bodies, reviewer profiles, source reviewer IDs, verified-purchase claims, and downloaded Amazon product images are excluded. `verifiedPurchase` is `null` because the rating-only source does not provide it.

## Reproducible Source Boundary

Committed files:

- `data/amazon-reviews-2023/source-manifest.json`
- `data/amazon-reviews-2023/transformation-config.json`
- `data/amazon-reviews-2023/data-quality-summary.json`
- `data/amazon-reviews-2023/README.md`

Ignored files:

- `data/amazon-reviews-2023/raw/`
- `data/amazon-reviews-2023/staging/`

Validated source artifacts:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `meta_CDs_and_Vinyl.jsonl` | 948,861,684 | `c52275a5bce63bf293f987bff5ff1f2b268982797545f3df2b7662ab638e8aec` |
| `CDs_and_Vinyl.5core.csv.gz` | 21,466,396 | `53811902ffb01eb22da31a35e0775f3b8351baebe7e1ab38b85b6c4aee689c20` |

The streaming parser bounds JSONL lines at 2 MiB, validates source hashes before transformation, and never loads the full metadata or ratings source into memory.

## Deterministic Transformation

The committed configuration pins:

- vinyl classifier `details-and-category-v1`;
- external-item-key-ascending product selection;
- HMAC-key-ascending user selection;
- most-recent-source-row duplicate handling;
- per-user leave-last-two split;
- rating `>= 4` as positive evaluation relevance;
- a three-interaction train-only core after domain filtering;
- no review text and no product images.

The source is globally 5-core before splitting. Vinyl-domain filtering makes a post-filter 5-core too destructive, so the reviewed plan uses a three-interaction training core and records that choice in the configuration digest. Stable product public IDs occupy the reserved numeric range 100000-899999 and are derived deterministically while preserving legacy public IDs through 244. Historical reviewer identities use keyed HMAC-SHA-256 with `DATASET_PSEUDONYM_KEY`, falling back to a sufficiently long `AUTH_SECRET`; a key fingerprint detects incompatible reruns without storing the key.

## Profile And Staging Evidence

| Measure | Observed value |
| --- | ---: |
| Metadata rows | 701,959 |
| Rating rows | 1,552,764 |
| Source users | 123,876 |
| Source products | 89,370 |
| Vinyl candidates | 3,022 |
| Staged products | 2,305 |
| Pseudonymous historical users | 2,387 |
| Staged ratings | 20,288 |
| Train / validation / test | 16,364 / 2,011 / 1,913 |
| Source timestamp range | 1997-11-12T01:37:58.000Z to 2023-09-08T22:06:04.465Z |

Source rating distribution: 1=`46,379`, 2=`46,595`, 3=`107,369`, 4=`264,151`, 5=`1,088,270`.

Content bindings for this staging run:

- configuration digest: `f7d4865b076eafc6fdccd8d9a2f6104b547f3805bd800c7f209b66b6e2fdc106`;
- product staging SHA-256: `3af37c8140a2389e3898d9d1a2ae7626371cbf0dfa75fad00ed177fdfb6399c5`;
- rating staging SHA-256: `34228e1538f6d7e62cde037ae06e042f8d500df0377ba51a7f5e8fbd687d416f`.

## Canonical Model And Provenance

Dataset-owned `VinylRecord` documents carry `datasetKey`, `sourceVersion`, a hashed `externalItemKey`, field-level origins, quality flags, and bounded provenance. Artist, price, currency, stock, condition, and format are nullable because the source does not reliably define Groovehaus commercial values. The current normalization uses only the broad source-supported format `Vinyl`; it never infers LP, EP, single, diameter, disc-count presentation, or box-set status. Amazon reference prices are profiled but canonical Groovehaus price/currency remain `null`. Genre and format filters are dynamic and bounded rather than fixed to the original seed facets.

### Raw-To-Canonical Field Map

| Source field or concept | Canonical handling | Origin/confidence and edge policy |
| --- | --- | --- |
| `parent_asin` / product external identity | HMAC-independent SHA-256 `externalItemKey`; deterministic numeric `publicId`; bounded slug | Raw ASIN is retained only in operator provenance, never used as a customer/user ID. Duplicate valid metadata rows keep the first source row; the current source has 0 duplicates. |
| Child ASIN / variants | Not present in the rating-only parent-ASIN benchmark | Parent product is the canonical item. Unknown or excluded products never create ratings. |
| `title` | Required bounded title | `source`; rows without a title are excluded. Unicode is preserved and slug normalization is separate. |
| `store` / artist | One bounded display artist when the store value is non-generic; otherwise `null` | `derived`, medium confidence, flagged `artist-derived-from-store`; no splitting or guessing for featured artists, composers, orchestras, conductors, Various Artists, or title-embedded names. |
| `categories` / genre | One broad display genre plus `genres` array, or `null` | `derived`, medium confidence. Broad mappings are deterministic; otherwise the last non-generic source category is retained. Conflicts are not invented away. |
| `features` | Excluded from canonical storefront product | Available only in ignored raw source; not needed for the current catalog contract. |
| `description` | `null` | No review or marketing text is copied into the storefront. |
| `details` | Used only for bounded release-date and label derivation | Raw details are not published. Extremely long values are clipped by field bounds. |
| Original/Release Date | Four-digit `year` when valid, otherwise `null` | `derived`, medium confidence. `Date First Available` is explicitly not treated as release year. |
| Label / Manufacturer | Bounded `label` or `null` | `source`; no label is inferred from title, store, or categories. |
| Vinyl format | Broad `Vinyl` | `derived` from accepted vinyl category/format evidence. LP/EP/single, 7/10/12-inch, picture disc, disc count, and bundles remain unknown. |
| Amazon `price` | Profiled for source coverage; canonical `price` and `currency` are `null` | Amazon reference price may be stale and is not a Groovehaus selling price; quality flag records the exclusion. Zero/non-numeric/outlier values are never presented as store price. |
| Amazon images | Excluded | No URL is proxied or committed. Canonical artwork is absent and the UI uses the generic placeholder. |
| `average_rating` / `rating_number` | Not copied into catalog or used as a live popularity claim | Rating-only rows are the authoritative historical evidence; aggregate distributions live in the quality summary. |
| Source and version | `source`, `datasetKey`, `sourceVersion` | Public safe labels; exact source revision and file hashes live in the manifest/import record. |
| Provenance and confidence | `fieldOrigins`, `qualityFlags`, bounded operator provenance | Public fields disclose safe origin/quality only. Source reviewer identifiers and raw rows are never included. |
| Soft deletion | `deletedAt: null` on import | Dataset rows are version-managed and cannot be soft-deleted through Admin; activation/rollback changes the pointer. |
| Created/updated timestamps | Mongoose import/update timestamps | Operational timestamps, not source release/review timestamps. Historical rating time remains in `occurredAt`. |

`DatasetImport` owns import state and the single active pointer. It stores source and staging file byte counts/hashes, configuration digest, and pseudonym-key fingerprint. Its states are `importing`, `completed`, `active`, `failed`, and `superseded`. A partial unique index permits at most one active version. `HistoricalAmazonRating` stores dataset key, hidden pseudonymous user key, canonical product ID, hashed external item key, rating, source timestamp, split, source row, and quality flags. Unique and chronology/split indexes protect idempotency and evaluation access.

The public catalog exposes only safe source/version, field-origin, and quality metadata. It never exposes raw reviewer identity, historical rows, internal MongoDB IDs, or the HMAC key.

## Activation And Storefront Behavior

When `CATALOG_DATA_SOURCE=mongodb`, catalog/search/detail/recommendation candidate reads resolve the single active `DatasetImport`. If no dataset is active, they resolve the preserved legacy catalog. Activation changes only this pointer; it does not delete either version.

Current live activation:

- dataset key: `amazon-reviews-2023-cds-vinyl-5core-v1`;
- source version: pinned revision above;
- active catalog: 2,305 source-derived products;
- historical evidence: 20,288 ratings / 2,387 pseudonymous subjects;
- preserved legacy catalog: 116 records;
- users: exactly three active showcase customers.

The frontend renders unknown metadata safely. A dataset product with unknown store price or stock cannot be added to cart or checked out, but it can still be browsed, filtered, opened, wishlisted, or rated. Dataset products have no unreviewed Amazon image; `ProductImage` goes directly to the generic vinyl placeholder instead of trying the legacy local-artwork endpoint.

Admin reads include active dataset status and source/version. Dataset rows are explicitly CLI-managed and cannot be edited, soft-deleted, restored, or artwork-enriched through the browser. The existing admin CSV/JSON preview/apply workflow remains for ordinary catalog records and does not ingest this external dataset.

## Commands And Recovery

Run from the backend repository. Dry-run or read-only commands come before mutation commands.

```powershell
npm.cmd run dataset:profile
npm.cmd run dataset:prepare
npm.cmd run dataset:import
npm.cmd run dataset:import:apply
npm.cmd run dataset:activate:apply
npm.cmd run dataset:verify
npm.cmd run dataset:evaluation:readiness
```

`dataset:import` validates staging and reports exact counts without writing. `dataset:import:apply` performs idempotent upserts and leaves the version completed but inactive. `dataset:activate:apply` imports and transactionally activates it, superseding any previous active dataset.

Product and rating batch sizes default to 500 and 1,000 and can be bounded from 1 through 5,000, for example:

```powershell
npm.cmd run dataset:import -- --product-batch=250 --rating-batch=500
```

Rollback is non-destructive:

```powershell
npm.cmd run dataset:rollback
npm.cmd run dataset:rollback:apply
```

The default target is `legacy`. A specific completed dataset can be selected with `npm.cmd run dataset:rollback:apply -- --to=<dataset-key>`. The transaction deactivates the current pointer and activates the requested completed version; it does not delete products, historical ratings, or user state. Re-run `dataset:verify` after reactivating the current Amazon version. Roll back when activation verification, catalog compatibility, latency, privacy, or integrity checks fail.

## Evaluation Readiness Boundary

`npm run dataset:evaluation:readiness` checks historical evidence only. It verifies chronology, split membership, no duplicate user-item pairs, a minimum of three training interactions, and positive held-out items under the `rating >= 4` rule. The current aggregate-only result is:

| Measure | Value |
| --- | ---: |
| Status | `ready` |
| Subjects | 2,387 |
| Eligible subjects | 1,708 |
| Candidate products | 2,305 |
| Historical ratings | 20,288 |
| Positive test items | 1,708 |

`ready` means the data adapter can supply a leakage-safe future experiment. It is not a ranking result and does not change the existing `recommender:evaluate` evidence gate or the current `insufficient-evidence` claim for live customer behavior. No collaborative filtering, matrix factorization, preference ranking, behavior ranking, popularity ranking, or hybrid orchestration was implemented in this milestone.

## DATA-00 Through DATA-15 Closure

| ID | Outcome | Status and evidence |
| --- | --- | --- |
| DATA-00 | Audit and decision freeze | Completed: source trees, plans, IDs, repositories, demo-user boundary, and non-goals were reconciled before mutation. |
| DATA-01 | Source, terms, citation, provenance | Completed: pinned revision, official sources, hashes, citation, and no-license boundary committed. |
| DATA-02 | Local raw-data boundary | Completed: raw/staging ignored; only reproducibility metadata and aggregates committed. |
| DATA-03 | Profiling and acceptance criteria | Completed: streaming profile and committed aggregate summary cover rows, distributions, timestamps, metadata, duplicates, and exclusions. |
| DATA-04 | Vinyl subset construction | Completed: deterministic classifier, bounded selection, deduplication, and train-only core. |
| DATA-05 | Identity and stable IDs | Completed: keyed pseudonyms, fingerprint check, hashed external keys, reserved deterministic public IDs, and legacy preservation. |
| DATA-06 | Catalog model and field provenance | Completed: nullable source-aware fields, dynamic facets, quality flags, provenance, and compatibility mapping. |
| DATA-07 | Historical rating contract | Completed: isolated immutable collection, split/chronology fields, idempotent keys, indexes, and no TTL. |
| DATA-08 | Streaming import pipeline | Completed: hash/config/staging validation, batches, dry-run, idempotent apply, persisted import state, and fail-closed errors. |
| DATA-09 | Coexistence, activation, rollback | Completed: additive version storage, one active pointer, transaction-backed activation, non-destructive rollback, and legacy fallback. |
| DATA-10 | Artwork policy | Completed: no Amazon images; source-derived products use the generic placeholder and disclose source. |
| DATA-11 | Backend/API/admin compatibility | Completed: active-version catalog/search/detail/facets, safe recommendation candidates, source metadata, admin status, and read-only dataset rows. |
| DATA-12 | Frontend integrity | Completed: nullable display helpers, dynamic facets, non-purchasable unknown commercial fields, placeholder policy, and responsive admin/storefront support. |
| DATA-13 | Evaluation readiness | Completed: aggregate-only leakage-safe adapter and readiness command; no recommender implementation or quality claim. |
| DATA-14 | Validation and rehearsal | Completed: unit/integration, lint, builds, Atlas counts/indexes, activation, cleanup, browser E2E, and rollback-path inspection. |
| DATA-15 | Documentation and recommender gate | Completed: both documentation sets synchronized; PERS-03 through PERS-09 remain deferred by explicit user direction. |

## Failure And Recovery Matrix

| Failure | Protection | Recovery |
| --- | --- | --- |
| Source bytes differ | SHA-256 and byte-count validation fails before staging. | Reacquire the pinned file or review a new source version; never amend hashes silently. |
| Pseudonym key changes | Stored fingerprint/config ownership blocks an incompatible same-key rerun. | Restore the original secret or create and document a new dataset version. |
| Interrupted import | Import state remains `failed` or incomplete; activation is separate. | Correct the cause and rerun the idempotent import; do not activate until counts match. |
| Count or index mismatch | `dataset:verify` / `db:indexes` fails. | Keep or restore legacy activation, repair the bounded issue, then re-verify. |
| Dataset field is absent | Canonical value remains `null`, never invented. | UI displays Unknown/Unavailable and disables purchase where required. |
| Browser attempts dataset mutation | Admin service returns a conflict explaining the CLI-managed boundary. | Rebuild/import/activate a version through the controlled pipeline. |
| Historical rows appear in live evidence | Collections and reporting paths are separated. | Stop evaluation, correct the data-source selection, and regenerate aggregate reports. |
| Storefront regression after activation | Activation is a reversible pointer. | Run `dataset:rollback:apply`, validate legacy behavior, then investigate. |

## Validation Record

Observed 2026-08-02:

- backend `npm test`: 167/167 passed;
- backend ESLint and Next.js 16.2.12 production build passed; the complete npm audit reported zero vulnerabilities after bounded framework/transitive security updates;
- source hashes, configuration digest, staging hashes, and aggregate counts matched;
- Atlas activation verified 2,305 dataset products, 20,288 ratings, 2,387 historical users, 116 preserved legacy products, and exactly three showcase customers;
- all declared MongoDB indexes were present and historical ratings had no TTL;
- frontend Vitest: 90/90 passed; ESLint and Vite production build passed;
- full Playwright matrix: 67 passed and 1 intentional skip across Chromium desktop/mobile/tablet, Firefox, and WebKit;
- automatic Atlas teardown removed 36 test interactions without deleting any catalog record or showcase customer, and the follow-up cleanup dry-run found zero residue.

## Deferred Recommender Work

PERS-03 through PERS-09 remain planning-only. The historical dataset changes their prerequisites: future plans must use this versioned, isolated evidence source, preserve temporal splits, distinguish historical from live evidence, and keep the exact three demo users. They must not treat readiness as quality, merge historical pseudonyms into customer accounts, expose raw signals, or activate a new model without a separately approved implementation and evaluation task.
