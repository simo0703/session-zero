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
    // Esempio di un player normale (role "player"), con scheda personaggio vera:
    // {
    //   id: "p1",
    //   nickname: "Marta",
    //   role: "player",
    //   mestiere: "rilevatore",        // uno dei 6 id in gameConfig.mestieri
    //   competenze: { "Strumenti": 3, "Terreno": 2, "Silenzio": 1 }, // 3 al Mestiere + 3 punti liberi su due extra
    //   difetto: "",                   // il gesto che si vede (facoltativo)
    //   ragione: "",                   // la riga sul perché ha firmato (facoltativa)
    //   simbolo: "🧭",
    //   tracce: { corpo: 0, equipaggiamento: 0, copertura: 0 }, // 0-6 ciascuna
    //   connesso: true
    // }
    // Chi guida la partita (role "gm") non ha mestiere/competenze/difetto/ragione:
    // narra, non gioca una scheda.

    gmId: null, // id del player che guida la partita (narratore / Censore, secondo il gioco)

    // L'Orologio dell'atto — avanza ogni due scene (regola fissata nel Design Bible cartaceo)
    orologio: {
      valore: 0,
      soglia: 8,
      sceneContate: 0,
      congelaProssimo: false // true se un giocatore ha speso il margine per fermarlo
    },

    // La scena attualmente aperta da chi guida la partita
    scenaCorrente: {
      id: null,
      testo: "",
      libreriaId: "", // id "scenario:atto:scena" se caricata dalla libreria, altrimenti vuoto
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
      segnoTesto: "",
      margine: 0,
      margineSpeso: false,
      margineScelta: "", // "traccia" | "orologio"
      // Dadi d'Azzardo (Design Bible §4.1): fino a 2 dadi extra dichiarati
      // dal giocatore prima del tiro. Un 1 naturale su di essi barra subito
      // 1 casella sulla traccia dichiarata in anticipo, indipendentemente
      // dall'esito complessivo del tiro.
      risultatoDadiAzzardo: [],
      doveScaricareAzzardo: "", // "corpo" | "equipaggiamento"
      costoAzzardo: 0,
      segnoAzzardoTesto: ""
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
    // I Sei Mestieri (Design Bible v1.3, §3.1-3.2): ognuno dà 3 dadi fissi
    // sulla propria competenzaMestiere. Il resto della scheda (altri 3 punti
    // su due competenze diverse, max 3 ciascuna) è distribuzione libera del
    // giocatore, applicata dal motore in fase di creazione personaggio.
    mestieri: [
      {
        id: "rilevatore",
        nome: "Il Rilevatore",
        competenzaMestiere: "Strumenti",
        descrizione: "Gli strumenti, la misura, il metodo.",
        rischio: "È il primo a vedere ciò che non torna."
      },
      {
        id: "guida",
        nome: "La Guida",
        competenzaMestiere: "Orientamento",
        descrizione: "Il terreno, l'acqua, le vie che non sono su mappa.",
        rischio: "La sua reputazione locale è la Copertura di tutti."
      },
      {
        id: "scalatore",
        nome: "Lo Scalatore",
        competenzaMestiere: "Corde",
        descrizione: "Corde, pareti, passaggi impossibili.",
        rischio: "Il Corpo: paga in mani, spalle, caviglie."
      },
      {
        id: "mediatore",
        nome: "Il Mediatore",
        competenzaMestiere: "Lingue",
        descrizione: "Le lingue, i permessi, i checkpoint.",
        rischio: "Ogni bugia detta è una bugia da mantenere."
      },
      {
        id: "medico",
        nome: "Il Medico",
        competenzaMestiere: "Medicina",
        descrizione: "Tiene in piedi la squadra.",
        rischio: "Decide chi si ferma. E la squadra non si ferma."
      },
      {
        id: "logista",
        nome: "Il Logista",
        competenzaMestiere: "Carico",
        descrizione: "Il carico, i tempi, il piano B.",
        rischio: "Sa sempre quanto manca. Anche quando è troppo."
      }
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
    orologioSoglia: 8,
    // Libreria di scene pronte dal Design Bible cartaceo (v1.3), scenario
    // Petra. Ogni scena ha un id univoco "scenario:atto:scena" usato dal
    // narratore per richiamarla in lobby; il testo resta comunque
    // modificabile prima di aprire la scena. "diramazioni" è il testo
    // suggerito da usare per la scena successiva secondo l'esito del tiro
    // precedente — assente dove il Design Bible non richiede un tiro.
    scenari: {
      petra: {
        nome: "Petra",
        atti: [
          {
            numero: 1,
            titolo: "La vallata",
            chiusura:
              "Il tempo del mondo avanza secondo la regola fissa (una casella ogni due scene, conteggio continuo): a fine Atto 1 (3 scene) l'Orologio è tipicamente a 1 casella su 8, più eventuali penalità da 1.2/1.3.",
            png: [
              {
                nome: "Il pastore",
                descrizione:
                  "Non ha nome nel testo base, il narratore ne dà uno al tavolo. Non è ostile, non è alleato: vende quello che ha, tace quello che vale."
              },
              {
                nome: "L'altra squadra",
                descrizione:
                  "Non compare mai di persona in questo atto, solo tracce. Il narratore la gioca come uno specchio: stessi Mestieri, stesso contratto con \"qualcun altro\"."
              }
            ],
            scene: [
              {
                id: "apertura",
                titolo: "Apertura",
                testo:
                  "La squadra scende dal fuoristrada dopo otto ore di pista. Il Centro ha dato coordinate, non indicazioni. Il campo si monta prima del buio, sempre, senza eccezioni — è la prima regola che la Guida ripete, e la ripete a chi non l'ha ancora sentita.",
                tiro: null,
                diramazioni: null
              },
              {
                id: "1.1",
                titolo: "Il campo",
                testo:
                  "Introduzione dei personaggi in azione, non in descrizione: ognuno fa la cosa del proprio Mestiere mentre il campo si monta. Nessun tiro necessario — è la scena in cui il tavolo impara chi è chi guardando le mani, non ascoltando le schede.\n\nSegno da innescare gratis, senza tiro: una traccia di pneumatici, fresca, che il campo non ha lasciato. Qualcuno è già stato qui, o c'è ancora.",
                tiro: null,
                diramazioni: null
              },
              {
                id: "1.2",
                titolo: "L'acqua",
                testo:
                  "La Guida tratta con l'unico pastore della valle per l'accesso al pozzo.",
                tiro: { competenze: ["Trattativa", "Lingue"], soglia: 1 },
                diramazioni: {
                  pieno:
                    "L'acqua è garantita, e il pastore lascia cadere un dettaglio utile — ha visto un'altra squadra, tre giorni fa, verso nord.",
                  costo:
                    "L'acqua è garantita, ma il pastore vuole qualcosa in cambio che tocca l'Equipaggiamento (una tanica, una torcia) — 1 casella.",
                  fallimento:
                    "Il pastore si chiude, non parla più. L'informazione sull'altra squadra arriverà solo più tardi, e più tardi vuol dire peggio (Orologio +1)."
                }
              },
              {
                id: "1.3",
                titolo: "Le tracce fresche",
                testo:
                  "La squadra trova il campo abbandonato dell'altra squadra: cenere ancora tiepida, un solo oggetto lasciato indietro — a scelta del narratore, qualcosa che dice cosa cercavano senza dirlo del tutto (una batteria scarica di un modello raro, una nota illeggibile in un'altra lingua).",
                tiro: { competenze: ["Terreno"], soglia: 1 },
                diramazioni: {
                  pieno:
                    "Legge le tracce con chiarezza: sa quando l'altra squadra è partita e in che direzione.",
                  fallimento:
                    "Parte comunque, ma un giorno indietro rispetto a chi ha letto bene le tracce — l'informazione si traduce direttamente in Orologio +1 se il gruppo sceglie la via sbagliata all'Atto 2."
                }
              }
            ]
          }
        ]
      }
    }
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
    mestieri: [], // da compilare quando esisterà l'equivalente per The Ledger Game
    tracce: {
      ledger: { label: "the Ledger", segni: [] } // da compilare
    },
    orologioSoglia: 8
  }
};

export { creaStatoIniziale, gameConfigs };
