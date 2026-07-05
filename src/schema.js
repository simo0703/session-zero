// Session Zero — Schema dati della stanza
// Questo modulo definisce la struttura dello stato che ogni GameRoom tiene in memoria
// per tutta la durata di una sessione. È generico: la stessa forma serve sia per
// La Soglia (Ferrara) sia per The Ledger Game (Stahl) — cambia solo gameConfig.

/**
 * Stato iniziale di una stanza appena creata.
 * roomCode: il codice a 6 caratteri usato dai giocatori per entrare.
 * gameId: quale gioco è in corso — "la-soglia" oppure "ledger-game".
 *         Determina quale gameConfig caricare (competenze, soglie, testi di scena).
 */
function creaStatoIniziale(roomCode, gameId) {
  return {
    roomCode,
    gameId,
    status: "lobby", // "lobby" | "playing" | "ended"
    createdAt: Date.now(),

    // Chi c'è in stanza. L'host è sempre players[0] finché non si assegna il Censore.
    players: [],
    // Esempio di un player:
    // {
    //   id: "p1",                  // identificatore interno di sessione (non persistente)
    //   nickname: "Marta",
    //   role: "player",            // "player" | "gm"
    //   competenzaPrincipale: "",  // scelta in lobby, dipende da gameConfig
    //   misura: 0,                 // il "conto" personale — dipende dal gioco
    //   connesso: true
    // }

    gmId: null, // id del player che ha scelto di fare il Censore/GM

    // L'Orologio dell'atto — avanza ogni due scene (regola fissata nel Design Bible cartaceo)
    orologio: {
      valore: 0,
      soglia: 8, // quando raggiunge la soglia, l'atto si chiude
      sceneContate: 0
    },

    // La scena attualmente aperta dal Censore
    scenaCorrente: {
      id: null,
      testo: "",
      tiroRichiesto: false,
      giocatoreCoinvolto: null
    },

    // Storico essenziale della sessione (non persistito oltre la sessione stessa,
    // usato solo per calcolare le statistiche finali)
    log: {
      sceneAperte: 0,
      tiriEffettuati: 0,
      inizioSessione: Date.now()
    }
  };
}

/**
 * Configurazione specifica di ogni gioco. Questo è il livello che li differenzia
 * senza toccare il motore. Va completato con i dati reali di ciascun Design Bible
 * (competenze, tabelle dei segni, soglie di dado) quando costruiamo i contenuti.
 */
const gameConfigs = {
  "la-soglia": {
    nome: "La Soglia",
    lingua: "it",
    competenze: [], // da compilare con le 12 competenze del Design Bible Ferrara
    orologioSoglia: 8,
    terminologia: {
      misura: "la Misura",
      gm: "il Censore",
      orologio: "l'Orologio"
    }
  },
  "ledger-game": {
    nome: "The Ledger Game",
    lingua: "en",
    competenze: [], // da compilare con le competenze/ruoli del Design Bible Stahl
    orologioSoglia: 8,
    terminologia: {
      misura: "the Ledger",
      gm: "the Censor",
      orologio: "the Clock"
    }
  }
};

export { creaStatoIniziale, gameConfigs };
