/* Whack-a-Track mini-game and playlist animal icons. */
(() => {
  "use strict";
  const TRACK_HEALTH = 24, GAME_DURATION = 80, MOLE_VISIBLE_MS = 460, MOLE_INTERVAL_MS = 1400;
  const youtube = () => window.rizneyPlayer || window.player || null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const controls = () => $(".controls");
  let game, active = false, trackHealth = TRACK_HEALTH, secondsLeft = GAME_DURATION;
  let moleTimer, hideTimer, gameTimer;

  const animalIcons = [
    "aardvark","alligator","anglefish","ant","anteater","armadillo","baboon","badger","bald-eagle","bass","bat","bear","beaver","bee","blob-fish","blue-heron","boar","buffalo","bull-skull","butterfly","camel","capuchin-monkey","capybara","catepillar","chameleon","cheetah","chihuahua","chimpanzee","chupacabra","clam","cow","coyote","crab","cricket","crocodile","crow","deer","desert-fox","dodo","dolphin","donkey","dove","duck","eagle","earthworm","eel","egg","elephant","elk","falcon","flamingo","fly","flying-fox","fox","frog","gazelle","gekko","giraffe","goat","goldfish","goose","gopher","gorilla","grouse","hamster","hawk","headless-horseman","hedgehog","hippo","horse","howler-monkey","hydra","hyena","jellyfish","kangaroo","kiwi","koala","komodo-dragon","labubu","lemming","lemur","leopard","like-an-antelope","lion","lizard","llama","lynx","manatee","mandrill","mantis","martian","medusa","meercat","minx","mole","moose","mountain-lion","mouse","narwhal","octopus (2)","orangutan","ostrich","otter","owl","ox","panda","panther","parrot","peacock","peican","penguin","pig","pirate","platypus","polar-bear","porcupine","puma","quokka","rabbit","raccoon","ram","rat","raven","red-panda","rhino","rooster","saber-tooth-tiger","saiga","salmon","sasquatch","scorpion","seagull","seahorse","seal","shark","siamese-twin-turtles","skull-hyena","skull","skunk","sloth","snail","snake","snapping-turtle","spider","squid","squirrel","stork","swan","t-rex","tapir","tazmanian-devil","toad","tortoise","toucan","turkey","unicorn","venus-fly-trap","vulture","walrus","warthog","weasel","werewolf","whale","wildebeest","wolf","wombat","woodpecker","wooly-mammoth","yak","yeti","zebra"
  ];
  const iconFor = index => animalIcons[index % animalIcons.length];
  const iconPath = index => `./assets/animal-icons/${encodeURIComponent(iconFor(index))}.png`;
  const animalName = index => iconFor(index);

  function setToolbarHidden(hidden) { controls()?.classList.toggle("toolbar-hidden", hidden); }
  function positionToolbar() { const dock = $(".player-dock"); if (dock) document.documentElement.style.setProperty("--player-dock-height", `${dock.offsetHeight}px`); }
  function scrollToReading() { const reading = $("#reading"); if (reading && !reading.hidden) requestAnimationFrame(() => reading.scrollIntoView({ behavior:"smooth", block:"start" })); }

  function setupSongIcons() {
    const list = $("#song-list");
    if (!list) return;
    list.querySelectorAll(".song").forEach((row, index) => {
      const button = $(".play", row);
      if (!button) return;
      const path = iconPath(index), name = animalName(index);
      button.innerHTML = `<img src="${path}" alt="Play song ${index + 1}: ${name}" loading="lazy">`;
      button.setAttribute("aria-label", `Play song ${index + 1}: ${name}`);
      button.title = `Play song ${index + 1}: ${name}`;
    });
  }

  function setupCards() {
    const style = document.createElement("style");
    style.textContent = `
      #song-list .song { grid-template-columns: 42px 38px minmax(0,1fr) !important; }
      #song-list .song .play { grid-column:1; grid-row:1; width:42px; height:42px; padding:3px; display:grid; place-items:center; overflow:hidden; }
      #song-list .song .play img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
      #cards .card { background:#000; }
      #cards .card .symbol { height:96px; margin:0 0 8px; display:grid; place-items:center; font-size:0; }
      #cards .card .symbol img { width:96px; height:96px; object-fit:contain; display:block; }
      #cards .card .animal-name { display:block; margin:0 0 8px; color:var(--bright-gold); font-family:sans-serif; font-size:.78rem; text-transform:capitalize; overflow-wrap:anywhere; }
      @media(max-width:500px){#song-list .song{grid-template-columns:38px 30px minmax(0,1fr)!important}#song-list .song .play{width:38px;height:38px}}
    `;
    document.head.appendChild(style);
    const cards = $("#cards");
    if (!cards) return;
    const render = () => {
      cards.querySelectorAll(".card").forEach(card => {
        const link = $("a", card);
        const match = (link?.textContent || "").match(/Play song\s+(\d+)/i);
        if (!match) return;
        const index = Number(match[1]) - 1;
        const path = iconPath(index), name = animalName(index);
        const symbol = $(".symbol", card);
        if (symbol) symbol.innerHTML = `<img src="${path}" alt="${name}" loading="lazy">`;
        let label = $(".animal-name", card);
        if (!label) { label = document.createElement("span"); label.className = "animal-name"; card.insertBefore(label, link); }
        label.textContent = name;
        card.dataset.songIndex = String(index);
      });
    };
    new MutationObserver(render).observe(cards, { childList:true, subtree:true });
    render();
  }

  function setupToolbar() {
    const style = document.createElement("style");
    style.textContent = `.controls{position:sticky;top:var(--player-dock-height,0px);z-index:90;transition:opacity .18s ease,visibility .18s ease}.controls.toolbar-hidden{visibility:hidden;opacity:0;pointer-events:none}#reading,#whack-a-track-game{scroll-margin-top:calc(var(--player-dock-height,0px) + 8px)}`;
    document.head.appendChild(style); positionToolbar(); window.addEventListener("resize", positionToolbar, { passive:true });
    if (window.ResizeObserver) { const dock = $(".player-dock"); if (dock) new ResizeObserver(positionToolbar).observe(dock); }
    const cardsButton = $("#draw-cards"), whackButton = $("#whack-track");
    if (cardsButton && whackButton) whackButton.parentElement.insertBefore(cardsButton, whackButton);
    setToolbarHidden(false);
    const reading = $("#reading");
    cardsButton?.addEventListener("click", event => { if (!reading || reading.hidden) return; event.preventDefault(); event.stopImmediatePropagation(); reading.hidden = true; }, true);
    cardsButton?.addEventListener("click", scrollToReading);
  }

  const playing = () => { const player = youtube(); return player && typeof player.getPlayerState === "function" && window.YT && player.getPlayerState() === YT.PlayerState.PLAYING; };
  function createGame() {
    if (game) return game;
    const panel = document.createElement("section"); panel.id = "whack-a-track-game"; panel.setAttribute("aria-label","Whack-a-Track");
    panel.innerHTML = `<h2>Whack-a-Track</h2><p id="wat-status" aria-live="polite"></p><p><span id="wat-time">${GAME_DURATION}</span>s</p><progress id="wat-health" max="${TRACK_HEALTH}" value="${TRACK_HEALTH}" aria-label="Track health"></progress><div id="wat-board" role="group" aria-label="Whack-a-Track board"></div><button id="wat-refresh" type="button" hidden>Refresh playlist</button><button id="wat-close" type="button">Close game</button>`;
    Object.assign(panel.style,{position:"sticky",top:"var(--player-dock-height,104px)",zIndex:"20",maxWidth:"min(92vw,620px)",boxSizing:"border-box",margin:"8px auto 18px",padding:"10px 14px 14px",textAlign:"center",background:"#120b18",border:"2px solid #d4af37",borderRadius:"12px",boxShadow:"0 0 24px rgba(212,175,55,.35)"});
    const board = $("#wat-board",panel); Object.assign(board.style,{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:"10px",margin:"18px auto"});
    for(let i=0;i<6;i++){const hole=document.createElement("button");hole.type="button";hole.className="wat-hole";hole.textContent="🕳️";hole.dataset.active="false";Object.assign(hole.style,{minHeight:"76px",padding:"8px",fontSize:"2rem",cursor:"crosshair"});hole.addEventListener("click",()=>{if(!active||hole.dataset.active!=="true")return;hole.dataset.active="false";hole.textContent="💥";trackHealth--;$("#wat-health",panel).value=trackHealth;if(trackHealth<=0)finish(true)});board.appendChild(hole)}
    $("#wat-close",panel).addEventListener("click",closeGame); $("#wat-refresh",panel).addEventListener("click",()=>window.location.reload()); ($(".player-dock")||$("main")||document.body).insertAdjacentElement("afterend",panel); panel.hidden=true;
    new MutationObserver(()=>setToolbarHidden(!panel.hidden)).observe(panel,{attributes:true,attributeFilter:["hidden"]}); game={panel,board,status:$("#wat-status",panel)}; return game;
  }
  function hideMoles(){game.board.querySelectorAll(".wat-hole").forEach(h=>{h.dataset.active="false";h.textContent="🕳️"})}
  function spawnMole(){if(!active)return;const holes=[...game.board.querySelectorAll(".wat-hole")],hole=holes[Math.floor(Math.random()*holes.length)];hideMoles();hole.dataset.active="true";hole.textContent="🐭";clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(hole.dataset.active==="true")hole.textContent="🕳️";hole.dataset.active="false"},MOLE_VISIBLE_MS);moleTimer=setTimeout(spawnMole,MOLE_INTERVAL_MS)}
  function startClock(){clearInterval(gameTimer);secondsLeft=GAME_DURATION;$("#wat-time",game.panel).textContent=secondsLeft;gameTimer=setInterval(()=>{if(!active)return;secondsLeft--;$("#wat-time",game.panel).textContent=secondsLeft;if(secondsLeft<=0)finish(false)},1000)}
  function finish(won){if(!active)return;active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);hideMoles();game.status.textContent=won?"💥 TRACK WHACKED!":"The track survived. Try again!"}
  function closeGame(){active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);if(game)game.panel.hidden=true}
  function startGame(event){event?.preventDefault();event?.stopImmediatePropagation();game=createGame();clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);$("#wat-refresh",game.panel).hidden=true;game.panel.hidden=false;if(!playing()){active=false;game.status.textContent="Play a track to start the game, then pause it to remove from playlist";game.panel.scrollIntoView({behavior:"smooth",block:"start"});return}trackHealth=TRACK_HEALTH;active=true;$("#wat-health",game.panel).value=trackHealth;hideMoles();game.status.textContent="Whack every mouse before the clock runs out!";startClock();spawnMole();game.panel.scrollIntoView({behavior:"smooth",block:"start"})}
  function init(){setupSongIcons();setupCards();setupToolbar();const button=$("#whack-track");if(!button||button.dataset.whackGameBound==="true")return;button.dataset.whackGameBound="true";button.addEventListener("click",startGame)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
