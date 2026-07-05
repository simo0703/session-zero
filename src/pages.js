// Session Zero — pagina della lobby e della schermata di gioco
// Restituisce l'HTML completo (stile + markup + script) come stringa.

export function paginaAdmin(gameIds) {
  var opzioniGioco = gameIds
    .map(function (id) {
      return "<option value=\"" + id + "\">" + id + "</option>";
    })
    .join("");

  return (
    "<!DOCTYPE html>" +
    "<html lang=\"it\">" +
    "<head>" +
    "<meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Session Zero — Area riservata</title>" +
    "<script src=\"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js\"></script>" +
    "<style>" + stileAdmin() + "</style>" +
    "</head>" +
    "<body>" +
    markupAdmin(opzioniGioco) +
    "<script>" + scriptAdmin() + "</script>" +
    "</body>" +
    "</html>"
  );
}

function stileAdmin() {
  return "\
  :root {\
    --walnut: #2B1B14; --walnut-dark: #1C120C; --chalk: #F3EEE2;\
    --brass: #C08A3E; --brass-bright: #D9A559; --mist: #8FA89C; --mist-dim: #5C7469;\
  }\
  * { box-sizing: border-box; }\
  body {\
    margin: 0; background: var(--walnut); color: var(--chalk);\
    font-family: 'Source Sans 3', sans-serif; min-height: 100vh;\
    display: flex; justify-content: center; padding: 48px 16px;\
  }\
  .box { width: 100%; max-width: 420px; }\
  h1 { font-size: 18px; margin: 0 0 22px; }\
  .field { margin-bottom: 14px; }\
  .field label { display: block; font-size: 12px; color: var(--mist); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }\
  .field input, .field select { width: 100%; background: var(--walnut-dark); border: 1px solid var(--mist-dim); border-radius: 8px; padding: 10px 12px; color: var(--chalk); font-family: inherit; font-size: 14px; }\
  .field input:focus, .field select:focus { outline: none; border-color: var(--brass); }\
  button { width: 100%; background: var(--brass); color: var(--walnut-dark); border: none; border-radius: 8px; padding: 13px; font-weight: 600; font-size: 15px; cursor: pointer; }\
  button:hover { background: var(--brass-bright); }\
  button:disabled { opacity: 0.6; cursor: default; }\
  #risultato { display: none; margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }\
  #codice-generato { font-family: 'JetBrains Mono', monospace; font-size: 22px; letter-spacing: 0.1em; color: var(--brass-bright); margin: 0 0 14px; }\
  #qr-container { margin: 0 auto 14px; display: flex; justify-content: center; }\
  #link-generato { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--mist); word-break: break-all; margin-bottom: 12px; }\
  .secondary-btn { background: none; border: 1px solid var(--mist-dim); color: var(--mist); padding: 8px 14px; border-radius: 6px; font-size: 12px; width: auto; }\
  .secondary-btn:hover { border-color: var(--brass); color: var(--brass-bright); background: none; }\
  ";
}

function markupAdmin(opzioniGioco) {
  return "\
  <div class=\"box\">\
    <h1>Session Zero — Genera codice d'accesso</h1>\
    <form id=\"admin-form\">\
      <div class=\"field\">\
        <label>Password</label>\
        <input type=\"password\" id=\"password\" autocomplete=\"off\">\
      </div>\
      <div class=\"field\">\
        <label>Gioco</label>\
        <select id=\"gioco\">" + opzioniGioco + "</select>\
      </div>\
      <div class=\"field\">\
        <label>Nota (facoltativa — es. email del cliente)</label>\
        <input type=\"text\" id=\"nota\" placeholder=\"mario.rossi@esempio.it\">\
      </div>\
      <button type=\"submit\" id=\"genera-btn\">Genera codice</button>\
    </form>\
    <div id=\"risultato\">\
      <p id=\"codice-generato\"></p>\
      <div id=\"qr-container\"></div>\
      <p id=\"link-generato\"></p>\
      <button type=\"button\" class=\"secondary-btn\" id=\"copia-link-btn\">Copia link</button>\
    </div>\
  </div>\
  ";
}

