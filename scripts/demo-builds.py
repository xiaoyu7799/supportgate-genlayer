"""Produce reproducible single-platform OCI manifests with an added test layer.

Use exact Registry V2 manifest and config bytes for each base. Store the resulting
manifest, config and uncompressed tar blob by their SHA-256 descriptors.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main():
    base_path, config_path, label, folder = sys.argv[1:]
    base_bytes = Path(base_path).read_bytes()
    base = json.loads(base_bytes)
    config_bytes = Path(config_path).read_bytes()
    if digest(config_bytes) != base["config"]["digest"]:
        raise ValueError("Base configuration digest mismatch")
    config = json.loads(config_bytes)
    data = (label + "\n").encode()
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        entry = tarfile.TarInfo("supportgate-release.txt")
        entry.size = len(data)
        entry.mode = 0o644
        archive.addfile(entry, io.BytesIO(data))
    layer = buffer.getvalue()
    config["rootfs"]["diff_ids"].append(digest(layer))
    config.setdefault("history", []).append({"created_by": "COPY supportgate-release.txt /supportgate-release.txt"})
    config_bytes = encoded(config)
    subject = {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "layers": [*base["layers"], {"digest": digest(layer), "size": len(layer),
                                    "mediaType": "application/vnd.oci.image.layer.v1.tar"}],
        "config": {"digest": digest(config_bytes), "size": len(config_bytes),
                   "mediaType": "application/vnd.oci.image.config.v1+json"},
    }
    output = Path(folder)
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_bytes(encoded(subject))
    (output / "config.json").write_bytes(config_bytes)
    (output / "layer.tar").write_bytes(layer)


if __name__ == "__main__":
    main()
