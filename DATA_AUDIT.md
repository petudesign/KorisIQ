# KorisIQ Phase 1 data audit

Audit date: **2026-09-15** (Europe/Helsinki)

This document records what was actually observed, what is a reasonable inference, and what remains unverified. It is a feasibility audit, not a claim that KorisIQ has permission to republish every field it can technically retrieve.

## Executive result

**Verified:** Basket.fi’s public Torneo service currently exposes the 2026–27 Women’s Korisliiga competition, its nine teams, a 24-game regular season, 108 scheduled match records, and match metadata through a JSON endpoint. A completed 2025–26 Women’s Korisliiga match also returned player lineups and 123 event records through the same endpoint.

**Verified:** The public statistics page for match `968948` exposes a complete player box score and team totals: `MIN`, `PTS`, 2P/3P/FT makes and attempts with percentages, `OR`, `DR`, `REB`, `AST`, `TO`, `STL`, `BLK`, `BR`, `PF`, `FD`, `+/-`, and `Eff`. The page renders these through a Sportradar/Synergy widget. The public widget response was also verified and now has a repeatable read-only adapter in this repository; the endpoint is still not a documented public API contract.

**Verified:** The 2025–26 Torneo season payload contains 145 played matches in total: 108 regular-season matches in group `302291` and 37 playoff matches in group `302874`. These phases must remain separate in seasonal reporting.

**Verified:** A historical FIBA LiveStats `data.json` payload contains structured play-by-play and shot records with made/missed status, shot type, player, period, and numeric `x`/`y` coordinates. The inspected example is Jyväskylä Basketball Academy vs ACO Basket, not the Women’s Korisliiga.

**Unknown:** Whether the 2026–27 Women’s Korisliiga will expose a public shot-coordinate feed after the move to Synergy Stats, whether the feed is stable enough for production, and whether reuse or republication is permitted.

**Not supported by evidence:** treating a FIBA LiveStats match ID as interchangeable with a current Torneo match ID, or promising a shot chart for current Women’s Korisliiga games before a completed game is captured and validated.

The smallest useful v0.1 is therefore a source-backed match/box-score/event pipeline with a local seasonal-analysis surface and shot support behind a capability flag. Build the shot layer only after one current-season game proves the payload, coordinate semantics, and permitted use.

## Repository baseline

The supplied GitHub URL was not present as a configured local remote, and the local checkout contained no project files when this audit began. This repository now contains the Phase 1 scaffold and compact normalized examples. The attached product brief is treated as the product source of truth until a populated application repository is provided.

## Source matrix