function scriptAdmin() {
  return "\
  var form = document.getElementById('admin-form');\
  var risultatoBox = document.getElementById('risultato');\
  var qrContainer = document.getElementById('qr-container');\
\
  form.addEventListener('submit', function (e) {\
    e.preventDefault();\
    var password = document.getElementById('password').value;\
    var gioco = document.getElementById('gioco').value;\
    var nota = document.getElementById('nota').value;\
    var btn = document.getElementById('genera-btn');\
    btn.disabled = true;\
    btn.textContent = 'Genero…';\
    fetch('/admin/genera', {\
      method: 'POST',\
      headers: { 'Content-Type': 'application/json' },\
      body: JSON.stringify({ password: password, gameId: gioco, nota: nota })\
    })\
      .then(function (r) { return r.json(); })\
      .then(function (data) {\
        btn.disabled = false;\
        btn.textContent = 'Genera codice';\
        if (data.errore) {\
          alert(data.errore);\
          return;\
        }\
        document.getElementById('codice-generato').textContent = data.code;\
        document.getElementById('link-generato').textContent = data.url;\
        risultatoBox.style.display = 'block';\
        qrContainer.innerHTML = '';\
        new QRCode(qrContainer, {\
          text: data.url,\
          width: 220,\
          height: 220,\
          colorDark: '#1C120C',\
          colorLight: '#F3EEE2'\
        });\
      })\
      .catch(function (err) {\
        btn.disabled = false;\
        btn.textContent = 'Genera codice';\
        alert('Errore di rete: ' + err.message);\
      });\
  });\
\
  document.getElementById('copia-link-btn').addEventListener('click', function () {\
    navigator.clipboard.writeText(document.getElementById('link-generato').textContent);\
    this.textContent = 'Copiato!';\
    var self = this;\
    setTimeout(function () { self.textContent = 'Copia link'; }, 1500);\
  });\
  ";
}

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
    markupPagina() +
    "<script>" + scriptPagina() + "</script>" +
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
    padding: 32px 16px 60px;\
  }\
  .stage { width: 100%; max-width: 760px; margin: 0 auto; }\
  .topbar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }\
  .brand { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 22px; }\
  .brand span { color: var(--brass-bright); }\
  .room-info { display: flex; align-items: center; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--mist); }\
  .room-code { background: rgba(0,0,0,0.25); border: 1px solid var(--mist-dim); padding: 5px 10px; border-radius: 4px; color: var(--brass-bright); letter-spacing: 0.08em; }\
  .copy-btn { background: none; border: 1px solid var(--mist-dim); color: var(--mist); padding: 5px 10px; border-radius: 4px; font-family: inherit; font-size: 12px; cursor: pointer; }\
  .copy-btn:hover { border-color: var(--brass); color: var(--brass-bright); }\
  .status-line { text-align: center; font-size: 12px; color: var(--mist-dim); margin-bottom: 14px; }\
  .table-wrap { background: var(--walnut-dark); border-radius: 20px; padding: 40px 24px 32px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03), 0 20px 40px rgba(0,0,0,0.35); margin-bottom: 18px; }\
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
  .join-panel { background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 22px 24px; margin-bottom: 18px; }\
  .join-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 16px; margin: 0 0 16px; }\
  .field { margin-bottom: 14px; }\
  .field label { display: block; font-size: 12px; color: var(--mist); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }\
  .field input, .field select { width: 100%; background: var(--walnut-dark); border: 1px solid var(--mist-dim); border-radius: 8px; padding: 10px 12px; color: var(--chalk); font-family: 'Source Sans 3', sans-serif; font-size: 14px; }\
  .field input:focus, .field select:focus { outline: none; border-color: var(--brass); }\
  .symbol-picker { display: flex; gap: 8px; flex-wrap: wrap; }\
  .symbol-btn { width: 46px; height: 46px; border-radius: 8px; background: var(--walnut-dark); border: 1px solid var(--mist-dim); font-size: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; }\
  .symbol-btn:hover { border-color: var(--brass); }\
  .symbol-btn.selected { border-color: var(--brass); background: var(--brass); box-shadow: 0 0 10px rgba(192,138,62,0.5); }\
  .mestiere-picker { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }\
  .mestiere-btn { padding: 8px 12px; border-radius: 8px; background: var(--walnut-dark); border: 1px solid var(--mist-dim); color: var(--chalk); font-size: 13px; cursor: pointer; font-family: inherit; }\
  .mestiere-btn:hover { border-color: var(--brass); }\
  .mestiere-btn.selected { border-color: var(--brass); background: var(--brass); color: var(--walnut-dark); font-weight: 600; }\
  .mestiere-flavor { font-size: 12px; color: var(--mist); margin: 8px 0 0; line-height: 1.5; min-height: 16px; }\
  .competenze-extra-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px; }\
  .competenze-extra-row select { background: var(--walnut-dark); border: 1px solid var(--mist-dim); border-radius: 8px; padding: 8px 10px; color: var(--chalk); font-family: inherit; font-size: 13px; }\
  .dadi-tag { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--brass-bright); background: rgba(192,138,62,0.15); padding: 4px 8px; border-radius: 6px; white-space: nowrap; }\
  .gm-toggle { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 10px 12px; background: rgba(180,72,58,0.08); border: 1px solid rgba(180,72,58,0.3); border-radius: 8px; }\
  .gm-toggle input { accent-color: var(--ember); width: 16px; height: 16px; }\
  .gm-toggle span { font-size: 13px; }\
  .gm-toggle small { display: block; color: var(--mist); font-weight: 400; }\
  .sit-btn { width: 100%; background: var(--brass); color: var(--walnut-dark); border: none; border-radius: 8px; padding: 13px; font-weight: 600; font-size: 15px; cursor: pointer; }\
  .sit-btn:hover { background: var(--brass-bright); }\
  .footer-note { text-align: center; font-size: 12px; color: var(--mist-dim); }\
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
  .gm-textarea { width: 100%; min-height: 100px; background: #EDE6D6; color: #2A2118; border: none; border-radius: 8px; padding: 14px 16px; font-family: inherit; font-size: 14px; line-height: 1.6; resize: vertical; }\
  .btn-primary { background: var(--brass); color: var(--walnut-dark); border: none; border-radius: 8px; padding: 11px 18px; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 10px; }\
  .btn-primary:hover { background: var(--brass-bright); }\
  .roster-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }\
  .roster-row:last-child { border-bottom: none; }\
  .roster-tag { font-size: 11px; color: var(--mist); text-transform: uppercase; }\
  .roll-request-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }\
  .field-inline { display: flex; flex-direction: column; gap: 6px; }\
  .field-inline label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mist); }\
  .field-inline select, .field-inline input { background: var(--walnut-dark); border: 1px solid var(--mist-dim); border-radius: 8px; padding: 9px 10px; color: var(--chalk); font-family: 'Source Sans 3', sans-serif; font-size: 13px; }\
  .field-inline input[type='number'] { width: 64px; }\
  .roll-status { font-size: 13px; color: var(--mist); margin: 0 0 12px; line-height: 1.5; }\
  .roll-status strong { color: var(--chalk); }\
  .dice-row { display: flex; gap: 10px; margin-bottom: 14px; min-height: 46px; }\
  .die { width: 46px; height: 46px; border-radius: 8px; background: rgba(255,255,255,0.1); color: var(--mist); display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 18px; }\
  .die.success { background: var(--brass); color: var(--walnut-dark); }\
  .die.fail { background: rgba(255,255,255,0.08); color: var(--mist-dim); }\
  .die.azzardo { border: 2px solid var(--ember); }\
  .die.azzardo.costo { background: var(--ember); color: var(--chalk); }\
  .roster-misura { display: flex; gap: 3px; margin-top: 4px; }\
  .roster-misura .seg { width: 8px; height: 8px; border-radius: 2px; background: rgba(255,255,255,0.1); }\
  .roster-misura .seg.filled { background: var(--ember); }\
  ";
}

