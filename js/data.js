// Edwards och Johns spel – all content in one place.
// Add a new game: put it in GAMES (with x/y on the map), give it clues and roulette challenges. Done.
(function () {
  'use strict';

  // The games themselves still live on the original site.
  const OLD = 'https://edhb15.github.io/EoJ-spel/';
  const PREV = OLD + 'dependencies/previews/';

  const DISTRICTS = {
    fart: { name: 'Fartdistriktet', icon: '🏎️', color: '#3b4256', ground: '#2b3040', desc: 'Fordon, flyg och fart', x: 180, y: 140, w: 760, h: 560 },
    action: { name: 'Actionkvarteren', icon: '💥', color: '#5a2a3a', ground: '#3a1f2a', desc: 'Action och kaos i stan', x: 1460, y: 140, w: 780, h: 560 },
    sport: { name: 'Arenan', icon: '⚽', color: '#1f5a3a', ground: '#1d4a32', desc: 'Sport mot kompisar', x: 1720, y: 740, w: 560, h: 420 },
    skola: { name: 'Skolgården', icon: '🏫', color: '#5a4a1f', ground: '#4a3d1c', desc: 'Skolkaos och rymningar', x: 1460, y: 1200, w: 780, h: 520 },
    hjarna: { name: 'Hjärnberget', icon: '🧠', color: '#2a2f6a', ground: '#23284f', desc: 'Pussel och strategi', x: 180, y: 1200, w: 760, h: 520 },
    aventyr: { name: 'Äventyrsskogen', icon: '🌲', color: '#1f4a2a', ground: '#18361f', desc: 'Äventyr och fantasy', x: 120, y: 740, w: 560, h: 420 },
  };

  // x/y = door position on the map (building is drawn above it)
  const GAMES = [
    { id: 'andorra', name: 'The Legend of Andorra', d: 'aventyr', x: 420, y: 960, w: 200, h: 150, kind: 'castle', roof: '#7a5cff',
      url: OLD + 'games/the-legend-of-andorra/index.html', img: PREV + 'the-legend-of-andorra.jpg', video: PREV + 'the-legend-of-andorra.mp4',
      tag: '3D • Äventyr', added: '2026-11-22', desc: 'Utforska Andorras riktiga berg i ett öppet fantasyäventyr. Besegra fem monster, samla magiska skärvor och stoppa Zorg innan giftmolnet slukar landet.' },
    { id: 'skyward', name: 'Skyward', d: 'fart', x: 330, y: 360, w: 230, h: 140, kind: 'hangar', roof: '#5ee7ff', desktop: true,
      url: OLD + 'games/skyward/index.html', img: PREV + 'skyward.jpg', video: PREV + 'skyward.mp4',
      tag: '3D • Flygsimulator', added: '2026-11-18', desc: 'Flyg passagerarplan, stridsflyg och fraktplan över en hel ö med städer, berg och nio flygplatser. Endast för dator.' },
    { id: 'stunt', name: 'Stunt Rider 3D', d: 'fart', x: 720, y: 330, w: 190, h: 140, kind: 'ramp', roof: '#ff7a3d', hot: true,
      url: OLD + 'games/stunt-rider-3d/index.html', img: PREV + 'stunt-rider-3d.jpg', video: PREV + 'stunt-rider-3d.mp4', board: 'stunt-rider:stunt',
      tag: '3D • Motorcykel', added: '2026-11-12', desc: 'Gör volter, wheelies och tailwhips i en öppen värld full av ramper, halfpipe och loop – och lås upp nya motorcyklar!' },
    { id: 'sweden', name: 'Open World Sweden', d: 'fart', x: 540, y: 640, w: 200, h: 130, kind: 'garage', roof: '#ffd23d',
      url: OLD + 'games/open-world-sweden/index.html', img: PREV + 'open-world-sweden.jpg', video: PREV + 'open-world-sweden.mp4',
      tag: '3D • Bilspel', desc: 'Kör runt i hela Sverige, tjäna pengar, köp nya bilar och mycket mer!' },
    { id: 'ski', name: 'Ski to Death 3D', d: 'action', x: 1650, y: 380, w: 200, h: 170, kind: 'mountain', roof: '#e8f4ff',
      url: OLD + 'games/Ski-to-death-3d/index.html', img: PREV + 'Ski-to-death.jpg', video: PREV + 'Ski-to-death.mp4', board: 'ski-to-death:score',
      tag: '3D • Action', desc: 'Åk nerför backen och försök att (inte) ta livet av dig!' },
    { id: 'chicago', name: 'Chicago Bois', d: 'action', x: 2010, y: 420, w: 190, h: 230, kind: 'tower', roof: '#e4002b', desktop: true,
      url: 'https://edhb15.github.io/chicago-bois/', img: OLD + 'dependencies/release/chicago-bois/poster.jpg', video: OLD + 'dependencies/release/chicago-bois/trailer.mp4',
      tag: '3D • Öppen värld', added: '2026-11-23', desc: 'Edwards och Johns största spel hittills: en hel stad med polisjakter, gömställen och fem efterlysningsstjärnor. Endast för dator.' },
    { id: 'matchdag', name: 'Matchdag', d: 'sport', x: 2000, y: 1000, w: 260, h: 160, kind: 'stadium', roof: '#3dff8a',
      url: OLD + 'games/matchdag/docs/index.html', img: PREV + 'matchdag.jpg', video: PREV + 'matchdag.mp4',
      tag: '2D • Fotboll', desc: 'Spela matcher mot kompisar, köp nya spelare, spela turneringar och bygg ett bättre stadium.' },
    { id: 'smita', name: 'Smita från ledet', d: 'skola', x: 1660, y: 1480, w: 190, h: 140, kind: 'school', roof: '#ffb03d', board: 'smita:sekunder',
      url: OLD + 'games/smita-fran-ledet/index.html', img: PREV + 'smita-fran-ledet.jpg', video: PREV + 'smita-fran-ledet.mp4',
      tag: '3D • Action', desc: 'Smit från ledet och håll dig borta från läraren!' },
    { id: 'teacher', name: 'Teacher Meltdown', d: 'skola', x: 2040, y: 1500, w: 200, h: 150, kind: 'school', roof: '#ff3d6e', board: 'teacher-meltdown:fastest', low: true,
      url: OLD + 'games/teacher-meltdown/index.html', img: PREV + 'teacher-meltdown.jpg', video: PREV + 'teacher-meltdown.mp4',
      tag: '2D • Kaos', added: '2026-11-12', desc: 'Gör läraren så arg som möjligt – kasta pappersbollar, råma och fråga dumma frågor utan att bli utkastad!' },
    { id: 'rooms', name: 'Impossible Rooms 3D', d: 'hjarna', x: 380, y: 1480, w: 190, h: 160, kind: 'cube', roof: '#a970ff', board: 'impossible-rooms:full', low: true,
      url: OLD + 'games/impossible-rooms-3d/index.html', img: PREV + 'Impossible-rooms-3d.jpg', video: PREV + 'Impossible-rooms-3d.mp4',
      tag: '3D • Pussel', desc: 'Försök att ta dig ut ur förvridna rum i 3D. Lycka till – det kommer du att behöva!' },
    { id: 'world', name: 'World Domination', d: 'hjarna', x: 760, y: 1440, w: 200, h: 150, kind: 'globe', roof: '#3d9bff',
      url: OLD + 'games/world-domination/index.html', img: PREV + 'world-domination.jpg', video: PREV + 'world-domination.mp4',
      tag: '2D • Strategi', added: '2026-11-16', desc: 'Styr ett av världens länder och ta över planeten – med krig, allianser, spioner och diplomati.' },
    { id: 'tvattbert', name: 'TVÄTTBERT: RED ZONE', d: 'action', x: 1840, y: 650, w: 210, h: 160, kind: 'hospital', roof: '#c8161d',
      url: OLD + 'games/tvattbert-red-zone/index.html', img: PREV + 'tvattbert-red-zone.jpg', video: PREV + 'tvattbert-red-zone.mp4',
      tag: '3D • FPS • Överlevnad', added: '2026-11-27', desc: 'Överlev zombieapokalypsen i ett ödelagt Göteborg byggt från en 3D-modell av staden. Blir du biten har du fem minuter på dig att hitta motgiftet på Sahlgrenska – till fots eller i en stulen bil. Fungerar på dator och mobil.' },
  ];

  // Daily Mystery: 5 clues per game, released during the day.
  const CLUE_HOURS = [6, 10, 14, 18, 21];
  const CLUES = {
    andorra: ['Det finns ett svärd i alla regnbågens färger.', 'Du har 14 dagar på dig.', 'Bergen är på riktigt.', 'Ett giftmoln närmar sig.', 'Skurken heter Zorg.'],
    skyward: ['Du är aldrig på marken länge.', 'Det finns nio av en viss sorts plats.', 'Fungerar bara på dator.', 'Både passagerare och frakt.', 'Landa mjukt!'],
    stunt: ['Två hjul räcker.', 'Det finns en loop.', 'Backflip ger poäng.', 'Har redan en daglig utmaning.', 'Tailwhip!'],
    sweden: ['Hela landet är ditt.', 'Pengar köper nya fordon.', 'Du kan köra från Malmö till Kiruna.', 'Fyra hjul.', 'Open world – men vilket land?'],
    ski: ['Det är kallt.', 'Du åker bara nedåt.', 'Skador ger poäng.', 'Ragdoll-fysik.', 'Pjäxor och stavar.'],
    chicago: ['Den nyaste byggnaden i världen.', 'Fem stjärnor är inte bra här.', 'En stad vid en stor sjö.', 'Polisen jagar dig.', 'Bois.'],
    matchdag: ['En boll är inblandad.', 'Du kan bygga ett stadium.', 'Spela mot kompisar online.', 'Köp spelare.', 'Det heter som en dag.'],
    smita: ['Någon letar efter dig.', 'Alla andra står på rad.', 'Läraren får inte se dig.', 'Ju längre, desto bättre.', 'Du lämnar en kö.'],
    teacher: ['Pappersbollar.', 'Någon blir väldigt arg.', 'Råma som en ko.', 'Dumma frågor rekommenderas.', 'Ett sammanbrott.'],
    rooms: ['Dörren leder inte dit du tror.', 'Väggarna ljuger.', 'Förstapersonsperspektiv.', 'Ta dig ut.', 'Omöjligt.'],
    world: ['Hela planeten.', 'Spioner och allianser.', 'Välj ett land.', 'Diplomati kan hjälpa.', 'Ta över allt.'],
    tvattbert: ['Ett bett räcker.', 'Du har fem minuter på dig.', 'Botemedlet finns på ett sjukhus.', 'En kyrka på en kulle är en fristad.', 'De döda vandrar i Göteborg.'],
  };

  // Game Roulette: challenge text + minutes
  const ROULETTE = {
    andorra: [['Besegra ett monster utan att äta något', 8], ['Hitta en magisk skärva på kortast möjliga tid', 10], ['Klättra upp på det högsta berget du ser', 6]],
    skyward: [['Starta och landa på en annan flygplats', 8], ['Flyg under en bro', 5], ['Landa ett fraktplan utan att studsa', 6]],
    stunt: [['Gör 3 backflips i rad utan att krascha', 4], ['Klara loopen utan att bromsa', 3], ['Få 10 000 poäng i Stunt Mode', 5]],
    sweden: [['Kör i 2 minuter utan att använda bromsen', 3], ['Tjäna ihop till en ny bil', 10], ['Kör till en annan stad utan att krocka', 8]],
    ski: [['Få 5 000 poäng', 4], ['Bryt så många ben som möjligt på ett åk', 3], ['Ta dig ner utan en enda skada', 4]],
    chicago: [['Få 3 stjärnor och skaka av dig polisen', 8], ['Ta dig upp på en skyskrapa', 6], ['Kör längs hela stranden', 5]],
    matchdag: [['Vinn en match med minst 3 mål', 10], ['Håll nollan en hel match', 10], ['Göra mål från din egen planhalva', 8]],
    smita: [['Håll dig undan i 60 sekunder', 4], ['Slå ditt eget rekord', 5], ['Smit utan att springa', 5]],
    teacher: [['Få sammanbrott på under 2 minuter', 3], ['Gör läraren arg bara med frågor', 5], ['Råma 10 gånger utan att åka ut', 4]],
    rooms: [['Klara en nivå utan att gå baklänges', 6], ['Klara Del 1 på under 10 minuter', 10], ['Hitta utgången i första rummet på 30 sekunder', 2]],
    world: [['Bilda en allians inom 5 minuter', 5], ['Ta över ett grannland utan krig', 10], ['Spela som det minsta landet du hittar', 10]],
    tvattbert: [['Ta dig från Masthuggskyrkan till Slottsskogen utan att bli biten', 8], ['Döda 10 zombier med bara kniven', 8], ['Hitta ett nytt vapen inom 5 minuter', 5]],
  };

  // Bosses come one after another: a new one appears as soon as the old one dies.
  // If nobody manages to kill it within a week, the boss wins and the next one comes.
  const BOSSES = [
    { name: 'Glitchkungen', icon: '👾', color: '#a970ff', desc: 'Han äter pixlar till frukost.' },
    { name: 'Lagg-monstret', icon: '🐌', color: '#3dff8a', desc: 'Gör allt ... lite ... långsammare.' },
    { name: 'Pixeldraken', icon: '🐉', color: '#ff7a3d', desc: 'Sprutar 8-bitarseld.' },
    { name: 'Buggzilla', icon: '🦖', color: '#ff3d6e', desc: 'Föddes i en kodrad som ingen testade.' },
    { name: 'Robot-rektorn', icon: '🤖', color: '#5ee7ff', desc: 'Har kvarsittning för alla. Samtidigt.' },
    { name: 'Molnspöket', icon: '👻', color: '#e8ecff', desc: 'Raderar sparfiler när ingen tittar.' },
    { name: 'Krakenkoden', icon: '🦑', color: '#ff79c6', desc: 'Åtta armar, åtta buggar.' },
    { name: 'Frysbjörnen', icon: '🐻‍❄️', color: '#bfe9ff', desc: 'Får alla spel att frysa.' },
    { name: 'Skelettkungen', icon: '💀', color: '#e8e2c8', desc: 'Har varit död förut. Det hjälpte inte.' },
    { name: 'Lavagolemen', icon: '🌋', color: '#ff5a1f', desc: 'Golvet är lava. Han ÄR golvet.' },
    { name: 'Spökpiraten', icon: '🏴‍☠️', color: '#9a8cff', desc: 'Stjäl highscores från de sju haven.' },
    { name: 'Megamyggan', icon: '🦟', color: '#c8ff3d', desc: 'Surrar i ditt öra varje gång du ska landa.' },
  ];
  const BOSS_EPOCH = Date.parse('2026-11-23T18:00:00Z'); // the first boss appeared
  const BOSS_WEEK = 7 * 86400000;
  const bossHp = (n) => Math.min(150000, 15000 + (n - 1) * 5000);

  // How playing hurts the boss. The games send these rows themselves (shared/eoj.js in EoJ-spel):
  //   u:time:<game>  every 2 minutes of active play  -> 100 damage
  //   u:res:<board>  a result screen                 -> damage from the score (100–2500)
  //   u:play:<game>  starting a game from the world  -> 50 damage
  // The daily mystery game gives double damage that day.
  const BOARDS = {
    'stunt-rider': { g: 'stunt', unit: 'p', dmg: (s) => 100 + Math.sqrt(s) * 6 },
    'ski-to-death': { g: 'ski', unit: 'p', dmg: (s) => 100 + Math.sqrt(s) * 10 },
    smita: { g: 'smita', unit: 's', dmg: (s) => 80 + s * 6 },
    'teacher-meltdown': { g: 'teacher', unit: 't', low: true, dmg: (s) => 2400 - s * 5 },
    'impossible-rooms': { g: 'rooms', unit: 't', low: true, dmg: (s) => 4000 - s },
    'chicago-bois': { g: 'chicago', unit: 'p', dmg: (s) => 100 + Math.sqrt(s) * 6 },
  };

  // Community challenges (one per week). metric is counted from everyone's activity this week.
  const COMMUNITY = [
    { metric: 'damage', goal: 60000, text: 'Gör 60 000 skada på bossar tillsammans', reward: 'gold-fountain', rewardName: 'Guldfontänen i Torget + 🏆 Guldpokal till ditt rum' },
    { metric: 'plays', goal: 150, text: 'Starta 150 spel tillsammans', reward: 'fireworks', rewardName: 'Fyrverkerier över världen + 🎆 Raket till ditt rum' },
    { metric: 'games', goal: 12, text: 'Spela alla 12 spelen minst en gång (tillsammans)', reward: 'rainbow', rewardName: 'Regnbågsväg i hela världen + 🌈 Regnbågsmatta' },
    { metric: 'secrets', goal: 25, text: 'Hitta hemligheter 25 gånger tillsammans', reward: 'ufo', rewardName: 'Ett UFO svävar över Torget + 🛸 UFO-modell' },
    { metric: 'mystery', goal: 40, text: 'Lös dagens mysterium 40 gånger tillsammans', reward: 'detective', rewardName: 'Detektivstaty + 🔍 Förstoringsglas' },
  ];

  // Room furniture. price in coins, or unlock: badge id / 'boss' / 'community:<reward>'
  const ITEMS = [
    { e: '🛋️', n: 'Soffa', p: 0 }, { e: '🪴', n: 'Växt', p: 0 }, { e: '🪑', n: 'Stol', p: 0 }, { e: '💡', n: 'Lampa', p: 0 },
    { e: '📺', n: 'TV', p: 15 }, { e: '🕹️', n: 'Arkadmaskin', p: 40 }, { e: '🛏️', n: 'Säng', p: 10 }, { e: '🖼️', n: 'Tavla', p: 8 },
    { e: '🎸', n: 'Gitarr', p: 20 }, { e: '🏀', n: 'Basketboll', p: 6 }, { e: '🧸', n: 'Nalle', p: 6 }, { e: '🗄️', n: 'Skåp', p: 8 },
    { e: '🎮', n: 'Konsol', p: 25 }, { e: '🐟', n: 'Akvarium', p: 30 }, { e: '🚀', n: 'Raketmodell', p: 35 }, { e: '🪩', n: 'Discokula', p: 50 },
    { e: '🖥️', n: 'Gamingdator', p: 60 }, { e: '🎧', n: 'Hörlurar', p: 12 }, { e: '🛹', n: 'Skateboard', p: 14 }, { e: '⚽', n: 'Fotboll', p: 6 },
    { e: '🏆', n: 'Guldpokal', unlock: 'community:gold-fountain' }, { e: '🎆', n: 'Fyrverkeri', unlock: 'community:fireworks' },
    { e: '🌈', n: 'Regnbågsmatta', unlock: 'community:rainbow' }, { e: '🛸', n: 'UFO-modell', unlock: 'community:ufo' },
    { e: '🔍', n: 'Förstoringsglas', unlock: 'community:detective' }, { e: '👑', n: 'Bosskrona', unlock: 'boss' },
    { e: '🐉', n: 'Drakstaty', unlock: 'boss' }, { e: '🕵️', n: 'Detektivhatt', unlock: 'detective' },
    { e: '🥇', n: 'Duellmedalj', unlock: 'duel-win' }, { e: '🔮', n: 'Kristallkula', unlock: 'secret-5' },
    { e: '🗿', n: 'Mystisk staty', unlock: 'cave' }, { e: '🦉', n: 'Uggla', unlock: 'night-owl' },
    { e: '🎰', n: 'Lyckohjul', unlock: 'roulette-3' }, { e: '🌟', n: 'Stjärna', unlock: 'artifacts' },
    { e: '🏔️', n: 'Bergsmodell', p: 18 }, { e: '✈️', n: 'Flygplansmodell', p: 22 }, { e: '🏍️', n: 'Motorcykel', p: 45 }, { e: '🚗', n: 'Bil', p: 45 },
    { e: '🌍', n: 'Jordglob', p: 16 }, { e: '📚', n: 'Bokhylla', p: 10 }, { e: '🕰️', n: 'Klocka', p: 9 }, { e: '🪞', n: 'Spegel', p: 9 },
  ];
  const WALLS = ['#2a2f4a', '#4a2a3a', '#1f4a3a', '#4a3d1c', '#2a1236', '#3a3a3a', '#16324f', '#5a1f1f'];
  const FLOORS = ['#6b4a2f', '#3b3b4f', '#2f5a3f', '#8a7a5a', '#1a1a2a', '#5a2f5a', '#7a3a2a', '#2f4a6b'];

  // Badges. secret: true = hidden until found.
  const BADGES = {
    'first-game': { i: '🎮', n: 'Första spelet', d: 'Starta ett spel från världen' },
    'explorer': { i: '🧭', n: 'Upptäcktsresande', d: 'Besök alla distrikt' },
    'collector': { i: '🪙', n: 'Myntjägare', d: 'Samla 50 mynt' },
    'artifacts': { i: '🌟', n: 'Samlare', d: 'Hitta alla 8 artefakter' },
    'variety': { i: '🌈', n: 'Allätare', d: 'Spela 5 olika spel' },
    'all-games': { i: '💯', n: 'Komplettist', d: 'Spela alla spel' },
    'marathon': { i: '⏱️', n: 'Maratonspelare', d: 'Spela i en timme sammanlagt' },
    'boss': { i: '⚔️', n: 'Bosskämpe', d: 'Skada en boss genom att spela' },
    'boss-kill': { i: '👑', n: 'Bossdräpare', d: 'Var med när en boss besegrades' },
    'mystery': { i: '🔎', n: 'Mysterielösare', d: 'Lös dagens mysterium' },
    'detective': { i: '🕵️', n: 'Dagens detektiv', d: 'Lös dagens mysterium FÖRST av alla' },
    'roulette': { i: '🎲', n: 'Våghals', d: 'Klara en Surprise Me-utmaning' },
    'roulette-3': { i: '🎰', n: 'Lyckans ost', d: 'Klara 3 Surprise Me-utmaningar' },
    'duel': { i: '⚔️', n: 'Utmanare', d: 'Spela en duell' },
    'duel-win': { i: '🥇', n: 'Duellmästare', d: 'Vinn en duell' },
    'room': { i: '🏠', n: 'Inredare', d: 'Ställ 5 saker i ditt rum' },
    'visitor': { i: '🚪', n: 'Grannen', d: 'Besök någon annans rum' },
    'challenge': { i: '🎯', n: 'Målmedveten', d: 'Klara 3 personliga utmaningar' },
    'community': { i: '🤝', n: 'Lagspelare', d: 'Bidra till veckans communityutmaning' },
    'secret-5': { i: '🔮', n: 'Hemlighetsjägare', d: 'Hitta 5 hemligheter' },
    // secrets
    'cave': { i: '🗿', n: 'Grottforskaren', d: 'Hittade grottan i skogen', secret: true },
    'konami': { i: '👾', n: 'Retro', d: 'Knappade in den klassiska koden', secret: true },
    'footer': { i: '🦶', n: 'Fotnot', d: 'Klickade 7 gånger längst ner', secret: true },
    'night-owl': { i: '🦉', n: 'Nattuggla', d: 'Besökte världen mitt i natten', secret: true },
    'edge': { i: '🍾', n: 'Flaskpost', d: 'Hittade flaskposten vid världens kant', secret: true },
    'logo': { i: '🔴', n: 'Pixeljägare', d: 'Hittade den röda pixeln', secret: true },
    'boss-poke': { i: '👉', n: 'Petig', d: 'Petade på bossen 30 gånger', secret: true },
    'wish': { i: '⛲', n: 'Önskebrunnen', d: 'Kastade ett mynt i fontänen', secret: true },
    'code-zorg': { i: '☠️', n: 'Zorgs namn', d: 'Skrev in en skurks namn i terminalen', secret: true },
    'code-eoj': { i: '💾', n: 'Källkoden', d: 'Hittade koden i sidans källkod', secret: true },
    'code-console': { i: '🖥️', n: 'Hackern', d: 'Hittade koden i konsolen', secret: true },
  };
  const SECRETS = ['cave', 'konami', 'footer', 'night-owl', 'edge', 'logo', 'boss-poke', 'wish', 'code-zorg', 'code-eoj', 'code-console'];
  const CODES = { ZORG: 'code-zorg', EOJ2026: 'code-eoj', NEONHACK: 'code-console' };

  // 8 artifacts hidden around the map
  const ARTIFACTS = [
    { id: 'a1', e: '🧭', x: 230, y: 200 }, { id: 'a2', e: '⚱️', x: 2200, y: 190 }, { id: 'a3', e: '🦴', x: 2240, y: 860 },
    { id: 'a4', e: '📜', x: 2200, y: 1690 }, { id: 'a5', e: '💎', x: 210, y: 1690 }, { id: 'a6', e: '🍄', x: 150, y: 790 },
    { id: 'a7', e: '🗝️', x: 1200, y: 1780 }, { id: 'a8', e: '🪐', x: 1340, y: 140 },
  ];

  // Profile types – picked from what you play most
  const TYPES = {
    fart: { t: 'Fartdåre', i: '🏎️' }, action: { t: 'Actionhjälte', i: '💥' }, sport: { t: 'Lagkapten', i: '⚽' },
    skola: { t: 'Kaosmakare', i: '🤪' }, hjarna: { t: 'Hjärnan', i: '🧠' }, aventyr: { t: 'Äventyrare', i: '🗡️' },
  };

  window.EOJ_DATA = { OLD, DISTRICTS, GAMES, CLUES, CLUE_HOURS, ROULETTE, BOSSES, BOSS_EPOCH, BOSS_WEEK, bossHp, BOARDS, COMMUNITY, ITEMS, WALLS, FLOORS, BADGES, SECRETS, CODES, ARTIFACTS, TYPES };
})();
