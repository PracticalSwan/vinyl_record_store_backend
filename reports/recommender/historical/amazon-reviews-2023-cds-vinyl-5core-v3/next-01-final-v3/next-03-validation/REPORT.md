# NEXT-03 Biased Matrix Factorization Validation

Status: validation-complete; final test not yet authorized by this artifact.

Dataset: `amazon-reviews-2023-cds-vinyl-5core-v3`

Experiment contract digest: `c0649386411049d88d3c9e993a99d565a1127913e250c637b38000d11ce1903f`

Candidate implementation digest: `86bfec44c5153a5865fda7f588cc05257be5766e765f559fce9d2f49d737fde6`

Every configuration fitted all observed train ratings for 2,387 structurally eligible subjects. Metrics use the canonical 1,823-subject validation-target-positive cohort and unchanged full-catalog exclusions.

| Order | Factors | Learning rate | Regularization | Epochs | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization | RMSE | Elapsed ms | Peak RSS delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 8 | 0.005 | 0.02 | 50 | 0.0033266644186245244 | 0.002535285461780251 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6906351831181976 | 2629 | 6385664 |
| 1 | 8 | 0.005 | 0.05 | 50 | 0.0033214919096312915 | 0.0025309319193027365 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6921014256793908 | 3041 | 7217152 |
| 2 | 8 | 0.01 | 0.02 | 50 | 0.0019176229066233579 | 0.001010239531907113 | 0.004936917169500823 | 0.005639913232104121 | 9.117187263434396 | 0.0032660485942045403 | 0.6598422423808774 | 2895 | 5361664 |
| 3 | 8 | 0.01 | 0.05 | 50 | 0.001924186356621215 | 0.0010163344913756325 | 0.004936917169500823 | 0.004772234273318872 | 9.117182155951983 | 0.0032626164161516646 | 0.6641057086909098 | 2872 | 5713920 |
| 4 | 16 | 0.005 | 0.02 | 50 | 0.0033685696998510175 | 0.0025796915950508934 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.690355159273313 | 3453 | 1044480 |
| 5 | 16 | 0.005 | 0.05 | 50 | 0.0033214919096312915 | 0.0025309319193027365 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6918807350160375 | 3309 | 1372160 |
| 6 | 16 | 0.01 | 0.02 | 50 | 0.0018925281685271552 | 0.000984118277042029 | 0.004936917169500823 | 0.006941431670281995 | 9.117095213412174 | 0.005730834146587149 | 0.6534437359456525 | 3322 | 823296 |
| 7 | 16 | 0.01 | 0.05 | 50 | 0.0018990916185250123 | 0.0009902132365105485 | 0.004936917169500823 | 0.006073752711496746 | 9.117199815200195 | 0.003914188323391299 | 0.6598586082001995 | 3267 | 4083712 |

## Frozen winner

Winner: order 4, factors 16, learning rate 0.005, regularization 0.02, epochs 50.

Primary unrounded NDCG@10: 0.0033685696998510175.

The selection rule was frozen before validation: unrounded NDCG@10, then MAP@10, HitRate@10, fewer factors, higher regularization, lower learning rate, and canonical configuration order.

## Boundaries

This is biased matrix factorization trained by SGD over observed ratings, not classical SVD. Missing entries are absent, never zero-valued ratings.

The training data are strongly positive-skewed; 50.02% of train users have no within-user rating variance and 64.35% have only positive ratings. The model may therefore be bias- or popularity-dominated.

Historical Amazon subjects are research pseudonyms, not Groovehaus customers. No factors or subject-level records are serialized, and no model is production-integrated.

The historical test split remained unread throughout grid training, scoring, and selection.
