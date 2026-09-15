"""Optional FIBA LiveStats reader for historical shot-feed experiments."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


FIBA_DATA_URL = "https://fibalivestats.dcd.shared.geniussports.com/data/{match_id}/data.json"


class FibaLiveStatsError(RuntimeError):
    """Raised when a FIBA LiveStats payload cannot be retrieved or decoded."""


@dataclass(frozen=True)
class FibaLiveStatsClient:
    timeout_seconds: float = 20.0

    def get_data(self, match_id: str) -> dict[str, Any]:
        url = FIBA_DATA_URL.format(match_id=match_id)
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "KorisIQ/0.1"})
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except (HTTPError, URLError, TimeoutError) as exc:
            raise FibaLiveStatsError(f"FIBA LiveStats request failed: {exc}") from exc
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise FibaLiveStatsError("FIBA LiveStats returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise FibaLiveStatsError("FIBA LiveStats returned an unexpected payload")
        return payload
