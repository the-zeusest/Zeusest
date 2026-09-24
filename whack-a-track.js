/* Whack-a-Track mini-game for the Rizney YouTube player. */
(() => {
  "use strict";
  const TRACK_HEALTH = 24;
  const GAME_DURATION = 80;
  const MOLE_VISIBLE_MS = 460;
  const MOLE_INTERVAL_MS = 1400;
  const youtube = () => window.rizneyPlayer || window.player || null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const controls = () => $(".controls");
  let game, active = false, trackHealth = TRACK_HEALTH, secondsLeft = GAME_DURATION;
  let moleTimer, hideTimer, gameTimer;

  function setToolbarHidden(hidden) { controls()?.classList.toggle("toolbar-hidden", hidden); }
  function positionToolbar() {
    const dock = $(".player-dock");
    if (dock) document.documentElement.style.setProperty("--player-dock-height", `${dock.offsetHeight}px`);
  }
  function scrollToReading() {
    const reading = $("#reading");
    if (!reading || reading.hidden) return;
    requestAnimationFrame(() => reading.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function songIcon(index) {
    const row = $("#song-list")?.querySelectorAll(".song")[index];
    const image = row?.querySelector(".play img");
    if (!image) return null;
    const src = decodeURIComponent(image.getAttribute("src") || "");
    const file = src.split("/").pop() || "";
    return { src, name: file.replace(/\.png$/i, "").replace(/\s*\(\d+\)$/i, "") };
  }

  // Replace each random-reading card's symbol with the animal assigned to its song.
  function updateCards() {
    const cards = $("#cards");
    if (!cards) return;
    cards.querySelectorAll(".card").forEach(card => {
      const link = $("a", card);
      const match = link?.textContent.match(/Play song\s+(\d+)/i);
      if (!match) return;
      const index = Number(match[1]) - 1;
      const icon = songIcon(index);
      if (!icon) return;
      const symbol = $(".symbol", card);
      if (symbol) symbol.innerHTML = `<img src="${icon.src}" alt="${icon.name}" loading="lazy">`;
      let name = $(".animal-name", card);
      if (!name) {
        name = document.createElement("span");
        name.className = "animal-name";
        card.insertBefore(name, link);
      }
      name.textContent = icon.name;
      card.dataset.songIndex = String(index);
    });
  }

  function setupCards() {
    const style = document.createElement("style");
    style.textContent = `
      #cards .card { background: #000; }
      #cards .card .symbol { height: 96px; margin: 0 0 8px; display: grid; place-items: center; }
      #cards .card .symbol img { display: block; width: 96px; height: 96px; object-fit: contain; }
      #cards .card .animal-name { display: block; margin: 0 0 8px; color: var(--bright-gold); font-family: sans-serif; font-size: .78rem; text-transform: capitalize; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(style);
    const cards = $("#cards");
    if (!cards) return;
    new MutationObserver(updateCards).observe(cards, { childList: true, subtree: true });
    updateCards();
  }

  function setupToolbar() {
    const style = document.createElement("style");
    style.textContent = `
      .controls { position: sticky; top: var(--player-dock-height, 0px); z-index: 90; transition: opacity .18s ease, visibility .18s ease; }
      .controls.toolbar-hidden { visibility: hidden; opacity: 0; pointer-events: none; }
      #reading, #whack-a-track-game { scroll-margin-top: calc(var(--player-dock-height, 0px) + 8px); }
      @media (max-width: 640px) {
        #whack-a-track-game { width: 100%; margin-top: 4px; margin-bottom: 12px; padding: 8px 10px 10px; }
        #whack-a-track-game #wat-board { gap: 6px; margin: 10px auto; }
        #whack-a-track-game .wat-hole { min-height: 58px !important; padding: 4px !important; font-size: 1.65rem !important; }
      }
    `;
    document.head.appendChild(style);
    positionToolbar();
    window.addEventListener("resize", positionToolbar, { passive: true });
    if (window.ResizeObserver) { const dock = $(".player-dock"); if (dock) new ResizeObserver(positionToolbar).observe(dock); }
    const cardsButton = $("#draw-cards"), whackButton = $("#whack-track");
    if (cardsButton && whackButton) whackButton.parentElement.insertBefore(cardsButton, whackButton);
    setToolbarHidden(false);
    const reading = $("#reading");
    cardsButton?.addEventListener("click", event => {
      if (!reading || reading.hidden) return;
      event.preventDefault(); event.stopImmediatePropagation(); reading.hidden = true;
    }, true);
    cardsButton?.addEventListener("click", scrollToReading);
  }

  const playing = () => {
    const player = youtube();
    return player && typeof player.getPlayerState === "function" && window.YT && player.getPlayerState() === YT.PlayerState.PLAYING;
  };
  function createGame() {
    if (game) return game;
    const panel = document.createElement("section");
    panel.id = "whack-a-track-game"; panel.setAttribute("aria-label", "Whack-a-Track");
    panel.innerHTML = `<h2>Whack-a-Track</h2><p id="wat-status" aria-live="polite"></p><p><span id="wat-time">${GAME_DURATION}</span>s</p><progress id="wat-health" max="${TRACK_HEALTH}" value="${TRACK_HEALTH}" aria-label="Track health"></progress><div id="wat-board" role="group" aria-label="Whack-a-Track board"></div><button id="wat-refresh" type="button" hidden>Refresh playlist</button><button id="wat-close" type="button">Close game</button>`;
    Object.assign(panel.style, { position:"sticky", top:"var(--player-dock-height, 104px)", zIndex:"20", maxWidth:"min(92vw, 620px)", boxSizing:"border-box", margin:"8px auto 18px", padding:"10px 14px 14px", textAlign:"center", background:"#120b18", border:"2px solid #d4af37", borderRadius:"12px", boxShadow:"0 0 24px rgba(212,175,55,.35)" });
    const board = $("#wat-board", panel); Object.assign(board.style, { display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:"10px", margin:"18px auto" });
    for (let i = 0; i < 6; i++) {
      const hole = document.createElement("button"); hole.type = "button"; hole.className = "wat-hole"; hole.textContent = "🕳️"; hole.dataset.active = "false";
      Object.assign(hole.style, { minHeight:"76px", padding:"8px", fontSize:"2rem", cursor:"crosshair" });
      hole.addEventListener("click", () => { if (!active || hole.dataset.active !== "true") return; hole.dataset.active = "false"; hole.textContent = "💥"; trackHealth--; $("#wat-health", panel).value = trackHealth; if (trackHealth <= 0) finish(true); });
      board.appendChild(hole);
    }
    $("#wat-close", panel).addEventListener("click", closeGame); $("#wat-refresh", panel).addEventListener("click", () => window.location.reload());
    ($(".player-dock") || $("main") || document.body).insertAdjacentElement("afterend", panel); panel.hidden = true;
    new MutationObserver(() => setToolbarHidden(!panel.hidden)).observe(panel, { attributes:true, attributeFilter:["hidden"] });
    game = { panel, board, status: $("#wat-status", panel) }; return game;
  }
  function hideMoles() { game.board.querySelectorAll(".wat-hole").forEach(hole => { hole.dataset.active = "false"; hole.textContent = "🕳️"; }); }
  function spawnMole() { if (!active) return; const holes = [...game.board.querySelectorAll(".wat-hole")], hole = holes[Math.floor(Math.random() * holes.length)]; hideMoles(); hole.dataset.active = "true"; hole.textContent = "🐭"; clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (hole.dataset.active === "true") hole.textContent = "🕳️"; hole.dataset.active = "false"; }, MOLE_VISIBLE_MS); moleTimer = setTimeout(spawnMole, MOLE_INTERVAL_MS); }
  function startClock() { clearInterval(gameTimer); secondsLeft = GAME_DURATION; $("#wat-time", game.panel).textContent = secondsLeft; gameTimer = setInterval(() => { if (!active) return; secondsLeft--; $("#wat-time", game.panel).textContent = secondsLeft; if (secondsLeft <= 0) finish(false); }, 1000); }
  function finish(won) { if (!active) return; active = false; clearTimeout(moleTimer); clearTimeout(hideTimer); clearInterval(gameTimer); hideMoles(); game.status.textContent = won ? "💥 TRACK WHACKED!" : "The track survived. Try again!"; }
  function closeGame() { active = false; clearTimeout(moleTimer); clearTimeout(hideTimer); clearInterval(gameTimer); if (game) game.panel.hidden = true; }
  function startGame(event) { event?.preventDefault(); event?.stopImmediatePropagation(); game = createGame(); clearTimeout(moleTimer); clearTimeout(hideTimer); clearInterval(gameTimer); $("#wat-refresh", game.panel).hidden = true; game.panel.hidden = false; if (!playing()) { active = false; game.status.textContent = "Play a track to start the game, then pause it to remove from playlist"; game.panel.scrollIntoView({ behavior:"smooth", block:"start" }); return; } trackHealth = TRACK_HEALTH; active = true; $("#wat-health", game.panel).value = trackHealth; hideMoles(); game.status.textContent = "Whack every mouse before the clock runs out!"; startClock(); spawnMole(); game.panel.scrollIntoView({ behavior:"smooth", block:"start" }); }
  function init() { setupCards(); setupToolbar(); const button = $("#whack-track"); if (!button || button.dataset.whackGameBound === "true") return; button.dataset.whackGameBound = "true"; button.addEventListener("click", startGame); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
