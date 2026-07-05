// Session Zero — motore di gioco multiplayer
// Fase 4bis: regole vere de La Soglia (tracce a 6 caselle, soglia 1-3, pool variabile)
// Fase 5: verifica del codice d'accesso (D1) per diventare host di una stanza
// Fase 5bis: pagina /admin per generare codici a mano (via di riserva) con QR

import { creaStatoIniziale, gameConfigs } from "./schema.js";
import { paginaLobby, paginaAdmin } from "./pages.js";

// Simboli di gioco selezionabili alla creazione del personaggio. Whitelist
// server-side: qualunque valore non presente qui viene ignorato e sostituito
// con il primo della lista, per non permettere stringhe arbitrarie nello stato.
const SIMBOLI_VALIDI = ["🧭", "🪢", "🔑", "🪶", "⏳", "🗺️", "🎲", "🔦"];

const SUCCESSO_DA = 5; // un dado è un successo se esce 5 o 6 (regola confermata dal Design Bible)

// Alfabeto per i codici generati a mano: esclude 0/O e 1/I per evitare
// ambiguità quando il codice viene letto o dettato a voce.
const ALFABETO_CODICE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// URL della futura home del sito (non ancora costruita). Il QR generato in
// /admin porta qui, con il solo codice come parametro — quando la home
// esisterà davvero, mostrerà le istruzioni e poi rimanderà a Session Zero.
// Per ora punta a Session Zero stesso come placeholder: aggiornare questa
// unica riga quando la home è pronta, nessun altro punto da toccare.
const URL_HOME_LIBRO = "https://session-zero.smnbadii.workers.dev/";

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.stato = null;
    this.sockets = new Map(); // playerId -> WebSocket
  }

  async getStato(roomCode, gameId) {
    if (this.stato) return this.stato;
    const salvato = await this.ctx.storage.get("stato");
    if (salvato) {
      this.stato = salvato;
    } else {
      this.stato = creaStatoIniziale(roomCode, gameId);
      await this.ctx.storage.put("stato", this.stato);
    }
    return this.stato;
  }

  async salvaStato() {
    await this.ctx.storage.put("stato", this.stato);
  }

  // Invia lo stato aggiornato a tutti i partecipanti connessi alla stanza,
  // insieme alla configurazione del gioco in corso (terminologia, competenze,
  // tracce) così il client non ha mai bisogno di indovinare quale gioco è.
  broadcast() {
    const config = gameConfigs[this.stato.gameId] || gameConfigs["la-soglia"];
    const payload = JSON.stringify({
      type: "stato",
      stato: this.stato,
      config,
    });
    for (const [id, ws] of this.sockets) {
      try {
        ws.send(payload);
      } catch (e) {
        this.sockets.delete(id);
      }
    }
  }

  // Verifica un codice contro la tabella access_codes in D1, filtrato per il
  // gioco della stanza corrente: un codice del libro di un mondo non deve mai
  // sbloccare l'accesso host in un altro mondo (il muro vale anche qui).
  async codiceValido(codiceInserito) {
    const codice = (codiceInserito || "").trim().toUpperCase();
    if (!codice) return false;
    try {
      const riga = await this.env.DB.prepare(
        "SELECT code FROM access_codes WHERE code = ? AND game_id = ? AND active = 1"
      )
        .bind(codice, this.stato.gameId)
        .first();
      return !!riga;
    } catch (e) {
      // Se D1 non risponde, non blocchiamo silenziosamente concedendo
      // l'accesso: meglio un errore visibile che un buco di sicurezza.
      console.error("Errore verifica codice:", e);
      return false;
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("room") || "TEST01";
    const gameId = url.searchParams.get("game") || "la-soglia";
    await this.getStato(roomCode, gameId);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      // Se il browser ha già un identificativo salvato (da una sessione precedente
      // nella stessa stanza), lo riusiamo: così chi ricarica la pagina viene
      // riconosciuto come la stessa persona invece di dover sedersi di nuovo.
      const clientId = url.searchParams.get("clientId");
      const playerId = clientId || "p_" + Math.random().toString(36).slice(2, 9);

      const giocatoreEsistente = this.stato.players.find(
        (p) => p.id === playerId
      );
      if (giocatoreEsistente) {
        giocatoreEsistente.connesso = true;
      }

      server.addEventListener("message", (event) => {
        this.gestisciMessaggio(playerId, server, event.data).catch((e) => {
          console.error("Errore gestione messaggio:", e);
        });
      });

      server.addEventListener("close", () => {
        this.sockets.delete(playerId);
        const p = this.stato.players.find((pl) => pl.id === playerId);
        if (p) {
          p.connesso = false;
          this.salvaStato();
          this.broadcast();
        }
      });

      this.sockets.set(playerId, server);

      if (giocatoreEsistente) {
        await this.salvaStato();
      }

      server.send(
        JSON.stringify({
          type: "benvenuto",
          playerId,
          giaSeduto: !!giocatoreEsistente,
          stato: this.stato,
          config: gameConfigs[this.stato.gameId] || gameConfigs["la-soglia"],
        })
      );

      if (giocatoreEsistente) {
        this.broadcast();
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // Nessun upgrade richiesto: risposta di debug in JSON
    return new Response(JSON.stringify(this.stato, null, 2), {
      headers: { "content-type": "application/json" },
    });
  }

  async gestisciMessaggio(playerId, socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === "siediti") {
      const giaEsistente = this.stato.players.find((p) => p.id === playerId);
      if (giaEsistente) {
        giaEsistente.nickname = (msg.nickname || giaEsistente.nickname).slice(
          0,
          24
        );
        giaEsistente.simbolo = SIMBOLI_VALIDI.includes(msg.simbolo)
          ? msg.simbolo
          : giaEsistente.simbolo || SIMBOLI_VALIDI[0];
        giaEsistente.connesso = true;
        this.salvaStato();
        this.broadcast();
        return;
      }

      const postiOccupati = this.stato.players.filter(
        (p) => p.connesso !== false && p.role === "player"
      ).length;
      const vuoleEssereHost = !!msg.vuoleGM && !this.stato.gmId;

      if (vuoleEssereHost) {
        const valido = await this.codiceValido(msg.codice);
        if (!valido) {
          socket.send(
            JSON.stringify({
              type: "errore",
              messaggio:
                "Codice non valido. Controlla il codice stampato nel libro.",
            })
          );
          return;
        }
      }

      if (!vuoleEssereHost && postiOccupati >= 6) {
        socket.send(
          JSON.stringify({ type: "errore", messaggio: "Il tavolo è pieno." })
        );
        return;
      }

      let schedaPersonaggio = null;
      if (!vuoleEssereHost) {
        const config =
          gameConfigs[this.stato.gameId] || gameConfigs["la-soglia"];
        schedaPersonaggio = costruisciSchedaPersonaggio(msg, config);
        if (!schedaPersonaggio) {
          socket.send(
            JSON.stringify({
              type: "errore",
              messaggio:
                "Scheda personaggio incompleta: scegli un Mestiere e due competenze diverse (3 dadi da distribuire, 2 e 1).",
            })
          );
          return;
        }
      }

      const nuovoPlayer = {
        id: playerId,
        nickname: (msg.nickname || "Senza nome").slice(0, 24),
        role: vuoleEssereHost ? "gm" : "player",
        simbolo: SIMBOLI_VALIDI.includes(msg.simbolo)
          ? msg.simbolo
          : SIMBOLI_VALIDI[0],
        tracce: { corpo: 0, equipaggiamento: 0, copertura: 0 },
        connesso: true,
      };

      if (schedaPersonaggio) {
        nuovoPlayer.mestiere = schedaPersonaggio.mestiere;
        nuovoPlayer.competenze = schedaPersonaggio.competenze;
        nuovoPlayer.difetto = schedaPersonaggio.difetto;
        nuovoPlayer.ragione = schedaPersonaggio.ragione;
      }

      this.stato.players.push(nuovoPlayer);
      if (vuoleEssereHost) this.stato.gmId = playerId;

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "apri_scena") {
      // Solo chi guida la partita può aprire una scena
      if (playerId !== this.stato.gmId) {
        socket.send(
          JSON.stringify({
            type: "errore",
            messaggio: "Solo chi guida la partita può aprire una scena.",
          })
        );
        return;
      }

      const testo = (msg.testo || "").slice(0, 4000);
      if (!testo.trim()) return;

      // Se il narratore ha caricato una scena dalla libreria, ne teniamo
      // traccia (id "scenario:atto:scena") per poter suggerire la
      // diramazione giusta dopo il tiro. Puramente informativo: se manca
      // o non è riconosciuto, il testo libero funziona comunque.
      const libreriaId =
        typeof msg.libreriaId === "string" ? msg.libreriaId.slice(0, 40) : "";

      this.stato.status = "playing";
      this.stato.scenaCorrente = {
        id: this.stato.log.sceneAperte + 1,
        testo,
        libreriaId,
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
        esito: "",
        segnoTesto: "",
        margine: 0,
        margineSpeso: false,
        margineScelta: "",
        risultatoDadiAzzardo: [],
        doveScaricareAzzardo: "",
        costoAzzardo: 0,
        segnoAzzardoTesto: "",
      };
      this.stato.log.sceneAperte += 1;

      // L'Orologio avanza ogni due scene, come da Design Bible — a meno che
      // qualcuno non abbia speso un margine per fermarlo questa volta.
      this.stato.orologio.sceneContate += 1;
      if (this.stato.orologio.sceneContate >= 2) {
        this.stato.orologio.sceneContate = 0;
        if (this.stato.orologio.congelaProssimo) {
          this.stato.orologio.congelaProssimo = false;
        } else {
          this.stato.orologio.valore = Math.min(
            this.stato.orologio.valore + 1,
            this.stato.orologio.soglia
          );
        }
      }

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "dichiara_approccio") {
      // Chiunque sia seduto come giocatore può dichiarare il proprio
      // approccio prima che il narratore imposti soglia e dadi (P1).
      const giocatore = this.stato.players.find(
        (p) => p.id === playerId && p.role === "player"
      );
      if (!giocatore || this.stato.status !== "playing") return;

      const testo = (msg.testo || "").trim().slice(0, 300);
      this.stato.scenaCorrente.dichiarazioni[playerId] = {
        nickname: giocatore.nickname,
        testo,
      };

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "richiedi_tiro") {
      // Solo chi guida la partita può chiedere un tiro, e solo a scena aperta
      if (playerId !== this.stato.gmId) {
        socket.send(
          JSON.stringify({
            type: "errore",
            messaggio: "Solo chi guida la partita può richiedere un tiro.",
          })
        );
        return;
      }
      if (this.stato.status !== "playing") return;

      const giocatore = this.stato.players.find(
        (p) => p.id === msg.giocatoreId && p.role === "player"
      );
      if (!giocatore) return;

      // Soglia 1 (facile) - 2 (ostile) - 3 (al limite), come da Design Bible.
      const soglia = Math.max(1, Math.min(3, parseInt(msg.soglia, 10) || 1));
      // Il numero di dadi è competenza + approccio: lo calcola chi narra a
      // mente seguendo la regola cartacea, e lo inserisce qui direttamente.
      const numDadi = Math.max(1, Math.min(6, parseInt(msg.numDadi, 10) || 1));
      const traccia = ["corpo", "equipaggiamento", "copertura"].includes(
        msg.traccia
      )
        ? msg.traccia
        : "corpo";

      this.stato.scenaCorrente.tiroRichiesto = true;
      this.stato.scenaCorrente.giocatoreCoinvolto = giocatore.id;
      this.stato.scenaCorrente.competenzaRichiesta = msg.competenza || "";
      this.stato.scenaCorrente.sogliaRichiesta = soglia;
      this.stato.scenaCorrente.numDadi = numDadi;
      this.stato.scenaCorrente.tracciaARischio = traccia;
      this.stato.scenaCorrente.tiroEffettuato = false;
      this.stato.scenaCorrente.risultatoDadi = [];
      this.stato.scenaCorrente.successi = 0;
      this.stato.scenaCorrente.esito = "";
      this.stato.scenaCorrente.segnoTesto = "";
      this.stato.scenaCorrente.margine = 0;
      this.stato.scenaCorrente.margineSpeso = false;
      this.stato.scenaCorrente.margineScelta = "";
      this.stato.scenaCorrente.risultatoDadiAzzardo = [];
      this.stato.scenaCorrente.doveScaricareAzzardo = "";
      this.stato.scenaCorrente.costoAzzardo = 0;
      this.stato.scenaCorrente.segnoAzzardoTesto = "";

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "tira_dadi") {
      const scena = this.stato.scenaCorrente;
      if (
        !scena.tiroRichiesto ||
        scena.tiroEffettuato ||
        scena.giocatoreCoinvolto !== playerId
      ) {
        return;
      }

      // Dadi d'Azzardo (Design Bible §4.1): fino a 2 dadi extra, dichiarati
      // dal giocatore prima del tiro insieme a dove scaricare il costo di un
      // eventuale 1 naturale. Danno successi come gli altri dadi, ma un 1 su
      // di essi barra subito 1 casella — anche se il tiro nel complesso
      // supera la Soglia.
      const numDadiAzzardo = Math.max(
        0,
        Math.min(2, parseInt(msg.numDadiAzzardo, 10) || 0)
      );
      const doveScaricareAzzardo = ["corpo", "equipaggiamento"].includes(
        msg.doveScaricare
      )
        ? msg.doveScaricare
        : "corpo";

      const risultati = [];
      let successi = 0;
      for (let i = 0; i < scena.numDadi; i++) {
        const valore = 1 + Math.floor(Math.random() * 6);
        risultati.push(valore);
        if (valore >= SUCCESSO_DA) successi++;
      }

      const risultatiAzzardo = [];
      for (let i = 0; i < numDadiAzzardo; i++) {
        const valore = 1 + Math.floor(Math.random() * 6);
        risultatiAzzardo.push(valore);
        if (valore >= SUCCESSO_DA) successi++;
      }

      scena.risultatoDadi = risultati;
      scena.risultatoDadiAzzardo = risultatiAzzardo;
      scena.doveScaricareAzzardo = doveScaricareAzzardo;
      scena.successi = successi;
      scena.tiroEffettuato = true;
      this.stato.log.tiriEffettuati += 1;

      const giocatore = this.stato.players.find((p) => p.id === playerId);
      const config =
        gameConfigs[this.stato.gameId] || gameConfigs["la-soglia"];
      const traccia = scena.tracciaARischio;

      // Regola vera: successi >= soglia → pieno successo, nessun costo,
      // ed eventuale margine (l'eccedenza) da spendere subito.
      // Successi sotto soglia ma almeno uno → riuscita con costo, la traccia
      // segna una casella. Zero successi → il mondo risponde, costo doppio.
      if (successi >= scena.sogliaRichiesta) {
        scena.esito = "pieno";
        scena.margine = successi - scena.sogliaRichiesta;
      } else if (successi > 0) {
        scena.esito = "costo";
        if (giocatore) {
          giocatore.tracce[traccia] = Math.min(
            giocatore.tracce[traccia] + 1,
            6
          );
        }
      } else {
        scena.esito = "fallimento";
        if (giocatore) {
          giocatore.tracce[traccia] = Math.min(
            giocatore.tracce[traccia] + 2,
            6
          );
        }
      }

      if (giocatore && scena.esito !== "pieno") {
        const nuovoValore = giocatore.tracce[traccia];
        const tabella = config.tracce[traccia];
        if (tabella && tabella.segni[nuovoValore - 1]) {
          scena.segnoTesto = tabella.segni[nuovoValore - 1];
        }
      }

      // Il costo dei Dadi d'Azzardo è indipendente dall'esito: un 1 naturale
      // su di essi barra comunque la casella dichiarata in anticipo, anche
      // su un pieno successo.
      const costoAzzardo = risultatiAzzardo.filter((v) => v === 1).length;
      if (costoAzzardo > 0 && giocatore) {
        giocatore.tracce[doveScaricareAzzardo] = Math.min(
          giocatore.tracce[doveScaricareAzzardo] + costoAzzardo,
          6
        );
        scena.costoAzzardo = costoAzzardo;
        const nuovoValoreAzzardo = giocatore.tracce[doveScaricareAzzardo];
        const tabellaAzzardo = config.tracce[doveScaricareAzzardo];
        if (tabellaAzzardo && tabellaAzzardo.segni[nuovoValoreAzzardo - 1]) {
          scena.segnoAzzardoTesto = tabellaAzzardo.segni[nuovoValoreAzzardo - 1];
        }
      }

      // Se questo tiro era su una scena caricata dalla libreria e ha
      // diramazioni scritte, prepariamo il suggerimento per la scena
      // successiva — salvato a livello di stanza, non di scena, così
      // resta visibile al narratore anche dopo aver aperto quella dopo.
      if (scena.libreriaId) {
        const sceneLibreria = trovaScenaLibreria(config, scena.libreriaId);
        if (sceneLibreria && sceneLibreria.diramazioni) {
          const chiaveEsito =
            scena.esito === "costo" && !sceneLibreria.diramazioni.costo
              ? "fallimento"
              : scena.esito;
          const testoSuggerito = sceneLibreria.diramazioni[chiaveEsito];
          if (testoSuggerito) {
            this.stato.ultimoSuggerimento = {
              testo: testoSuggerito,
              daScena: scena.id,
            };
          }
        }
      }

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "iscrivi_email") {
      // Casella facoltativa dopo lo sblocco host: nessun invio reale finché
      // la newsletter di Ferrara non esiste, solo salvataggio in D1.
      const email = (msg.email || "").trim().slice(0, 200);
      if (!email || !email.includes("@")) return;
      try {
        await this.env.DB.prepare(
          "INSERT INTO newsletter_signups (email, room_code) VALUES (?, ?)"
        )
          .bind(email, this.stato.roomCode)
          .run();
      } catch (e) {
        console.error("Errore salvataggio email:", e);
      }
      return;
    }

    if (msg.type === "invia_chat") {
      const mittente = this.stato.players.find((p) => p.id === playerId);
      if (!mittente) return;

      const testo = (msg.testo || "").trim().slice(0, 500);
      if (!testo) return;

      this.stato.chat.push({
        id: playerId + "_" + Date.now(),
        nickname: mittente.nickname,
        simbolo: mittente.simbolo || "",
        ruolo: mittente.role,
        testo,
        quando: Date.now(),
      });
      // Non lasciamo crescere lo stato all'infinito in sessioni lunghe.
      if (this.stato.chat.length > 200) {
        this.stato.chat = this.stato.chat.slice(-200);
      }

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "imposta_link_chiamata") {
      // Chiunque sia seduto (giocatore o narratore) può condividere o
      // rimuovere il link della chiamata. Nessuna chiamata è gestita da
      // Session Zero: solo il link, validato in modo minimo.
      const giaSeduto = this.stato.players.some((p) => p.id === playerId);
      if (!giaSeduto) return;

      const url = (msg.url || "").trim().slice(0, 300);
      if (url && url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) {
        return;
      }
      this.stato.linkChiamata = url;

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "nascondi_suggerimento") {
      // Solo il narratore può chiudere il proprio suggerimento.
      if (playerId !== this.stato.gmId) return;
      this.stato.ultimoSuggerimento = null;
      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "spendi_margine") {
      const scena = this.stato.scenaCorrente;
      if (
        scena.giocatoreCoinvolto !== playerId ||
        scena.esito !== "pieno" ||
        scena.margine <= 0 ||
        scena.margineSpeso
      ) {
        return;
      }

      const giocatore = this.stato.players.find((p) => p.id === playerId);
      if (!giocatore) return;

      if (msg.scelta === "orologio") {
        this.stato.orologio.congelaProssimo = true;
        scena.margineScelta = "orologio";
      } else if (msg.scelta === "traccia") {
        const traccia = ["corpo", "equipaggiamento", "copertura"].includes(
          msg.traccia
        )
          ? msg.traccia
          : null;
        if (!traccia || giocatore.tracce[traccia] <= 0) return;
        giocatore.tracce[traccia] = Math.max(
          0,
          giocatore.tracce[traccia] - 1
        );
        scena.margineScelta = "traccia:" + traccia;
      } else {
        return;
      }

      scena.margineSpeso = true;

      this.salvaStato();
      this.broadcast();
      return;
    }
  }
}

