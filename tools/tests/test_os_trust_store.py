"""The agent verifies HTTPS through the OS certificate store (truststore).

A frozen macOS agent's own OpenSSL has no usable CA path on a user's Mac, so without
this it could verify no certificate at all. See __main__._use_os_trust_store.
"""

import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import __main__ as agent_main  # noqa: E402


def test_injects_truststore_into_ssl(monkeypatch):
    calls = []
    fake = types.ModuleType("truststore")
    fake.inject_into_ssl = lambda: calls.append("inject")
    monkeypatch.setitem(sys.modules, "truststore", fake)

    agent_main._use_os_trust_store()

    assert calls == ["inject"]


def test_missing_truststore_is_a_warning_not_a_crash(monkeypatch, caplog):
    # None in sys.modules makes `import truststore` raise ImportError.
    monkeypatch.setitem(sys.modules, "truststore", None)

    agent_main._use_os_trust_store()

    assert "truststore" in caplog.text


def test_truststore_is_a_declared_agent_dependency():
    # CI builds the frozen agent from this file; missing here means missing on macOS.
    requirements = Path(agent_main.__file__).with_name("requirements.txt").read_text()
    assert "truststore" in requirements
