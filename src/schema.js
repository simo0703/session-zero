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

    // Chi c'è in stanza. L'host è sempre players[0] finché non si assegna il narratore.
    players: [],
    // Esempio di un player:
    // {
    //   id: "p1",
    //   nickname: "Marta",
    //   role: "player",            // "player" | "gm"
    //   competenzaPrincipale: "",  // scelta tra le competenze di gameConfig
    //   tracce: { corpo: 0, equipaggiamento: 0, copertura: 0 }, // 0-6 ciascuna
    //   connesso: true
    // }

    gmId: null, // id del player che guida la partita (narratore / Censore, secondo il gioco)

    // L'Orologio dell'atto — avanza ogni due scene (regola fissata nel Design Bible cartaceo)
    orologio: {
      valore: 0,
      soglia: 8,
      sceneContate: 0
    },

    // La scena attualmente aperta da chi guida la partita
    scenaCorrente: {
      id: null,
      testo: "",
      tiroRichiesto: false,
      giocatoreCoinvolto: null,
      competenzaRichiesta: "",
      sogliaRichiesta: 0,
      tracciaARischio: "",
      numDadi: 0,
      tiroEffettuato: false,
      risultatoDadi: [],
      successi: 0,
      esito: "", // "pieno" | "costo" | "fallimento"
      segnoTesto: ""
    },

    log: {
      sceneAperte: 0,
      tiriEffettuati: 0,
      inizioSessione: Date.now()
    }
  };
}

/**
 * Configurazione specifica di ogni gioco: quello che li differenzia senza
 * toccare il motore. I dati de "La Soglia" sono presi dal Design Bible
 * cartaceo (v1.3). Quelli di "The Ledger Game" restano da compilare.
 */
const gameConfigs = {
  "la-soglia": {
    nome: "La Soglia",
    lingua: "it",
    terminologia: {
      gm: "il narratore",
      gmMaiuscolo: "Il narratore",
      orologio: "l'Orologio"
    },
    competenze: [
      "Terreno", "Corde", "Strumenti", "Lingue", "Sangue freddo", "Carico",
      "Acqua", "Meccanica", "Medicina", "Orientamento", "Trattativa", "Silenzio"
    ],
    // Tre tracce di conseguenza, 6 caselle ciascuna. Ogni casella ha un segno
    // pronto da leggere ad alta voce così com'è — mai il nome dell'emozione,
    // solo il fatto, come vuole lo stile Ferrara.
    tracce: {
      corpo: {
        label: "Corpo",
        segni: [
          "Il fiato si allunga di un respiro, sul gradino che prima non contava",
          "Una vescica sul palmo, ancora ignorata",
          "La mano sinistra si chiude a metà, e la si nasconde in tasca",
          "Il passo rallenta senza che lo si decida",
          "Le dita non sentono più la corda, solo il suo peso",
          "Il corpo smette di rispondere agli ordini: qualcun altro deve deciderne il passo"
        ]
      },
      equipaggiamento: {
        label: "Equipaggiamento",
        segni: [
          "La batteria di riserva segna già meno del previsto",
          "Un moschettone ha un graffio nuovo, profondo",
          "L'acqua nella seconda tanica sa di plastica calda",
          "La torcia principale vira al giallo",
          "Uno strumento smette di rispondere ai comandi, poi riparte da solo — una volta",
          "Quello che serviva davvero non risponde più, e non c'è tempo di aprirlo"
        ]
      },
      copertura: {
        label: "Copertura",
        segni: [
          "Il nome della Guida viene ripetuto due volte da chi lo ascolta",
          "Un documento ha una data che nessuno aveva controllato",
          "Qualcuno, al villaggio, fa una domanda che non c'entra — e resta a guardare la risposta",
          "Il capoposto tiene i documenti un secondo di troppo prima di restituirli",
          "Un'auto senza insegne passa due volte sulla stessa strada",
          "Qualcuno vi sta cercando — e sa dove"
        ]
      }
    },
    orologioSoglia: 8
  },
  "ledger-game": {
    nome: "The Ledger Game",
    lingua: "en",
    terminologia: {
      gm: "the Censor",
      gmMaiuscolo: "The Censor",
      orologio: "the Clock"
    },
    competenze: [], // da compilare con le competenze/ruoli del Design Bible Stahl
    tracce: {
      ledger: { label: "the Ledger", segni: [] } // da compilare
    },
    orologioSoglia: 8
  }
};

export { creaStatoIniziale, gameConfigs };