function markupPagina() {
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
  </div>\
\
  <div class=\"stage\" id=\"lobby-screen\">\
    <div class=\"table-wrap\">\
      <div class=\"table\" id=\"table\">\
        <div class=\"gm-seat\" id=\"gm-seat\"><div class=\"die\">⚄</div><div class=\"label\" id=\"gm-seat-label\">…</div></div>\
        <div class=\"seat\" data-pos=\"1\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"2\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"3\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"4\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"5\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
        <div class=\"seat\" data-pos=\"6\"><div class=\"ring\">＋</div><div class=\"label\">In attesa</div></div>\
      </div>\
      <p class=\"table-caption\" id=\"table-caption\">In attesa che il tavolo si riempia.</p>\
    </div>\
    <p class=\"footer-note\" id=\"footer-note\">La partita inizia quando chi guida decide di aprire la prima scena.</p>\
  </div>\
\
  <div class=\"stage\" id=\"join-panel-wrap\">\
    <div class=\"join-panel\" id=\"join-panel\">\
      <p class=\"join-title\">Siediti al tavolo</p>\
      <div class=\"field\">\
        <label>Il tuo nome</label>\
        <input type=\"text\" id=\"nickname\" placeholder=\"Come vuoi essere chiamato in stanza\">\
      </div>\
      <div class=\"field\" id=\"scheda-personaggio-wrap\">\
        <label>Mestiere</label>\
        <div class=\"mestiere-picker\" id=\"mestiere-picker\"></div>\
        <p class=\"mestiere-flavor\" id=\"mestiere-flavor\"></p>\
        <label style=\"margin-top:12px;\">Altre due competenze (3 dadi da distribuire)</label>\
        <div class=\"competenze-extra-row\">\
          <select id=\"competenza-extra-1\"></select>\
          <span class=\"dadi-tag\" id=\"dadi-extra-1\">2 dadi</span>\
          <select id=\"competenza-extra-2\"></select>\
          <span class=\"dadi-tag\" id=\"dadi-extra-2\">1 dado</span>\
          <button type=\"button\" class=\"copy-btn\" id=\"scambia-dadi-btn\">Scambia</button>\
        </div>\
        <label style=\"margin-top:12px;\">Il difetto che si vede (facoltativo)</label>\
        <input type=\"text\" id=\"difetto-input\" placeholder=\"Es. Controlla il nodo due volte\">\
        <label style=\"margin-top:12px;\">La ragione per cui hai firmato (facoltativa)</label>\
        <input type=\"text\" id=\"ragione-input\" placeholder=\"Una riga, letta ad alta voce una sola volta\">\
      </div>\
      <div class=\"field\">\
        <label>Il tuo simbolo</label>\
        <div class=\"symbol-picker\" id=\"symbol-picker\"></div>\
      </div>\
      <div class=\"gm-toggle\" id=\"gm-toggle-wrap\">\
        <input type=\"checkbox\" id=\"gm-check\">\
        <label for=\"gm-check\" style=\"cursor:pointer;\">\
          <span id=\"gm-toggle-label\">Voglio guidare la partita</span>\
          <small id=\"gm-toggle-sub\">Aprirai le scene e gestirai l'Orologio.</small>\
        </label>\
      </div>\
      <div class=\"field\" id=\"codice-wrap\" style=\"display:none;\">\
        <label id=\"codice-label\">Codice del libro</label>\
        <input type=\"text\" id=\"codice-input\" placeholder=\"Il codice stampato nel tuo libro\" style=\"text-transform:uppercase;\">\
      </div>\
      <button class=\"sit-btn\" id=\"sit-btn\">Siediti al tavolo</button>\
    </div>\
  </div>\
\
  <div class=\"stage\" id=\"email-panel-wrap\" style=\"display:none;\">\
    <div class=\"join-panel\">\
      <p class=\"join-title\">Resta aggiornato</p>\
      <p style=\"font-size:13px;color:var(--mist);margin:0 0 14px;line-height:1.5;\">Vuoi restare aggiornato sui prossimi romanzi di S. B. Ferrara e i vari scenari del gioco di ruolo? Lasciaci la tua email.</p>\
      <div class=\"field\">\
        <input type=\"email\" id=\"email-input\" placeholder=\"La tua email (facoltativa)\">\
      </div>\
      <button class=\"sit-btn\" id=\"email-submit-btn\">Salva email</button>\
      <button class=\"copy-btn\" id=\"email-skip-btn\" style=\"width:100%;margin-top:8px;\">No grazie</button>\
    </div>\
  </div>\
\
  <div class=\"stage\" id=\"gm-panel-wrap\" style=\"display:none;\">\
    <div class=\"panel\" id=\"gm-controls\">\
      <p class=\"panel-title\" id=\"gm-panel-title\">Apri la prima scena</p>\
      <div class=\"field-inline\" style=\"margin-bottom:12px;\">\
        <label>Scena pronta (facoltativo)</label>\
        <select id=\"scena-libreria-select\">\
          <option value=\"\">— scrivi liberamente —</option>\
        </select>\
      </div>\
      <div id=\"diramazione-suggerita\" style=\"display:none; background:rgba(192,138,62,0.1); border:1px solid rgba(192,138,62,0.3); border-radius:8px; padding:12px 14px; margin-bottom:12px;\">\
        <p style=\"font-size:12px;color:var(--mist);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;\">Sviluppo suggerito dal tiro precedente</p>\
        <p id=\"diramazione-testo\" style=\"font-size:13px;line-height:1.5;margin:0 0 10px;\"></p>\
        <button type=\"button\" class=\"copy-btn\" id=\"usa-diramazione-btn\">Usa questo testo</button>\
      </div>\
      <textarea class=\"gm-textarea\" id=\"scene-input\" placeholder=\"Scrivi qui il testo della scena…\"></textarea>\
      <button class=\"btn-primary\" id=\"apri-scena-btn\">Apri scena</button>\
    </div>\
    <div class=\"panel\" id=\"richiedi-tiro-panel\" style=\"display:none;\">\
      <p class=\"panel-title\">Richiedi un tiro</p>\
      <div class=\"roll-request-row\">\
        <div class=\"field-inline\">\
          <label>Giocatore</label>\
          <select id=\"tiro-giocatore\"></select>\
        </div>\
        <div class=\"field-inline\">\
          <label>Competenza</label>\
          <select id=\"tiro-competenza\"></select>\
        </div>\
        <div class=\"field-inline\">\
          <label>Numero dadi</label>\
          <input type=\"number\" id=\"tiro-numdadi\" value=\"3\" min=\"1\" max=\"6\">\
        </div>\
        <div class=\"field-inline\">\
          <label>Soglia</label>\
          <select id=\"tiro-soglia\">\
            <option value=\"1\">1 — facile</option>\
            <option value=\"2\" selected>2 — ostile</option>\
            <option value=\"3\">3 — al limite</option>\
          </select>\
        </div>\
        <div class=\"field-inline\">\
          <label>Traccia a rischio</label>\
          <select id=\"tiro-traccia\"></select>\
        </div>\
        <button class=\"btn-primary\" id=\"richiedi-tiro-btn\">Richiedi tiro</button>\
      </div>\
    </div>\
  </div>\
\
  <div class=\"stage\" id=\"game-screen\" style=\"display:none;\">\
    <div class=\"topbar\">\
      <span></span>\
      <div class=\"orologio-wrap\">\
        <span class=\"orologio-label\">L'Orologio</span>\
        <div class=\"orologio-ring\" id=\"orologio-ring\"></div>\
      </div>\
    </div>\
    <div class=\"scene-card\">\
      <p class=\"scene-eyebrow\" id=\"scene-eyebrow\">Scena</p>\
      <p class=\"scene-text\" id=\"scene-text\"></p>\
    </div>\
    <div class=\"panel\" id=\"tiro-panel\" style=\"display:none;\">\
      <p class=\"panel-title\">Tiro richiesto</p>\
      <p class=\"roll-status\" id=\"tiro-status\"></p>\
      <div id=\"azzardo-scelta\" class=\"roll-request-row\" style=\"margin-bottom:14px;\">\
        <div class=\"field-inline\">\
          <label>Dadi d'Azzardo</label>\
          <select id=\"azzardo-numero\">\
            <option value=\"0\">Nessuno</option>\
            <option value=\"1\">1 dado</option>\
            <option value=\"2\">2 dadi</option>\
          </select>\
        </div>\
        <div class=\"field-inline\" id=\"azzardo-destinazione-wrap\" style=\"display:none;\">\
          <label>Se esce 1, scarico su</label>\
          <select id=\"azzardo-destinazione\">\
            <option value=\"corpo\">Corpo</option>\
            <option value=\"equipaggiamento\">Equipaggiamento</option>\
          </select>\
        </div>\
      </div>\
      <div class=\"dice-row\" id=\"dice-row\"></div>\
      <p class=\"roll-status\" id=\"tiro-esito\"></p>\
      <button class=\"btn-primary\" id=\"tira-dadi-btn\">Tira i dadi</button>\
      <div id=\"margine-panel\" style=\"display:none; margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08);\">\
        <p class=\"roll-status\" id=\"margine-status\"></p>\
        <div class=\"roll-request-row\">\
          <div class=\"field-inline\">\
            <label>Proteggi una traccia</label>\
            <select id=\"margine-traccia\"></select>\
          </div>\
          <button class=\"btn-primary\" id=\"margine-traccia-btn\">Proteggi</button>\
          <button class=\"btn-primary\" id=\"margine-orologio-btn\">Ferma l'Orologio</button>\
        </div>\
      </div>\
    </div>\
    <div class=\"panel\">\
      <p class=\"panel-title\">Il tavolo</p>\
      <div id=\"roster-list\"></div>\
    </div>\
  </div>\
  ";
}

