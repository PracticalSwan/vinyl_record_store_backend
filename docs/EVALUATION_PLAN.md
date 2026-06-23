# Backend Evaluation Plan

## Evaluation Goals

- Prove recommendation output is relevant.
- Prove explanations match backend data.
- Check diversity and coverage.
- Check API behavior and validation.
- Produce evidence for the academic project.

## API Evaluation

Planned checks:

- Valid requests return documented success shapes.
- Invalid requests return documented error shapes.
- Missing products return not-found errors.
- Invalid IDs are rejected before database queries.
- Private user data is not exposed unnecessarily.

## Recommender Evaluation

Planned checks:

- Same-artist candidates rank high.
- Shared genre and subgenre affect ranking.
- Already purchased records are excluded.
- In-stock records are preferred.
- Explanation reasons match actual metadata.
- Diversity rules avoid only one artist or one genre.

## Recommendation Log Review

Future `recommendationLogs` should help answer:

- Which algorithm version produced the result?
- What source product or user profile was used?
- Which records were recommended?
- What reasons were returned?
- Did the result change after a scoring update?

## Example Test Cases

| ID | Input | Expected Backend Result |
| --- | --- | --- |
| BE-001 | Product with same-artist candidates | Same-artist records rank near the top. |
| BE-002 | Product with no same-artist candidates | Shared genre, tags, era, or label drive ranking. |
| BE-003 | User already bought candidate | Candidate is excluded by default. |
| BE-004 | New user | Popular in-stock records appear without false personalization. |
| BE-005 | Invalid product ID | API returns validation error. |
| BE-006 | Database unavailable | API returns safe backend error. |

## Documentation Update Rules

Update this file when backend API checks, recommender scoring, explanation logic, diversity rules, evaluation metrics, or test cases change.

