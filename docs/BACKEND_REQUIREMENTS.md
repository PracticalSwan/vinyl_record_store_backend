# Backend Requirements

## Goals

- Provide API data for the separate frontend.
- Store vinyl record and user interaction data in MongoDB Atlas.
- Produce explainable recommendations.
- Support academic evaluation of the recommender system.
- Keep backend code safe, testable, and beginner-readable.

## Backend Users

| User | Need |
| --- | --- |
| Frontend app | Stable API contracts and predictable errors. |
| Customer | Fast and correct data through the frontend. |
| Store admin | Future catalog management APIs. |
| Academic reviewer | Clear recommendation and evaluation evidence. |
| Developer | Safe setup, clear boundaries, and documented decisions. |

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-001 | Provide product listing data. | Must |
| BR-002 | Provide product detail data. | Must |
| BR-003 | Support search and filters. | Must |
| BR-004 | Log user interactions. | Must |
| BR-005 | Store wishlist, cart, and order-related events. | Must |
| BR-006 | Generate product-based recommendations. | Must |
| BR-007 | Generate user-based recommendations when user history exists. | Should |
| BR-008 | Return recommendation explanations. | Must |
| BR-009 | Log recommendation outputs for evaluation. | Should |
| BR-010 | Support admin product management later. | Optional |

## Non-Functional Requirements

- Keep secrets server-only.
- Validate all request input.
- Return consistent errors.
- Avoid exposing raw private interaction logs to the frontend.
- Keep route handlers small.
- Keep data access and recommender logic in separate modules.
- Run targeted lint/build checks when implementation changes.

## Out Of Scope

- Frontend component implementation.
- Production payment processing.
- Production authentication unless approved later.
- External scraping.
- Real collaborative filtering before enough data exists.

## Success Criteria

- The frontend can consume stable backend contracts.
- Recommendation results include reasons.
- Backend data models support product browsing and recommender scoring.
- Evaluation logs can show why recommendations were produced.
- Backend docs stay synchronized with backend changes.

## Change Tracking

Update this file when backend scope, users, requirements, non-functional requirements, or success criteria change.

