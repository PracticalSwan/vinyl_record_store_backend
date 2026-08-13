# Amazon Reviews 2023 Dataset Integration

Status: corrected immutable v3 implementation and migration evidence verified on 2026-08-08, with read-only PERS-09 regression verification on 2026-08-13. The migration/rollback evidence and exact quality/artwork counts below are the release record. Dataset completion did not authorize personalization; the separately implemented PERS-03 through PERS-09 work remains data-lifecycle independent, and the PERS-04 through PERS-08 ranking flags remain default-off.

Audience: backend/frontend maintainers, course assessors, and operators of the classroom `vinyl_record_store` MongoDB database.

Purpose: explain the reproducible Amazon Reviews 2023 research-catalog boundary, how to prepare and activate it safely, how to recover, and what evidence must remain true.

Source of truth: committed files under `data/amazon-reviews-2023/`, dataset scripts under `scripts/`, models/repositories under `src/`, and the verification commands below. Recheck upstream terms, availability, and API rules before reacquiring source data or regenerating artwork.

## Executive Summary

Groovehaus now uses immutable `amazon-reviews-2023-cds-vinyl-5core-v3` in MongoDB mode. It contains 2,305 source-derived vinyl products in `datasetProducts` and 20,288 isolated historical ratings from 2,387 HMAC-pseudonymous subjects. V2 is the immediate non-destructive rollback release, v1 remains the identity/legacy base, and the original 116 reviewed Groovehaus records remain stored. The only application customers remain `demo-jazz`, `demo-rock`, and `demo-soul`.

V3 supersedes v2 with corrected original-release-year enrichment. V2 remains the immediate rollback target:

- a 15-label canonical genre taxonomy (14 represented in the active catalog plus `Unresolved` as a fallback state, not a 16th genre), with no retailer/navigation fallback;
- conservative artist normalization, explicit original-versus-edition year semantics, and broad `Vinyl` only;
- authoritative MusicBrainz release-group first-release-date for the 208 strict-match accepted products (v2 incorrectly reported zero original-year coverage because the release search endpoint omits this field);
- a committed opaque identity registry that preserves every v1 numeric public ID;
- exact record digests, separate immutable storage, sealing, and exact-set verification;
- strict rate-limited MusicBrainz/Cover Art Archive decisions and a local fallback for every accepted image;
- explicit research-only browsing with no invented price, currency, stock, condition, cart, or checkout behavior;
- protected customer state, seed-mode regression coverage, and a reproducible dataset E2E mode.

This dataset milestone originally established readiness only. The later, separately authorized NEXT-01/NEXT-03 work evaluated deterministic random, positive-popularity, content, and one observed-only biased-MF candidate on aggregate historical evidence; biased MF was rejected for live use. The live `preference-profile-v1` mode remains default-off and has not been quality-evaluated, the deployed default behavior remains `content-demo-v1`, and the live evaluator remains `insufficient-evidence`.

## Source, Citation, And Redistribution Boundary

