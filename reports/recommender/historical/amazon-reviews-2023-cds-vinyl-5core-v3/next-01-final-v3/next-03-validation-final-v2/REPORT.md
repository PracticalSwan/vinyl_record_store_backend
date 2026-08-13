# NEXT-03 Biased Matrix Factorization Validation

Status: validation-complete; final test not yet authorized by this artifact.

Dataset: `amazon-reviews-2023-cds-vinyl-5core-v3`

Experiment contract digest: `3c47a2acaaa3d18283fd8a73b00ffee756f3490d7c174e9c84e464d14c62d3a1`

Candidate implementation digest: `5cef69f14dac7981292da159d72b437e09176a027a747d3724eb82857d601c3d`

Every configuration fitted all observed train ratings for 2,387 structurally eligible subjects. Metrics use the canonical 1,823-subject validation-target-positive cohort and unchanged full-catalog exclusions.

| Order | Factors | Learning rate | Regularization | Epochs | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization | RMSE | Elapsed ms | Peak RSS delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 8 | 0.005 | 0.02 | 50 | 0.0033266644186245244 | 0.002535285461780251 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6906351831181976 | 1138 | 6352896 |
| 1 | 8 | 0.005 | 0.05 | 50 | 0.0033214919096312915 | 0.0025309319193027365 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6921014256793908 | 1422 | 6017024 |
| 2 | 8 | 0.01 | 0.02 | 50 | 0.0019176229066233579 | 0.001010239531907113 | 0.004936917169500823 | 0.005639913232104121 | 9.117187263434396 | 0.0032660485942045403 | 0.6598422423808774 | 1289 | 7524352 |
| 3 | 8 | 0.01 | 0.05 | 50 | 0.001924186356621215 | 0.0010163344913756325 | 0.004936917169500823 | 0.004772234273318872 | 9.117182155951983 | 0.0032626164161516646 | 0.6641057086909098 | 1295 | 6119424 |
| 4 | 16 | 0.005 | 0.02 | 50 | 0.0033685696998510175 | 0.0025796915950508934 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.690355159273313 | 1529 | 5799936 |
| 5 | 16 | 0.005 | 0.05 | 50 | 0.0033214919096312915 | 0.0025309319193027365 | 0.006034009873834339 | 0.005639913232104121 | 8.459914696132849 | 0.006904759468224553 | 0.6918807350160375 | 1477 | 0 |
| 6 | 16 | 0.01 | 0.02 | 50 | 0.0018925281685271552 | 0.000984118277042029 | 0.004936917169500823 | 0.006941431670281995 | 9.117095213412174 | 0.005730834146587149 | 0.6534437359456525 | 1568 | 3579904 |
| 7 | 16 | 0.01 | 0.05 | 50 | 0.0018990916185250123 | 0.0009902132365105485 | 0.004936917169500823 | 0.006073752711496746 | 9.117199815200195 | 0.003914188323391299 | 0.6598586082001995 | 1415 | 1314816 |

## Frozen winner

Winner: order 4, factors 16, learning rate 0.005, regularization 0.02, epochs 50.

Primary unrounded NDCG@10: 0.0033685696998510175.

The selection rule was frozen before validation: unrounded NDCG@10, then MAP@10, HitRate@10, fewer factors, higher regularization, lower learning rate, and canonical configuration order.

## Boundaries

This is biased matrix factorization trained by SGD over observed ratings, not classical SVD. Missing entries are absent, never zero-valued ratings.

The training data are strongly positive-skewed; 50.02% of train users have no within-user rating variance and 64.35% have only positive ratings. The model may therefore be bias- or popularity-dominated.

Historical Amazon subjects are research pseudonyms, not Groovehaus customers. No factors or subject-level records are serialized, and no model is production-integrated.

The historical test split remained unread throughout grid training, scoring, and selection.
