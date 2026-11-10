let maze = [];
const GRID_HEIGHT = 31;
const HALF_WIDTH = 14;
function zaehleBegehbareFelder(karte) {
  return karte.join("").split("").filter((zeichen) => zeichen !== "#").length;
}
let startLabyrinth;
let mindestPunktAnzahl;
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const menu = document.querySelector("#menu");
const startButton = document.querySelector("#start-button");
const musikKnopf = document.querySelector("#music-toggle");
const spielerNameFeld = document.querySelector("#player-name");
const highscoreListe = document.querySelector("#highscores");
const highscoreSchluessel = "pacman-top5";

const feld = 20;
const startY = 80;

function spielStartX() {
  return (canvas.width - maze[0].length * feld) / 2;
}

// Hintergrund schwarz färben
ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

let spielerZeile = 1;
let spielerSpalte = 1;
let spielerName = "";
let punkte = 0;
let blickRichtung = 0;
let bewegungZeile = 0;
let bewegungSpalte = 1;
let punktSpawnGeplant = false;
let punktSpawnTimer;
let naechstesKartenItemBei = 400;
let kartenItem;
let kartenItemSpawnTimer;
let kartenItemAblaufTimer;
let kartenwechselAktiv = false;
let leben = 3;
let spielVorbei = false;
let spielSchritte = 0;
let item;
let itemSpawnTimer;
let itemAblaufTimer;
let powerTimer;
let powerAktiv = false;
let magnetTimer;
let magnetAktiv = false;
let naechsterMagnetBei = 150;
let naechsterBonusGeistBei = 250;
let audioContext;
let melodieTimer;
let melodieIndex = 0;
let musikAn = true;
const melodie = [
  523, 659, 784, 659, 523, 392,
  587, 698, 880, 698, 587, 440,
  523, 659, 784, 988, 784, 659,
  587, 523, 440, 523, 659, 523
];
const geisterStart = [
  { zeile: 15, spalte: 11, farbe: "purple" },
  { zeile: 15, spalte: 12, farbe: "limegreen" },
  { zeile: 15, spalte: 15, farbe: "red" },
  { zeile: 15, spalte: 16, farbe: "deepskyblue" }
];
let geister = [];

function spieleMelodieton(frequenz) {
  const ton = audioContext.createOscillator();
  const lautstaerke = audioContext.createGain();
  const start = audioContext.currentTime;

  ton.type = "square";
  ton.frequency.setValueAtTime(frequenz, start);
  lautstaerke.gain.setValueAtTime(0.035, start);
  lautstaerke.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
  ton.connect(lautstaerke);
  lautstaerke.connect(audioContext.destination);
  ton.start(start);
  ton.stop(start + 0.18);
  ton.addEventListener("ended", function () {
    ton.disconnect();
    lautstaerke.disconnect();
  }, { once: true });
}

function spieleEffekt(frequenzen, wellenform, dauer, lautstaerke) {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const start = audioContext.currentTime;
  frequenzen.forEach(function (frequenz, index) {
    const tonStart = start + index * dauer;
    const ton = audioContext.createOscillator();
    const gain = audioContext.createGain();

    ton.type = wellenform;
    ton.frequency.setValueAtTime(frequenz, tonStart);
    gain.gain.setValueAtTime(lautstaerke, tonStart);
    gain.gain.exponentialRampToValueAtTime(0.001, tonStart + dauer * 0.9);
    ton.connect(gain);
    gain.connect(audioContext.destination);
    ton.start(tonStart);
    ton.stop(tonStart + dauer);
    ton.addEventListener("ended", function () {
      ton.disconnect();
      gain.disconnect();
    }, { once: true });
  });
}

function spieleGeistKontaktSound() {
  spieleEffekt([180, 95], "sawtooth", 0.09, 0.12);
}

function spieleGameOverSound() {
  spieleEffekt([392, 330, 262, 196], "triangle", 0.22, 0.14);
}

function starteMusik() {
  if (!musikAn || melodieTimer) {
    return;
  }

  if (!window.AudioContext) {
    console.error("Dieser Browser unterstützt die Web-Audio-API nicht.");
    return;
  }

  audioContext ??= new window.AudioContext();
  audioContext.resume().then(function () {
    if (!musikAn || melodieTimer) {
      return;
    }

    spieleMelodieton(melodie[melodieIndex]);
    melodieIndex = (melodieIndex + 1) % melodie.length;
    melodieTimer = setInterval(function () {
      spieleMelodieton(melodie[melodieIndex]);
      melodieIndex = (melodieIndex + 1) % melodie.length;
    }, 240);
  }).catch(function (fehler) {
    console.error("Die Musik konnte nicht gestartet werden:", fehler);
  });
}

function aktualisiereMusikKnopf() {
  musikKnopf.textContent = musikAn ? "Musik: an" : "Musik: aus";
  musikKnopf.setAttribute("aria-pressed", String(musikAn));
}

function schalteMusik() {
  musikAn = !musikAn;
  aktualisiereMusikKnopf();

  if (musikAn) {
    starteMusik();
  } else {
    clearInterval(melodieTimer);
    melodieTimer = undefined;
  }
}

