# Contract and application architecture

## Deployment identity

- Network: GenLayer Stable Studionet, chain ID 61999.
- RPC: https://studio.genlayer.com/api
- Contract: SupportGate, protocol version 2.
- Current deployed address: 0xD252920A2995Af73aD1cbA2c38AfbcE5C01C5990.
- SDK: genlayer-js 2.0.0.
- The deployed Python source is compared byte-for-byte with contracts/supportgate.py. Its SHA-256 is recorded in public/deployment.json and evidence/oci/verification.json.

The contract retains the original Ubuntu LTS support decision workflow and adds an OCI builder-attestation path. The two proposal methods coexist for compatibility.

## Ubuntu support decision

The only external source is Ubuntu's official meta-release-lts feed:

https://changelogs.ubuntu.com/meta-release-lts

The contract parses the matching LTS release block and uses its Supported flag. The leader retrieves the source; validators independently retrieve and parse it. gl.vm.run_nondet_unsafe accepts the candidate only when the canonical JSON result exactly matches the independently obtained result. The comparison includes the source URL, codename, found flag, supported flag, version and release name.

The source is fetched again during release. A READY observation is not a cached permit: release checks the expected revision and re-evaluates the current source in the same transaction. If the source now denies support, the transaction records BLOCKED rather than releasing.

## Ticket lifecycle

| Call | Authorization | Result |
| --- | --- | --- |
| propose | Any wallet | Creates a legacy manifest in PROPOSED |
| propose_oci | Any wallet | Creates an OCI manifest in PROPOSED with base digest and designated builder |
| attest_build | Designated builder only; once; while PROPOSED | Stores the proof digest and attestation time; increments revision |
| evaluate | Any wallet; OCI tickets require an attestation | READY or BLOCKED after GenLayer source consensus |
| release(id, expected_revision) | Ticket owner; current revision required | RELEASED or BLOCKED after a fresh source check |
| cancel | Ticket owner | CANCELLED |
| supersede | Ticket owner | Marks a released ticket SUPERSEDED and links a newer compatible released ticket |

A replacement must have the same owner, application and environment, must itself be RELEASED, and cannot have an earlier creation time. CANCELLED and SUPERSEDED are terminal. A RELEASED ticket cannot be edited or cancelled.

The three read methods are get_ticket, list_tickets and get_protocol. The deployed contract has 10 public methods: 7 writes and 3 views.

## OCI builder provenance

propose_oci records the immutable subject manifest digest, base manifest digest, codename, environment and builder wallet. The builder must be a valid address distinct from the proposal owner.

attest_build is restricted to that designated builder. It accepts one attestation while the ticket is PROPOSED and checks that the supplied subject and base digests match the proposal. The contract stores the proof digest and timestamp; it does not receive or parse the full OCI manifest or proof bytes.

The off-chain verifier in scripts/oci-proof.mjs checks the raw subject manifest digest, the embedded base manifest digest, and that the subject manifest begins with the exact ordered base-layer descriptors. It also calculates the proof digest. scripts/check-oci-release.mjs then checks the finalized on-chain ticket against a trusted policy: chain and contract identity, release state, Ubuntu support result, approval age, release owner, trusted builder, application, environment, exact artifact/base/proof digests and pinned base-to-codename mapping.

The checker is read-only. It returns ALLOW or exits nonzero with a denial reason; it does not publish an image or write to a registry. A consuming CI pipeline must protect its policy and verifier, run the check immediately before promotion, and pass the same immutable image digest to the promotion step.

## Application

The Vite application uses genlayer-js 2.0.0 and the Stable Studionet chain definition. It discovers injected wallets through EIP-6963 and legacy provider injection, verifies chain 61999 before signing, and supports an optional disposable EIP-1193 Studionet signer.

The application polls the real transaction until FINALIZED and requires successful execution. It then reads the affected ticket with TransactionHashVariant.LATEST_FINAL. UI state is based on that finalized readback, not on a submitted transaction or a local mock.

The optional browser signer uses a real secp256k1 key and Studio faucet funding. Its private key remains in the current tab's memory and is not exported or stored in browser persistence. This demonstrates the provider connection and signing path; it does not certify the individual interfaces of every third-party wallet.
