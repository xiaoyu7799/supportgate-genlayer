# OCI release gate model

The first SupportGate release bound an artifact digest to a declared Ubuntu
codename. The OCI release adds independent builder authorization on-chain
and validates the relationship between the built image and the approved Ubuntu
base in the pipeline.

- `propose_oci` fixes the owner, image manifest digest, base manifest digest,
  builder wallet, codename and target environment. Legacy `propose` records
  remain possible on this deployment for compatibility.
- `attest_build` accepts an exact subject, base and proof digest once, from the
  recorded builder. It requires a distinct wallet. Without it an OCI ticket
  cannot be evaluated. Legacy declarations cannot satisfy the OCI CLI.
- `evaluate` and `release` keep the original independent validator fetch and
  strict equality. Every successful release rechecks Ubuntu's `Supported`
  flag at execution. The gate reads only finalized state and times out
  approvals after 24 hours. A superseded ticket fails even during that window.
- The CI verifier hashes raw subject and proof bytes, recomputes the base hash,
  compares the complete ordered prefix of base layer descriptors, pins the
  base-to-codename mapping and validates release/attestation identities.
  The caller must supply the exact manifest bytes corresponding to the
  registry digest used in the next step. Keep the policy and verifier on a
  protected revision and never load them from a pull-request build artifact.

## CI sequence

Resolve the registry's intended platform manifest by digest. Save its raw bytes
without formatting or using a tag lookup at promotion time. Retrieve the
builder-produced proof and set the finalized ticket ID. Run
`scripts/check-oci-release.mjs` as a required step immediately before promotion.
Pass the very same immutable image digest to the next command. A nonzero gate
exit denies promotion. The command makes no registry writes.

The independent approval validates Ubuntu's published LTS upgrade-feed flag.
The OCI proof establishes inherited layer descriptors relative to a trusted
base hash. Later layers can override base files. This workflow neither proves
every build invocation nor replaces OS or vulnerability scanning, image
signature or registry controls. The demo uses a public Ubuntu amd64 base with a
single added deterministic tar layer. The manifest, config, tar as Base64 and
proof are under `evidence/oci/builds`. No registry promotion was performed.

## Demo outcomes

| Ticket | Final state | Evidence |
| --- | --- | --- |
| Billing RC1 | SUPERSEDED | It was released, then explicitly replaced by RC2 |
| Billing RC2 | RELEASED | Trusted builder, Ubuntu Noble, production |
| Search Indexer | RELEASED | Different owner and builder, Ubuntu Jammy, staging |
| Legacy Worker | BLOCKED | Deliberate Dapper policy negative, release rejected |
| Metrics Exporter | PROPOSED | No valid attestation. Wrong wallet, changed digest and early evaluation rejected |
| Batch Scheduler | CANCELLED | Owner withdrew the proposed staging release |

To reproduce on a new contract, use a fresh working copy without
`evidence/oci/live.json`. Run `node scripts/live-oci.mjs` once at a time. On
interruption, preserve its journal and disposable local signers to resume
recorded hashes. The script uses the Studio faucet and cleans up its signers
when the run is complete. The existing read-only verifier makes no writes
to the network and records a fresh local verification file.
