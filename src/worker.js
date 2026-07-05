// Session Zero — motore di gioco multiplayer
// Fase 4bis: regole vere de La Soglia (tracce a 6 caselle, soglia 1-3, pool variabile)

import { creaStatoIniziale, gameConfigs } from "./schema.js";
import { paginaLobby } from "./pages.js";

const SUCCESSO_DA = 5; // un dado è un successo se esce 5 o 6 (regola confermata dal Design Bible)

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
        this.gestisciMessaggio(playerId, server, event.data);
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

  gestisciMessaggio(playerId, socket, raw) {
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
        giaEsistente.competenzaPrincipale =
          msg.competenza || giaEsistente.competenzaPrincipale;
        giaEsistente.connesso = true;
        this.salvaStato();
        this.broadcast();
        return;
      }

      const postiOccupati = this.stato.players.filter(
        (p) => p.connesso !== false && p.role === "player"
      ).length;
      const vuoleGM = !!msg.vuoleGM && !this.stato.gmId;

      if (!vuoleGM && postiOccupati >= 6) {
        socket.send(
          JSON.stringify({ type: "errore", messaggio: "Il tavolo è pieno." })
        );
        return;
      }

      const nuovoPlayer = {
        id: playerId,
        nickname: (msg.nickname || "Senza nome").slice(0, 24),
        role: vuoleGM ? "gm" : "player",
        competenzaPrincipale: msg.competenza || "",
        tracce: { corpo: 0, equipaggiamento: 0, copertura: 0 },
        connesso: true,
      };

      this.stato.players.push(nuovoPlayer);
      if (vuoleGM) this.stato.gmId = playerId;

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

      this.stato.status = "playing";
      this.stato.scenaCorrente = {
        id: this.stato.log.sceneAperte + 1,
        testo,
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

      const risultati = [];
      let successi = 0;
      for (let i = 0; i < scena.numDadi; i++) {
        const valore = 1 + Math.floor(Math.random() * 6);
        risultati.push(valore);
        if (valore >= SUCCESSO_DA) successi++;
      }

      scena.risultatoDadi = risultati;
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

    // Tutto il resto: la pagina della lobby
    return new Response(paginaLobby(), {
      headers: { "content-type": "text/html; charset=UTF-8" },
    });
  },
};


