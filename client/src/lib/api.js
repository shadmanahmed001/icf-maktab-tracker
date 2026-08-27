/**
 * API entry point.
 *
 * A single indirection so the transport can be swapped at build time: the demo
 * build aliases './api.impl' to a fixture-backed client. Every other module
 * imports from here and is unaware of which one it got — so there is exactly
 * one switch point rather than a pattern that has to match every import path.
 */
export { api, ApiError } from './api.impl';
