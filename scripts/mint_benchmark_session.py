#!/usr/bin/env python3
"""Mint a signed kicad_prism_session for capacity/load benchmarks.

Uses SESSION_SECRET and BOOTSTRAP_ADMIN_USERS_STR from KiCAD-Prism/.env so the
cookie passes AUTH_ENABLED role checks without a DB role row.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import time
from pathlib import Path


def load_dotenv(path: Path) -> dict[str, str]:
    vals: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        vals[key.strip()] = value.strip().strip('"').strip("'")
    return vals


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        default=str(Path(__file__).resolve().parents[1] / ".env"),
    )
    parser.add_argument("--email", default="", help="Override email (default: first BOOTSTRAP_ADMIN)")
    parser.add_argument("--role", default="admin")
    parser.add_argument(
        "--output",
        default="/tmp/prism-benchmark-session.txt",
        help="Write raw cookie value here",
    )
    args = parser.parse_args()

    env = load_dotenv(Path(args.env_file))
    secret = env.get("SESSION_SECRET") or ""
    if not secret:
        raise SystemExit("SESSION_SECRET missing from env file")

    email = (args.email or (env.get("BOOTSTRAP_ADMIN_USERS_STR") or "").split(",")[0]).strip().lower()
    if not email or "@" not in email:
        raise SystemExit("Provide --email or BOOTSTRAP_ADMIN_USERS_STR")

    ttl_hours = int(env.get("SESSION_TTL_HOURS") or "12")
    now = int(time.time())
    payload = {
        "email": email,
        "name": "Capacity Hammer",
        "picture": "",
        "role": args.role,
        "iat": now,
        "exp": now + ttl_hours * 3600,
    }
    encoded = b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = b64(hmac.new(secret.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha256).digest())
    token = f"v1.{encoded}.{signature}"

    out = Path(args.output)
    out.write_text(token, encoding="utf-8")
    print(f"Wrote {out}")
    print(f"email={email}")
    print("export PRISM_BENCHMARK_SESSION_COOKIE=\"$(cat %s)\"" % out)


if __name__ == "__main__":
    main()
