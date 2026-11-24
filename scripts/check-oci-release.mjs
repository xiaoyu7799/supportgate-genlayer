import { checkApproval, checkProof, readBounded } from './oci-proof.mjs';
import { chain, read } from './oci-runtime.mjs';

const [id, manifest, evidence, policyPath] = process.argv.slice(2);
if (!id || !manifest || !evidence || !policyPath) {
  throw new Error('Usage: node scripts/check-oci-release.mjs TICKET_ID MANIFEST PROOF POLICY');
}
const [subjectBytes, proofBytes, policyBytes] = await Promise.all([
  readBounded(manifest,262144), readBounded(evidence,400000), readBounded(policyPath,65536),
]);
const policy = JSON.parse(policyBytes);
if (policy.chainId !== 61999 || !/^0x[0-9a-f]{40}$/i.test(policy.contract)) {
  throw new Error('Release denied: pin a Stable Studionet contract in trusted CI policy');
}
const proof = checkProof(subjectBytes,proofBytes);
await chain();
const protocol = await read(policy.contract,'get_protocol');
if (protocol.name !== 'SupportGate' || protocol.version !== 2 || !protocol.oci_builder_attestation) {
  throw new Error('Release denied: incompatible contract');
}
const ticket = await read(policy.contract,'get_ticket',[id]);
checkApproval(ticket,proof,policy);
console.log(JSON.stringify({decision:'ALLOW',id,artifact:'sha256:'+proof.subject_sha256,
  base:'sha256:'+proof.base_sha256,builder:ticket.provenance.builder,environment:ticket.environment}));
