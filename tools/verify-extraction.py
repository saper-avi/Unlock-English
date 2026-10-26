"""Verify original APK and preserved extracted files using the recovery manifest. Python 3.9+."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT / "docs/apk-inventory.json").read_text(encoding="utf-8"))
apk = ROOT / "original/Unlock-English-0.1.0.apk"

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit("FAILED: " + message)

check(digest(apk.read_bytes()) == report["apk_sha256"], "APK hash mismatch")
with zipfile.ZipFile(apk) as archive:
    for item in report["entries"]:
        raw = archive.read(item["apk_path"])
        check(len(raw) == item["bytes"] and digest(raw) == item["sha256"], item["apk_path"])
        name = item["apk_path"]
        if name.startswith("assets/"):
            file = ROOT / "original/web" / name.removeprefix("assets/")
        elif name.startswith("META-INF/"):
            continue  # Original signing files remain in the unchanged APK.
        else:
            file = ROOT / "android-binary" / name
        check(file.read_bytes() == raw, str(file))
print("PASS: APK and every extracted web/native binary file match the uploaded APK byte for byte.")
