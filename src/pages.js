// Session Zero — pagina della lobby
// Restituisce l'HTML completo (stile + markup + script) come stringa.
// Il colore/tipografia riprendono la direzione approvata (feltro, ottone, gesso).

export function paginaLobby() {
  return (
    "<!DOCTYPE html>" +
    "<html lang=\"it\">" +
    "<head>" +
    "<meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Session Zero — Lobby</title>" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Source+Sans+3:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap\" rel=\"stylesheet\">" +
    "<style>" + stileCss() + "</style>" +
    "</head>" +
    "<body>" +
    markupLobby() +
    "<script>" + scriptLobby() + "</script>" +
    "</body>" +
    "</html>"
  );
}

function stileCss() {
  return "\
  :root {\
    --felt: #1E3A32; --felt-dark: #162B25; --walnut: #2B1B14; --walnut-dark: #1C120C;\
    --chalk: #F3EEE2; --brass: #C08A3E; --brass-bright: #D9A559; --ember: #B4483A;\
    --mist: #8FA89C; --mist-dim: #5C7469;\
  }\
  * { box-sizing: border-box; }\
  body {\
    margin: 0; background: var(--walnut); color: var(--chalk);\
    font-family: 'Source Sans 3', sans-serif; min-height: 100vh;\
    display: flex; align-items: center; justify-content: center; padding: 32px 16px;\
  }\
  .stage { width: 100%; max-width: 760px; }\
  .topbar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }\
  .brand { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 22px; }\
  .brand span { color: var(--brass-bright); }\
  .room-info { display: flex; align-items: center; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--mist); }\
  .room-code { background: rgba(0,0,0,0.25); border: 1px solid var(--mist-dim); padding: 5px 10px; border-radius: 4px; color: var(--brass-bright); letter-spacing: 0.08em; }\
  .copy-btn { background: none; border: 1px solid var(--mist-dim); color: var(--mist); padding: 5px 10px; border-radius: 4px; font-family: inherit; font-size: 12px; cursor: pointer; }\
  .copy-btn:hover { border-color: var(--brass); color: var(--brass-bright); }\
  .table-wrap { background: var(--walnut-dark); border-radius: 20px; padding: 40px 24px 32px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03), 0 20px 40px rgba(0,0,0,0.35); }\
  .table { position: relative; width: 100%; max-width: 460px; aspect-ratio: 1; margin: 0 auto; border-radius: 50%; background: radial-gradient(circle at 42% 38%, rgba(255,255,255,0.05), transparent 55%), radial-gradient(circle, var(--felt) 0%, var(--felt-dark) 100%); box-shadow: inset 0 0 0 8px var(--walnut), inset 0 0 40px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.4); }\
  .seat { position: absolute; width: 74px; height: 74px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transform: translate(-50%, -50%); }\
  .seat .ring { width: 54px; height: 54px; border-radius: 50%; border: 2px dashed var(--mist-dim); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--mist-dim); background: rgba(0,0,0,0.15); }\
  .seat.filled .ring { border: 2px solid var(--brass); background: var(--brass); color: var(--walnut-dark); font-weight: 700; box-shadow: 0 0 18px rgba(192,138,62,0.55); }\
  .seat .label { margin-top: 6px; font-size: 11px; color: var(--mist); white-space: nowrap; }\
  .seat.filled .label { color: var(--chalk); }\
  .seat[data-pos='1'] { top: 6%; left: 50%; } .seat[data-pos='2'] { top: 27%; left: 87%; }\
  .seat[data-pos='3'] { top: 73%; left: 87%; } .seat[data-pos='4'] { top: 94%; left: 50%; }\
  .seat[data-pos='5'] { top: 73%; left: 13%; } .seat[data-pos='6'] { top: 27%; left: 13%; }\
  .gm-seat { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 88px; height: 88px; border-radius: 50%; background: radial-gradient(circle, var(--mist-dim), #3a4a44); display: flex; flex-direction: column; align-items: center; justify-content: center; }\
  .gm-seat.filled { background: radial-gradient(circle, var(--ember), #7d2f26); box-shadow: 0 0 26px rgba(180,72,58,0.5); }\
  .gm-seat .die { font-size: 26px; line-height: 1; }\
  .gm-seat .label { margin-top: 4px; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.85); }\
  .table-caption { text-align: center; margin-top: 22px; color: var(--mist); font-size: 14px; font-style: italic; }\
  .table-caption strong { color: var(--chalk); font-style: normal; }\
  .join-panel { margin-top: 28px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 22px 24px; }\
  .join-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 16px; margin: 0 0 16px; }\
  .field { margin-bottom: 14px; }\
  .field label { display: block; font-size: 12px; color: var(--mist); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }\
  .field input, .field select { width: 100%; background: var(--walnut-dark); border: 1px solid var(--mist-dim); border-radius: 8px; padding: 10px 12px; color: var(--chalk); font-family: 'Source Sans 3', sans-serif; font-size: 14px; }\
  .field input:focus, .field select:focus { outline: none; border-color: var(--brass); }\
  .gm-toggle { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 10px 12px; background: rgba(180,72,58,0.08); border: 1px solid rgba(180,72,58,0.3); border-radius: 8px; }\
  .gm-toggle input { accent-color: var(--ember); width: 16px; height: 16px; }\
  .gm-toggle span { font-size: 13px; }\
  .gm-toggle small { display: block; color: var(--mist); font-weight: 400; }\
  .sit-btn { width: 100%; background: var(--brass); color: var(--walnut-dark); border: none; border-radius: 8px; padding: 13px; font-weight: 600; font-size: 15px; cursor: pointer; }\
  .sit-btn:hover { background: var(--brass-bright); }\
  .sit-btn:disabled { background: rgba(255,255,255,0.1); color: var(--mist-dim); cursor: default; }\
  .footer-note { text-align: center; margin-top: 18px; font-size: 12px; color: var(--mist-dim); }\
  .status-line { text-align: center; font-size: 12px; color: var(--mist-dim); margin-bottom: 14px; }\
  .orologio-wrap { display: flex; align-items: center; gap: 10px; }\
  .orologio-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mist); }\
  .orologio-ring { display: flex; gap: 4px; }\
  .orologio-ring .tick { width: 14px; height: 14px; border-radius: 3px; background: rgba(255,255,255,0.06); border: 1px solid var(--mist-dim); }\
  .orologio-ring .tick.on { background: var(--brass); border-color: var(--brass-bright); box-shadow: 0 0 8px rgba(192,138,62,0.6); }\
  .scene-card { background: #EDE6D6; color: #2A2118; border-radius: 10px; padding: 26px 28px; box-shadow: 0 14px 30px rgba(0,0,0,0.35); background-image: repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(43,27,20,0.07) 28px); margin-bottom: 18px; }\
  .scene-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8a6a3f; margin: 0 0 10px; }\
  .scene-text { font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap; }\
  .panel { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }\
  .panel-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mist); margin: 0 0 12px; }\
  .gm-textarea { width: 100%; min-height: 110px; background: #EDE6D6; color: #2A2118; border: none; border-radius: 8px; padding: 14px 16px; font-family: inherit; font-size: 14px; line-height: 1.6; resize: vertical; }\
  .btn-primary { background: var(--brass); color: var(--walnut-dark); border: none; border-radius: 8px; padding: 11px 18px; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 10px; }\
  .btn-primary:hover { background: var(--brass-bright); }\
  .roster-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }\
  .roster-row:last-child { border-bottom: none; }\
  .roster-tag { font-size: 11px; color: var(--mist); text-transform: uppercase; }\
  ";
}