function setzeGeisterZurueck(neuesSpiel = false) {
  const bonusGeister = geister.filter((geist) => geist.bonus && !geist.abgelaufen);
  for (const geist of geister) {
    clearTimeout(geist.rueckkehrTimer);
    if (neuesSpiel) {
      clearTimeout(geist.ablaufTimer);
    }
  }
  geister = geisterStart.map((geist) => ({
    ...geist,
    startZeile: geist.zeile,
    startSpalte: geist.spalte,
    weg: false
  }));

  if (!neuesSpiel) {
    for (const geist of bonusGeister) {
      geist.weg = false;
      geist.zeile = geist.startZeile;
      geist.spalte = geist.startSpalte;
    }
    geister.push(...bonusGeister);
  }
}

function zeigeBonusGeist() {
  if (spielVorbei) {
    return;
  }

  const freieFelder = [];
  for (let zeile = 0; zeile < maze.length; zeile++) {
    for (let spalte = 0; spalte < maze[zeile].length; spalte++) {
      const belegt =
        (zeile === spielerZeile && spalte === spielerSpalte) ||
        geister.some(
          (geist) => geist.zeile === zeile && geist.spalte === spalte
        );
      if (maze[zeile][spalte] !== "#" && !belegt) {
        freieFelder.push({ zeile, spalte });
      }
    }
  }

  if (freieFelder.length === 0) {
    return;
  }

  const freieFelderOhnePunkt = freieFelder.filter(
    (feld) => maze[feld.zeile][feld.spalte] !== "."
  );
  const moeglicheFelder =
    freieFelderOhnePunkt.length > 0 ? freieFelderOhnePunkt : freieFelder;
  const startfeld =
    moeglicheFelder[Math.floor(Math.random() * moeglicheFelder.length)];
  const bonusGeist = {
    zeile: startfeld.zeile,
    spalte: startfeld.spalte,
    farbe: "orange",
    startZeile: startfeld.zeile,
    startSpalte: startfeld.spalte,
    weg: false,
    bonus: true,
    abgelaufen: false
  };

  geister.push(bonusGeist);
  bonusGeist.ablaufTimer = setTimeout(function () {
    bonusGeist.abgelaufen = true;
    clearTimeout(bonusGeist.rueckkehrTimer);
    geister = geister.filter((geist) => geist !== bonusGeist);
    zeichneSpiel();
  }, 20000);
  zeichneSpiel();
}

function pruefeBonusGeist() {
  while (punkte >= naechsterMagnetBei) {
    naechsterMagnetBei += 150;
    if (!powerAktiv) {
      aktiviereMagnet();
    }
  }

  while (punkte >= naechsterBonusGeistBei) {
    zeigeBonusGeist();
    naechsterBonusGeistBei += 250;
  }
  pruefeKartenItem();
}

function aktiviereMagnet() {
  magnetAktiv = true;
  clearTimeout(magnetTimer);
  magnetTimer = setTimeout(function () {
    magnetAktiv = false;
    magnetTimer = undefined;
    zeichneSpiel();
  }, 15000);
  zeichneSpiel();
}

function beendeMagnet() {
  magnetAktiv = false;
  clearTimeout(magnetTimer);
  magnetTimer = undefined;
}

function begehbareNachbarn(zeile, spalte) {
  const nachbarn = [
    { zeile: zeile - 1, spalte },
    { zeile: zeile + 1, spalte },
    { zeile, spalte: spalte - 1 },
    { zeile, spalte: spalte + 1 }
  ];

  if (maze.length === GRID_HEIGHT && zeile === 17) {
    if (spalte === 0) {
      nachbarn.push({ zeile: 17, spalte: maze[17].length - 1 });
    } else if (spalte === maze[17].length - 1) {
      nachbarn.push({ zeile: 17, spalte: 0 });
    }
  }

  return nachbarn.filter(
    (feld) =>
      feld.zeile >= 0 &&
      feld.zeile < maze.length &&
      feld.spalte >= 0 &&
      feld.spalte < maze[feld.zeile].length &&
      maze[feld.zeile][feld.spalte] !== "#"
  );
}

function ermittleEntfernungen(zielZeile, zielSpalte) {
  const entfernungen = new Map();
  const start = { zeile: zielZeile, spalte: zielSpalte };
  const warteschlange = [start];
  entfernungen.set(zielZeile + "," + zielSpalte, 0);

  for (let index = 0; index < warteschlange.length; index++) {
    const feld = warteschlange[index];
    const entfernung = entfernungen.get(feld.zeile + "," + feld.spalte);
    for (const nachbar of begehbareNachbarn(feld.zeile, feld.spalte)) {
      const schluessel = nachbar.zeile + "," + nachbar.spalte;
      if (!entfernungen.has(schluessel)) {
        entfernungen.set(schluessel, entfernung + 1);
        warteschlange.push(nachbar);
      }
    }
  }
  return entfernungen;
}

