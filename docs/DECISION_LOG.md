# Backend Decision Log

These decisions define the consolidated backend baseline.

## BDEC-001: Keep Next.js And JavaScript

Date: 2026-07-02

Decision: Keep the current Next.js 16.2.9 App Router and JavaScript modules.

Rationale: The read API is small, validated, testable, and builds cleanly. A TypeScript migration would expand scope without changing the requested integration outcome.

## BDEC-002: Use An Approved Demo Seed Before MongoDB

Date: 2026-07-02

Decision: Serve `src/data/records.js` through the service/API boundary and keep MongoDB placeholders inactive.

Rationale: The frontend can integrate now without fake credentials or an undocumented external dependency. Public product normalization removes legacy seed-only reasons.

## BDEC-003: Start With Deterministic Content Ranking

Date: 2026-07-02

Decision: Score artist, genre, decade, label, and availability with documented fixed weights.

Rationale: The logic is explainable and testable without interaction data. Collaborative methods would be unsupported.

## BDEC-004: Separate Demo Profile And Cold Start

Date: 2026-07-02

Decision: Only `demo-user` receives the synthetic profile; all other valid IDs receive clearly labeled cold-start results.

Rationale: This prevents false personalization claims.

## BDEC-005: Keep Write Features Deferred

Date: 2026-07-02

Decision: Do not implement in-memory interaction, wishlist, cart, order, or recommendation logs as if they were durable.

Rationale: Server-memory writes would be misleading and unreliable without identity and persistence.

## BDEC-006: Distinguish Behavior Tests From Quality Metrics

Date: 2026-07-02

Decision: Test deterministic rules and metric sanity, but report no offline quality score until a leakage-safe dataset and baselines exist.

Rationale: A top-k metric without held-out relevance and fair baselines is not valid evaluation evidence.
