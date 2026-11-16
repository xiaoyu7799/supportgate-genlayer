# Technical limitations

- The official meta-release-lts `Supported` flag describes Ubuntu's release-upgrader policy. It does not establish an Ubuntu Pro / ESM entitlement, a security patch SLA, absence of CVEs or support for any particular package. No security or compliance certification is implied.
- The artifact's declared codename is not extracted or attested by the contract. CI must verify base-image provenance separately; otherwise an operator can misdeclare an artifact. The digest still binds the public declaration to one exact artifact.
- HTTPS and the authoritative source remain external dependencies. GenLayer consensus removes reliance on a single app operator's retrieval but cannot correct a consistently wrong official source.
- Support observations are historical. The release call always rechecks; the optional CI consumer additionally refuses approvals older than 24 hours. Older records remain readable for audit.
- The product has no deployer, scheduler, automatic monitor, funds, token rewards or administrative override. A deployment system must explicitly consume the approval.
- Stable Studionet is a development network and may reset or become unavailable. Do not rely on it as the sole production control. All records and references are public; never enter secrets or personal information.
- EIP-1193 interfaces vary between wallet versions. Supported discovery and switching code is not proof that every named wallet has been tested. Live wallet and mobile-browser compatibility must be recorded separately.
- Each instance has bounded storage and per-ticket history. At the history limit, create a new manifest; at registry capacity deploy a new instance. There is no in-place migration.
- Deployment, chain lifecycle acceptance and injected-wallet signing are not established by local tests or schema acceptance. Only real public receipts and finalized readbacks establish those results.