function scriptPagina() {
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
  var codiceParam = params.get('codice');\
  var autohostParam = params.get('autohost');\
  if (codiceParam) {\
    document.getElementById('codice-input').value = codiceParam;\
  }\
  if (autohostParam === '1') {\
    document.getElementById('gm-check').checked = true;\
    document.getElementById('codice-wrap').style.display = 'block';\
  }\
\
  document.getElementById('copy-btn').addEventListener('click', function () {\
    navigator.clipboard.writeText(window.location.href);\
    this.textContent = 'Copiato!';\
    var self = this;\
    setTimeout(function () { self.textContent = 'Copia link'; }, 1500);\
  });\
\
  var SIMBOLI = ['🧭', '🪢', '🔑', '🪶', '⏳', '🗺️', '🎲', '🔦'];\
  var simboloSelezionato = SIMBOLI[0];\
  var pickerEl = document.getElementById('symbol-picker');\
  SIMBOLI.forEach(function (s, idx) {\
    var btn = document.createElement('button');\
    btn.type = 'button';\
    btn.className = 'symbol-btn' + (idx === 0 ? ' selected' : '');\
    btn.textContent = s;\
    btn.addEventListener('click', function () {\
      simboloSelezionato = s;\
      var tutti = pickerEl.querySelectorAll('.symbol-btn');\
      tutti.forEach(function (b) { b.classList.remove('selected'); });\
      btn.classList.add('selected');\
    });\
    pickerEl.appendChild(btn);\
  });\
\
  var storageKey = 'sz_client_' + roomCode;\
  var clientId = localStorage.getItem(storageKey);\
  if (!clientId) {\
    clientId = 'c_' + Math.random().toString(36).slice(2, 10);\
    localStorage.setItem(storageKey, clientId);\
  }\
\
  var protocollo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';\
  var wsUrl = protocollo + '//' + window.location.host + '/ws?room=' + roomCode + '&game=' + gameId + '&clientId=' + clientId;\
  var socket = new WebSocket(wsUrl);\
  var mioId = null;\
  var configAttuale = null;\
  var mestiereSelezionato = '';\
  var valoreExtra1 = 2;\
  var valoreExtra2 = 1;\
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
      configAttuale = msg.config;\
      inizializzaConConfig();\
      aggiornaSchermata(msg.stato);\
    } else if (msg.type === 'stato') {\
      configAttuale = msg.config;\
      aggiornaSchermata(msg.stato);\
    } else if (msg.type === 'errore') {\
      alert(msg.messaggio);\
    }\
  });\