function waehleFreiesFeld(karte, belegteFelder) {
  const freieFelder = [];
  for (let zeile = 0; zeile < karte.length; zeile++) {
    for (let spalte = 0; spalte < karte[zeile].length; spalte++) {
      if (
        karte[zeile][spalte] !== "#" &&
        !belegteFelder.some(
          (feld) => feld.zeile === zeile && feld.spalte === spalte
        )
      ) {
        freieFelder.push({ zeile, spalte });
      }
    }
  }
  return freieFelder[Math.floor(Math.random() * freieFelder.length)];
}

function erzeugeZufaelligesLabyrinth() {
  const halbKarte = Array.from({ length: GRID_HEIGHT }, () =>
    Array(HALF_WIDTH).fill(1)
  );
  for (let zeile = 14; zeile < 20; zeile++) {
    for (let spalte = 10; spalte < HALF_WIDTH; spalte++) {
      halbKarte[zeile][spalte] =
        zeile === 14 || zeile === 19 || spalte === 10 ? 0 : 2;
    }
  }

  const stapel = [{ zeile: 1, spalte: 1 }];
  halbKarte[1][1] = 0;
  while (stapel.length > 0) {
    const feld = stapel[stapel.length - 1];
    const nachbarn = [
      { zeile: feld.zeile - 2, spalte: feld.spalte },
      { zeile: feld.zeile + 2, spalte: feld.spalte },
      { zeile: feld.zeile, spalte: feld.spalte - 2 },
      { zeile: feld.zeile, spalte: feld.spalte + 2 }
    ].filter(
      (nachbar) =>
        nachbar.zeile > 0 &&
        nachbar.zeile < GRID_HEIGHT - 1 &&
        nachbar.spalte > 0 &&
        nachbar.spalte < HALF_WIDTH - 1 &&
        halbKarte[nachbar.zeile][nachbar.spalte] === 1
    );

    if (nachbarn.length === 0) {
      stapel.pop();
      continue;
    }

    const naechster =
      nachbarn[Math.floor(Math.random() * nachbarn.length)];
    halbKarte[(feld.zeile + naechster.zeile) / 2][
      (feld.spalte + naechster.spalte) / 2
    ] = 0;
    halbKarte[naechster.zeile][naechster.spalte] = 0;
    stapel.push(naechster);
  }

  for (let zeile = 1; zeile < GRID_HEIGHT - 1; zeile++) {
    for (let spalte = 1; spalte < HALF_WIDTH - 1; spalte++) {
      if (halbKarte[zeile][spalte] !== 0) {
        continue;
      }

      const wandNachbarn = [
        [zeile - 1, spalte],
        [zeile + 1, spalte],
        [zeile, spalte - 1],
        [zeile, spalte + 1]
      ].filter(([nachbarZeile, nachbarSpalte]) =>
        halbKarte[nachbarZeile]?.[nachbarSpalte] === 1
      );

      if (wandNachbarn.length >= 3) {
        const [wandZeile, wandSpalte] =
          wandNachbarn[Math.floor(Math.random() * wandNachbarn.length)];
        if (
          wandZeile > 0 &&
          wandZeile < GRID_HEIGHT - 1 &&
          wandSpalte > 0 &&
          wandSpalte < HALF_WIDTH - 1
        ) {
          halbKarte[wandZeile][wandSpalte] = 0;
        }
      }
    }
  }

  halbKarte[17][0] = 0;

  // Zwei getrennte Querwege bleiben auch bei einem blockierten Feld offen.
  for (const zeile of [1, GRID_HEIGHT - 2]) {
    for (let spalte = 1; spalte < HALF_WIDTH; spalte++) {
      halbKarte[zeile][spalte] = 0;
    }
  }

  const vollKarte = halbKarte.map((zeile) => [...zeile, ...zeile.slice().reverse()]);
  return vollKarte.map((zeile) =>
    zeile.map((feld) => (feld === 1 ? "#" : feld === 2 ? "G" : ".")).join("")
  );
}

maze = erzeugeZufaelligesLabyrinth();
startLabyrinth = maze.slice();
mindestPunktAnzahl = Math.ceil(zaehleBegehbareFelder(startLabyrinth) / 3);

function planeKartenItem() {
  if (
    canvas.hidden ||
    spielVorbei ||
    kartenItem ||
    kartenItemSpawnTimer ||
    punkte < naechstesKartenItemBei
  ) {
    return;
  }

  const belegteFelder = [
    { zeile: spielerZeile, spalte: spielerSpalte },
    ...geister
      .filter((geist) => !geist.weg)
      .map((geist) => ({ zeile: geist.zeile, spalte: geist.spalte }))
  ];
  if (item) {
    belegteFelder.push({ zeile: item.zeile, spalte: item.spalte });
  }

  const feld = waehleFreiesFeld(maze, belegteFelder);
  if (!feld) {
    kartenItemSpawnTimer = setTimeout(function () {
      kartenItemSpawnTimer = undefined;
      planeKartenItem();
    }, 250);
    return;
  }

  kartenItem = feld;
  naechstesKartenItemBei += 400;
  kartenItemAblaufTimer = setTimeout(function () {
    kartenItem = undefined;
    kartenItemAblaufTimer = undefined;
    planeKartenItem();
    zeichneSpiel();
  }, 20000);
  zeichneSpiel();
}