function markupLobby() {
  return "\
  <div class=\"stage\">\
    <div class=\"topbar\">\
      <div class=\"brand\">SESSION <span>ZERO</span></div>\
      <div class=\"room-info\">\
        <span>Stanza</span>\
        <span class=\"room-code\" id=\"room-code\">------</span>\
        <button class=\"copy-btn\" id=\"copy-btn\">Copia link</button>\
      </div>\
    </div>\
    <p class=\"status-line\" id=\"status-line\">Connessione in corso…</p>\
    <div class=\"table-wrap\">\
      <div class=\"table\" id=\"table\">\
        <div class=\"gm-seat\" id=\"gm-seat\"><div class=\"die\">⚄</div><div class=\"label\">Censore</div></div>\
        <div class=\"seat\" data-pos=\"1\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"2\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"3\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"4\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"5\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"6\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
      </div>\
      <p class=\"table-caption\" id=\"table-caption\">In attesa che il tavolo si riempia.</p>\
    </div>\
    <div class=\"join-panel\" id=\"join-panel\">\
      <p class=\"join-title\">Siediti al tavolo</p>\
      <div class=\"field\">\
        <label>Il tuo nome</label>\
        <input type=\"text\" id=\"nickname\" placeholder=\"Come vuoi essere chiamato in stanza\">\
      </div>\
      <div class=\"field\">\
        <label>Competenza principale</label>\
        <select id=\"competenza\">\
          <option value=\"\">Scegli una competenza</option>\
          <option value=\"Sottrazione\">Sottrazione</option>\
          <option value=\"Osservazione\">Osservazione</option>\
          <option value=\"Dissimulazione\">Dissimulazione</option>\
        </select>\
      </div>\
      <div class=\"gm-toggle\">\
        <input type=\"checkbox\" id=\"gm-check\">\
        <label for=\"gm-check\" style=\"cursor:pointer;\">\
          <span>Voglio essere il Censore</span>\
          <small>Guiderai la partita: apri le scene, gestisci l'Orologio.</small>\
        </label>\
      </div>\
      <button class=\"sit-btn\" id=\"sit-btn\">Siediti al tavolo</button>\
    </div>\
    <p class=\"footer-note\" id=\"footer-note\">La partita inizia quando il Censore decide di aprire la prima scena.</p>\
  </div>\
  <div class=\"stage\" id=\"game-screen\" style=\"display:none;\">\
    <div class=\"topbar\">\
      <div class=\"brand\">SESSION <span>ZERO</span></div>\
      <div class=\"orologio-wrap\">\
        <span class=\"orologio-label\">L'Orologio</span>\
        <div class=\"orologio-ring\" id=\"orologio-ring\"></div>\
      </div>\
    </div>\
    <div class=\"scene-card\">\
      <p class=\"scene-eyebrow\" id=\"scene-eyebrow\">Scena</p>\
      <p class=\"scene-text\" id=\"scene-text\"></p>\
    </div>\
    <div class=\"panel\" id=\"gm-controls\" style=\"display:none;\">\
      <p class=\"panel-title\">Apri la prossima scena</p>\
      <textarea class=\"gm-textarea\" id=\"scene-input\" placeholder=\"Scrivi qui il testo della scena…\"></textarea>\
      <button class=\"btn-primary\" id=\"apri-scena-btn\">Apri scena</button>\
    </div>\
    <div class=\"panel\">\
      <p class=\"panel-title\">Il tavolo</p>\
      <div id=\"roster-list\"></div>\
    </div>\
  </div>\
  ";
}

