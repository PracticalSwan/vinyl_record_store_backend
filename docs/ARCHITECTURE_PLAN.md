# Backend Architecture Plan

## Summary

The backend is a Next.js server-side application that supports a separate React frontend. It should expose APIs, validate requests, access MongoDB Atlas, run recommender services, and return clear recommendation explanations.

## Backend Layers

### API Layer

Planned location: `src/app/api/`.

Responsibilities:

- Receive frontend requests.
- Validate parameters and request bodies.
- Call service modules.
- Return consistent success and error shapes.

### Service Layer

Planned location: `src/services/`.

Responsibilities:

- Keep route handlers small.
- Coordinate product, interaction, order, wishlist, and recommendation behavior.
- Keep business logic separate from transport details.

### Database Layer

Planned location: `src/lib/db/`.

Responsibilities:

- Connect to MongoDB Atlas.
- Read and write collections.
- Keep credentials server-only.
- Support indexing and query patterns documented in `docs/DATA_MODEL_PLAN.md`.

### Recommender Layer

Planned location: `src/lib/recommender/`.

Responsibilities:

- Select candidates.
- Score records.
- Generate explanation reasons.
- Apply diversity rules.
- Return algorithm version data.

### Validation Layer

Planned location: `src/validation/`.

Responsibilities:

- Validate route params and request bodies.
- Normalize query filters.
- Reject invalid inputs before database operations.

## Frontend Boundary

The frontend should call backend APIs. The backend should not depend on frontend components.

If a backend contract changes, update backend API docs and the frontend API consumption docs.

## Security Considerations

- Keep MongoDB credentials server-only.
- Validate all inputs.
- Avoid exposing private interaction data.
- Protect admin routes when authentication is added.
- Use safe error messages that do not leak secrets or internal stack traces.

## Open Decisions

- Whether backend implementation will stay JavaScript or move to TypeScript.
- Exact API route structure.
- Authentication approach.
- Whether admin APIs are MVP or later.
- Deployment target.
- Whether MongoDB Atlas Search or vector features will be used.

## Documentation Update Rules

Update this file when backend boundaries, module ownership, framework usage, data flow, validation approach, security approach, or deployment assumptions change.