function wechsleKarte() {
  if (spielVorbei) {
    return;
  }

  const neueKarte = erzeugeZufaelligesLabyrinth();
  const belegteFelder = [];

  const neuesSpielerFeld = waehleFreiesFeld(neueKarte, belegteFelder);
  if (!neuesSpielerFeld) {
    throw new Error("Im neuen Labyrinth wurde kein Startfeld gefunden.");
  }
  spielerZeile = neuesSpielerFeld.zeile;
  spielerSpalte = neuesSpielerFeld.spalte;
  belegteFelder.push(neuesSpielerFeld);

  for (const geist of geister) {
    const neuesGeisterFeld = waehleFreiesFeld(neueKarte, belegteFelder);
    if (neuesGeisterFeld) {
      geist.zeile = neuesGeisterFeld.zeile;
      geist.spalte = neuesGeisterFeld.spalte;
      geist.startZeile = neuesGeisterFeld.zeile;
      geist.startSpalte = neuesGeisterFeld.spalte;
      belegteFelder.push(neuesGeisterFeld);
    }
  }

  if (item) {
    const neuesItemFeld = waehleFreiesFeld(neueKarte, belegteFelder);
    if (neuesItemFeld) {
      item.zeile = neuesItemFeld.zeile;
      item.spalte = neuesItemFeld.spalte;
      belegteFelder.push(neuesItemFeld);
    }
  }

  maze.splice(0, maze.length, ...neueKarte);
  mindestPunktAnzahl = Math.ceil(zaehleBegehbareFelder(maze) / 3);
  const belegteZeichenFelder = [
    { zeile: spielerZeile, spalte: spielerSpalte },
    ...geister.map((geist) => ({ zeile: geist.zeile, spalte: geist.spalte })),
    ...(item ? [{ zeile: item.zeile, spalte: item.spalte }] : [])
  ];
  for (const feld of belegteZeichenFelder) {
    maze[feld.zeile] =
      maze[feld.zeile].slice(0, feld.spalte) +
      " " +
      maze[feld.zeile].slice(feld.spalte + 1);
  }

  kartenwechselAktiv = true;
  planeNeuenPunkt();
  pruefeKartenItem();
  zeichneSpiel();
}

function sammleKartenItem() {
  if (
    !kartenItem ||
    kartenItem.zeile !== spielerZeile ||
    kartenItem.spalte !== spielerSpalte
  ) {
    return;
  }

  clearTimeout(kartenItemAblaufTimer);
  kartenItemAblaufTimer = undefined;
  kartenItem = undefined;
  wechsleKarte();
}

function pruefeKartenItem() {
  if (punkte >= naechstesKartenItemBei) {
    planeKartenItem();
  }
}

function ladeRekorde() {
  let gespeicherteRekorde;
  try {
    gespeicherteRekorde = localStorage.getItem(highscoreSchluessel);
  } catch (fehler) {
    console.error("Rekorde konnten nicht geladen werden:", fehler);
    return [];
  }

  if (!gespeicherteRekorde) {
    return [];
  }

  try {
    const rekorde = JSON.parse(gespeicherteRekorde);
    if (!Array.isArray(rekorde)) {
      throw new Error("Die gespeicherten Rekorde sind keine Liste.");
    }
    return rekorde.filter(
      (rekord) =>
        Number.isFinite(rekord.punkte) &&
        rekord.punkte >= 0 &&
        typeof rekord.datum === "string"
    );
  } catch (fehler) {
    console.error("Gespeicherte Rekorde sind ungültig:", fehler);
    return [];
  }
}

function zeigeRekorde() {
  const rekorde = ladeRekorde()
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 5);
  highscoreListe.replaceChildren();

  if (rekorde.length === 0) {
    const eintrag = document.createElement("li");
    eintrag.textContent = "Noch keine Rekorde";
    highscoreListe.append(eintrag);
    return;
  }

  for (const rekord of rekorde) {
    const eintrag = document.createElement("li");
    const name = typeof rekord.name === "string" ? rekord.name : "Unbekannt";
    eintrag.textContent =
      name + " – " + rekord.punkte + " Punkte – " + rekord.datum;
    highscoreListe.append(eintrag);
  }
}

function speichereRekord() {
  const rekorde = ladeRekorde();
  rekorde.push({
    name: spielerName,
    punkte,
    datum: new Date().toLocaleDateString("de-DE")
  });
  rekorde.sort((a, b) => b.punkte - a.punkte);

  try {
    localStorage.setItem(
      highscoreSchluessel,
      JSON.stringify(rekorde.slice(0, 5))
    );
  } catch (fehler) {
    console.error("Rekord konnte nicht gespeichert werden:", fehler);
  }
  zeigeRekorde();
}

