# KorisIQ

KorisIQ is a small, evidence-first data foundation for Finnish basketball analysis.

The current Phase 1 deliverable is intentionally narrow:

- document what the public Basket.fi/TorneoPal data exposes for the 2026–27 Women’s Korisliiga;
- normalize match, team, player, event, and shot records without making names the primary key;
- provide a runnable ingestion path and validation checks;
- keep shot-coordinate support separate because the current feed has not been verified to expose it.

See [DATA_AUDIT.md](DATA_AUDIT.md) for the source audit, current-season evidence, legal/operational risks, and the v0.1 recommendation.

## Quick start

The runtime uses Python’s standard library only.

```powershell
python -m ingestion.cli --competition-id huki2627 --category-id 1 --match-id 1006239 --out data/normalized/current_fixture_1006239.json
python -m ingestion.cli --competition-id huki2526 --category-id 1 --match-id 968948 --out data/normalized/historical_womens_match_968948.json
python -m ingestion.cli --statistics-match-id 968948 --out data/normalized/basketfi_statistics_968948.json
python -m ingestion.cli --season --competition-id huki2526 --category-id 1 --group-id 302291 --out data/normalized/season_2025_2026_schedule.json
python -m ingestion.cli --season-statistics --competition-id huki2526 --category-id 1 --group-id 302291 --limit 1 --out data/normalized/season_2025_2026_statistics_smoke.json
python -m ingestion.cli --fiba-match-id 2701885 --out data/normalized/fibalivestats_match_2701885.json
python -m unittest discover -s tests -v
```

The fixture command should produce an honest empty-stats result before tip-off. The match command is a completed Women’s Korisliiga match from the prior season. The FIBA command is a historical example used only to prove that structured shot coordinates existed in an older feed; it is not evidence that the current Women’s feed has the same capability.

The season command extracts a compact schedule snapshot. `--group-id 302291` limits the 2025–26 result to the 108-game regular season instead of including playoffs. It does not claim that schedule metadata contains the full player box score; that enrichment remains a separate statistics-page adapter.

The `--statistics-match-id` command now performs that enrichment: it resolves Torneo's public `match_external_id`, calls Basket.fi's embedded Sportradar fixture endpoint, and normalizes the full player/team box score. The adapter is read-only and source-specific; it intentionally does not infer shot coordinates or positions that the public response does not provide.

The `--season-statistics` command is the opt-in batch path. It first filters the Torneo schedule to played games, then hydrates each game through the same single-game adapter while preserving per-game failures. Use `--limit 1` for a smoke test and add a small `--delay-seconds` value before any larger run.

The API client sends the public request headers used by the existing [KorisAPI](https://github.com/apmnt/koris-api) project. Network calls are read-only. Do not commit raw payloads or personal data without confirming the source’s reuse terms.

## Local web app

The 2025–26 regular season is now loaded: 108 validated games, nine teams,
24 games per team. `Joukkueet` compares each team's shooting profile, estimated
offensive/defensive efficiency, rebounds, turnovers and possessions with the
league. The frontend imports only `season_verified.summary.json` (aggregate
statistics, no player records). Regenerate with
`python -m analytics.export_web data/normalized/season_verified.json` after
updating a season snapshot. Season CLI runs also export this compact summary.

The first visible prototype lives in `web/` and uses React, TypeScript, and Vite. Start it on port 5173 (port 4180 is intentionally not used):

```powershell
cd web
pnpm install
pnpm run dev -- --port 5173
```

The prototype currently presents a real 2025–26 Women’s Korisliiga match and makes source availability visible instead of hiding missing fields. Its player view uses the reviewed public statistics page for match `968948`, including the full 24-column box score. Derived eFG%, TS%, ORtg, DRtg, Net Rating, and other efficiency values are labeled as box-score estimates where exact possession data is not available. The `Kausitrendit` view is now in place with a clearly labeled test sample; it will become a real multi-season trend view once additional verified seasons have been ingested.

The current web snapshot is intentionally not a production season loader: the statistics page embeds a Sportradar/Synergy widget, and the repeatable single-game adapter is now in the ingestion layer. Broad season-wide use still needs a respectful batch job, caching, retry/rate-limit policy, and a second verified season before trend lines are presented as historical facts.

## Layout

```text
DATA_AUDIT.md
ingestion/       public-source clients and CLI
normalization/   source-specific to KorisIQ schema mapping
validation/      small data-quality checks
analytics/       deterministic metric helpers
data/normalized/ compact, redacted source snapshots
tests/           standard-library regression tests
```