- Dataset: [Amazon Reviews 2023](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023), category `CDs_and_Vinyl`.
- Pinned revision: `2b6d039ed471f2ba5fd2acb718bf33b0a7e5598e`.
- Rating input: official `CDs_and_Vinyl.5core.csv.gz`; metadata input: `meta_CDs_and_Vinyl.jsonl`.
- Citation: Hou et al., [Bridging Language and Items for Retrieval and Recommendation](https://arxiv.org/abs/2403.03952) (2024).
- Terms: the publisher states it is not in a position to assign a dataset license in the official [license discussion](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/discussions/1). This repository makes no permissive-license claim.

Raw source, staging output, reviewer IDs, review text, profiles, and Amazon product images stay ignored and uncommitted. The repository commits transformation code, manifests, opaque identity mappings, aggregate quality evidence, strict artwork decisions, and approved Cover Art Archive fallback JPEGs. The code license does not grant rights to third-party cover art; see `THIRD_PARTY_ARTWORK.md`.

| Source file | Bytes | SHA-256 |
| --- | ---: | --- |
| `meta_CDs_and_Vinyl.jsonl` | 948,861,684 | `c52275a5bce63bf293f987bff5ff1f2b268982797545f3df2b7662ab638e8aec` |
| `CDs_and_Vinyl.5core.csv.gz` | 21,466,396 | `53811902ffb01eb22da31a35e0775f3b8351baebe7e1ab38b85b6c4aee689c20` |

## Historical V2 Audit Findings And Decisions

| Finding | Classification | V2 outcome |
| --- | --- | --- |
| V1 genre values included navigation/geographic contamination. | True | Controlled taxonomy; unmatched categories remain operator provenance only. |
| Artist cleanup could preserve role noise or generic store values. | True | Conservative single-display-artist rule, explicit Various Artists handling, and unresolved values instead of guesses. |
| Amazon availability/edition evidence could be mistaken for original release year. | True | Separate fields; generic `year` and era facets use verified original year only. |
| V1 same-key upserts could mutate or leave stale rows. | True | V2 uses `datasetProducts`, record digests, `$setOnInsert`, exact sets, and sealing. |
| Public IDs could drift when subset order/collisions changed. | True | Opaque registry preserves all v1 IDs; fixed `record-<publicId>` slugs. |
| V1 had no approved dataset artwork or local dataset fallback. | True | Strict MusicBrainz decisions plus exact accepted local coverage; no Amazon images. |
| The existing browser suite validated only the 116 seed records. | True | Seed suite retained; separate deterministic dataset E2E added. |
| Dataset readiness demonstrated recommendation quality. | False | Readiness validates inputs only; no recommender work or quality claim. |
| Amazon historical subjects were or should become app users. | False | They remain hidden HMAC keys in the historical collection only. |

This table records the v2 foundation verified on 2026-08-08; it is not a statement that v2 is current. The initial proposal preferred storing all versions in `vinylRecords`. V2 deliberately uses `datasetProducts` instead. A separate collection is the smallest safe correction because v1 must remain byte-for-byte available while sealed later releases must reject same-key mutation and stale rows. Repository selection still presents one active catalog contract, so this does not create a second application service or API.

## Data Honesty And Canonical Mapping

| Input/concept | Canonical value | Rule |
| --- | --- | --- |
| `parent_asin` | Opaque `externalItemKey`, stable numeric `publicId` | Namespace SHA-256 plus committed v1-derived identity registry; raw ASIN remains bounded operator provenance only. |
| Title | `title` | Required source value, whitespace-normalized and bounded; no marketing/review text. |
| `store` | `artist` or `null` | Remove bounded role markers; normalize Various Artists; reject generic or ambiguous multi-credit text. |
| Categories | `genre`, `genres`, or unresolved | First match in the controlled 15-genre priority table; never expose unmatched retailer/navigation terms as genre. |
| Release dates | `originalReleaseYear`, `editionReleaseYear`, `yearDisplayType` | MusicBrainz release-group first date may establish original year. Amazon release fields are edition evidence only. `Date First Available` is audit-only. |
| Format evidence | `Vinyl` | Eligibility proves only broad carrier; never infer LP/EP/single/diameter/disc count/box set. |
| Label/manufacturer | `label` or `null` | Bounded source value; no title/store inference. |
| Amazon price/images | Excluded | Not a current Groovehaus offer; no Amazon image download/proxy. |
| Price/currency/stock/condition | `null` | Research-only records have no simulated commerce state. |
| Ratings | 1 through 5 plus source time/split | Most recent duplicate user-item row; `verifiedPurchase` is `null` because rating-only input lacks it. |
| Source identity | HMAC `userKey` | Dataset-scoped HMAC-SHA-256; never an account, API identity, log field, or report row. |

Public APIs expose only safe source/version, field origins, quality flags, year semantics, and local-art availability. Raw source metadata and historical rows never reach the browser.

## Deterministic Subset And Quality Evidence

The transformation streams both inputs, validates exact byte/hash evidence, selects vinyl candidates by explicit category/detail evidence, sorts products by opaque external key, sorts subjects by HMAC key, resolves duplicate user-item rows to the most recent source row, performs per-user leave-last-two splitting, and applies a three-interaction train-only core. It uses no source review text and fabricates no negative ratings.

| Measure | V1 | V2 |
| --- | ---: | ---: |
| Products | 2,305 | 2,305 |
| Historical subjects | 2,387 | 2,387 |
| Historical ratings | 20,288 | 20,288 |
| Train / validation / test | 16,364 / 2,011 / 1,913 | 16,364 / 2,011 / 1,913 |
| Rating 1 / 2 / 3 / 4 / 5 | 642 / 492 / 967 / 1,917 / 16,270 | 642 / 492 / 967 / 1,917 / 16,270 |
| Positive ratings (`>= 4`) | 18,187 | 18,187 |
| Rebalanced/fabricated negatives | No / No | No / No |

Historical v2 quality and artwork evidence (generated 2026-08-08):

- canonical genre distribution: Blues 37, Classical 5, Electronic 30, Folk 66, Hip-Hop 38, Holiday 20, Jazz 71, Latin 1, Pop 742, Reggae 1, Rock 993, Soul 40, Soundtrack 32, Spoken Word 5, Unresolved 224;
- artist quality: accepted 2,044, cleaned 238, ambiguous 20, rejected or missing 3;
- year coverage: original and edition 0, original only 0, edition only 2,026, unresolved 279; original-release-year decade coverage is Unresolved for all 2,305 products;
- format distribution: Vinyl 2,305;
- field coverage: artist 2,282, canonical genre 2,081, original release year 0, edition release year 2,026, label 2,217, description 0, commercial fields 0;
- artwork decisions: accepted 208, ambiguous 6, unresolved 2,091, errors 0; accepted local JPEGs 208 totaling 14,086,838 bytes;
- evidence digests: config `233db0e03d4365a971e33dad9a7748c34c17f717f867f60ea64577f9456fb255`, staging products `9fd82e135992212ae849fa9bbd2328d032f6dac8e876df5b1451d4ebe61ac00e`, staging ratings `fce3b191502e28b79880c9bc5285e9bc7863af0500dae8685257f8be6541b9bf`, identity `316f58bd8eac7d9e687a7c99328450452842e47c936ce5092fa31dbecb63a7ad`, and artwork `1b47512e93688e24c24f53b8cb29e9520ff3660f185540575a00d3f6b4b16292`.

Current v3 preserves the same product, subject, rating, split, genre, artist, format, artwork-decision, and commercial-null counts. It corrects original-year coverage to 208 products: 205 have original and edition years, 3 original only, 1,821 edition only, and 276 unresolved. The v3 evidence digests are config `6b7d56f957c663c49d2d1d79a7074fac4665dc531f1cf07396ee7639aae3d648`, staged products `87fb67c44e5ed4882058007f623941517a81d0b7a0595bfcea28f73fbbfb01ee`, staged ratings `b0412cd0050d171d89a209106ebbf954ce140946343dbbad19f7524dbb9c2746`, identity `316f58bd8eac7d9e687a7c99328450452842e47c936ce5092fa31dbecb63a7ad`, and artwork `733eb522644d8552787121a6b8e0008c98fbca4ff2de48e900ffab660f57ae89`.

The committed `data-quality-summary.json` is the machine-readable public projection of current v3 aggregates. It deliberately excludes the secret-derived pseudonym-key fingerprint and internal source/staging hashes; those remain only in ignored staging and the private import record required for ownership verification. Positive skew is a dataset characteristic, not an error to “balance.” Future evaluation must disclose it and must not alter source ratings.

The manual normalization audit sampled one row from every emitted canonical genre plus unresolved rows. It found one geographic navigation label that had been mapped to World; the generic `international` rule was removed and regression-tested. It also found a source category that disagreed with the album's apparent genre; the transformer retained the explicit controlled source-category result rather than inferring from title. No row-level reviewer data was inspected or documented.

## Artwork Policy

`dataset:artwork:enrich` uses a meaningful User-Agent, a 1,100 ms minimum interval between uncached MusicBrainz requests, bounded retries/backoff, and resumable ignored progress. A decision is accepted only when all of the following hold:

- MusicBrainz score is at least 95;
- normalized title is exact;
- artist agreement is strong (or an exact ASIN fallback supplies the bounded alternate path);
- the result is official and returned through a vinyl-constrained search;
- exactly one release group survives;
- Cover Art Archive supplies an approved front image.

Ambiguous, unresolved, and failed decisions use the placeholder. `dataset:artwork:download` downloads every accepted 500-pixel JPEG through the existing host/redirect/type/size/pixel checks, writes content-addressed files under `public/artwork/dataset/`, and generates `datasetLocalArtworkManifest.js`. The verifier requires exact accepted/local ID equality and rejects missing, corrupt, stale, duplicate, or orphan assets.

## Storage, Lifecycle, And State

| Collection | Ownership and invariant |
| --- | --- |
| `vinylRecords` | 116 legacy records plus preserved v1 identity-base dataset rows; never deleted by later releases. |
| `datasetProducts` | Immutable v2 and v3 rows, one exact digest per record, compound unique dataset/public ID/slug/external key. |
| `historicalAmazonRatings` | V1, v2, and v3 version-owned rating evidence; unique dataset/user/product; no TTL. |
| `datasetImports` | Source/staging/config/identity/artwork evidence, counts, collection owner, status, sealing, and one active pointer. |
| `users` and customer-state collections | Application identities/state only; never populated from Amazon subjects and never deleted/remapped by activation. |

Lifecycle:

1. Prepare and verify ignored staging owned by the intended release.
2. Run `dataset:import` for a no-write dry run.
3. For a genuinely new release only, run `dataset:import:apply` to write it inactive.
4. Verify exact persisted evidence while the previous release remains active.
5. For a genuinely new release only, run `dataset:activate:apply` for the transactional pointer switch.
6. Verify APIs, UI, indexes, state, and counts.
7. Use `dataset:rollback:apply -- --to=<key>` for a non-destructive rollback.

A sealed `completed`, `active`, or `superseded` release key is immutable. An interrupted unsealed inactive import can resume. `dataset:clean:failed` is dry-run by default and may delete only the exact selected unsealed inactive release products/ratings/import record after `--apply`; it refuses active or sealed data.

Wishlist and rating references remain stored across activation. If a product is absent from the active version, reads hide or mark the product unavailable without deleting/remapping state. Cart writes reject research products before persistence; existing unavailable/research rows return null totals and warnings. Guest merge drops research-only cart entries but preserves valid wishlist/rating state.

## Research-Only Storefront And Admin Contract

Catalog responses set `meta.catalogMode` to `research-only`. The frontend:

- shows source-derived title/artist/genre/format and explicit original/edition year labels;
- hides price, stock, condition, commerce filters/sorts, add-to-cart, and checkout actions;
- keeps browse, search, pagination, detail, wishlist, and rating behavior;
- loads preference choices from active nonzero facets and hides budget/condition controls;
- uses remote -> approved local -> placeholder artwork only when the backend confirms local coverage.

The Admin dashboard shows active source/version/counts and research policy. Dataset rows are browsable but read-only: update, delete, restore, and browser artwork enrichment return a conflict directing operators to the CLI. The ordinary bounded CSV/JSON preview/apply path remains available for non-dataset records and is not an Amazon ingestion surface.

## Current V3 Operator Runbook

Run from `vinyl_record_store_backend` in PowerShell. Review all dry-run output before an apply command.

The normal sealed-release check is read-only and verifies current v3 plus the complete v2 rollback target while v3 remains active:

```powershell
npm.cmd run db:ping
npm.cmd run catalog:artwork:verify
npm.cmd run dataset:artwork:verify
npm.cmd run dataset:verify -- --dataset-key=amazon-reviews-2023-cds-vinyl-5core-v3 --expect-active=amazon-reviews-2023-cds-vinyl-5core-v3
npm.cmd run dataset:verify -- --dataset-key=amazon-reviews-2023-cds-vinyl-5core-v2 --expect-active=amazon-reviews-2023-cds-vinyl-5core-v3
npm.cmd run db:indexes
npm.cmd run dataset:evaluation:readiness
```

Reproduce current v3 transformation/artwork only when the pinned raw input and the existing private v3 staging evidence are available. Because v3 is sealed, `dataset:prepare` is now a no-write reproduction check: it recomputes product/rating evidence in memory, verifies the existing private staging files and report, compares every stable report field plus the public aggregate summary, and refuses `--base-only` or product/user/core overrides. A different pseudonym key therefore fails closed instead of replacing v3 staging. The enrichment command resumes transient release-group hydration, compares the recomputed semantic digest to the exact pinned artifact, leaves identical sealed v3 evidence unchanged, and fails closed if decisions differ. If sealed staging or an immutable committed artifact is missing, restore the exact evidence rather than regenerating or publishing different bytes under the v3 key. These commands do not justify re-importing sealed v3:

```powershell
npm.cmd run dataset:profile
npm.cmd run dataset:identity:build
npm.cmd run dataset:prepare
npm.cmd run dataset:artwork:enrich
npm.cmd run dataset:artwork:verify
npm.cmd run dataset:import
```

The 2026-08-08 v2 migration sequence and v2-to-v1 rehearsal are historical evidence, not current operator commands. A new database write rehearsal is necessary only after lifecycle transaction behavior changes. If one is required, rehearse v3 to v2 and back to v3, and verify the target meaningfully in each active state:

```powershell
npm.cmd run dataset:rollback -- --to=amazon-reviews-2023-cds-vinyl-5core-v2
npm.cmd run dataset:rollback:apply -- --to=amazon-reviews-2023-cds-vinyl-5core-v2
npm.cmd run dataset:verify -- --dataset-key=amazon-reviews-2023-cds-vinyl-5core-v2 --expect-active=amazon-reviews-2023-cds-vinyl-5core-v2
npm.cmd run dataset:activate:apply
npm.cmd run dataset:verify -- --dataset-key=amazon-reviews-2023-cds-vinyl-5core-v3 --expect-active=amazon-reviews-2023-cds-vinyl-5core-v3
```

If an inactive unsealed current-release import cannot resume:

```powershell
npm.cmd run dataset:clean:failed
npm.cmd run dataset:clean:failed:apply
```

Never run failed-import cleanup against a sealed or active version. Never delete v1, v2, v3, legacy records, or customer state to repair a release.

## V3 Release-Hardening Validation Record

Observed on 2026-08-09 against active `amazon-reviews-2023-cds-vinyl-5core-v3`:

- focused backend tests passed 74 with one intentional Windows file-symlink-permission skip; the full backend suite passed 220 with the same one skip, with zero failures;
- ESLint and the Next.js 16.2.12 production build passed, generating all 23 application pages;
- the legacy artwork verifier passed 116 files / 7,562,124 bytes and the dataset artwork verifier passed 208 files / 14,086,838 bytes;
- the complete v3 verifier passed while v3 was active, and the complete v2 rollback-target verifier independently passed while v3 remained active; the v1 identity-base verifier also passed;
- all 14 declared MongoDB collections reported no missing indexes; aggregate readiness reported 2,387 subjects, 1,708 eligible subjects, 2,305 products, and 20,288 ratings without running a recommender model;
- the current-release import and v3-to-v2 rollback commands passed in dry-run mode; no database write rehearsal was performed because lifecycle transaction behavior did not change;
- frontend unit tests passed 93/93, ESLint passed, and the Vite 8.1 production build passed. Broader dataset E2E was not applicable because neither frontend source nor the API/data contract changed;
- the intended tracked/untracked set contained no raw/staging/cache/temp artifacts, credential or private-review patterns, secret-derived public fingerprint, non-EOL control bytes, or EOL-only files. Immutable v2/v3 JSON evidence is explicitly pinned to LF.

## Failure And Recovery Matrix

| Failure | Protection | Recovery |
| --- | --- | --- |
| Wrong/truncated source or staging | Byte count, SHA-256, bounded parser, gzip error | Reacquire the pinned input or rebuild ignored staging; never amend evidence silently. |
| Changed config/identity/art under same key | Ownership and digest mismatch | Create/review a new dataset key; never rewrite the sealed key. |
| Interrupted import | Unsealed inactive `importing`/`failed` state | Fix cause and rerun; use exact failed cleanup only when resume is inappropriate. |
| Partial/stale persisted rows | Exact counts and digest sets fail | Keep the current release active, clean only the exact unsealed inactive target, rebuild, and reverify. |
| MusicBrainz/CAA error | Retry/cache, explicit `error`, no activation with errors | Resume enrichment; unresolved/ambiguous remain placeholders. |
| Local artwork mismatch | Exact accepted coverage plus hash/dimension/orphan check | Republish from the reviewed manifest; do not hand-edit assets. |
| API/UI regression | Separate inactive import and transactional pointer | Roll back v3 to v2, verify v2 while active, repair, then reactivate and verify v3. |
| Product absent after rollback | Stable IDs and non-destructive state | Hide/mark unavailable; restore visibility when product returns; never remap. |
| Test cleanup targets evidence | Executable protected-collection policy | Stop; tests require dataset collections disjoint from deletion targets. |

## Historical V2 Validation And Migration Record

Observed on 2026-08-08. This block preserves v2/v1 migration history and does not supersede the current v3 runbook:

- v1 preflight verifier: all checks passed with 2,305 products, 20,288 ratings, 2,387 subjects, 116 legacy records, and three showcase users;
- v2 preparation determinism: repeated normal preparation kept product/rating hashes, config, identity, artwork, counts, and acceptance identical; only `generatedAt` changed;
- inactive import/verification: `dataset:import:apply` completed v2 inactive and the verifier passed while v1 remained the only active import; an exact repeated sealed import was idempotent and preserved the persisted digest sets and timestamps;
- activation, rollback to v1, and reactivation: v2 activation passed; the aggregate rollback rehearsal reported active v1 with v2 evidence, legacy IDs, showcase state, and customer collections preserved and no deletion; normal activation restored v2 and the complete verifier passed;
- stable v1/v2 IDs and customer state: the verifier passed `stableIdsPreservedFromV1` with 2,305 products and exactly three showcase customers; the live rollback snapshot passed v2 evidence, legacy, showcase, and customer-state preservation checks;
- MongoDB indexes and post-E2E protected counts: all 14 declared collections reported no missing indexes; cleanup dry-run ended at zero `e2e_` users/residue while preserving `vinylRecords` 2,421, `datasetProducts` 2,305, `datasetImports` 2, and `historicalAmazonRatings` 40,576 (v1 plus v2);
- backend tests/lint/build: 179/179 Node tests passed, ESLint passed, and the Next.js 16.2.12 production build passed on 2026-08-08;
- frontend unit/seed-E2E/dataset-E2E/lint/build: 93/93 unit tests passed, seed E2E passed 67 with one intentional skip, deterministic dataset E2E passed 10 with two mobile-only skips, the dedicated accessibility suite passed 20/20, ESLint passed, and the Vite 8.1.0 production build passed on 2026-08-08;
- live API/browser/artwork smoke: MongoDB mode returned research-only catalog metadata with 2,305 products, Vinyl facets, null commerce fields, accepted local fallback, unresolved 404 placeholder behavior, and the then-current Admin v2 source/version/counts; live browser checks passed catalog, local fallback, unresolved placeholder, mobile keyboard, Admin read-only rows, and authenticated wishlist/rating behavior.

## Recommender Gate

DATA-00 through DATA-15 are closed only for the dataset foundation. PERS-03 through PERS-09 were implemented separately and do not alter this dataset; the PERS-04 through PERS-08 ranking flags remain default-off. The completed NEXT-03 offline-academic experiment evaluated one observed-only biased matrix-factorization model and rejected it for live use; neighborhood collaborative filtering, classical SVD, live latent-factor integration, and any recommendation-quality claim remain deferred. The implemented popularity/behavior/hybrid paths use the versioned historical adapter without mixing live identities; offline baselines remain leakage-safe, and `content-demo-v1` remains regression behavior.