function planeItem() {
  if (canvas.hidden || spielVorbei || item || itemSpawnTimer) {
    return;
  }

  const wartezeit = 5000 + Math.random() * 5000;
  itemSpawnTimer = setTimeout(function () {
    itemSpawnTimer = undefined;

    const freieFelder = [];
    for (let zeile = 0; zeile < maze.length; zeile++) {
      for (let spalte = 0; spalte < maze[zeile].length; spalte++) {
        const geistAufFeld = geister.some(
          (geist) =>
            !geist.weg && geist.zeile === zeile && geist.spalte === spalte
        );
        if (
          maze[zeile][spalte] !== "#" &&
          (zeile !== spielerZeile || spalte !== spielerSpalte) &&
          !geistAufFeld
        ) {
          freieFelder.push({ zeile, spalte });
        }
      }
    }

    if (freieFelder.length === 0) {
      planeItem();
      return;
    }

    const feld =
      freieFelder[Math.floor(Math.random() * freieFelder.length)];
    const itemTypen = ["power", "bonusPunkt", "auffuellen"];
    if (leben < 3) {
      itemTypen.push("herz");
    }
    item = {
      zeile: feld.zeile,
      spalte: feld.spalte,
      typ: itemTypen[Math.floor(Math.random() * itemTypen.length)]
    };
    itemAblaufTimer = setTimeout(function () {
      item = undefined;
      itemAblaufTimer = undefined;
      planeItem();
      zeichneSpiel();
    }, 15000);
    zeichneSpiel();
  }, wartezeit);
}

function sammleItem() {
  if (
    !item ||
    item.zeile !== spielerZeile ||
    item.spalte !== spielerSpalte
  ) {
    return;
  }

  clearTimeout(itemAblaufTimer);
  itemAblaufTimer = undefined;

  if (item.typ === "herz") {
    leben = Math.min(3, leben + 1);
  } else if (item.typ === "power") {
    beendeMagnet();
    powerAktiv = true;
    clearTimeout(powerTimer);
    powerTimer = setTimeout(function () {
      powerAktiv = false;
      powerTimer = undefined;
      zeichneSpiel();
    }, 7000);
  } else if (item.typ === "bonusPunkt") {
    punkte += 5;
    pruefeBonusGeist();
  } else if (item.typ === "auffuellen") {
    for (let zeile = 0; zeile < maze.length; zeile++) {
      for (let spalte = 0; spalte < maze[zeile].length; spalte++) {
        if (
          maze[zeile][spalte] !== "#" &&
          (zeile !== spielerZeile || spalte !== spielerSpalte)
        ) {
          maze[zeile] =
            maze[zeile].slice(0, spalte) +
            "." +
            maze[zeile].slice(spalte + 1);
        }
      }
    }
  }

  item = undefined;
  planeItem();
  zeichneSpiel();
}

function punktNeuErscheinenLassen() {
  const freieFelder = [];

  for (let zeile = 0; zeile < maze.length; zeile++) {
    for (let spalte = 0; spalte < maze[zeile].length; spalte++) {
      const abstand =
        Math.abs(zeile - spielerZeile) + Math.abs(spalte - spielerSpalte);

      const geistAufFeld = geister.some(
        (geist) => geist.zeile === zeile && geist.spalte === spalte
      );

      if (
        maze[zeile][spalte] !== "#" &&
        maze[zeile][spalte] !== "." &&
        (zeile !== spielerZeile || spalte !== spielerSpalte) &&
        !geistAufFeld
      ) {
        freieFelder.push({ zeile, spalte, abstand });
      }
    }
  }

  if (freieFelder.length === 0) {
    return false;
  }

  const weitEntfernteFelder = freieFelder.filter((feld) => feld.abstand >= 5);
  const moeglicheFelder =
    weitEntfernteFelder.length > 0 ? weitEntfernteFelder : freieFelder;
  const groessterAbstand = Math.max(
    ...moeglicheFelder.map((feld) => feld.abstand)
  );
  const amWeitestenEntfernteFelder = moeglicheFelder.filter(
    (feld) => feld.abstand === groessterAbstand
  );
  const neuesFeld =
    amWeitestenEntfernteFelder[
      Math.floor(Math.random() * amWeitestenEntfernteFelder.length)
    ];

  maze[neuesFeld.zeile] =
    maze[neuesFeld.zeile].slice(0, neuesFeld.spalte) +
    "." +
    maze[neuesFeld.zeile].slice(neuesFeld.spalte + 1);
  zeichneSpiel();
  return true;
}

function zaehlePunkteAufSpielfeld() {
  return maze.join("").split(".").length - 1;
}

function planeNeuenPunkt() {
  if (canvas.hidden || spielVorbei) {
    return;
  }

  while (zaehlePunkteAufSpielfeld() < mindestPunktAnzahl) {
    if (punktNeuErscheinenLassen()) {
      continue;
    }

    if (!punktSpawnGeplant) {
      punktSpawnGeplant = true;
      punktSpawnTimer = setTimeout(function () {
        punktSpawnGeplant = false;
        punktSpawnTimer = undefined;
        planeNeuenPunkt();
      }, 150);
    }
    return;
  }
}

