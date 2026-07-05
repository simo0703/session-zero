// Session Zero — motore di gioco multiplayer
// Fase 3: la stanza gestisce connessioni WebSocket reali e l'ingresso dei giocatori

import { creaStatoIniziale } from "./schema.js";
import { paginaLobby } from "./pages.js";

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

  // Invia lo stato aggiornato a tutti i partecipanti connessi alla stanza
  broadcast() {
    const payload = JSON.stringify({ type: "stato", stato: this.stato });
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

      const playerId = "p_" + Math.random().toString(36).slice(2, 9);

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

      // Il client riceve subito il proprio id e lo stato attuale della stanza
      server.send(
        JSON.stringify({ type: "benvenuto", playerId, stato: this.stato })
      );

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
        misura: 0,
        connesso: true,
      };

      this.stato.players.push(nuovoPlayer);
      if (vuoleGM) this.stato.gmId = playerId;

      this.salvaStato();
      this.broadcast();
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


