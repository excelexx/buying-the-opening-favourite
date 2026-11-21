"""Read the U.S. roster and verified feature tapes from authorized archives in place."""
import json
from contextlib import ExitStack
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile

from .core import Event

ROOT = Path(__file__).resolve().parents[1]
CALENDAR = ROOT / "data/us-calendar.json"


CALENDAR_SHA256 = "e6332c46fd60a212fc10464aea28e76b2250168c9960c14d3110094f529c122b"


def population(source=None):
    """Read archived members, or rebuild in memory from Kalshi when source is None."""
    roster = CALENDAR.read_bytes()
    if sha256(roster).hexdigest() != CALENDAR_SHA256:
        raise ValueError("The U.S. replay roster differs from the frozen manifest")
    rows = []
    opened = {}
    with ExitStack() as stack:
        for case in json.loads(roster):
            tape = []
            if case["ticker"]:
                if source is None:
                    from .kalshi import normalize, source_pages
                    raw = normalize(case, *source_pages(case))
                else:
                    name = case["bundle"]
                    if name not in opened:
                        opened[name] = stack.enter_context(ZipFile(source / name))
                    raw = opened[name].read(case["member"])
                if sha256(raw).hexdigest() != case["events_sha256"]:
                    raise ValueError(f"Frozen tape mismatch for {case['key']}")
                tape = [Event(*event) for event in json.loads(raw)]
            rows.append((case, tape))
    return rows
