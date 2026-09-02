# Fiducia service-discovery watch executable overlay

This repository retains the generated `protocol-e2e` inventory and adds a product-specific, credential-free canary for the public Fiducia sources.

## Resume and recovery semantics

The service-discovery committed-change broadcast is an acceleration channel, not a retained event log. “SSE resume” therefore means:

1. subscribe to the canonical service-domain broadcast before reading;
2. obtain a linearizable, authoritative service snapshot;
3. use revisioned committed deltas as low-latency hints;
4. replace local state after every authoritative snapshot;
5. repair receiver lag from another authoritative snapshot;
6. reconnect by repeating subscribe-before-snapshot rather than claiming `Last-Event-ID` replay.

This avoids silently pretending that an in-memory broadcast can replay events after process restart. Event IDs remain useful monotonic committed-revision hints for ordering and diagnostics.

## What CI executes

`.github/workflows/discovery-watch-canary.yml` checks out immutable commits for:

- `fiducia-cloud/fiducia-node.rs`;
- its generated `fiducia-interfaces` Rust dependency;
- its shared `fiducia-routing.rs` dependency.

It then validates the source-level recovery invariants, confirms the required Rust tests are present in Cargo's test inventory, and executes the complete `discovery::tests` suite. The checks cover register/heartbeat/deregister ordering, metadata filters, organization and service isolation, bounded client queues, lag repair, lease-expiry refresh, revision IDs, authoritative snapshots, and intermediary-cache prevention.

`product-overlay.json` is the machine-readable source pin and behavioral contract. Generated fleet files remain untouched so a future fleet refresh can coexist with this executable overlay.