function zeichneSpiel() {
  const links = spielStartX();
  const groesse = feld / 32;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let zeile = 0; zeile < maze.length; zeile++) {
    for (let spalte = 0; spalte < maze[zeile].length; spalte++) {
      const zeichen = maze[zeile][spalte];
      const x = links + spalte * feld;
      const y = startY + zeile * feld;

      if (zeichen === "#") {
        ctx.fillStyle = "blue";
        ctx.fillRect(x, y, feld, feld);
      } else if (zeichen === ".") {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x + feld / 2, y + feld / 2, 4 * groesse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (kartenItem) {
    const mitteX = links + kartenItem.spalte * feld + feld / 2;
    const mitteY = startY + kartenItem.zeile * feld + feld / 2;
    ctx.fillStyle = "darkviolet";
    ctx.beginPath();
    ctx.arc(mitteX, mitteY, 12 * groesse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2 * groesse;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(mitteX, mitteY, 9 * groesse, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2 * groesse;
    ctx.beginPath();
    ctx.moveTo(mitteX - 7 * groesse, mitteY - 5 * groesse);
    ctx.lineTo(mitteX + 6 * groesse, mitteY - 5 * groesse);
    ctx.lineTo(mitteX + 6 * groesse, mitteY - groesse);
    ctx.lineTo(mitteX - 4 * groesse, mitteY - groesse);
    ctx.lineTo(mitteX - 4 * groesse, mitteY + 3 * groesse);
    ctx.lineTo(mitteX + 7 * groesse, mitteY + 3 * groesse);
    ctx.lineTo(mitteX + 7 * groesse, mitteY + 7 * groesse);
    ctx.stroke();
    ctx.restore();
  }

  if (item) {
    const mitteX = links + item.spalte * feld + feld / 2;
    const mitteY = startY + item.zeile * feld + feld / 2;

    if (item.typ === "herz") {
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.moveTo(mitteX, mitteY + 9 * groesse);
      ctx.bezierCurveTo(mitteX - 15 * groesse, mitteY, mitteX - 8 * groesse, mitteY - 12 * groesse, mitteX, mitteY - 5 * groesse);
      ctx.bezierCurveTo(mitteX + 8 * groesse, mitteY - 12 * groesse, mitteX + 15 * groesse, mitteY, mitteX, mitteY + 9 * groesse);
      ctx.fill();
    } else if (item.typ === "power") {
      ctx.fillStyle = "deepskyblue";
      ctx.beginPath();
      ctx.moveTo(mitteX + 2 * groesse, mitteY - 12 * groesse);
      ctx.lineTo(mitteX - 8 * groesse, mitteY + groesse);
      ctx.lineTo(mitteX - groesse, mitteY + groesse);
      ctx.lineTo(mitteX - 4 * groesse, mitteY + 12 * groesse);
      ctx.lineTo(mitteX + 8 * groesse, mitteY - 3 * groesse);
      ctx.lineTo(mitteX + groesse, mitteY - 3 * groesse);
      ctx.closePath();
      ctx.fill();
    } else if (item.typ === "bonusPunkt") {
      ctx.fillStyle = "gold";
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, 11 * groesse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2 * groesse;
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = 12 * groesse + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("5", mitteX, mitteY);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    } else if (item.typ === "auffuellen") {
      ctx.fillStyle = "limegreen";
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, 11 * groesse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillRect(mitteX - 2 * groesse, mitteY - 7 * groesse, 4 * groesse, 14 * groesse);
      ctx.fillRect(mitteX - 7 * groesse, mitteY - 2 * groesse, 14 * groesse, 4 * groesse);
    }
  }

  for (const geist of geister) {
    if (geist.weg) {
      continue;
    }
    const mitteX = links + geist.spalte * feld + feld / 2;
    const mitteY = startY + geist.zeile * feld + feld / 2;

    ctx.save();
    if (magnetAktiv && !powerAktiv && Date.now() % 600 < 180) {
      ctx.globalAlpha = 0.25;
    }

    ctx.fillStyle = powerAktiv ? "black" : geist.farbe;
    ctx.beginPath();
    ctx.arc(mitteX, mitteY - 2 * groesse, 12 * groesse, Math.PI, 0);
    ctx.lineTo(mitteX + 12 * groesse, mitteY + 11 * groesse);
    ctx.lineTo(mitteX + 4 * groesse, mitteY + 7 * groesse);
    ctx.lineTo(mitteX, mitteY + 11 * groesse);
    ctx.lineTo(mitteX - 4 * groesse, mitteY + 7 * groesse);
    ctx.lineTo(mitteX - 12 * groesse, mitteY + 11 * groesse);
    ctx.closePath();
    ctx.fill();
    if (powerAktiv) {
      ctx.strokeStyle = "deepskyblue";
      ctx.lineWidth = 3 * groesse;
      ctx.stroke();
    }

    for (const augenAbstand of [-5 * groesse, 5 * groesse]) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(mitteX + augenAbstand, mitteY - 2 * groesse, 4 * groesse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = powerAktiv
        ? "deepskyblue"
        : magnetAktiv
          ? "red"
          : "blue";
      ctx.beginPath();
      ctx.arc(mitteX + augenAbstand + groesse, mitteY - 2 * groesse, 2 * groesse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const x = links + spielerSpalte * feld;
  const y = startY + spielerZeile * feld;

  const mitteX = x + feld / 2;
  const mitteY = y + feld / 2;

  ctx.save();
  ctx.translate(mitteX, mitteY);
  ctx.rotate(blickRichtung);

  // Pac-Man schaut im ungedrehten Zustand nach rechts.
  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(0, 0, 15 * groesse, 0.25, Math.PI * 2 - 0.25);
  ctx.lineTo(0, 0);
  ctx.fill();

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(2 * groesse, -8 * groesse, 2 * groesse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "white";
  ctx.font = "20px sans-serif";
  ctx.fillText("Punkte: " + punkte, 10, 30);
  ctx.fillStyle = "red";
  ctx.font = "24px sans-serif";
  ctx.fillText("♥".repeat(leben), canvas.width - 100, 30);
  if (powerAktiv) {
    ctx.fillStyle = "deepskyblue";
    ctx.font = "16px sans-serif";
    ctx.fillText("POWER!", 10, 55);
  } else if (magnetAktiv) {
    ctx.fillStyle = "red";
    ctx.font = "16px sans-serif";
    ctx.fillText("MAGNET!", 10, 55);
  }
  if (kartenwechselAktiv) {
    ctx.fillStyle = "cyan";
    ctx.font = "16px sans-serif";
    ctx.fillText("ZUFALLSLABYRINTH!", 10, 75);
  }

  if (spielVorbei) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "red";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
  }
}

function pruefeGeisterKollision() {
  const getroffeneGeister = geister.filter(
    (geist) =>
      !geist.weg &&
      geist.zeile === spielerZeile &&
      geist.spalte === spielerSpalte
  );

  if (getroffeneGeister.length === 0 || spielVorbei) {
    return;
  }

  if (powerAktiv) {
    for (const geist of getroffeneGeister) {
      geist.weg = true;
      punkte += 10;
      pruefeBonusGeist();
      geist.rueckkehrTimer = setTimeout(function () {
        if (geist.abgelaufen || spielVorbei) {
          return;
        }
        geist.weg = false;
        geist.zeile = geist.startZeile;
        geist.spalte = geist.startSpalte;
        geist.rueckkehrTimer = undefined;
        zeichneSpiel();
      }, 15000);
    }
    return;
  }

  leben--;
  if (leben === 0) {
    spielVorbei = true;
    spieleGameOverSound();
    clearTimeout(punktSpawnTimer);
    clearTimeout(itemSpawnTimer);
    clearTimeout(itemAblaufTimer);
    clearTimeout(powerTimer);
    clearTimeout(magnetTimer);
    for (const geist of geister) {
      clearTimeout(geist.rueckkehrTimer);
      clearTimeout(geist.ablaufTimer);
    }
    clearTimeout(kartenItemSpawnTimer);
    clearTimeout(kartenItemAblaufTimer);
    itemSpawnTimer = undefined;
    itemAblaufTimer = undefined;
    powerTimer = undefined;
    magnetTimer = undefined;
    magnetAktiv = false;
    kartenItemSpawnTimer = undefined;
    kartenItemAblaufTimer = undefined;
    kartenwechselAktiv = false;
    kartenItem = undefined;
    punktSpawnGeplant = false;
    speichereRekord();
    zeichneSpiel();
    setTimeout(function () {
      canvas.hidden = true;
      menu.hidden = false;
    }, 1800);
    return;
  }

  spieleGeistKontaktSound();
  spielerZeile = 1;
  spielerSpalte = 1;
  setzeGeisterZurueck();
  zeichneSpiel();
}

function bewegeSpieler() {
  if (spielVorbei) {
    return;
  }

  const neueZeile = spielerZeile + bewegungZeile;
  let neueSpalte = spielerSpalte + bewegungSpalte;
  if (maze.length === GRID_HEIGHT && neueZeile === 17) {
    if (neueSpalte < 0) {
      neueSpalte = maze[neueZeile].length - 1;
    } else if (neueSpalte >= maze[neueZeile].length) {
      neueSpalte = 0;
    }
  }

  if (
    neueZeile >= 0 &&
    neueZeile < maze.length &&
    neueSpalte >= 0 &&
    neueSpalte < maze[neueZeile].length &&
    maze[neueZeile][neueSpalte] !== "#"
  ) {
    spielerZeile = neueZeile;
    spielerSpalte = neueSpalte;

    if (maze[neueZeile][neueSpalte] === ".") {
      maze[neueZeile] =
        maze[neueZeile].slice(0, neueSpalte) +
        " " +
        maze[neueZeile].slice(neueSpalte + 1);
      punkte++;
      pruefeBonusGeist();
      planeNeuenPunkt();
    }

    sammleItem();
    sammleKartenItem();
  }

  pruefeGeisterKollision();
}

function bewegeGeister() {
  if (spielVorbei) {
    return;
  }

  const entfernungenZumSpieler =
    powerAktiv || magnetAktiv
      ? ermittleEntfernungen(spielerZeile, spielerSpalte)
      : undefined;

  for (const geist of geister) {
    if (geist.weg) {
      continue;
    }

    const moeglicheZuege = begehbareNachbarn(geist.zeile, geist.spalte);

    if (moeglicheZuege.length > 0) {
      let zug;
      if (entfernungenZumSpieler) {
        const distanz = (feld) =>
          entfernungenZumSpieler.get(feld.zeile + "," + feld.spalte) ??
          Number.POSITIVE_INFINITY;
        const zielDistanz = distanz({
          zeile: geist.zeile,
          spalte: geist.spalte
        });

        if (powerAktiv) {
          const fluchtZuege = moeglicheZuege.filter(
            (feld) => distanz(feld) > zielDistanz
          );
          const kandidaten =
            fluchtZuege.length > 0 ? fluchtZuege : moeglicheZuege;
          const groessteDistanz = Math.max(...kandidaten.map(distanz));
          const weitesteZuege = kandidaten.filter(
            (feld) => distanz(feld) === groessteDistanz
          );
          zug =
            weitesteZuege[Math.floor(Math.random() * weitesteZuege.length)];
        } else {
          const kuerzesteDistanz = Math.min(...moeglicheZuege.map(distanz));
          const kandidaten = moeglicheZuege.filter(
            (feld) => distanz(feld) === kuerzesteDistanz
          );
          zug = kandidaten[Math.floor(Math.random() * kandidaten.length)];
        }
      } else {
        zug = moeglicheZuege[
          Math.floor(Math.random() * moeglicheZuege.length)
        ];
      }

      geist.zeile = zug.zeile;
      geist.spalte = zug.spalte;
    }
  }

  pruefeGeisterKollision();
}

function spielNeuStarten() {
  clearTimeout(punktSpawnTimer);
  clearTimeout(itemSpawnTimer);
  clearTimeout(itemAblaufTimer);
  clearTimeout(powerTimer);
  clearTimeout(magnetTimer);
  for (const geist of geister) {
    clearTimeout(geist.rueckkehrTimer);
    clearTimeout(geist.ablaufTimer);
  }
  clearTimeout(kartenItemSpawnTimer);
  clearTimeout(kartenItemAblaufTimer);
  itemSpawnTimer = undefined;
  itemAblaufTimer = undefined;
  powerTimer = undefined;
  magnetTimer = undefined;
  magnetAktiv = false;
  naechsterMagnetBei = 150;
  kartenItemSpawnTimer = undefined;
  kartenItemAblaufTimer = undefined;
  maze.splice(0, maze.length, ...startLabyrinth);
  mindestPunktAnzahl = Math.ceil(zaehleBegehbareFelder(maze) / 3);
  spielerZeile = 1;
  spielerSpalte = 1;
  punkte = 0;
  leben = 3;
  blickRichtung = 0;
  bewegungZeile = 0;
  bewegungSpalte = 1;
  punktSpawnGeplant = false;
  punktSpawnTimer = undefined;
  spielVorbei = false;
  item = undefined;
  kartenItem = undefined;
  powerAktiv = false;
  kartenwechselAktiv = false;
  naechstesKartenItemBei = 400;
  naechsterBonusGeistBei = 250;
  setzeGeisterZurueck(true);
  zeichneSpiel();
  planeItem();
}

function spielSchritt() {
  if (canvas.hidden || spielVorbei) {
    return;
  }

  bewegeSpieler();
  spielSchritte++;
  if (spielSchritte % 2 === 0) {
    bewegeGeister();
  }
  zeichneSpiel();
}

document.addEventListener("keydown", function (event) {
  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    schalteMusik();
    return;
  }

  if (canvas.hidden || spielVorbei) {
    return;
  }

  const taste = event.key.toLowerCase();

  if (event.key === "ArrowUp" || taste === "w") {
    bewegungZeile = -1;
    bewegungSpalte = 0;
    blickRichtung = -Math.PI / 2;
  } else if (event.key === "ArrowDown" || taste === "s") {
    bewegungZeile = 1;
    bewegungSpalte = 0;
    blickRichtung = Math.PI / 2;
  } else if (event.key === "ArrowLeft" || taste === "a") {
    bewegungZeile = 0;
    bewegungSpalte = -1;
    blickRichtung = Math.PI;
  } else if (event.key === "ArrowRight" || taste === "d") {
    bewegungZeile = 0;
    bewegungSpalte = 1;
    blickRichtung = 0;
  } else {
    return;
  }

  event.preventDefault();
  zeichneSpiel();
});

setzeGeisterZurueck();
zeigeRekorde();
startButton.addEventListener("click", function () {
  const eingegebenerName = spielerNameFeld.value.trim();
  if (!eingegebenerName) {
    spielerNameFeld.setCustomValidity("Bitte gib deinen Spielernamen ein.");
    spielerNameFeld.reportValidity();
    spielerNameFeld.focus();
    return;
  }

  spielerNameFeld.setCustomValidity("");
  spielerName = eingegebenerName;
  menu.hidden = true;
  canvas.hidden = false;
  spielNeuStarten();
  if (window.AudioContext) {
    audioContext ??= new window.AudioContext();
    audioContext.resume().then(function () {
      starteMusik();
    }).catch(function (fehler) {
      console.error("Der Ton konnte nicht aktiviert werden:", fehler);
    });
  } else {
    console.error("Dieser Browser unterstützt die Web-Audio-API nicht.");
  }
});
spielerNameFeld.addEventListener("input", function () {
  spielerNameFeld.setCustomValidity("");
});
musikKnopf.addEventListener("click", function () {
  schalteMusik();
});
aktualisiereMusikKnopf();
setInterval(spielSchritt, 180);