\
  function trovaScenaLibreria(idCompleto) {\
    if (!idCompleto || !configAttuale || !configAttuale.scenari) return null;\
    var pezzi = idCompleto.split(':');\
    var scenario = configAttuale.scenari[pezzi[0]];\
    if (!scenario) return null;\
    var attoTrovato = null;\
    scenario.atti.forEach(function (atto) {\
      if (String(atto.numero) === pezzi[1]) attoTrovato = atto;\
    });\
    if (!attoTrovato) return null;\
    var sceneTrovata = null;\
    attoTrovato.scene.forEach(function (scena) {\
      if (scena.id === pezzi[2]) sceneTrovata = scena;\
    });\
    return sceneTrovata;\
  }\
\
  function inizializzaConConfig() {\
    var mestieriConfig = configAttuale.mestieri || [];\
\
    function competenzaMestiereDi(id) {\
      var trovato = null;\
      mestieriConfig.forEach(function (m) { if (m.id === id) trovato = m; });\
      return trovato ? trovato.competenzaMestiere : '';\
    }\
\
    function aggiornaSelectExtra() {\
      var esclusa = competenzaMestiereDi(mestiereSelezionato);\
      var selezioni = [document.getElementById('competenza-extra-1'), document.getElementById('competenza-extra-2')];\
      selezioni.forEach(function (sel) {\
        var valorePrecedente = sel.value;\
        sel.innerHTML = '';\
        configAttuale.competenze.forEach(function (c) {\
          if (c === esclusa) return;\
          var opt = document.createElement('option');\
          opt.value = c;\
          opt.textContent = c;\
          sel.appendChild(opt);\
        });\
        if (valorePrecedente && valorePrecedente !== esclusa) sel.value = valorePrecedente;\
      });\
      var sel1 = document.getElementById('competenza-extra-1');\
      var sel2 = document.getElementById('competenza-extra-2');\
      if (sel1.value === sel2.value && sel2.options.length > 1) {\
        sel2.selectedIndex = sel2.selectedIndex === 0 ? 1 : 0;\
      }\
    }\
\
    var pickerMestiere = document.getElementById('mestiere-picker');\
    mestieriConfig.forEach(function (m, idx) {\
      var btn = document.createElement('button');\
      btn.type = 'button';\
      btn.className = 'mestiere-btn' + (idx === 0 ? ' selected' : '');\
      btn.textContent = m.nome;\
      btn.addEventListener('click', function () {\
        mestiereSelezionato = m.id;\
        var tutti = pickerMestiere.querySelectorAll('.mestiere-btn');\
        tutti.forEach(function (b) { b.classList.remove('selected'); });\
        btn.classList.add('selected');\
        document.getElementById('mestiere-flavor').textContent = m.descrizione + ' ' + m.rischio;\
        aggiornaSelectExtra();\
      });\
      pickerMestiere.appendChild(btn);\
    });\
    if (mestieriConfig.length) {\
      mestiereSelezionato = mestieriConfig[0].id;\
      document.getElementById('mestiere-flavor').textContent = mestieriConfig[0].descrizione + ' ' + mestieriConfig[0].rischio;\
    }\
    aggiornaSelectExtra();\
\
    document.getElementById('scambia-dadi-btn').addEventListener('click', function () {\
      var tmp = valoreExtra1;\
      valoreExtra1 = valoreExtra2;\
      valoreExtra2 = tmp;\
      document.getElementById('dadi-extra-1').textContent = valoreExtra1 + (valoreExtra1 === 1 ? ' dado' : ' dadi');\
      document.getElementById('dadi-extra-2').textContent = valoreExtra2 + (valoreExtra2 === 1 ? ' dado' : ' dadi');\
    });\
\
    var selScena = document.getElementById('scena-libreria-select');\
    var scenari = configAttuale.scenari || {};\
    Object.keys(scenari).forEach(function (idScenario) {\
      var scenario = scenari[idScenario];\
      scenario.atti.forEach(function (atto) {\
        atto.scene.forEach(function (scena) {\
          var opt = document.createElement('option');\
          opt.value = idScenario + ':' + atto.numero + ':' + scena.id;\
          opt.textContent = scenario.nome + ' — Atto ' + atto.numero + ' — ' + scena.titolo;\
          selScena.appendChild(opt);\
        });\
      });\
    });\
\
    selScena.addEventListener('change', function () {\
      if (!this.value) return;\
      var scena = trovaScenaLibreria(this.value);\
      if (scena) {\
        document.getElementById('scene-input').value = scena.testo;\
      }\
    });\
\
    var selTiroComp = document.getElementById('tiro-competenza');\
    configAttuale.competenze.forEach(function (c) {\
      var opt = document.createElement('option');\
      opt.value = c;\
      opt.textContent = c;\
      selTiroComp.appendChild(opt);\
    });\
\
    var selTraccia = document.getElementById('tiro-traccia');\
    Object.keys(configAttuale.tracce).forEach(function (chiave) {\
      var opt = document.createElement('option');\
      opt.value = chiave;\
      opt.textContent = configAttuale.tracce[chiave].label;\
      selTraccia.appendChild(opt);\
    });\
\
    document.getElementById('gm-toggle-label').textContent =\
      'Voglio essere ' + configAttuale.terminologia.gm;\
    document.getElementById('gm-toggle-sub').textContent =\
      'Guiderai la partita: apri le scene, gestisci ' + configAttuale.terminologia.orologio + '.';\
  }\
