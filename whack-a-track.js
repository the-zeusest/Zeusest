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
  let game;
  let active = false;
  let trackHealth = TRACK_HEALTH;
  let secondsLeft = GAME_DURATION;
  let moleTimer;
  let hideTimer;
  let gameTimer;

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

  // Turn every playlist Play button into a clean animal-icon play button.
  function setupSongIcons() {
    const icons = [
      "aardvark","alligator","anglefish","ant","anteater","armadillo","baboon","badger",
      "bald-eagle","bass","bat","bear","beaver","bee","blob-fish","blue-heron","boar",
      "buffalo","bull-skull","butterfly","camel","capuchin-monkey","capybara","catepillar",
      "chameleon","cheetah","chihuahua","chimpanzee","chupacabra","clam","cow","coyote",
      "crab","cricket","crocodile","crow","deer","desert-fox","dodo","dolphin","donkey",
      "dove","duck","eagle","earthworm","eel","egg","elephant","elk","falcon","flamingo",
      "fly","flying-fox","fox","frog","gazelle","gekko","giraffe","goat","goldfish","goose",
      "gopher","gorilla","grouse","hamster","hawk","headless-horseman","hedgehog","hippo",
      "horse","howler-monkey","hydra","hyena","jellyfish","kangaroo","kiwi","koala",
      "komodo-dragon","labubu","lemming","lemur","leopard","like-an-antelope","lion","lizard",
      "llama","lynx","manatee","mandrill","mantis","martian","medusa","meercat","minx","mole",
      "moose","mountain-lion","mouse","narwhal","octopus (2)","orangutan","ostrich","otter","owl",
      "ox","panda","panther","parrot","peacock","peican","penguin","pig","pirate","platypus",
      "polar-bear","porcupine","puma","quokka","rabbit","raccoon","ram","rat","raven","red-panda",
      "rhino","rooster","saber-tooth-tiger","saiga","salmon","sasquatch","scorpion","seagull",
      "seahorse","seal","shark","siamese-twin-turtles","skull-hyena","skull","skunk","sloth","snail",
      "snake","snapping-turtle","spider","squid","squirrel","stork","swan","t-rex","tapir",
      "tazmanian-devil","toad","tortoise","toucan","turkey","unicorn","venus-fly-trap","vulture",
      "walrus","warthog","weasel","werewolf","whale","wildebeest","wolf","wombat","woodpecker",
      "wooly-mammoth","yak","yeti","zebra"
    ];
    const style = document.createElement("style");
    style.textContent = `
      #song-list .song { grid-template-columns: 42px 38px minmax(0, 1fr) !important; gap: 10px; }
      #song-list .song-number { grid-column: 2; grid-row: 1; }
      #song-list .song-title { grid-column: 3; grid-row: 1; min-width: 0; }
      #song-list .song .play { grid-column: 1; grid-row: 1; width: 42px; height: 42px; padding: 3px; display: grid; place-items: center; overflow: hidden; }
      #song-list .song .play img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
      @media (max-width: 500px) {
        #song-list .song { grid-template-columns: 38px 30px minmax(0, 1fr) !important; gap: 8px; }
        #song-list .song .play { width: 38px; height: 38px; }
      }
    `;
    document.head.appendChild(style);
    $("#song-list")?.querySelectorAll(".song").forEach((row, index) => {
      const button = $(".play", row);
      if (!button) return;
      const name = icons[index % icons.length];
      const file = `${name}.png`;
      button.innerHTML = `<img src="./assets/animal-icons/${encodeURIComponent(file)}" alt="Play song ${index + 1}" title="Play song ${index + 1}">`;
      button.setAttribute("aria-label", `Play song ${index + 1}`);
      button.title = `Play song ${index + 1}`;
    });
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
    Object.assign(panel.style, { position:"sticky", top:"var(--player-dock-height, 104px)", zIndex:"20", maxWidth:"min(92vw, 620px)", boxSizing:"border-box", margin:"8px auto 18px", padding:"10px 14px 14px", textAlign:"center", background:"#120b18", border:"2px solid #d4af37", borderRadius:"12px", boxShadow:"0 0 24px rgba(212,175,55,.35)", scrollMarginTop:"calc(var(--player-dock-height, 0px) + 8px)" });
    Object.assign($("h2", panel).style, { margin:"0 0 6px" }); Object.assign($("#wat-status", panel).style, { margin:"0 0 4px", minHeight:"1.4em" }); Object.assign($("#wat-time", panel).parentElement.style, { margin:"0 0 8px" });
    Object.assign($("#wat-health", panel).style, { display:"block", width:"100%", height:"18px", margin:"8px 0 14px", accentColor:"#d4af37" });
    const board = $("#wat-board", panel); Object.assign(board.style, { display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:"10px", margin:"18px auto" });
    for (let i=0;i<6;i++) { const hole=document.createElement("button"); hole.type="button"; hole.className="wat-hole"; hole.textContent="🕳️"; hole.dataset.active="false"; Object.assign(hole.style,{minHeight:"76px",padding:"8px",fontSize:"2rem",cursor:"crosshair"}); hole.addEventListener("click",()=>{if(!active||hole.dataset.active!=="true")return;hole.dataset.active="false";hole.textContent="💥";trackHealth--;$("#wat-health",panel).value=trackHealth;if(trackHealth<=0)finish(true)}); board.appendChild(hole); }
    $("#wat-close",panel).addEventListener("click",closeGame); $("#wat-refresh",panel).addEventListener("click",()=>window.location.reload()); ($(".player-dock")||$("main")||document.body).insertAdjacentElement("afterend",panel); panel.hidden=true;
    new MutationObserver(()=>setToolbarHidden(!panel.hidden)).observe(panel,{attributes:true,attributeFilter:["hidden"]}); game={panel,board,status:$("#wat-status",panel)}; return game;
  }
  function hideMoles(){game.board.querySelectorAll(".wat-hole").forEach(h=>{h.dataset.active="false";h.textContent="🕳️"})}
  function spawnMole(){if(!active)return;const holes=[...game.board.querySelectorAll(".wat-hole")],hole=holes[Math.floor(Math.random()*holes.length)];hideMoles();hole.dataset.active="true";hole.textContent="🐭";clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(hole.dataset.active==="true")hole.textContent="🕳️";hole.dataset.active="false"},MOLE_VISIBLE_MS);moleTimer=setTimeout(spawnMole,MOLE_INTERVAL_MS)}
  function startClock(){clearInterval(gameTimer);secondsLeft=GAME_DURATION;$("#wat-time",game.panel).textContent=secondsLeft;gameTimer=setInterval(()=>{if(!active)return;secondsLeft--;$("#wat-time",game.panel).textContent=secondsLeft;if(secondsLeft<=0)finish(false)},1000)}
  function finish(won){if(!active)return;active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);hideMoles();game.status.textContent=won?"💥 TRACK WHACKED!":"The track survived. Try again!"}
  function closeGame(){active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);if(game)game.panel.hidden=true}
  function startGame(event){event?.preventDefault();event?.stopImmediatePropagation();game=createGame();clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);$("#wat-refresh",game.panel).hidden=true;game.panel.hidden=false;if(!playing()){active=false;game.status.textContent="Play a track to start the game, then pause it to remove from playlist";game.panel.scrollIntoView({behavior:"smooth",block:"start"});return}trackHealth=TRACK_HEALTH;active=true;$("#wat-health",game.panel).value=trackHealth;hideMoles();game.status.textContent="Whack every mouse before the clock runs out!";startClock();spawnMole();game.panel.scrollIntoView({behavior:"smooth",block:"start"})}
  function init(){setupSongIcons();setupToolbar();const button=$("#whack-track");if(!button||button.dataset.whackGameBound==="true")return;button.dataset.whackGameBound="true";Object.assign(button.style,{cursor:"pointer"});button.addEventListener("click",startGame)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
