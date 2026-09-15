# KorisIQ design QA

source visual truth: `C:\Users\petsk\AppData\Local\Temp\codex-clipboard-ab8e13bc-47e1-403c-b70a-f82912356e9f.png`
implementation: `http://127.0.0.1:5173/`
state: ottelun tarina, historiallinen Women’s Korisliiga -näyte

## Comparison

- Reference: tumma analytiikkatyökalu, ottelukortti, joukkuevertailu, kenttävisualisointi ja pelaajapoiminta.
- Implementation: sama tiedon hierarkia KorisIQ:n omalla kielellä; lisäksi lähteen saatavuus ja koko 19 rivin pelaajamateriaali.
- Typography: Inter palautettu käyttöliittymän pääfontiksi; kontrollit, taulukot ja otsikot käyttävät samaa järjestelmää.
- Layout rhythm: ottelukortin jälkeen vertailu + kenttä, rosteri sen alla; alle 900 px rosteri pinoutuu yhdeksi sarakkeeksi.
- Color/tokens: musta-sininen pinta, hillityt coral/mint-joukkueaksentit ja matala kontrastihierarkia säilytetty ilman neon-palettia.
- Asset treatment: court is a code-native data visualization; shot markers are intentionally absent because this source does not expose x–y coordinates.
- Copy/content: source-specific Finnish labels, real 19 player rows, points and personal fouls; no fabricated shooting coordinates or box score values.
- Stat semantics: `Ottelun luvut` now contains Pisteet, FG%, Levypallot, Syötöt and PF. Missing fields use an em dash and an explicit explanation instead of zeroes or source metadata such as starter/lineup counts.
- Player semantics: `Pisteet tässä ottelussa` uses the same PTS/REB/AST/FG%/PF surface; roles are compact C/SF/PG labels and starters are marked `(A)` next to the player name.

## Interaction evidence

- Player filters switch between all players, Kouvottaret and BC Nokia.
- Court filters switch the empty-state explanation between all events, point map and missing data.
- Existing story, players and data availability tabs remain available.

## Findings

No actionable P0/P1/P2 findings remain for this iteration. Intentional deviations from the reference are the empty court state and em dashes for unavailable box score fields: real shot locations, rebounds, assists and shooting percentages are not present in the Basket.fi/Torneo sample and are not invented.

## Verification

- Browser: Codex in-app browser, `http://127.0.0.1:5173/`.
- Screenshot evidence: latest rendered state inspected in the browser after reload; reference image inspected from the source path above.
- Build: `pnpm.cmd run build` passed.
- Interaction: roster filter, court filter, story/player tabs and player expansion exercised; visible state updated.
- Console: no warning or error entries after reload.

final result: passed