\
  document.getElementById('gm-check').addEventListener('change', function () {\
    document.getElementById('codice-wrap').style.display = this.checked ? 'block' : 'none';\
    document.getElementById('scheda-personaggio-wrap').style.display = this.checked ? 'none' : 'block';\
  });\
\
  document.getElementById('email-submit-btn').addEventListener('click', function () {\
    var email = document.getElementById('email-input').value.trim();\
    if (email) {\
      socket.send(JSON.stringify({ type: 'iscrivi_email', email: email }));\
    }\
    localStorage.setItem('sz_newsletter_prompted', '1');\
    document.getElementById('email-panel-wrap').style.display = 'none';\
  });\
\
  document.getElementById('email-skip-btn').addEventListener('click', function () {\
    localStorage.setItem('sz_newsletter_prompted', '1');\
    document.getElementById('email-panel-wrap').style.display = 'none';\
  });\
\
  document.getElementById('sit-btn').addEventListener('click', function () {\
    var nickname = document.getElementById('nickname').value.trim();\
    var vuoleGM = document.getElementById('gm-check').checked;\
    var codice = document.getElementById('codice-input').value.trim();\
    if (!nickname) { alert('Scrivi un nome prima di sederti.'); return; }\
    if (vuoleGM && !codice) { alert('Inserisci il codice stampato nel libro per guidare la partita.'); return; }\
\
    var payload = { type: 'siediti', nickname: nickname, vuoleGM: vuoleGM, codice: codice, simbolo: simboloSelezionato };\
\
    if (!vuoleGM) {\
      var extra1 = document.getElementById('competenza-extra-1').value;\
      var extra2 = document.getElementById('competenza-extra-2').value;\
      if (!mestiereSelezionato || !extra1 || !extra2 || extra1 === extra2) {\
        alert('Completa la scheda: scegli un Mestiere e due competenze diverse.');\
        return;\
      }\
      payload.mestiere = mestiereSelezionato;\
      payload.competenzaExtra1 = extra1;\
      payload.valoreExtra1 = valoreExtra1;\
      payload.competenzaExtra2 = extra2;\
      payload.valoreExtra2 = valoreExtra2;\
      payload.difetto = document.getElementById('difetto-input').value.trim();\
      payload.ragione = document.getElementById('ragione-input').value.trim();\
    }\
\
    socket.send(JSON.stringify(payload));\
  });\
\
  document.getElementById('apri-scena-btn').addEventListener('click', function () {\
    var testo = document.getElementById('scene-input').value.trim();\
    if (!testo) { alert('Scrivi il testo della scena prima di aprirla.'); return; }\
    var libreriaId = document.getElementById('scena-libreria-select').value;\
    socket.send(JSON.stringify({ type: 'apri_scena', testo: testo, libreriaId: libreriaId }));\
    document.getElementById('scene-input').value = '';\
    document.getElementById('scena-libreria-select').value = '';\
  });\
\
  document.getElementById('richiedi-tiro-btn').addEventListener('click', function () {\
    var giocatoreId = document.getElementById('tiro-giocatore').value;\
    var competenza = document.getElementById('tiro-competenza').value;\
    var numDadi = document.getElementById('tiro-numdadi').value;\
    var soglia = document.getElementById('tiro-soglia').value;\
    var traccia = document.getElementById('tiro-traccia').value;\
    if (!giocatoreId) { alert('Scegli un giocatore.'); return; }\
    socket.send(JSON.stringify({\
      type: 'richiedi_tiro',\
      giocatoreId: giocatoreId,\
      competenza: competenza,\
      numDadi: numDadi,\
      soglia: soglia,\
      traccia: traccia\
    }));\
  });\
\
  document.getElementById('azzardo-numero').addEventListener('change', function () {\
    document.getElementById('azzardo-destinazione-wrap').style.display =\
      this.value === '0' ? 'none' : 'flex';\
  });\
\
  document.getElementById('tira-dadi-btn').addEventListener('click', function () {\
    var numDadiAzzardo = document.getElementById('azzardo-numero').value;\
    var doveScaricare = document.getElementById('azzardo-destinazione').value;\
    socket.send(JSON.stringify({\
      type: 'tira_dadi',\
      numDadiAzzardo: numDadiAzzardo,\
      doveScaricare: doveScaricare\
    }));\
  });\
\
  document.getElementById('margine-traccia-btn').addEventListener('click', function () {\
    var traccia = document.getElementById('margine-traccia').value;\
    if (!traccia) { alert('Scegli quale traccia proteggere.'); return; }\
    socket.send(JSON.stringify({ type: 'spendi_margine', scelta: 'traccia', traccia: traccia }));\
  });\
\
  document.getElementById('margine-orologio-btn').addEventListener('click', function () {\
    socket.send(JSON.stringify({ type: 'spendi_margine', scelta: 'orologio' }));\
  });\
\
  function aggiornaSchermata(stato) {\
    var sonoSeduto = stato.players.some(function (p) { return p.id === mioId; });\
    var sonoIlGM = stato.gmId === mioId;\
\
    document.getElementById('join-panel-wrap').style.display = sonoSeduto ? 'none' : 'block';\
    document.getElementById('gm-toggle-wrap').style.display = stato.gmId ? 'none' : 'flex';\
    if (stato.gmId) {\
      document.getElementById('codice-wrap').style.display = 'none';\
    }\
\
    document.getElementById('gm-panel-wrap').style.display = sonoIlGM ? 'block' : 'none';\
    var giaChiestaEmail = localStorage.getItem('sz_newsletter_prompted');\
    document.getElementById('email-panel-wrap').style.display =\
      (sonoIlGM && !giaChiestaEmail) ? 'block' : 'none';\
    if (sonoIlGM) {\
      document.getElementById('gm-panel-title').textContent =\
        stato.log.sceneAperte > 0 ? 'Apri la prossima scena' : 'Apri la prima scena';\
      document.getElementById('apri-scena-btn').textContent =\
        stato.log.sceneAperte > 0 ? 'Apri prossima scena' : 'Apri scena';\
    }\
\
    if (stato.status === 'playing') {\
      document.getElementById('lobby-screen').style.display = 'none';\
      document.getElementById('game-screen').style.display = 'block';\
      renderizzaSchermataGioco(stato);\
    } else {\
      document.getElementById('lobby-screen').style.display = 'block';\
      document.getElementById('game-screen').style.display = 'none';\
      renderizzaTavoloLobby(stato, sonoIlGM);\
    }\
  }\
