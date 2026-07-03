# API Routes

Implemented routes live in this tree for health, products, search, recommendations, registration/login/logout/session restoration, profile/preferences/account deletion, interactions, wishlist, cart, ratings, and guest-state merge.

Keep handlers thin: validate origin/session/body/parameters as applicable, call a service, then return through `src/lib/http.js`. Product and search routes share the same repository-backed query service; protected mutations derive ownership only from the verified session.
