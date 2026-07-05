// Session Zero — motore di gioco multiplayer
// Fase 2: la stanza inizializza e mantiene il proprio stato usando lo schema dati

import { creaStatoIniziale } from "./schema.js";

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.stato = null; // caricato pigro al primo utilizzo, vedi getStato()
  }

  // Carica lo stato dallo storage persistente della Durable Object,
  // o lo inizializza se la stanza è nuova.
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

  async fetch(request) {
    const url = new URL(request.url);
    // Esempio minimo di verifica: creazione/ingresso stanza con parametri in query
    // — verrà sostituito da una vera gestione WebSocket nel prossimo passo.
    const roomCode = url.searchParams.get("room") || "TEST01";
    const gameId = url.searchParams.get("game") || "la-soglia";

    const stato = await this.getStato(roomCode, gameId);
    return new Response(JSON.stringify(stato, null, 2), {
      headers: { "content-type": "application/json" }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("room");

    if (roomCode) {
      // Ogni codice stanza diverso genera/richiama una GameRoom isolata
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response(
      "Session Zero — piattaforma online. Prova con ?room=TEST01&game=la-soglia"
    );
  },
};

