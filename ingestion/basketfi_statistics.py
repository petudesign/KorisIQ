"""Read the public Sportradar fixture statistics embedded by Basket.fi."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ingestion.basketfi import BasketFiClient
from normalization.basketfi_statistics import normalize_fixture_statistics


DEFAULT_EMBED_BASE_URL = "https://embed-api.eui.connect.sportradar.com/v1/embed"


class BasketFiStatisticsError(RuntimeError):
    """Raised when the public fixture statistics cannot be read."""


@dataclass(frozen=True)
class BasketFiStatisticsClient:
    website_id: str = "322"
    embed_base_url: str = DEFAULT_EMBED_BASE_URL
    timeout_seconds: float = 20.0
    torneo_client: BasketFiClient = field(default_factory=BasketFiClient, compare=False)
    headers: dict[str, str] = field(
        default_factory=lambda: {
            "Accept": "application/json",
            "Origin": "https://tulospalvelu.basket.fi",
            "Referer": "https://tulospalvelu.basket.fi/",
            "User-Agent": "KorisIQ/0.1 (read-only research client)",
        }
    )

    def get_fixture(self, fixture_id: str, *, sub: str = "statistics") -> dict[str, Any]:
        query = urlencode({"fixtureId": fixture_id, "sub": sub})
        url = f"{self.embed_base_url.rstrip('/')}/{self.website_id}/fixture_detail?{query}"
        request = Request(url, headers=self.headers, method="GET")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except (HTTPError, URLError, TimeoutError) as exc:
            raise BasketFiStatisticsError(f"Sportradar fixture request failed: {exc}") from exc
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BasketFiStatisticsError("Sportradar fixture returned non-JSON data") from exc
        if not isinstance(payload, dict):
            raise BasketFiStatisticsError("Sportradar fixture returned an unexpected payload")
        return payload

    def get_match_statistics(self, match_id: str) -> dict[str, Any]:
        """Resolve Torneo's ``match_external_id`` and fetch its full public box score."""

        torneo_payload = self.torneo_client.get_match(match_id)
        match = torneo_payload.get("match") if isinstance(torneo_payload.get("match"), dict) else {}
        fixture_id = match.get("match_external_id")
        if not fixture_id:
            raise BasketFiStatisticsError(f"Torneo match {match_id} has no public Sportradar fixture ID")
        embed_url = f"{self.embed_base_url.rstrip('/')}/{self.website_id}/fixture_detail"
        payload = self.get_fixture(str(fixture_id))
        return normalize_fixture_statistics(
            payload,
            match_id=str(match_id),
            source_url=f"https://tulospalvelu.basket.fi/match/{match_id}/statistics",
            embed_url=embed_url,
        )
