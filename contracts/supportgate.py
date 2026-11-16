# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
from datetime import datetime

SOURCE = "https://changelogs.ubuntu.com/meta-release-lts"


def pack(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def require(ok, code):
    if not ok:
        raise ValueError(code)


def clean(value, low, high):
    require(isinstance(value, str) and low <= len(value) <= high, "INVALID_TEXT")
    require(value == value.strip() and all(ord(c) >= 32 and ord(c) != 127 for c in value), "INVALID_TEXT")
    return value


def now():
    return int(datetime.fromisoformat(gl.message_raw["datetime"].replace("Z", "+00:00")).timestamp())


def parse_release(body, codename):
    require(len(body) <= 200000 and "Dist: " in body, "INVALID_SOURCE")
    matches = []
    for block in body.replace("\r\n", "\n").strip().split("\n\n"):
        fields = {}
        for line in block.split("\n"):
            if ": " in line:
                key, value = line.split(": ", 1)
                require(key not in fields, "DUPLICATE_SOURCE_FIELD")
                fields[key] = value.strip()
        if fields.get("Dist") == codename:
            matches.append(fields)
    require(len(matches) <= 1, "AMBIGUOUS_RELEASE")
    if not matches:
        return {"codename": codename, "found": False, "supported": False, "version": "", "name": "", "source": SOURCE}
    fields = matches[0]
    require(fields.get("Supported") in ["0", "1"], "INVALID_SUPPORTED_FLAG")
    require("LTS" in fields.get("Version", "") and len(fields.get("Name", "")) > 0, "INVALID_LTS_RECORD")
    return {"codename": codename, "found": True, "supported": fields["Supported"] == "1", "version": fields["Version"], "name": fields["Name"], "source": SOURCE}


class SupportGate(gl.Contract):
    tickets: TreeMap[str, str]
    ids: str

    def __init__(self):
        self.ids = "[]"

    def _load(self, ticket_id):
        raw = self.tickets.get(ticket_id, "")
        require(bool(raw), "TICKET_NOT_FOUND")
        return json.loads(raw)

    def _save(self, ticket):
        self.tickets[ticket["id"]] = pack(ticket)

    def _owner(self, ticket):
        require(str(gl.message.sender_address).lower() == ticket["owner"], "OWNER_ONLY")

    def _check(self, ticket):
        codename = ticket["codename"]

        def fetch():
            response = gl.nondet.web.get(SOURCE)
            require(response.status == 200, "SOURCE_UNAVAILABLE")
            return parse_release(response.body.decode("utf-8"), codename)

        def validate(candidate):
            if not isinstance(candidate, gl.vm.Return):
                return False
            try:
                return pack(candidate.calldata) == pack(fetch())
            except Exception:
                return False

        return gl.vm.run_nondet_unsafe(fetch, validate)

    def _event(self, ticket, action, result):
        require(len(ticket["history"]) < 32, "HISTORY_LIMIT")
        ticket["history"].append({"action": action, "at": now(), "actor": str(gl.message.sender_address).lower(), "source": result})
        ticket["source"] = result
        ticket["checked_at"] = now()
        ticket["revision"] += 1

    @gl.public.write
    def propose(self, reference: str, application: str, artifact_sha256: str, codename: str, environment: str) -> str:
        reference = clean(reference, 3, 40)
        require(all(c in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in reference), "INVALID_REFERENCE")
        application = clean(application, 2, 80)
        require(len(artifact_sha256) == 64 and all(c in "0123456789abcdef" for c in artifact_sha256), "INVALID_DIGEST")
        require(2 <= len(codename) <= 24 and all(c in "abcdefghijklmnopqrstuvwxyz" for c in codename), "INVALID_CODENAME")
        require(environment in ["staging", "production"], "INVALID_ENVIRONMENT")
        owner = str(gl.message.sender_address).lower()
        ticket_id = owner + ":" + reference
        require(not self.tickets.get(ticket_id, ""), "DUPLICATE_REFERENCE")
        ids = json.loads(self.ids)
        require(len(ids) < 2000, "REGISTRY_FULL")
        require(sum(1 for entry in ids if entry.startswith(owner + ":")) < 100, "OWNER_LIMIT")
        ticket = {"id": ticket_id, "reference": reference, "owner": owner, "application": application, "artifact_sha256": artifact_sha256, "codename": codename, "environment": environment, "state": "PROPOSED", "revision": 0, "created_at": now(), "checked_at": 0, "source": None, "history": [], "superseded_by": ""}
        self._save(ticket)
        ids.append(ticket_id)
        self.ids = pack(ids)
        return ticket_id

    @gl.public.write
    def evaluate(self, ticket_id: str) -> str:
        ticket = self._load(ticket_id)
        require(ticket["state"] in ["PROPOSED", "READY", "BLOCKED"], "TERMINAL_STATE")
        result = self._check(ticket)
        self._event(ticket, "EVALUATE", result)
        ticket["state"] = "READY" if result["found"] and result["supported"] else "BLOCKED"
        self._save(ticket)
        return pack(ticket)

    @gl.public.write
    def release(self, ticket_id: str, expected_revision: int) -> str:
        ticket = self._load(ticket_id)
        self._owner(ticket)
        require(ticket["state"] == "READY", "NOT_READY")
        require(type(expected_revision) is int and expected_revision == ticket["revision"], "STALE_REVISION")
        # Re-fetch inside the release transaction: READY is never a cached permit.
        result = self._check(ticket)
        self._event(ticket, "RELEASE" if result["found"] and result["supported"] else "RELEASE_BLOCKED", result)
        ticket["state"] = "RELEASED" if result["found"] and result["supported"] else "BLOCKED"
        self._save(ticket)
        return pack(ticket)

    @gl.public.write
    def cancel(self, ticket_id: str) -> str:
        ticket = self._load(ticket_id)
        self._owner(ticket)
        require(ticket["state"] in ["PROPOSED", "READY", "BLOCKED"], "TERMINAL_STATE")
        ticket["state"] = "CANCELLED"
        ticket["revision"] += 1
        self._save(ticket)
        return pack(ticket)

    @gl.public.write
    def supersede(self, ticket_id: str, replacement_id: str) -> str:
        ticket = self._load(ticket_id)
        self._owner(ticket)
        require(ticket["state"] == "RELEASED", "NOT_RELEASED")
        replacement = self._load(replacement_id)
        require(replacement_id != ticket_id and replacement["owner"] == ticket["owner"] and replacement["application"] == ticket["application"] and replacement["environment"] == ticket["environment"] and replacement["state"] == "RELEASED" and replacement["created_at"] >= ticket["created_at"], "INVALID_REPLACEMENT")
        ticket["state"] = "SUPERSEDED"
        ticket["superseded_by"] = replacement_id
        ticket["revision"] += 1
        self._save(ticket)
        return pack(ticket)

    @gl.public.view
    def get_ticket(self, ticket_id: str) -> str:
        return pack(self._load(ticket_id))

    @gl.public.view
    def list_tickets(self, offset: int, limit: int) -> str:
        require(type(offset) is int and offset >= 0 and type(limit) is int and 1 <= limit <= 50, "INVALID_PAGE")
        ids = json.loads(self.ids)
        return pack({"total": len(ids), "items": [self._load(entry) for entry in ids[offset:offset + limit]]})

    @gl.public.view
    def get_protocol(self) -> str:
        return pack({"name": "SupportGate", "version": 1, "chain_id": 61999, "source": SOURCE, "policy": "Ubuntu meta-release-lts Supported == 1", "release_rechecks_source": True})