function scriptLobby() {
  return "\
  var params = new URLSearchParams(window.location.search);\
  var roomCode = params.get('room');\
  var gameId = params.get('game') || 'la-soglia';\
  if (!roomCode) {\
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();\
    var nuovoUrl = window.location.pathname + '?room=' + roomCode + '&game=' + gameId;\
    window.history.replaceState({}, '', nuovoUrl);\
  }\
  document.getElementById('room-code').textContent = roomCode;\
\
  document.getElementById('copy-btn').addEventListener('click', function () {\
    navigator.clipboard.writeText(window.location.href);\
    this.textContent = 'Copiato!';\
    var self = this;\
    setTimeout(function () { self.textContent = 'Copia link'; }, 1500);\
  });\
\
  var protocollo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';\
  var wsUrl = protocollo + '//' + window.location.host + '/ws?room=' + roomCode + '&game=' + gameId;\
  var socket = new WebSocket(wsUrl);\
  var mioId = null;\
\
  socket.addEventListener('open', function () {\
    document.getElementById('status-line').textContent = 'Connesso alla stanza ' + roomCode + '.';\
  });\
\
  socket.addEventListener('close', function () {\
    document.getElementById('status-line').textContent = 'Connessione interrotta. Ricarica la pagina.';\
  });\
\
  socket.addEventListener('message', function (event) {\
    var msg = JSON.parse(event.data);\
    if (msg.type === 'benvenuto') {\
      mioId = msg.playerId;\
      aggiornaTavolo(msg.stato);\
    } else if (msg.type === 'stato') {\
      aggiornaTavolo(msg.stato);\
    } else if (msg.type === 'errore') {\
      alert(msg.messaggio);\
    }\
  });\
\
  document.getElementById('sit-btn').addEventListener('click', function () {\
    var nickname = document.getElementById('nickname').value.trim();\
    var competenza = document.getElementById('competenza').value;\
    var vuoleGM = document.getElementById('gm-check').checked;\
    if (!nickname) { alert('Scrivi un nome prima di sederti.'); return; }\
    socket.send(JSON.stringify({ type: 'siediti', nickname: nickname, competenza: competenza, vuoleGM: vuoleGM }));\
    document.getElementById('join-panel').style.display = 'none';\
  });\
\
  document.getElementById('apri-scena-btn').addEventListener('click', function () {\
    var testo = document.getElementById('scene-input').value.trim();\
    if (!testo) { alert('Scrivi il testo della scena prima di aprirla.'); return; }\
    socket.send(JSON.stringify({ type: 'apri_scena', testo: testo }));\
    document.getElementById('scene-input').value = '';\
  });\
\
  function aggiornaTavolo(stato) {\
    if (stato.status === 'playing') {\
      mostraSchermataGioco(stato);\
      return;\
    }\
\
    var seats = document.querySelectorAll('.seat');\
    var giocatori = stato.players.filter(function (p) { return p.role === 'player'; });\
    for (var i = 0; i < seats.length; i++) {\
      var seat = seats[i];\
      var g = giocatori[i];\
      var ring = seat.querySelector('.ring');\
      var label = seat.querySelector('.label');\
      if (g) {\
        seat.classList.add('filled');\
        ring.textContent = g.nickname.charAt(0).toUpperCase();\
        label.textContent = g.nickname + (g.id === mioId ? ' (tu)' : '');\
      } else {\
        seat.classList.remove('filled');\
        ring.textContent = '＋';\
        label.textContent = 'In attesa';\
      }\
    }\
\
    var gmSeat = document.getElementById('gm-seat');\
    var gm = stato.players.find(function (p) { return p.role === 'gm'; });\
    if (gm) {\
      gmSeat.classList.add('filled');\
      gmSeat.querySelector('.label').textContent = gm.nickname + (gm.id === mioId ? ' (tu)' : '');\
    } else {\
      gmSeat.classList.remove('filled');\
      gmSeat.querySelector('.label').textContent = 'Censore';\
    }\
\
    document.getElementById('table-caption').innerHTML =\
      'Il tavolo si sta riempiendo — <strong>' + giocatori.length + ' di 6</strong> posti occupati. ' +\
      (gm ? 'Il Censore si è seduto.' : 'Il Censore non si è ancora seduto.');\
\
    if (gm && gm.id === mioId) {\
      document.getElementById('footer-note').textContent = 'Sei il Censore. Quando vuoi, apri la prima scena per iniziare la partita.';\
    }\
  }\
\
  function mostraSchermataGioco(stato) {\
    document.querySelector('.table-wrap').style.display = 'none';\
    document.getElementById('join-panel').style.display = 'none';\
    document.getElementById('footer-note').style.display = 'none';\
    document.getElementById('game-screen').style.display = 'block';\
\
    var ring = document.getElementById('orologio-ring');\
    ring.innerHTML = '';\
    for (var i = 0; i < stato.orologio.soglia; i++) {\
      var tick = document.createElement('div');\
      tick.className = 'tick' + (i < stato.orologio.valore ? ' on' : '');\
      ring.appendChild(tick);\
    }\
\
    document.getElementById('scene-eyebrow').textContent = 'Scena ' + (stato.scenaCorrente.id || 1);\
    document.getElementById('scene-text').textContent = stato.scenaCorrente.testo || '';\
\
    var sonoIlGM = stato.gmId === mioId;\
    document.getElementById('gm-controls').style.display = sonoIlGM ? 'block' : 'none';\
    if (sonoIlGM) {\
      document.getElementById('apri-scena-btn').textContent =\
        stato.log.sceneAperte > 0 ? 'Apri prossima scena' : 'Apri scena';\
    }\
\
    var rosterList = document.getElementById('roster-list');\
    rosterList.innerHTML = '';\
    stato.players.forEach(function (p) {\
      var row = document.createElement('div');\
      row.className = 'roster-row';\
      var nomeConTu = p.nickname + (p.id === mioId ? ' (tu)' : '');\
      var ruoloEtichetta = p.role === 'gm' ? 'Censore' : (p.competenzaPrincipale || 'Giocatore');\
      row.innerHTML = '<span>' + nomeConTu + '</span><span class=\"roster-tag\">' + ruoloEtichetta + '</span>';\
      rosterList.appendChild(row);\
    });\
  }\
  ";
}
