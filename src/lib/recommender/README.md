# Recommender Library

`contentBased.js` implements deterministic product, synthetic demo-profile, cold-start, optional preference-profile, and history-based offline ranking. `exclusions.js` applies exact durable feedback suppression, while `preferenceRanking.js` contains the pure null-safe preference scorer. `evaluationDataset.js` constructs final-state relevance and leakage-safe temporal splits. `offlineEvaluation.js` compares live-event random, `offline-popularity-train-v1`, and content-based methods. `historicalOfflineEvaluation.js` separately evaluates pinned Amazon train/validation/test semantics with shared full-catalog candidates and sealed aggregate artifacts. The production aggregate mode remains `popularity-v1`. `evaluate.js` contains the shared pure ranking and beyond-accuracy helpers.

Do not report metric values without the leakage-safe protocol and minimum evidence boundary in `../../../docs/EVALUATION_PLAN.md`.
