# Mongoose Models

This directory defines strict, timestamped schemas for users, vinyl records, interactions, wishlists, carts, ratings, demo orders, recommendation logs, audit logs, and counters.

Schemas enforce public-ID, enum, uniqueness, and list constraints. Interactions and recommendation logs use 90-day expiry fields with TTL indexes. Sensitive identity and subject fields are excluded from normal query selection.

Models provide the persistence boundary only. No authentication or customer write API is implemented yet.
