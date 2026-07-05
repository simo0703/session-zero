// Session Zero — motore di gioco multiplayer
// Fase 1: scheletro minimo con Durable Object GameRoom

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    return new Response("GameRoom attivo — stanza pronta a ricevere connessioni.");
  }
}

export default {
  async fetch(request, env, ctx) {
    return new Response("Session Zero — piattaforma online. Motore in costruzione.");
  },
};