// Genera un codice casuale leggibile, usando un alfabeto senza caratteri
// ambigui (niente 0/O, niente 1/I).
// Costruisce e valida la scheda personaggio al momento della creazione:
// Mestiere scelto (3 dadi fissi sulla sua competenza) + due competenze
// diverse su cui distribuire i 3 punti liberi rimanenti (2 e 1, mai altro,
// per restare fedeli alla regola "due competenze libere" del Design Bible).
// Ritorna null se qualcosa non torna, senza mai fidarsi ciecamente del client.
function costruisciSchedaPersonaggio(msg, config) {
  const mestieri = config.mestieri || [];
  const mestiereScelto = mestieri.find((m) => m.id === msg.mestiere);
  if (!mestiereScelto) return null;

  const competenzeValide = config.competenze || [];
  const extra1 = msg.competenzaExtra1;
  const extra2 = msg.competenzaExtra2;
  const valore1 = parseInt(msg.valoreExtra1, 10);
  const valore2 = parseInt(msg.valoreExtra2, 10);

  if (!competenzeValide.includes(extra1) || !competenzeValide.includes(extra2)) {
    return null;
  }
  if (extra1 === extra2) return null;
  if (
    extra1 === mestiereScelto.competenzaMestiere ||
    extra2 === mestiereScelto.competenzaMestiere
  ) {
    return null;
  }
  if (![1, 2].includes(valore1) || ![1, 2].includes(valore2) || valore1 + valore2 !== 3) {
    return null;
  }

  const competenze = {};
  competenze[mestiereScelto.competenzaMestiere] = 3;
  competenze[extra1] = valore1;
  competenze[extra2] = valore2;

  return {
    mestiere: mestiereScelto.id,
    competenze,
    difetto: (msg.difetto || "").trim().slice(0, 140),
    ragione: (msg.ragione || "").trim().slice(0, 140),
  };
}

