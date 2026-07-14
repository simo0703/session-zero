// Session Zero — motore di gioco multiplayer
// Fase 4bis: regole vere de La Soglia (tracce a 6 caselle, soglia 1-3, pool variabile)
// Fase 5: verifica del codice d'accesso (D1) per diventare host di una stanza
// Fase 5bis: pagina /admin per generare codici a mano (via di riserva) con QR

import { creaStatoIniziale, gameConfigs } from "./schema.js";
import { paginaLobby, paginaAdmin, paginaHome, paginaGioco, paginaInArrivo, paginaCorsaInvisibile } from "./pages.js";

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
const URL_HOME_LIBRO = "https://sbferrara.org/la-soglia";

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
      this.applicaMigrazioneStato();
    } else {
      this.stato = creaStatoIniziale(roomCode, gameId);
      await this.ctx.storage.put("stato", this.stato);
    }
    return this.stato;
  }

  // Le stanze create prima di un aggiornamento del motore restano con lo
  // stato salvato al momento della loro nascita: i campi aggiunti dopo
  // (es. la chat) semplicemente non ci sono. Qui li completiamo con valori
  // di default, così ogni stanza vecchia resta compatibile con le nuove
  // funzionalità senza bisogno di essere ricreata.
  applicaMigrazioneStato() {
    if (!Array.isArray(this.stato.chat)) this.stato.chat = [];
    if (typeof this.stato.linkChiamata !== "string") this.stato.linkChiamata = "";
    if (this.stato.ultimoSuggerimento === undefined) this.stato.ultimoSuggerimento = null;
    if (this.stato.misura === undefined) this.stato.misura = null;

    const scena = this.stato.scenaCorrente;
    if (scena) {
      if (typeof scena.libreriaId !== "string") scena.libreriaId = "";
      if (!scena.dichiarazioni || typeof scena.dichiarazioni !== "object") scena.dichiarazioni = {};
      if (!Array.isArray(scena.risultatoDadiAzzardo)) scena.risultatoDadiAzzardo = [];
      if (typeof scena.doveScaricareAzzardo !== "string") scena.doveScaricareAzzardo = "";
      if (typeof scena.costoAzzardo !== "number") scena.costoAzzardo = 0;
      if (typeof scena.segnoAzzardoTesto !== "string") scena.segnoAzzardoTesto = "";
    }
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
        const risultato = costruisciSchedaPersonaggio(msg, config);
        schedaPersonaggio = risultato.scheda;
        if (!schedaPersonaggio) {
          socket.send(
            JSON.stringify({
              type: "errore",
              messaggio:
                "Scheda personaggio incompleta. " + risultato.motivo,
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
      // La competenza suggerita è facoltativa e serve solo a velocizzare
      // il lavoro del narratore quando prepara il tiro: deve essere una
      // delle competenze che il giocatore possiede davvero sulla propria
      // scheda, altrimenti viene ignorata. Resta comunque un suggerimento:
      // il narratore decide sempre lui quale competenza usare (§5).
      const competenzaProposta =
        typeof msg.competenza === "string" ? msg.competenza.trim() : "";
      const competenzaSuggerita =
        giocatore.competenze &&
        Object.prototype.hasOwnProperty.call(giocatore.competenze, competenzaProposta)
          ? competenzaProposta
          : "";
      this.stato.scenaCorrente.dichiarazioni[playerId] = {
        nickname: giocatore.nickname,
        testo,
        competenzaSuggerita,
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

    if (msg.type === "avvia_misura") {
      // Solo il narratore avvia il protocollo, scegliendo chi lo conduce
      // (di norma il Rilevatore, ma il manuale lascia aperta la scelta).
      if (playerId !== this.stato.gmId) return;

      const giocatore = this.stato.players.find(
        (p) => p.id === msg.giocatoreId && p.role === "player"
      );
      if (!giocatore) return;

      this.stato.misura = {
        attivo: true,
        passo: "installare",
        giocatoreId: giocatore.id,
        competenzaCorrente: "Strumenti",
        sogliaCorrente: sogliaInstallare(giocatore.tracce.equipaggiamento),
        numDadi: 0,
        pronto: false,
        tiroEffettuato: false,
        risultatoDadi: [],
        successi: 0,
        descrizione: "",
        discordanzaVoce: null,
        discordanzaTesto: "",
        rivelata: false,
      };

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "configura_misura") {
      // Il narratore imposta il numero di dadi (competenza + approccio,
      // come per ogni altro tiro) prima che chi conduce il protocollo tiri.
      // Per il Passo 2 (Calibrare) sceglie anche quale competenza usare.
      if (playerId !== this.stato.gmId) return;
      const misura = this.stato.misura;
      if (!misura || !misura.attivo || misura.tiroEffettuato) return;

      const numDadi = Math.max(1, Math.min(6, parseInt(msg.numDadi, 10) || 1));
      misura.numDadi = numDadi;

      if (misura.passo === "calibrare") {
        misura.competenzaCorrente = ["Strumenti", "Terreno"].includes(msg.competenza)
          ? msg.competenza
          : "Strumenti";
      }

      misura.pronto = true;

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "tira_misura") {
      // Solo chi conduce il protocollo tira, e solo quando il narratore ha
      // già impostato il numero di dadi per questo tentativo.
      const misura = this.stato.misura;
      if (
        !misura ||
        !misura.attivo ||
        !misura.pronto ||
        misura.tiroEffettuato ||
        misura.giocatoreId !== playerId
      ) {
        return;
      }

      const config = gameConfigs[this.stato.gameId] || gameConfigs["la-soglia"];
      const giocatore = this.stato.players.find((p) => p.id === playerId);
      if (!giocatore) return;

      const risultati = [];
      let successi = 0;
      for (let i = 0; i < misura.numDadi; i++) {
        const valore = 1 + Math.floor(Math.random() * 6);
        risultati.push(valore);
        if (valore >= SUCCESSO_DA) successi++;
      }
      misura.risultatoDadi = risultati;
      misura.successi = successi;
      misura.tiroEffettuato = true;

      if (misura.passo === "installare") {
        if (successi < misura.sogliaCorrente) {
          // Fallimento (o riuscita con costo): l'installazione richiede
          // modifiche urgenti. Equipaggiamento +1, poi si ripete il tiro.
          giocatore.tracce.equipaggiamento = Math.min(
            giocatore.tracce.equipaggiamento + 1,
            6
          );
          misura.sogliaCorrente = sogliaInstallare(giocatore.tracce.equipaggiamento);
          misura.tiroEffettuato = false;
          misura.risultatoDadi = [];
          misura.successi = 0;
          misura.descrizione = "";
          // numDadi e pronto restano: il narratore può rilanciare subito
          // lo stesso tentativo, o cambiare il numero di dadi se preferisce.
        } else {
          misura.passo = "calibrare";
          misura.competenzaCorrente = "";
          misura.sogliaCorrente = 2;
          misura.numDadi = 0;
          misura.pronto = false;
          misura.tiroEffettuato = false;
          misura.risultatoDadi = [];
          misura.successi = 0;
          misura.descrizione = "";
        }
      } else if (misura.passo === "calibrare") {
        if (successi < misura.sogliaCorrente) {
          // La calibrazione richiede troppo tempo: Orologio +1 immediato,
          // poi si procede comunque al Passo 3.
          this.stato.orologio.valore = Math.min(
            this.stato.orologio.valore + 1,
            this.stato.orologio.soglia
          );
        }
        misura.passo = "leggere";
        misura.competenzaCorrente = "Strumenti";
        misura.sogliaCorrente = 2;
        misura.numDadi = 0;
        misura.pronto = false;
        misura.tiroEffettuato = false;
        misura.risultatoDadi = [];
        misura.successi = 0;
        misura.descrizione = "";
      } else if (misura.passo === "leggere") {
        // Il margine decide quale fascia di discordanza esce (§7.2).
        // Anche il tiro peggiore non lascia mai la squadra a mani vuote.
        const tabella = config.misuraDiscordanze || [];
        let inizioFascia, lunghezzaFascia;
        if (successi >= 3) {
          inizioFascia = 6;
          lunghezzaFascia = 2; // Voci 7-8
        } else if (successi === 2) {
          inizioFascia = 2;
          lunghezzaFascia = 4; // Voci 3-6
        } else {
          inizioFascia = 0;
          lunghezzaFascia = 2; // Voci 1-2 (anche a 0 successi)
        }
        const indice = inizioFascia + Math.floor(Math.random() * lunghezzaFascia);
        misura.discordanzaVoce = indice + 1;
        misura.discordanzaTesto = tabella[indice] || "";

        if (successi === 0) {
          // Il segnale è a malapena leggibile: la Misura si ottiene comunque,
          // ma l'Orologio scatta subito a 8 e la squadra paga la fuga.
          this.stato.orologio.valore = this.stato.orologio.soglia;
          giocatore.tracce.equipaggiamento = Math.min(
            giocatore.tracce.equipaggiamento + 1,
            6
          );
        }

        misura.passo = "completato";
        misura.rivelata = false;
        misura.pronto = false;
      }

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "descrivi_misura") {
      // Chi conduce il protocollo descrive come procede in questo passo,
      // prima che il narratore imposti competenza e dadi — stessa idea
      // della dichiarazione d'approccio, applicata alla Misura.
      const misura = this.stato.misura;
      if (!misura || !misura.attivo || misura.tiroEffettuato) return;
      if (misura.giocatoreId !== playerId) return;

      misura.descrizione = (msg.testo || "").trim().slice(0, 300);

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "rivela_misura") {
      // Solo il narratore decide quando leggere la discordanza alla squadra.
      if (playerId !== this.stato.gmId) return;
      const misura = this.stato.misura;
      if (!misura || misura.passo !== "completato" || misura.rivelata) return;

      misura.rivelata = true;

      this.salvaStato();
      this.broadcast();
      return;
    }

    if (msg.type === "chiudi_misura") {
      if (playerId !== this.stato.gmId) return;
      this.stato.misura = null;

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
  if (!mestiereScelto) {
    return {
      scheda: null,
      motivo:
        "Mestiere non riconosciuto (ricevuto: \"" + (msg.mestiere || "vuoto") + "\").",
    };
  }

  const competenzeValide = config.competenze || [];
  const extra1 = msg.competenzaExtra1;
  const extra2 = msg.competenzaExtra2;
  const valore1 = parseInt(msg.valoreExtra1, 10);
  const valore2 = parseInt(msg.valoreExtra2, 10);

  if (!competenzeValide.includes(extra1) || !competenzeValide.includes(extra2)) {
    return {
      scheda: null,
      motivo:
        "Competenza non valida (ricevute: \"" + extra1 + "\" e \"" + extra2 + "\").",
    };
  }
  if (extra1 === extra2) {
    return { scheda: null, motivo: "Le due competenze extra sono uguali (\"" + extra1 + "\")." };
  }
  if (
    extra1 === mestiereScelto.competenzaMestiere ||
    extra2 === mestiereScelto.competenzaMestiere
  ) {
    return {
      scheda: null,
      motivo:
        "Una delle competenze extra (\"" + extra1 + "\", \"" + extra2 + "\") coincide con la Competenza di Mestiere di " +
        mestiereScelto.nome + " (\"" + mestiereScelto.competenzaMestiere + "\").",
    };
  }
  if (![1, 2].includes(valore1) || ![1, 2].includes(valore2) || valore1 + valore2 !== 3) {
    return {
      scheda: null,
      motivo:
        "Split dei dadi non valido (ricevuto: " + valore1 + " e " + valore2 + ", deve essere 2 e 1).",
    };
  }

  const competenze = {};
  competenze[mestiereScelto.competenzaMestiere] = 3;
  competenze[extra1] = valore1;
  competenze[extra2] = valore2;

  return {
    scheda: {
      mestiere: mestiereScelto.id,
      competenze,
      difetto: (msg.difetto || "").trim().slice(0, 140),
      ragione: (msg.ragione || "").trim().slice(0, 140),
    },
    motivo: null,
  };
}

// Cerca una scena nella libreria dato il suo id "scenario:atto:scena",
// usata per calcolare il suggerimento di diramazione dopo un tiro.
// Soglia del Passo 1 (Installare) del Protocollo della Misura, legata
// all'Equipaggiamento di chi lo conduce (Design Bible §7.1).
function sogliaInstallare(equipaggiamento) {
  if (equipaggiamento >= 5) return 3;
  if (equipaggiamento === 4) return 2;
  return 1;
}

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

// Tipi di materiale ammessi in upload — whitelist server-side, mai fidarsi
// del valore mandato dal client.
const TIPI_MATERIALE = ["quickstart", "schede", "design-bible", "scenario", "altro"];

// Endpoint dell'area riservata: carica un file (PDF, .md, ecc.) su R2 e ne
// registra i metadati in D1. Multipart/form-data, protetto da ADMIN_KEY.
async function gestisciCaricaMateriale(request, env) {
  if (!env.MATERIALI) {
    return jsonResponse({ errore: "Bucket materiali non configurato." }, 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return jsonResponse({ errore: "Richiesta non valida." }, 400);
  }

  const password = form.get("password");
  if (!env.ADMIN_KEY || password !== env.ADMIN_KEY) {
    return jsonResponse({ errore: "Password non corretta." }, 401);
  }

  const gameId = gameConfigs[form.get("gameId")] ? form.get("gameId") : null;
  if (!gameId) {
    return jsonResponse({ errore: "Gioco non valido." }, 400);
  }

  const tipo = TIPI_MATERIALE.includes(form.get("tipo")) ? form.get("tipo") : "altro";
  const titolo = (form.get("titolo") || "").toString().slice(0, 200);
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return jsonResponse({ errore: "Nessun file ricevuto." }, 400);
  }
  if (file.size > 25 * 1024 * 1024) {
    return jsonResponse({ errore: "File troppo grande (limite 25 MB)." }, 400);
  }

  const nomeFilePulito = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const chiaveR2 = "materiali/" + gameId + "/" + Date.now() + "-" + nomeFilePulito;

  await env.MATERIALI.put(chiaveR2, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const risultato = await env.DB.prepare(
    "INSERT INTO materiali (game_id, tipo, titolo, filename, r2_key, content_type, size, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  )
    .bind(gameId, tipo, titolo || nomeFilePulito, nomeFilePulito, chiaveR2, file.type || "application/octet-stream", file.size)
    .run();

  return jsonResponse({ ok: true, id: risultato.meta.last_row_id });
}

// Endpoint dell'area riservata: elenca i materiali caricati per un gioco
// (o per tutti, se gameId non è specificato). Protetto da ADMIN_KEY via query.
async function gestisciListaMateriali(request, env) {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  if (!env.ADMIN_KEY || password !== env.ADMIN_KEY) {
    return jsonResponse({ errore: "Password non corretta." }, 401);
  }

  const { results } = await env.DB.prepare(
    "SELECT id, game_id, tipo, titolo, filename, size, uploaded_at FROM materiali ORDER BY game_id, tipo, uploaded_at DESC"
  ).all();

  return jsonResponse({ materiali: results });
}

// Endpoint dell'area riservata: elimina un materiale (da R2 e da D1).
async function gestisciEliminaMateriale(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ errore: "Richiesta non valida." }, 400);
  }

  if (!env.ADMIN_KEY || body.password !== env.ADMIN_KEY) {
    return jsonResponse({ errore: "Password non corretta." }, 401);
  }

  const riga = await env.DB.prepare("SELECT r2_key FROM materiali WHERE id = ?")
    .bind(body.id)
    .first();
  if (!riga) {
    return jsonResponse({ errore: "Materiale non trovato." }, 404);
  }

  await env.MATERIALI.delete(riga.r2_key);
  await env.DB.prepare("DELETE FROM materiali WHERE id = ?").bind(body.id).run();

  return jsonResponse({ ok: true });
}

// Route pubblica: scarica un materiale dato il suo id. Nessuna password:
// una volta pubblicato, il materiale è pensato per essere scaricabile da
// chiunque arrivi dalla pagina del gioco.
async function gestisciScaricaMateriale(id, env, codiceInserito) {
  const riga = await env.DB.prepare(
    "SELECT filename, r2_key, content_type, game_id FROM materiali WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!riga) {
    return new Response("Materiale non trovato.", { status: 404 });
  }

  // I materiali scaricabili richiedono lo stesso codice che sblocca il
  // ruolo di narratore per quel gioco (tabella access_codes, filtrata per
  // game_id) — nessun download libero. Coerente col §6 del Design Bible
  // Digitale: il gioco online è il bonus di chi compra il cartaceo, e
  // questo vale anche per i materiali scaricabili collegati.
  const codice = (codiceInserito || "").trim().toUpperCase();
  if (!codice) {
    return new Response(
      "Inserisci il codice stampato nel tuo libro per scaricare questo materiale.",
      { status: 401 }
    );
  }
  const codiceRiga = await env.DB.prepare(
    "SELECT code FROM access_codes WHERE code = ? AND game_id = ? AND active = 1"
  )
    .bind(codice, riga.game_id)
    .first();
  if (!codiceRiga) {
    return new Response("Codice non valido per questo gioco.", { status: 403 });
  }

  const oggetto = await env.MATERIALI.get(riga.r2_key);
  if (!oggetto) {
    return new Response("File non trovato nell'archivio.", { status: 404 });
  }

  return new Response(oggetto.body, {
    headers: {
      "content-type": riga.content_type || "application/octet-stream",
      "content-disposition": "attachment; filename=\"" + riga.filename + "\"",
    },
  });
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

    // Home della piattaforma: solo se non si arriva già con un codice stanza
    // (link/QR diretti continuano a funzionare come prima, vedi sotto).
    if (url.pathname === "/" && !url.searchParams.get("room")) {
      return new Response(paginaHome(), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    }

    // Pagina pubblica di un singolo gioco (presentazione + ingresso)
    if (url.pathname === "/la-soglia" && !url.searchParams.get("room")) {
      const config = gameConfigs["la-soglia"];
      let materiali = [];
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, tipo, titolo, filename, size FROM materiali WHERE game_id = ? ORDER BY tipo, uploaded_at DESC"
        )
          .bind("la-soglia")
          .all();
        materiali = results;
      } catch (e) {
        // Se la tabella materiali non esiste ancora, la pagina resta
        // comunque funzionante, semplicemente senza sezione download.
        materiali = [];
      }
      const dati = {
        id: "la-soglia",
        nome: config.nome,
        tagline: config.presentazione.tagline,
        hook: config.presentazione.hook,
        comeSiGioca: config.presentazione.comeSiGioca,
        giocatori: config.presentazione.giocatori,
        durata: config.presentazione.durata,
        mestieri: config.mestieri,
        tracceLabels: Object.keys(config.tracce).map((k) => config.tracce[k].label),
        materiali: materiali,
      };
      return new Response(paginaGioco(dati), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    }
    if (url.pathname === "/ledger-game" && !url.searchParams.get("room")) {
      return new Response(paginaInArrivo("The Ledger Game"), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    }

    // Pagina vetrina de La Corsa Invisibile: presentazione + CTA verso il suo
    // worker indipendente. Additiva, nessun aggancio al motore/gameConfigs.
    if (url.pathname === "/la-corsa-invisibile" && !url.searchParams.get("room")) {
      return new Response(paginaCorsaInvisibile(), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
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

    // Area riservata: carica, elenca, elimina materiali scaricabili
    if (url.pathname === "/admin/carica-materiale" && request.method === "POST") {
      return gestisciCaricaMateriale(request, env);
    }
    if (url.pathname === "/admin/lista-materiali" && request.method === "GET") {
      return gestisciListaMateriali(request, env);
    }
    if (url.pathname === "/admin/elimina-materiale" && request.method === "POST") {
      return gestisciEliminaMateriale(request, env);
    }

    // Route pubblica di download: /scarica/123?codice=XXXX
    if (url.pathname.startsWith("/scarica/")) {
      const id = url.pathname.split("/")[2];
      const codice = url.searchParams.get("codice");
      return gestisciScaricaMateriale(id, env, codice);
    }

    // Tutto il resto: la pagina della lobby
    return new Response(paginaLobby(), {
      headers: { "content-type": "text/html; charset=UTF-8" },
    });
  },
};
