# Mongoose Models

This directory defines strict, timestamped schemas for users, vinyl records, interactions, wishlists, carts, ratings, guest-merge receipts, demo orders, recommendation logs, audit logs, and counters.

Schemas enforce public-ID, enum, uniqueness, and list constraints. Interactions and recommendation logs use 90-day expiry fields with TTL indexes. Sensitive identity and subject fields are excluded from normal query selection.

Authentication, customer-state routes, request logging, catalog import, offline evaluation, and the default-off personalization batch actively use the user, vinyl-record, interaction, recommendation-log, wishlist, cart, rating, guest-merge, and feedback models. Demo-order routes remain deferred.