// Cerca una scena nella libreria dato il suo id "scenario:atto:scena",
// usata per calcolare il suggerimento di diramazione dopo un tiro.
function trovaScenaLibreria(config, idCompleto) {
  if (!idCompleto || !config.scenari) return null;
  const pezzi = idCompleto.split(":");
  const scenario = config.scenari[pezzi[0]];
  if (!scenario) return null;
  const atto = scenario.atti.find((a) => String(a.numero) === pezzi[1]);
  if (!atto) return null;
  return atto.scene.find((s) => s.id === pezzi[2]) || null;
}

function generaCodiceCasuale(lunghezza) {
  let risultato = "";
  for (let i = 0; i < lunghezza; i++) {
    risultato += ALFABETO_CODICE[Math.floor(Math.random() * ALFABETO_CODICE.length)];
  }
  return risultato;
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

// Endpoint dell'area riservata: genera un nuovo codice d'accesso a mano
// (via di riserva per chi non ha il codice del libro, es. compratori ebook)
// e lo salva in D1. Protetto da una password condivisa (env.ADMIN_KEY),
// mai salvata nel codice sorgente.
async function gestisciGeneraCodice(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ errore: "Richiesta non valida." }, 400);
  }

  if (!env.ADMIN_KEY || body.password !== env.ADMIN_KEY) {
    return jsonResponse({ errore: "Password non corretta." }, 401);
  }

  const gameId = gameConfigs[body.gameId] ? body.gameId : null;
  if (!gameId) {
    return jsonResponse({ errore: "Gioco non valido." }, 400);
  }

  const nota = (body.nota || "").slice(0, 200);

  let codice = null;
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const candidato = generaCodiceCasuale(8);
    const esistente = await env.DB.prepare(
      "SELECT code FROM access_codes WHERE code = ?"
    )
      .bind(candidato)
      .first();
    if (!esistente) {
      codice = candidato;
      break;
    }
  }

  if (!codice) {
    return jsonResponse(
      { errore: "Non sono riuscito a generare un codice unico. Riprova." },
      500
    );
  }

  await env.DB.prepare(
    "INSERT INTO access_codes (code, game_id, label) VALUES (?, ?, ?)"
  )
    .bind(codice, gameId, nota)
    .run();

  const link = URL_HOME_LIBRO + "?codice=" + codice;

  return jsonResponse({ code: codice, url: link });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Canale WebSocket per una stanza specifica
    if (url.pathname === "/ws") {
      const roomCode = url.searchParams.get("room");
      const gameId = url.searchParams.get("game") || "la-soglia";
      if (!roomCode) {
        return new Response("Manca il codice stanza", { status: 400 });
      }
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Debug: stato grezzo in JSON, utile per verifiche rapide
    if (url.pathname === "/api/state") {
      const roomCode = url.searchParams.get("room") || "TEST01";
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Area riservata: pagina del generatore di codici
    if (url.pathname === "/admin") {
      return new Response(paginaAdmin(Object.keys(gameConfigs)), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    }

    // Area riservata: endpoint che genera davvero il codice
    if (url.pathname === "/admin/genera" && request.method === "POST") {
      return gestisciGeneraCodice(request, env);
    }

    // Tutto il resto: la pagina della lobby
    return new Response(paginaLobby(), {
      headers: { "content-type": "text/html; charset=UTF-8" },
    });
  },
};
