# Contract and consensus

The contract stores JSON ticket records in a `TreeMap[str, str]` and a bounded index. Ticket IDs are `lowercase-owner-address:reference`. Manifest fields cannot be edited. There are at most 2,000 tickets globally, 100 per owner and 32 source observations per ticket. Reads are paginated up to 50 entries. A full instance requires deploying a new instance; there is no administrator override or upgrade path.

## State transitions

| Current state | Call | Actor | Result |
| --- | --- | --- | --- |
| — | propose | Any wallet | PROPOSED |
| PROPOSED, READY, BLOCKED | evaluate | Any wallet | READY or BLOCKED |
| READY | release(id, expected_revision) | Proposer | RELEASED or BLOCKED after fresh consensus |
| PROPOSED, READY, BLOCKED | cancel | Proposer | CANCELLED |
| RELEASED | supersede(id, replacement_id) | Proposer | SUPERSEDED, preserving replacement pointer |

CANCELLED and SUPERSEDED are terminal. RELEASED can only be superseded, never modified or cancelled. A replacement must be a different released ticket with the same owner, application and environment, and no earlier creation time. Replacement chains cannot cycle because a superseded ticket cannot be selected as a released replacement.

## Source verification

The sole URL is hardcoded: `https://changelogs.ubuntu.com/meta-release-lts`. User-controlled URLs are never fetched. The parser rejects non-200 responses, oversized payloads, duplicate keys, duplicate matching codenames, invalid support flags and malformed matching LTS records. Unknown codenames produce a specific negative result. Only `Supported: 1` in a matching LTS block allows a release.

The leader fetches the feed; each validator independently fetches and parses it. `gl.vm.run_nondet_unsafe(fetch, validate)` accepts a `gl.vm.Return` only when canonical JSON of the independently obtained result equals the candidate exactly. Equality includes source URL, codename, found flag, supported flag, version and name. There is no numeric tolerance, model interpretation, provider fallback or leader-only bypass. A source change during consensus can prevent agreement; this is intentional and retryable. No fields are written before consensus returns.

At release, the owner and expected revision are checked first. The source is fetched again in that same transaction. If support has ended, the call successfully records BLOCKED and an explicit RELEASE_BLOCKED observation. Infrastructure or consensus failure instead aborts without writing the ticket.

Observation timestamps use the deterministic transaction context `gl.message_raw['datetime']`, not an LLM or independently fetched clock. Every evaluation increments the revision. Stale release approvals fail before source retrieval. The source result is a historical observation at transaction time, not a permanent assertion of support.

## Application

Vite builds a static application. `genlayer-js@1.1.8` uses the `studionet` chain definition and a selected EIP-1193 provider. EIP-6963 discovery and legacy injected providers are supported. Chain 61999 is verified before signing; no value is sent and `leaderOnly` is false.

`src/chain.js` polls the real transaction. FINALIZED alone is insufficient: successful execution must also be present. The app then fetches the affected ticket using `TransactionHashVariant.LATEST_FINAL`. UI success is based on that readback. Records and source flags are never synthesized locally. Session storage contains only a pending transaction hash, ticket ID and contract address; it is not a business-state database.

A CI consumer hashes the actual local artifact and checks the exact finalized release record, including a 24-hour freshness bound. Teams must separately prove base-image provenance. SupportGate records an approval, not execution of deployment or runtime safety.
