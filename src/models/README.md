# Mongoose Models

This directory defines strict, timestamped schemas for users, vinyl records, interactions, wishlists, carts, ratings, guest-merge receipts, demo orders, recommendation logs, audit logs, and counters.

Schemas enforce public-ID, enum, uniqueness, and list constraints. Interactions and recommendation logs use 90-day expiry fields with TTL indexes. Sensitive identity and subject fields are excluded from normal query selection.

Authentication and customer-state routes actively use the user, interaction, wishlist, cart, rating, and guest-merge models. Demo-order, recommendation-request-log, and administrator catalog routes remain deferred.
