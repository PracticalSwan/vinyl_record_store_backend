# Recommender Library

`contentBased.js` implements deterministic product, synthetic demo-profile, cold-start, optional preference-profile, and history-based offline ranking. `exclusions.js` applies exact durable feedback suppression, while `preferenceRanking.js` contains the pure null-safe preference scorer. `evaluationDataset.js` constructs final-state relevance and leakage-safe temporal splits. `offlineEvaluation.js` compares random, popularity, and content-based methods under the same subjects, candidates, and `k`. `evaluate.js` contains pure ranking and beyond-accuracy helpers.

Do not report metric values without the leakage-safe protocol and minimum evidence boundary in `../../../docs/EVALUATION_PLAN.md`.
