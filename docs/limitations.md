# Technical limitations

## Ubuntu support signal

- The official meta-release-lts Supported flag describes Ubuntu's release-upgrader policy. It does not establish Ubuntu Pro/ESM entitlement, a security patch SLA, absence of CVEs, package compatibility or support for a particular workload. No security or compliance certification is implied.
- The contract checks the declared Ubuntu codename against the official feed. It does not extract or attest the codename from the image. A consuming CI system must verify base-image provenance separately; an operator can otherwise misdeclare the artifact.
- HTTPS and the authoritative Ubuntu feed remain external dependencies. Validators independently fetch and compare the result, but consensus cannot correct a consistently wrong official source. A source change during validation can prevent agreement; retrying is possible.
- Support observations are historical. The release transaction fetches the source again. The OCI CLI consumer also rejects finalized approvals older than 24 hours; older records remain readable for audit.

## OCI proof boundary

- The on-chain builder field is a wallet address, not a verified real-world identity or organization credential. The contract requires the builder wallet to differ from the proposal owner and permits that builder to attest once while the ticket is PROPOSED.
- The contract stores the subject digest, base digest, proof digest and attestation time. It does not parse OCI manifest or proof bytes on-chain. scripts/oci-proof.mjs performs the byte-level checks off-chain.
- The current proof checker verifies the raw subject-manifest digest, embedded base-manifest digest and exact ordered base-layer descriptor prefix. It does not verify every layer's contents, the complete build invocation, the identity of the registry that supplied the bytes, or the runtime behavior of the image.
- Later image layers can override files inherited from the base image. The proof is not a complete filesystem or security equivalence claim.
- The demo uses locally retained OCI manifest/config/layer artifacts. No OCI registry promotion or registry write was performed. The release checker is read-only; a trusted consuming CI pipeline must call it immediately before promotion and pass the same immutable digest to the promotion command.
- The base-manifest digest-to-codename mapping, release owner, trusted builder, application and environment must be pinned in a protected CI policy. Do not load the policy or verifier from an untrusted pull-request artifact.
- A finalized approval is rejected by the OCI CLI when its checked_at timestamp is more than 24 hours old. The contract itself still rechecks the Ubuntu feed during release.

## Operational scope

- SupportGate records and checks release approvals. It does not build images, publish to a registry, deploy workloads, schedule releases, monitor deployments, roll back releases, scan vulnerabilities or verify runtime health.
- Stable Studionet is a development network and may reset or become unavailable. Do not rely on it as the sole production control. All on-chain records and references are public; never submit secrets or personal information.
- EIP-1193 interfaces vary by wallet and version. The application supports EIP-6963 and legacy injected-provider discovery, and its disposable signer demonstrates the real provider signing path. This is not proof that every named wallet or mobile browser has been tested.
- Each contract instance is bounded to 2,000 tickets globally, 100 per owner and 32 source observations per ticket. Reads are paginated up to 50 entries. At a limit, deploy a new instance; there is no in-place migration or administrator override.
- Local tests and schema acceptance are not chain acceptance. The OCI milestone's actual deployment, operation receipts and finalized state readbacks are recorded separately in evidence/oci/verification.json and evidence/oci/live.json.
