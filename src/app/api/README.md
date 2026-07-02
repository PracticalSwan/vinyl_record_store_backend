# API Routes

Implemented routes live in this tree for health, products, search, product recommendations, and user recommendations.

Keep handlers thin: validate or call a service, then return through `src/lib/http.js`.
