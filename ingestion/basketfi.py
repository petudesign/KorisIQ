"""Small read-only client for the public Basket.fi/Torneo JSON endpoints."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://koripallo-api.torneopal.net/taso/rest"


class BasketFiError(RuntimeError):
    """Raised when the public source cannot be read or returns invalid JSON."""


@dataclass(frozen=True)
class BasketFiClient:
    base_url: str = DEFAULT_BASE_URL
    timeout_seconds: float = 20.0
    headers: dict[str, str] = field(
        default_factory=lambda: {
            "Accept": "json/df8e84j9xtdz269euy3h",
            "Origin": "https://tulospalvelu.basket.fi",
            "Referer": "https://tulospalvelu.basket.fi/",
            "User-Agent": "KorisIQ/0.1 (read-only research client)",
        }
    )

    def _get_json(self, method: str, **params: str) -> dict[str, Any]:
        query = urlencode({key: value for key, value in params.items() if value is not None})
        url = f"{self.base_url.rstrip('/')}/{method}"
        if query:
            url = f"{url}?{query}"
        request = Request(url, headers=self.headers, method="GET")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except (HTTPError, URLError, TimeoutError) as exc:
            raise BasketFiError(f"Basket.fi request failed for {method}: {exc}") from exc
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BasketFiError(f"Basket.fi returned non-JSON data for {method}") from exc
        if not isinstance(payload, dict):
            raise BasketFiError(f"Basket.fi returned an unexpected payload for {method}")
        call = payload.get("call")
        if isinstance(call, dict) and call.get("status") not in (None, "ok"):
            raise BasketFiError(f"Basket.fi rejected {method}: {call.get('status')}")
        return payload

    def get_category(self, competition_id: str, category_id: str) -> dict[str, Any]:
        return self._get_json("getCategory", competition_id=competition_id, category_id=category_id)

    def get_matches(self, competition_id: str, category_id: str) -> dict[str, Any]:
        return self._get_json("getMatches", competition_id=competition_id, category_id=category_id)

    def get_match(self, match_id: str) -> dict[str, Any]:
        return self._get_json("getMatch", match_id=match_id)
