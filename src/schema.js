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

    // L'ultimo suggerimento di diramazione mostrato al narratore (Design
    // Bible §9), persistente finché non arriva un tiro successivo su una
    // scena di libreria o il narratore lo chiude manualmente — non si
    // azzera con l'apertura di una nuova scena, a differenza di scenaCorrente.
    ultimoSuggerimento: null, // { testo, daScena } oppure null

    // Link a una chiamata vocale/video esterna (Discord, Meet, Zoom...),
    // condiviso da chi vuole avviarla. Session Zero non ospita né apre
    // nessuna chiamata: fa solo da bacheca per il link, così nessuno deve
    // registrarsi da nessuna parte per usarla.
    linkChiamata: "",

    // Chat di gruppo testuale: nome e simbolo del mittente sono quelli veri
    // della scheda, quindi risolve anche il problema di riconoscersi senza
    // bisogno di rinominarsi altrove. Tenuta corta (ultimi 200 messaggi)
    // per non far crescere lo stato all'infinito in sessioni lunghe.
    chat: [],

    // Protocollo della Misura (Design Bible §7.1-7.2): Installare, Calibrare,
    // Leggere. null quando non è in corso. Vedi worker.js per la logica dei
    // tre passi e la scelta della discordanza.
    misura: null,

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
      // Dichiarazioni d'approccio (Design Bible §4, principio P1: "prima la
      // scena, poi il tiro"): il giocatore descrive come affronta l'ostacolo
      // prima che il narratore imposti soglia e dadi. Chiave = id giocatore.
      // Si azzera a ogni nuova scena, resta per tutti i tiri della stessa.
      dichiarazioni: {},
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
    // Riferimento discreto al romanzo collegato, mostrato come piccolo
    // badge nella topbar del tavolo di gioco (non nella pagina di gioco
    // vera e propria) — testo minimo apposta, la versione estesa con la
    // descrizione vive solo nella card del catalogo su pages.js.
    libro: {
      img: "https://sbferrara.org/img/echi.jpg",
      alt: "Echi del Profondo",
      href: "https://sbferrara.org/echi",
      label: "Il libro"
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
    // Testo di presentazione per le pagine pubbliche (home piattaforma,
    // pagina del gioco). Contenuto editoriale, non meccanica di gioco —
    // ma resta qui per rispettare il muro: nessun testo d'ambientazione
    // hardcoded nelle pagine condivise.
    presentazione: {
      tagline: "Il rilievo è autorizzato. Il ritorno no.",
      hook: "Siete una squadra di tecnici. Un committente senza nome vi ha assunti per fare un rilievo — cioè misurare e studiare un sito vicino a Petra, senza fare domande. Uno di voi guida la storia (il narratore), gli altri interpretano i personaggi della squadra. A ogni tiro di dado rischiate qualcosa: la salute, l'equipaggiamento, o il segreto della missione. Alla fine, gli strumenti danno una risposta. Ma non è detto che sia la risposta che vi aspettavate.",
      comeSiGioca: [
        "Un giocatore fa il narratore: racconta cosa succede e decide quando serve un tiro di dado.",
        "Gli altri giocatori interpretano i personaggi della squadra e rispondono alle situazioni.",
        "Ogni volta che un tiro va male (anche solo un po'), succede qualcosa di brutto: un graffio, uno strumento che si rompe, un sospetto che cresce.",
        "Alla fine della partita, la squadra scopre cosa ha davvero trovato — e il prezzo pagato per saperlo."
      ],
      giocatori: "Da 2 a 7 persone: fino a 6 giocatori, più 1 narratore",
      durata: "Una partita completa dura una serata (circa 3 ore)"
    },
    // Tabella delle discordanze del Protocollo della Misura (Design Bible
    // §7.2, "costruita per il gioco, mai coi dati dei romanzi"). Indice 0-7
    // corrisponde alle Voci 1-8 del manuale cartaceo. Il motore ne sceglie
    // una a caso dentro la fascia decisa dal margine del Passo 3 (Leggere).
    misuraDiscordanze: [
      "I due strumenti, identici, danno due numeri. Si riprova. Lo scarto cresce",
      "Il valore cambia a seconda di chi tiene lo strumento in mano",
      "Un dato resta perfettamente fermo dove tutto, intorno, dovrebbe oscillare",
      "Il rumore di fondo — sempre presente, in ogni rilevazione mai fatta — qui sparisce del tutto",
      "Lo strumento registra un secondo passaggio di lettura mai comandato da nessuno",
      "Il dato torna identico a distanza di ore, mentre ogni altra costante del sito si è spostata",
      "Due membri della squadra, leggendo lo stesso display nello stesso istante, riportano due cifre",
      "Il numero è quello atteso — fino all'ultima cifra, che non dovrebbe esserci"
    ],
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
          },
          {
            numero: 2,
            titolo: "La pista",
            chiusura:
              "Stesso conteggio fisso di sempre (1 casella di Orologio ogni 2 scene). Le tre scene di questo atto portano l'Orologio a circa 2-3 caselle su 8, più eventuali penalità dalle scene sotto — a seconda di come è andato l'Atto 1.",
            png: [
              {
                nome: "L'altra squadra",
                descrizione:
                  "Ancora uno specchio, mai vista di persona in questo atto: solo un accampamento lasciato indietro e, se la scena 2.3 va male, la sua ombra su un posto di blocco che qualcuno ha già attraversato prima di voi."
              },
              {
                nome: "La pattuglia di frontiera",
                descrizione:
                  "Un piccolo gruppo, due o tre uomini, un solo veicolo. Non cerca la squadra in particolare: controlla chiunque passi. Non ha nome nel testo base, il narratore ne dà uno se serve."
              }
            ],
            scene: [
              {
                id: "apertura",
                titolo: "Apertura",
                testo:
                  "Se la squadra ha letto bene le tracce (Atto 1, scena 1.3 riuscita), parte lo stesso giorno, con un vantaggio chiaro. Se non le ha lette bene, parte un giorno dopo — il narratore lo dice così, senza spiegare cosa significhi in pratica: lo si scoprirà dentro le scene.",
                tiro: null,
                diramazioni: null
              },
              {
                id: "2.1",
                titolo: "Il canalone",
                testo:
                  "La pista dell'altra squadra taglia dritta attraverso un canalone di roccia friabile — l'unico passaggio che non allunga il giro di un giorno intero. Bisogna scendere, attraversare, risalire dall'altra parte, con tutto il carico.",
                tiro: { competenze: ["Corde"], soglia: 2 },
                diramazioni: {
                  pieno:
                    "La squadra passa senza perdere tempo, e il margine (se c'è) può essere speso subito per proteggere l'Equipaggiamento nel passaggio successivo.",
                  costo:
                    "Passano tutti, ma qualcuno paga: Corpo +1 (una caduta corta, una torsione) oppure Equipaggiamento +1 (un sacco che si strappa contro la roccia) — decide chi ha fatto il tiro.",
                  fallimento:
                    "Il passaggio si chiude: una frana, una corda che non regge il primo tentativo. La squadra deve girare al largo. Orologio +1, oltre al conteggio normale."
                }
              },
              {
                id: "2.2",
                titolo: "Il campo vuoto",
                testo:
                  "Il canalone porta a un accampamento smontato in fretta: un telo lasciato a terra, una radio con la batteria morta, niente corpi, niente sangue. È lo specchio della squadra, qualche giorno prima.\n\nNessun obbligo di tiro se la squadra decide di non toccare la radio: in quel caso si passa oltre senza rischio e senza informazione, ed è una scelta valida quanto le altre.",
                tiro: { competenze: ["Meccanica", "Strumenti"], soglia: 1 },
                diramazioni: {
                  pieno:
                    "La radio tiene ancora un frammento dell'ultima trasmissione: non parole chiare, ma abbastanza per sapere che l'altra squadra è passata di qui viva, e diretta verso lo stesso punto sul satellite.",
                  costo:
                    "La radio parla, ma nel farlo consuma l'ultima batteria buona della squadra — Equipaggiamento +1.",
                  fallimento:
                    "La radio resta muta. Nessuna informazione in più: la squadra prosegue alla cieca, sapendo solo la direzione generale."
                }
              },
              {
                id: "2.3",
                titolo: "Il posto di blocco",
                testo:
                  "Prima di arrivare in vista del sito, la pista attraversa l'unica strada asfaltata della zona — e su quella strada c'è un posto di blocco, non segnato su nessuna mappa del Centro.",
                tiro: { competenze: ["Lingue", "Trattativa"], soglia: 2 },
                diramazioni: {
                  pieno:
                    "Si passa senza intoppi. Se la squadra ha margine, può spenderlo per sapere qualcosa in più sulla pattuglia (per esempio, che ha già fermato un altro gruppo, pochi giorni prima).",
                  costo:
                    "Si passa, ma la Copertura segna una casella — un documento controllato più a lungo del dovuto, una domanda a cui si è risposto un attimo troppo in fretta.",
                  fallimento:
                    "La pattuglia trattiene la squadra per ore. Orologio +1, oltre al conteggio normale, e la Copertura segna comunque una casella: la storia ufficiale della squadra è ormai nota a qualcuno che non dovrebbe saperla."
                }
              }
            ]
          },
          {
            numero: 3,
            titolo: "La Soglia",
            chiusura:
              "Stesso conteggio fisso (1 casella ogni 2 scene). Le tre scene di questo atto, più il Protocollo della Misura (che non conta come una scena a sé ai fini dell'Orologio, ma può far avanzare l'Orologio per conto suo — vedi passo Calibrare), portano l'Orologio tipicamente a 5-6 caselle su 8 a fine atto.",
            png: [
              {
                nome: "L'altra squadra",
                descrizione:
                  "Per la prima volta, compare di persona. Il narratore la gioca con gli stessi Sei Mestieri della squadra dei giocatori (improvvisa chi sono usando la tabella dei Mestieri): non è nemica per contratto, ma nemmeno alleata — ha lo stesso obiettivo, e non è detto che ci sia dato per tutti."
              }
            ],
            scene: [
              {
                id: "apertura",
                titolo: "Apertura",
                testo:
                  "Da vicino, la forma non assomiglia a nulla che il Centro abbia mostrato in foto. Non ha né porte né segni evidenti: solo una superficie che il terreno intorno non spiega. Il tempo stimato dal Centro per il rilievo completo è breve — meno di quanto servirebbe per capire cosa si sta davvero misurando, ed è esattamente per questo che nessuno ve l'ha spiegato prima.",
                tiro: null,
                diramazioni: null
              },
              {
                id: "3.1",
                titolo: "Il perimetro",
                testo:
                  "Prima di installare qualsiasi strumento, bisogna assicurarsi che il sito sia stabile: il terreno intorno alla forma è pieno di crepe sottili, alcune vecchie, altre no.",
                tiro: { competenze: ["Terreno", "Sangue freddo"], soglia: 2 },
                diramazioni: {
                  pieno:
                    "Il perimetro è sicuro, e la squadra guadagna un margine da spendere subito.",
                  costo:
                    "Il perimetro tiene, ma qualcuno ci lascia qualcosa — Corpo +1 (un piede che sprofonda per un attimo, una torsione alla caviglia).",
                  fallimento:
                    "Una crepa cede sotto il peso di uno strumento pesante. Equipaggiamento +1, e l'installazione del Protocollo della Misura parte con un dado in meno rispetto al previsto."
                }
              },
              {
                id: "3.2",
                titolo: "Lo specchio, di persona",
                testo:
                  "L'altra squadra è già lì, o arriva mentre la vostra si sistema. Nessuno spara, nessuno grida: due squadre con lo stesso contratto, davanti alla stessa cosa, devono decidere in pochi minuti se dividersi il tempo, dividersi il sito, o restare ciascuna per conto proprio fingendo che l'altra non esista.",
                tiro: { competenze: ["Trattativa", "Silenzio"], soglia: 2 },
                diramazioni: {
                  pieno:
                    "Si arriva a un accordo che non costa nulla alla squadra — l'altra squadra si sposta, aspetta il suo turno, o se ne va con un margine di rispetto reciproco. Margine, se avanzato, va speso subito.",
                  costo:
                    "L'accordo tiene, ma la squadra deve cedere qualcosa in cambio — Equipaggiamento +1 (una parte del carico passa all'altra squadra) o Copertura +1 (l'altra squadra ora sa qualcosa di voi che non dovrebbe sapere).",
                  fallimento:
                    "Non c'è accordo. Le due squadre lavorano fianco a fianco in tensione aperta, e il tempo ne risente — Orologio +1, oltre al conteggio normale."
                }
              },
              {
                id: "3.3",
                titolo: "Il Protocollo della Misura",
                testo:
                  "Qui si applica per intero il Protocollo della Misura (Installare, Calibrare, Leggere — gestito dai comandi dedicati, non da un tiro di scena normale). È il momento per cui la squadra ha attraversato la vallata e la pista — e il narratore lo tratta con lo stesso passo lento e preciso con cui tratterebbe qualunque altro momento importante, senza accelerare solo perché è il punto centrale della storia.\n\nIl narratore sceglie chi conduce il protocollo (di solito il Rilevatore, se presente, ma qualunque personaggio può farlo). Al termine del passo Leggere, la Discordanza ottenuta va rivelata al tavolo con la stessa cura fredda con cui è scritta, senza aggiungere spiegazioni che il testo non dà.",
                tiro: null,
                diramazioni: null
              }
            ]
          },
          {
            numero: 4,
            titolo: "La Chiusura",
            chiusura:
              "Ultimo atto: non porta a un Atto 5, porta dritto all'epilogo (vedi scena \"epilogo\"). Se, entrando in questo atto, l'Orologio è già a 8 caselle su 8, il narratore salta le scene sotto e va direttamente all'epilogo, scegliendo la riga che corrisponde allo stato delle tracce in quel momento.",
            png: [
              {
                nome: "La pattuglia di frontiera",
                descrizione:
                  "La stessa dell'Atto 2, scena 2.3, se la Copertura della squadra è già stata segnata lì: questa volta il controllo è più attento, perché qualcosa, la volta scorsa, non è tornato del tutto ai loro occhi."
              },
              {
                nome: "Il pilota",
                descrizione:
                  "La persona che riporta la squadra fuori dalla zona (auto, furgone, o aereo leggero a seconda di cosa il gruppo ha stabilito all'inizio). Non ha nome nel testo base: fa solo il suo lavoro, e non fa domande — a meno che il narratore non decida che, per una volta, ne faccia una."
              }
            ],
            scene: [
              {
                id: "apertura",
                titolo: "Apertura",
                testo:
                  "Il dato è registrato. Il Centro, dall'altra parte di una radio che funziona a intermittenza, ripete solo due parole: \"Uscite subito.\" Non chiede cosa avete trovato. Non lo chiederà nemmeno dopo.",
                tiro: null,
                diramazioni: null
              },
              {
                id: "4.1",
                titolo: "Il ritorno",
                testo:
                  "La strada del ritorno è la stessa dell'andata, ma il tempo a disposizione è meno di quanto sembrasse alla partenza. Bisogna scegliere: portare via tutto l'equipaggiamento, o muoversi più in fretta lasciandone indietro una parte.",
                tiro: { competenze: ["Carico", "Terreno"], soglia: 2 },
                diramazioni: {
                  pieno:
                    "La squadra torna al punto di raccolta in anticipo, con tutto il necessario. Margine, se avanzato, si spende subito.",
                  costo:
                    "Arrivano in tempo, ma qualcosa si paga — Corpo +1 (la stanchezza che si fa sentire proprio ora) oppure Equipaggiamento +1 (qualcosa va abbandonato lungo la strada).",
                  fallimento:
                    "Il ritardo è concreto. Orologio +1, oltre al conteggio normale — se questo porta l'Orologio a 8/8, si passa subito all'epilogo, saltando la scena 4.2."
                }
              },
              {
                id: "4.2",
                titolo: "L'uscita",
                testo:
                  "L'ultimo posto di blocco prima della strada libera è lo stesso di sempre, o uno nuovo se il gruppo non è mai passato di lì. Chi lo presidia oggi ha una lista di nomi da controllare, e la Copertura della squadra è l'unica cosa che la separa da quella lista.\n\nSoglia legata alla Copertura attuale della squadra — il narratore la corregge prima di aprire il tiro: soglia 1 se Copertura è a 0-2 caselle, soglia 2 se è a 3, soglia 3 se è a 4 o più (il valore preimpostato qui sotto è quello medio, da confermare o cambiare al tavolo).",
                tiro: { competenze: ["Lingue", "Trattativa", "Silenzio"], soglia: 2 },
                diramazioni: {
                  pieno: "Si passa senza fermarsi. Nessun costo.",
                  costo:
                    "Si passa, ma la Copertura segna un'ultima casella — un dettaglio che resterà scritto da qualche parte, anche dopo che la squadra sarà lontana.",
                  fallimento:
                    "La squadra viene trattenuta. Il narratore decide se questo significa solo un ritardo (Orologio +1, come sempre) o qualcosa di più serio, da risolvere fuori dalle regole del gioco, a voce, insieme al tavolo."
                }
              },
              {
                id: "epilogo",
                titolo: "Epilogo",
                testo:
                  "Quando la squadra è fuori — o quando l'Orologio arriva a 8/8 prima che ci arrivi — il narratore legge la riga che corrisponde allo stato delle tracce in quel momento. Si guarda quale traccia, tra le tre, ha più caselle segnate; in caso di parità, il narratore sceglie quella che ha pesato di più nella partita appena giocata.\n\nNESSUNA TRACCIA oltre 2 caselle → USCITA PULITA. La squadra consegna il dato senza che nessuno, a parte loro, sappia cosa è successo davvero sul campo. Il Centro paga, ringrazia con la stessa voce con cui ha dato l'ordine di partire, e chiude il contratto. Nessuno vi richiamerà — o forse è solo questione di tempo.\n\nCORPO più segnato → IL PREZZO SUL CORPO. Il dato arriva, ma qualcuno della squadra porta a casa qualcosa che non guarirà in fretta — non necessariamente grave, ma abbastanza da ricordarlo ogni volta che il tempo cambia. Il Centro non se ne cura: ha già il numero che voleva.\n\nEQUIPAGGIAMENTO più segnato → IL PREZZO SUL MATERIALE. La squadra torna con meno di quanto è partita: strumenti rotti, un veicolo che non arriverà al prossimo contratto senza riparazioni costose. Il dato è comunque buono — ma il prossimo lavoro dovrà pagare anche questo.\n\nCOPERTURA più segnata → IL PREZZO SUL NOME. Il dato arriva al Centro, ma la storia ufficiale della squadra non regge più: qualcuno, da qualche parte — la pattuglia, l'altra squadra, un funzionario che ha trattenuto i documenti un secondo di troppo — sa ora qualcosa che non doveva sapere. Non succede nulla subito. Succederà, ed è tutto quello che si può dire per certo.\n\nOROLOGIO arrivato a 8/8 prima dell'uscita → LA FUGA. Il finale arriva prima che la squadra sia pronta, ovunque si trovi in quel momento: il dato viene comunque registrato (vedi Protocollo della Misura, passo Leggere), ma l'uscita è improvvisata, rumorosa, e nessuno controlla più cosa viene lasciato indietro.\n\nIl numero che la squadra porta via, qualunque Discordanza sia uscita, non torna mai del tutto. Non tocca a questo gioco spiegare perché: quello appartiene ai romanzi.",
                tiro: null,
                diramazioni: null
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
