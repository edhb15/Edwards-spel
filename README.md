# Edwards och Johns spel – en levande spelvärld

Den nya startsidan för Edwards och Johns spel. I stället för en lista med spel får man en hel värld att gå runt i – varje spel är en byggnad.

**▶ Spela:** https://edhb15.github.io/edwards-spel/ (när GitHub Pages är påslaget)

Själva spelen ligger kvar i [EoJ-spel](https://github.com/edhb15/EoJ-spel) och länkas därifrån, så de behöver inte flyttas.

## Vad finns i världen?

| Funktion | Var | Hur det funkar |
|---|---|---|
| 🌍 Levande spelvärld | Hela kartan | Gå med piltangenter/WASD eller klicka/tryck. Distrikt för varje spelkategori med egna mönster, 3D-byggnader, riktigt nattljus med gatlyktor, moln, fåglar och eldflugor. Byggnaderna lyser och får folkmassor när många spelar dem. Dag och natt följer svensk tid. Mynt (nya varje dag) och 8 artefakter att samla. |
| 🕵️ Daily Mystery Game | Mysterietornet | Ett hemligt spel per dag, samma för alla. 5 ledtrådar släpps kl 06, 10, 14, 18 och 21. Första som löser det får utmärkelsen *Dagens detektiv*. Daglig topplista. |
| 👹 Global Boss Battle | Bossarenan | Alla slåss mot samma boss **genom att spela spelen**: varannan minut du spelar = 100 skada, varje resultat = 100–2 500 skada, dagens mysteriespel = dubbel skada. Dör bossen kommer nästa direkt (lite starkare). Klarar ingen att döda den inom en vecka vinner bossen och nästa kommer. |
| 🧬 Spel som utvecklas efter dig | DNA-labbet | Spelprofil (typ, nivå, XP), spel-DNA per kategori, 4 personliga utmaningar varje dag, spelhistorik, utmärkelser och saker som låses upp (grottan, maratonspelare). |
| 🎲 Game Roulette | Knappen SURPRISE ME! / Lyckohjulet | Slumpat spel + slumpad utmaning + tidsgräns. Timern följer med när man kommer tillbaka. Utmana kompisar med en länk. |
| 🏠 Eget spelrum | Mitt rum / Granngatan | 12×8-rum med möbler, troféhylla (dina utmärkelser) och favoritspel på väggen. Köp saker för mynt, lås upp specialsaker. Visa upp på Granngatan och besök andras rum. |
| ⚔️ Utmana andra | Duellhallen | Bäst i ett spel (Stunt Rider, Ski to Death, Smita, Teacher Meltdown, Impossible Rooms) eller Bäst av tre. 48 timmar på sig, resultaten räknas automatiskt. Veckans rival och vinster/förluster på profilen. |
| 🕵️ Hemliga upptäckter | Överallt | 11 hemligheter (hemliga knappar, en grotta, koder, påskägg). Hall of Fame visar hur många communityn har hittat tillsammans. |
| 📺 Gaming Live Feed | Live-tavlan + listen längst ner | Nya rekord, bossattacker, hemligheter, "X personer spelar Y just nu". Andra spelare syns som figurer i världen. |
| 🎯 Community Challenges | Monumentet | En gemensam utmaning per vecka. Når alla målet syns belöningen i världen (guldfontän, fyrverkerier, UFO …) och en sak låses upp till rummet. |
| 🏆 Globala topplistor | Hall of Fame | Spelens topplistor, bosskämpar, mest speltid, detektiver och hemlighetsjägare. Varje byggnad visar också spelets rekord och hur många som spelar just nu. |

## Online-delen

Allt delat (boss, live-flöde, mysteriet, rum, dueller) sparas i **samma Supabase-tabell `scores`** som topplistorna i EoJ-spel använder (`js/config.js`). Ingen ny inställning behövs. Världens rader har boards som börjar med `u:` så de aldrig blandas ihop med spelens poäng:

| Board | Betyder |
|---|---|
| `u:play:<spel>` | Någon startade ett spel |
| `u:time:<spel>` | 2 minuters speltid (skickas av spelen själva via `shared/eoj.js` i EoJ-spel) → 100 skada |
| `u:res:<topplista>` | Ett resultat i ett spel (skickas av spelen) → skada och duellresultat |
| `u:boss-n:<nr>:<start>:<k/w>` | En ny boss har kommit (k = förra dog, w = förra vann) |
| `u:mystery:<datum>` | Löste dagens mysterium (score = poäng) |
| `u:secret:<id>` | Hittade en hemlighet |
| `u:duel:<kod>:<format>:<spel>` | Vem som är med i en duell |
| `u:room:<layout>` | Ett rum på Granngatan (layouten är packad i board-namnet) |
| `u:pc`, `u:roulette` | Klarad personlig utmaning / Surprise Me-utmaning |

Om databasen inte svarar (t.ex. pausat gratisprojekt) fungerar allt ändå – då sparas det bara på den egna enheten.

## Lägg till ett nytt spel

Öppna `js/data.js`:

1. Lägg till spelet i `GAMES` med `x`/`y` (var dörren står på kartan) och vilket distrikt `d` det hör till.
2. Ge det 5 ledtrådar i `CLUES` och några utmaningar i `ROULETTE`.

## Filer

- `index.html` – sidan
- `css/style.css` – utseendet
- `js/data.js` – spel, distrikt, ledtrådar, bossar, möbler, utmärkelser
- `js/core.js` – profil, databas, utmärkelser, popup-fönster
- `js/world.js` – världen (karta, gubbe, byggnader)
- `js/features.js` – allt som öppnas i byggnaderna
- `js/main.js` – start, länkar och hemligheter