\
  function renderizzaTavoloLobby(stato, sonoIlGM) {\
    var seats = document.querySelectorAll('.seat');\
    var giocatori = stato.players.filter(function (p) { return p.role === 'player'; });\
    for (var i = 0; i < seats.length; i++) {\
      var seat = seats[i];\
      var g = giocatori[i];\
      var ring = seat.querySelector('.ring');\
      var label = seat.querySelector('.label');\
      if (g) {\
        seat.classList.add('filled');\
        ring.textContent = g.simbolo || g.nickname.charAt(0).toUpperCase();\
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
    var terminGm = configAttuale.terminologia.gmMaiuscolo;\
    if (gm) {\
      gmSeat.classList.add('filled');\
      gmSeat.querySelector('.die').textContent = gm.simbolo || '⚄';\
      gmSeat.querySelector('.label').textContent = gm.nickname + (gm.id === mioId ? ' (tu)' : '');\
    } else {\
      gmSeat.classList.remove('filled');\
      gmSeat.querySelector('.die').textContent = '⚄';\
      gmSeat.querySelector('.label').textContent = terminGm;\
    }\
\
    document.getElementById('table-caption').innerHTML =\
      'Il tavolo si sta riempiendo — <strong>' + giocatori.length + ' di 6</strong> posti occupati. ' +\
      (gm ? terminGm + ' si è seduto.' : terminGm + ' non si è ancora seduto.');\
\
    document.getElementById('footer-note').textContent = sonoIlGM\
      ? 'Sei ' + configAttuale.terminologia.gm + '. Scrivi la prima scena qui sotto quando vuoi iniziare.'\
      : 'La partita inizia quando ' + configAttuale.terminologia.gm + ' apre la prima scena.';\
  }\
\
  function renderizzaSchermataGioco(stato) {\
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
    var pannelloTiroGM = document.getElementById('richiedi-tiro-panel');\
    if (sonoIlGM) {\
      pannelloTiroGM.style.display = 'block';\
      var select = document.getElementById('tiro-giocatore');\
      var selezionePrecedente = select.value;\
      select.innerHTML = '';\
      stato.players.filter(function (p) { return p.role === 'player'; }).forEach(function (p) {\
        var opt = document.createElement('option');\
        opt.value = p.id;\
        opt.textContent = p.nickname;\
        select.appendChild(opt);\
      });\
      if (selezionePrecedente) select.value = selezionePrecedente;\
\
      var pannelloDiramazione = document.getElementById('diramazione-suggerita');\
      var scenaAttuale = stato.scenaCorrente;\
      var testoSuggerito = '';\
      if (scenaAttuale.libreriaId && scenaAttuale.tiroRichiesto && scenaAttuale.tiroEffettuato) {\
        var sceneLibreria = trovaScenaLibreria(scenaAttuale.libreriaId);\
        if (sceneLibreria && sceneLibreria.diramazioni) {\
          var chiaveEsito = scenaAttuale.esito === 'costo' && !sceneLibreria.diramazioni.costo\
            ? 'fallimento'\
            : scenaAttuale.esito;\
          testoSuggerito = sceneLibreria.diramazioni[chiaveEsito] || '';\
        }\
      }\
      if (testoSuggerito) {\
        pannelloDiramazione.style.display = 'block';\
        document.getElementById('diramazione-testo').textContent = testoSuggerito;\
        document.getElementById('usa-diramazione-btn').onclick = function () {\
          document.getElementById('scene-input').value = testoSuggerito;\
        };\
      } else {\
        pannelloDiramazione.style.display = 'none';\
      }\
    } else {\
      pannelloTiroGM.style.display = 'none';\
    }\
\
    var scena = stato.scenaCorrente;\
    var pannelloTiro = document.getElementById('tiro-panel');\
    var sonoIoIlDestinatario = scena.tiroRichiesto && scena.giocatoreCoinvolto === mioId;\
    if (sonoIoIlDestinatario) {\
      pannelloTiro.style.display = 'block';\
      var etichettaTraccia = configAttuale.tracce[scena.tracciaARischio]\
        ? configAttuale.tracce[scena.tracciaARischio].label\
        : scena.tracciaARischio;\
      document.getElementById('tiro-status').innerHTML =\
        configAttuale.terminologia.gmMaiuscolo + ' chiede un tiro di <strong>' + scena.competenzaRichiesta +\
        '</strong> — ' + scena.numDadi + ' dadi, soglia <strong>' + scena.sogliaRichiesta + '</strong>. In gioco: ' + etichettaTraccia + '.';\
\
      var diceRow = document.getElementById('dice-row');\
      diceRow.innerHTML = '';\
      scena.risultatoDadi.forEach(function (valore) {\
        var die = document.createElement('div');\
        die.className = 'die ' + (valore >= 5 ? 'success' : 'fail');\
        die.textContent = valore;\
        diceRow.appendChild(die);\
      });\
      scena.risultatoDadiAzzardo.forEach(function (valore) {\
        var die = document.createElement('div');\
        die.className = 'die azzardo ' + (valore === 1 ? 'costo' : (valore >= 5 ? 'success' : 'fail'));\
        die.textContent = valore;\
        diceRow.appendChild(die);\
      });\
\
      document.getElementById('azzardo-scelta').style.display = scena.tiroEffettuato ? 'none' : 'flex';\
      if (!scena.tiroEffettuato) {\
        document.getElementById('azzardo-numero').value = '0';\
        document.getElementById('azzardo-destinazione-wrap').style.display = 'none';\
      }\
\
      var esito = document.getElementById('tiro-esito');\
      var btn = document.getElementById('tira-dadi-btn');\
      var pannelloMargine = document.getElementById('margine-panel');\
      if (scena.tiroEffettuato) {\
        var testoEsito = '';\
        if (scena.esito === 'pieno') {\
          testoEsito = 'Pieno successo: ' + scena.successi + ' su ' + scena.sogliaRichiesta + '. Nessun costo.';\
          if (scena.margine > 0) {\
            testoEsito += ' Margine: <strong>' + scena.margine + '</strong>.';\
          }\
        } else if (scena.esito === 'costo') {\
          testoEsito = 'Successo con costo: ' + scena.successi + ' su ' + scena.sogliaRichiesta + '.';\
        } else {\
          testoEsito = 'Nessun successo. Il mondo risponde.';\
        }\
        if (scena.segnoTesto) {\
          testoEsito += '<br><em>' + scena.segnoTesto + '</em>';\
        }\
        if (scena.costoAzzardo > 0) {\
          var etichettaAzzardo = configAttuale.tracce[scena.doveScaricareAzzardo]\
            ? configAttuale.tracce[scena.doveScaricareAzzardo].label\
            : scena.doveScaricareAzzardo;\
          testoEsito += '<br>Rischio dichiarato: <strong>' + scena.costoAzzardo + '</strong> su ' + etichettaAzzardo + '.';\
          if (scena.segnoAzzardoTesto) {\
            testoEsito += '<br><em>' + scena.segnoAzzardoTesto + '</em>';\
          }\
        }\
        esito.innerHTML = testoEsito;\
        btn.disabled = true;\
        btn.textContent = 'Tiro già effettuato';\
\
        if (scena.esito === 'pieno' && scena.margine > 0 && !scena.margineSpeso) {\
          pannelloMargine.style.display = 'block';\
          document.getElementById('margine-status').textContent =\
            'Hai ' + scena.margine + ' di margine. Come lo spendi?';\
          var giocatoreCorrente = stato.players.find(function (p) { return p.id === mioId; });\
          var selTraccia = document.getElementById('margine-traccia');\
          selTraccia.innerHTML = '';\
          Object.keys(configAttuale.tracce).forEach(function (chiave) {\
            var valoreAttuale = giocatoreCorrente && giocatoreCorrente.tracce ? giocatoreCorrente.tracce[chiave] : 0;\
            if (valoreAttuale > 0) {\
              var opt = document.createElement('option');\
              opt.value = chiave;\
              opt.textContent = configAttuale.tracce[chiave].label + ' (' + valoreAttuale + ')';\
              selTraccia.appendChild(opt);\
            }\
          });\
          document.getElementById('margine-traccia-btn').style.display =\
            selTraccia.options.length > 0 ? 'inline-block' : 'none';\
        } else if (scena.margineSpeso) {\
          pannelloMargine.style.display = 'block';\
          document.getElementById('margine-status').textContent =\
            scena.margineScelta === 'orologio'\
              ? 'Margine speso: hai fermato l\\'Orologio per la prossima scena.'\
              : 'Margine speso: hai protetto una traccia.';\
          document.getElementById('margine-traccia-btn').style.display = 'none';\
          document.getElementById('margine-orologio-btn').style.display = 'none';\
        } else {\
          pannelloMargine.style.display = 'none';\
        }\
      } else {\
        esito.textContent = '';\
        btn.disabled = false;\
        btn.textContent = 'Tira i dadi';\
        pannelloMargine.style.display = 'none';\
        document.getElementById('margine-traccia-btn').style.display = 'inline-block';\
        document.getElementById('margine-orologio-btn').style.display = 'inline-block';\
      }\
    } else {\
      pannelloTiro.style.display = 'none';\
    }\
\
    var rosterList = document.getElementById('roster-list');\
    rosterList.innerHTML = '';\
    stato.players.forEach(function (p) {\
      var row = document.createElement('div');\
      row.className = 'roster-row';\
      var nomeConTu = (p.simbolo ? p.simbolo + ' ' : '') + p.nickname + (p.id === mioId ? ' (tu)' : '');\
      if (p.role === 'gm') {\
        row.innerHTML = '<span>' + nomeConTu + '</span><span class=\"roster-tag\">' + configAttuale.terminologia.gmMaiuscolo + '</span>';\
        rosterList.appendChild(row);\
        return;\
      }\
      var mestiereInfo = null;\
      (configAttuale.mestieri || []).forEach(function (m) { if (m.id === p.mestiere) mestiereInfo = m; });\
      var mestiereNome = mestiereInfo ? mestiereInfo.nome : '';\
      var tracceHtml = Object.keys(configAttuale.tracce).map(function (chiave) {\
        var valore = p.tracce ? (p.tracce[chiave] || 0) : 0;\
        var segmenti = '';\
        for (var s = 0; s < 6; s++) {\
          segmenti += '<div class=\"seg' + (s < valore ? ' filled' : '') + '\"></div>';\
        }\
        return '<div style=\"margin-top:4px;\"><span class=\"roster-tag\">' + configAttuale.tracce[chiave].label +\
          '</span><div class=\"roster-misura\">' + segmenti + '</div></div>';\
      }).join('');\
      row.innerHTML =\
        '<div style=\"width:100%;\"><div><span>' + nomeConTu + '</span><span class=\"roster-tag\" style=\"margin-left:8px;\">' +\
        (mestiereNome || '') + '</span></div>' +\
        (p.difetto ? '<div style=\"font-size:11px;color:var(--mist);font-style:italic;margin-top:2px;\">' + p.difetto + '</div>' : '') +\
        tracceHtml + '</div>';\
      rosterList.appendChild(row);\
    });\
  }\
  ";
}
