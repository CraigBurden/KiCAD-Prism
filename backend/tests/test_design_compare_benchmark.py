import json
import tempfile
import threading
import unittest
from pathlib import Path

from app.services.design_compare_benchmark import DesignCompareBenchmark


class DesignCompareBenchmarkTests(unittest.TestCase):
    def test_records_parallel_scopes_and_publishes_atomically(self) -> None:
        benchmark = DesignCompareBenchmark(
            job_id="benchmark-test",
            metadata={"base": "old", "compare": "new"},
        )
        barrier = threading.Barrier(2)

        def worker(scope: str) -> None:
            with benchmark.span("semantic-index", scope=scope):
                barrier.wait(timeout=2)

        threads = [
            threading.Thread(target=worker, args=(f"revision:{side}",), name=side)
            for side in ("old", "new")
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=2)

        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "benchmark.json"
            benchmark.write(path)
            payload = json.loads(path.read_text(encoding="utf-8"))

        self.assertEqual(payload["schema"], "prism.design_compare_benchmark_a0")
        self.assertEqual(payload["metadata"]["base"], "old")
        self.assertEqual(
            {event["scope"] for event in payload["events"]},
            {"revision:old", "revision:new"},
        )
        self.assertTrue(all(event["elapsedMs"] >= 0 for event in payload["events"]))
        self.assertTrue(all(event["cpuMs"] >= 0 for event in payload["events"]))


if __name__ == "__main__":
    unittest.main()