| Source | Observed evidence | Status | Implication |
|---|---|---|---|
| [Basket.fi Women’s Korisliiga](https://basket.fi/sarjat/sarjat/naisten-korisliiga/) | Official competition page and current 2026–27 coverage | **Verified** | Use as the human-facing provenance link |
| [Torneo categories](https://tulospalvelu.basket.fi/categories) | Current category navigation includes Naisten Korisliiga | **Verified** | Public discovery surface |
| [Current group table](https://tulospalvelu.basket.fi/category/1!huki2627/group/303031/tables) | Competition `huki2627`, category `1`, group `303031`, season `2026-2027`; nine teams; 24 rounds; 0 played | **Verified** | Stable-enough current identifiers for a first adapter |
| [Current fixtures](https://tulospalvelu.basket.fi/category/1!huki2627/group/303031/fixtures) | Fixtures exist; first inspected game is match `1006239`, Kouvottaret–ToPo on 2026-10-02 | **Verified** | Schedule ingestion can start before statistics exist |
| [Torneo `getMatches`](https://koripallo-api.torneopal.net/taso/rest/getMatches?competition_id=huki2627&category_id=1) | HTTP 200, JSON, 108 current match records, `logged_in: false` | **Verified** | Public read path, but still subject to rate/terms review |
| [Torneo `getCategory`](https://koripallo-api.torneopal.net/taso/rest/getCategory?competition_id=huki2627&category_id=1) | HTTP 200; nine teams; one group; current player and official statistics arrays empty | **Verified** | Category metadata is richer than current statistical coverage |
| [Current match `1006239`](https://koripallo-api.torneopal.net/taso/rest/getMatch?match_id=1006239) | Fixture metadata; `status: Fixture`, empty `events` and `lineups`, `shotmap: 0` | **Verified** | Correct empty-state behavior is required |
| [Completed Women’s match `968948`](https://koripallo-api.torneopal.net/taso/rest/getMatch?match_id=968948) | 2025-10-01 Kouvottaret–BC Nokia; final 47–70; 19 lineups; 123 events | **Verified** | Match/event normalization is feasible on the previous feed |
| [Match statistics `968948`](https://tulospalvelu.basket.fi/match/968948/statistics) | Full player and team box score; 24 statistical columns; page embeds a Sportradar/Synergy fixture widget | **Verified; contract unknown** | Use the separate versioned statistics adapter; do not assume `getMatch` contains the same fields |
| [2025–26 Torneo matches](https://koripallo-api.torneopal.net/taso/rest/getMatches?competition_id=huki2526&category_id=1) | 145 played records; group `302291` has 108 regular-season games and group `302874` has 37 playoff games | **Verified** | Filter phase before calculating seasonal trends |
| [KorisAPI](https://github.com/apmnt/koris-api) and its [Basket.fi adapter](https://github.com/apmnt/koris-api/blob/main/src/koris_api/basketfi_api.py) | Existing Python client documents the Torneo REST base and `getMatches`/`getMatch` calls | **Verified** | Reuse protocol knowledge; do not fork the whole project |
| [KorisNext project notes](https://aapomontin.com/projects/korisnext) | Existing Next.js/shadcn statistics UI built on scraped Basket.fi data | **Verified** | Useful compatibility reference, not a source-of-truth contract |
| [FIBA LiveStats sample](https://fibalivestats.dcd.shared.geniussports.com/data/2701885/data.json) | HTTP 200; 629 PBP records and 138 shot records with `x`, `y`, `r`, `actionType`, `per`, and player fields | **Verified for this historical match** | Implement as a separate optional adapter |
| [Synergy transition announcement](https://basket.fi/uutiset/syksy-tuo-lisaa-tilastointikoulutuksia/) | Finnish Basketball Association says national leagues use Synergy Stats from 2026–27 | **Verified** | Previous FIBA assumptions cannot be carried forward automatically |
| [Basket.fi privacy statement](https://basket.fi/koripalloliitto/tietoa-sivustosta/tietosuojaseloste/) | Published statistics and player/competition data are described as processing content/purposes | **Verified** | Privacy context exists; it is not a reuse licence |

## Current Women’s Korisliiga snapshot

Observed identifiers:

```text
competition_id: huki2627
season_id:      2026-2027
category_id:    1
group_id:       303031
group_name:     Runkosarja
periods:        4 x 10 minutes
regular games:  24 per team / 108 scheduled match records
played games:   0 at audit time
```

The nine teams returned by the current category record are:

```text
BC Nokia              8
Espoo Basket Team     1040
HBA-Märsky            4615311
Kouvottaret           48083
Peli-Karhut           4
Tampereen Pyrintö     138
Tapiolan Honka        31
ToPo                  34
Vimpelin Veto         45373
```

The first inspected fixture was match `1006239`: Kouvottaret vs ToPo, 2026-10-02 18:30 Europe/Helsinki, MLL Areena, status `Fixture`. Its public match JSON contained metadata but no lineups, events, or shotmap. This is expected before tip-off and must not be represented as missing data from a played game.

## What is actually available

### Match and schedule data — **verified**

The public Torneo endpoint returns stable source IDs, competition/category/season/group identifiers, scheduled date/time/time zone, teams, venue, status, period configuration, and availability flags. A scheduled current season can therefore support a calendar, team list, fixture page, and ingestion monitoring without inventing statistics.

### Previous-season box score and event data — **verified**

Completed match `968948` returned 19 lineup records and 123 events. Events include a source event ID, Finnish/English code, period, clock components, player/team references when applicable, description, and score-after-event fields. The inspected final score was 47–70, with quarter scores 7–18, 18–22, 15–16, and 7–14; the quarters reconcile to the final score.

The lineup payload contains source player IDs, names, team IDs, jersey numbers, starter flags, positions, and stat-like fields. Some fields need semantic validation before being presented as basketball box-score truth: for example, the inspected payload’s `playing_time_min` values were zero for records that appeared in the lineup. Preserve the raw value and mark it suspect rather than silently converting it.

### Statistics-page box score — **verified, adapter implemented**

The separate public statistics page for match `968948` returned the full 24-column box score for both teams. It includes the raw fields used by the first KorisIQ dashboard: `MIN`, `PTS`, `2PM`, `2PA`, `2P%`, `3PM`, `3PA`, `3P%`, `FTM`, `FTA`, `FT%`, `OR`, `DR`, `REB`, `AST`, `TO`, `STL`, `BLK`, `BR`, `PF`, `FD`, `+/-`, and `Eff`. The team totals also reconcile with the final score and player rows for the inspected match.

The page embeds a Sportradar/Synergy fixture-detail widget. The widget receives Torneo's `match_external_id` and serves a public JSON response from its fixture-detail embed endpoint. `ingestion.basketfi_statistics.BasketFiStatisticsClient` resolves that ID through `getMatch`, fetches the response, and `normalization.basketfi_statistics.normalize_fixture_statistics` maps nested team/person rows into the KorisIQ schema. The adapter preserves source provenance, starter/DNP state, minute durations, team totals, and the full player stat set. It does not infer positions or shot coordinates that the response does not provide.

This is a verified implementation for the inspected public route, not a promise of a permanent API contract. Keep it behind caching, validation, rate limits, and a source-permission review before season-wide automation.

### Shot coordinates — **verified historically, unknown currently**

The older FIBA LiveStats sample returned 138 shot records across two teams and 629 play-by-play records. A shot includes fields equivalent to:

```text
team, player, shirt number, period, action type (2pt/3pt), subtype,
made/missed flag, x, y, action number, previous action
```

The coordinate values are numeric and clearly useful for a shot-chart prototype. Their court orientation, origin, dimensions, home/away normalization, and coordinate transformation are **unknown** until calibrated against a known court image or documented feed contract.

The sample is not a Women’s Korisliiga game. Probing current Torneo IDs (`1006239`, `968948`, and another current fixture) against the FIBA URL returned 403, so the ID spaces must be treated as separate. The 2026–27 Synergy migration makes a direct carry-over even less safe.

### Player and team data — **partly verified**

Current category metadata verifies the nine team IDs and names. A current fixture has no lineups yet. A direct `getTeam` request was not accepted by the public endpoint during the audit, so current roster availability, player IDs, birth years, and roster history remain **unknown**. Do not use player names as primary identifiers and do not infer a roster from a fixture page.

## Proposed normalized model

The code in `normalization/` implements a deliberately source-neutral shape:

```text
source_system + source_entity_id + ingested_at_utc + payload_sha256
competition { source_id, name }
season      { source_id, name }
game        { source_id, scheduled_at, timezone, status, venue, periods }
teams       { source_id, name, home_away, score }
players     { source_id, display_name, team_source_id, jersey_number, starter, stats }
events      { source_id, period, clock, event_type, player_source_id, team_source_id, score_after }
shots       { source_id, team_source_id, player_source_id, period, shot_type, made, x, y }
availability { lineups, events, box_score, shot_coordinates }
```

Rules:

1. Source IDs remain the identity anchor. Names are display attributes and can change.
2. Keep source system and source match ID on every entity that can be joined across feeds.
3. Keep local timestamps plus the declared time zone; do not convert a date-only fixture to UTC by assumption.
4. Missing, not-yet-published, and unsupported are different states.
5. Preserve source codes and selected raw fields at the edge; derive analytics in a separate layer.
6. Keep FIBA LiveStats shots behind a source capability flag until a current Synergy payload is proven.

## Ingestion path

The runnable path is:

```text
Basket.fi/Torneo JSON
        ↓
ingestion.basketfi.BasketFiClient
        ↓
normalization.basketfi.normalize_match
        ↓
validation.checks.validate_normalized_match
        ↓
compact JSON snapshot in data/normalized/
```

The full box score follows a separate route:

```text
Basket.fi match /statistics page
        ↓
Torneo match_external_id
        ↓
Sportradar/Synergy fixture-detail JSON endpoint
        ↓
ingestion.basketfi_statistics.BasketFiStatisticsClient
        ↓
normalization.basketfi_statistics.normalize_fixture_statistics
        ↓
validated normalized player/team box score
        ↓
analytics.metrics + web dashboard
```

The optional historical shot path is intentionally separate:

```text
FIBA LiveStats data.json
        ↓
ingestion.fibalivestats.FibaLiveStatsClient
        ↓
normalization.fibalivestats.normalize_shots
        ↓
coordinate-aware validation with explicit unknown bounds
```

## Validation plan

The initial checks are small and actionable:

- required source/game/team IDs exist;
- team count and home/away assignment are coherent;
- final score reconciles with period scores when both are present;
- lineup and event IDs are unique within a match;
- event periods are positive and parseable when supplied;
- shot `made` values are binary and `x`/`y` values are finite when supplied;
- source availability flags agree with the normalized payload.

Warnings are used for legitimate empty states (fixture not started), missing current stats, and semantically suspect source fields. A warning is not silently promoted to zero.

## Metric feasibility

The first analytical layer should use metrics whose inputs are available and auditable:

| Metric | Inputs | Feasibility |
|---|---|---|
| Points per game | final score, games | **Verified feasible** after games are played |
| eFG% | FGM, FGA, 3PM | **Verified for inspected statistics page**; formula is explicit |
| TS% | points, FGA, FTA | **Verified for inspected statistics page**; keep the 0.44 convention explicit |
| Offensive/defensive rebounds | OR, DR | **Verified for inspected statistics page** |
| Assist/turnover ratio | AST, TOV | **Verified for inspected statistics page**; denominator-zero case required |
| Pace estimate | FGA, FTA, OR, TOV and game time | **Estimate only** unless possession/event semantics are validated |
| ORtg / DRtg / Net Rating | points, estimated/shared possessions | **Estimate only** from box score; exact possession feed can replace the denominator later |
| Shot zones and location splits | shot x/y plus court calibration | **Unsupported currently** for Women’s Korisliiga |
| Lineup plus/minus | player stints and score deltas | **Unsupported currently** until substitutions/stints are complete |
| Tracking, closeouts, defensive matchup | tracking/video or manual labels | **Unsupported** in the public source audit |

The included `analytics/metrics.py` implements only deterministic formulas for the first layer. It does not fabricate possession, lineup, or tracking data.

## Peluutin and KorisNext compatibility

The existing [KorisNext notes](https://aapomontin.com/projects/korisnext) describe a Next.js UI backed by scraped Basket.fi data and [KorisAPI](https://github.com/apmnt/koris-api). KorisIQ should remain compatible at the data boundary by retaining source IDs, competition/category/season IDs, team IDs, and source event codes. Do not make KorisNext’s internal response shape the canonical model; use an adapter if integration is needed.

Peluutin-style lineup analysis is a useful downstream consumer, but it requires reliable substitutions, stints, and score deltas. The inspected Women’s match exposed an empty `substitution_events` array even though it had normal event records, so lineup plus/minus should remain a later capability, not a v0.1 promise.

## Legal and operational constraints

The Basket.fi privacy statement describes published statistics and player/competition information as processing content and purposes. That establishes privacy relevance; it does **not** establish permission to bulk scrape, store, enrich, or republish the data.

Before public launch, confirm in writing:

- permission and rate limits for automated access to Basket.fi/Torneo and any Synergy endpoint;
- whether derived team/player metrics may be publicly republished;
- retention and deletion expectations for player data;
- whether birth year, photographs, contact fields, or other personal fields are needed at all (v0.1 should omit them);
- attribution and caching requirements;
- whether FIBA LiveStats data may be retained or redistributed.

The adapter should use conservative request rates, cache by source ID, record retrieval time, avoid raw-payload commits, and provide a deletion path by source entity ID.

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---:|---|
| 2026–27 Synergy payload differs from the prior Torneo/FIBA path | High | Keep the adapter versioned, validate each snapshot, and compare the first current-season completed game before bulk ingestion |
| Public embed route changes or becomes permission-gated | High | Cache by source ID, throttle, monitor failures, and confirm reuse terms before production automation |
| Shot coordinates are absent, transformed, or undocumented | High | Treat shots as optional; calibrate orientation and bounds before analytics |
| IDs or competition slugs change each season | Medium | Discover via category metadata; persist source IDs and season mapping |
| Empty fixture data is mistaken for a broken ingestion | Medium | Model availability/status separately; test a fixture explicitly |
| Player fields are inconsistent or over-collected | High | Minimize fields, preserve provenance, validate semantics, document retention |
| Rate limits or terms prohibit bulk access | High | Obtain permission, throttle/cache, and retain only what is necessary |
| Incomplete substitutions make lineup metrics misleading | Medium | Ship box-score/event summaries first; gate lineup analytics on stint quality |

## v0.1 recommendation

Ship a read-only data foundation with:

1. current competition/team/fixture ingestion;
2. completed-game metadata, box-score/event normalization when available;
3. validation reports and provenance hashes;
4. a small formula-based metric layer;
5. an explicit `shot_coordinates` capability that is off until a current-season game proves it.

The local web prototype can now demonstrate the match and seasonal-analysis surfaces, but the seasonal trend view must remain explicitly sample-limited until additional seasons are ingested. The next implementation task is a respectful batch runner that hydrates the verified 2025–26 schedule through this single-game adapter, keeps regular season and playoffs separate, and writes a season aggregate only from successful validated box scores. The Three.js/CV shot layer remains gated on verified coordinates and permission.
