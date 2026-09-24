/* Playlist animal icons, reading cards, and Whack-a-Track. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const icons = ["aardvark","alligator","anglefish","ant","anteater","armadillo","baboon","badger","bald-eagle","bass","bat","bear","beaver","bee","blob-fish","blue-heron","boar","buffalo","bull-skull","butterfly","camel","capuchin-monkey","capybara","catepillar","chameleon","cheetah","chihuahua","chimpanzee","chupacabra","clam","cow","coyote","crab","cricket","crocodile","crow","deer","desert-fox","dodo","dolphin","donkey","dove","duck","eagle","earthworm","eel","egg","elephant","elk","falcon","flamingo","fly","flying-fox","fox","frog","gazelle","gekko","giraffe","goat","goldfish","goose","gopher","gorilla","grouse","hamster","hawk","headless-horseman","hedgehog","hippo","horse","howler-monkey","hydra","hyena","jellyfish","kangaroo","kiwi","koala","komodo-dragon","labubu","lemming","lemur","leopard","like-an-antelope","lion","lizard","llama","lynx","manatee","mandrill","mantis","martian","medusa","meercat","minx","mole","moose","mountain-lion","mouse","narwhal","octopus (2)","orangutan","ostrich","otter","owl","ox","panda","panther","parrot","peacock","peican","penguin","pig","pirate","platypus","polar-bear","porcupine","puma","quokka","rabbit","raccoon","ram","rat","raven","red-panda","rhino","rooster","saber-tooth-tiger","saiga","salmon","sasquatch","scorpion","seagull","seahorse","seal","shark","siamese-twin-turtles","skull-hyena","skull","skunk","sloth","snail","snake","snapping-turtle","spider","squid","squirrel","stork","swan","t-rex","tapir","tazmanian-devil","toad","tortoise","toucan","turkey","unicorn","venus-fly-trap","vulture","walrus","warthog","weasel","werewolf","whale","wildebeest","wolf","wombat","woodpecker","wooly-mammoth","yak","yeti","zebra"];
  const name = i => icons[i % icons.length];
  const src = i => new URL(`assets/animal-icons/${name(i)}.png`, document.baseURI).href;

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #song-list .song { grid-template-columns:42px 38px minmax(0,1fr)!important; gap:10px; }
      #song-list .song .play { grid-column:1; grid-row:1; width:42px; height:42px; padding:3px; display:grid; place-items:center; overflow:hidden; }
      #song-list .song .play img { display:block; width:100%; height:100%; object-fit:contain; pointer-events:none; }
      #cards .card { background:#000!important; }
      #cards .card .symbol { font-size:0!important; height:96px; display:grid; place-items:center; }
      #cards .card .symbol img { display:block; width:96px; height:96px; object-fit:contain; }
      #cards .card .animal-name { display:block; margin:0 0 8px; color:var(--bright-gold); font-family:sans-serif; font-size:.78rem; overflow-wrap:anywhere; }
      @media(max-width:500px){#song-list .song{grid-template-columns:38px 30px minmax(0,1fr)!important}#song-list .song .play{width:38px;height:38px}}
    `;
    document.head.appendChild(style);
  }

  function paintSongs() {
    document.querySelectorAll("#song-list .song").forEach((row, i) => {
      const button = row.querySelector("button.play");
      if (!button) return;
      const image = button.querySelector("img") || document.createElement("img");
      image.src = src(i);
      image.alt = `Play song ${i + 1}: ${name(i)}`;
      image.title = name(i);
      image.loading = "lazy";
      button.replaceChildren(image);
      button.setAttribute("aria-label", image.alt);
      button.title = image.alt;
    });
  }

  function paintCards() {
    const cards = $("#cards");
    if (!cards) return;
    cards.querySelectorAll(".card").forEach((card, position) => {
      const link = card.querySelector("a");
      const text = link?.textContent || "";
      const match = text.match(/Play song\s+(\d+)/i);
      const index = match ? Number(match[1]) - 1 : Number(card.dataset.songIndex ?? position);
      const animal = name(index);
      const symbol = card.querySelector(".symbol");
      if (symbol) {
        symbol.textContent = "";
        const image = document.createElement("img");
        image.src = src(index); image.alt = animal; image.title = animal; image.loading = "lazy";
        symbol.replaceChildren(image);
      }
      let label = card.querySelector(".animal-name");
      if (!label) { label = document.createElement("span"); label.className = "animal-name"; link?.before(label); }
      label.textContent = animal;
      card.dataset.songIndex = String(index);
    });
  }

  function bindVisuals() {
    addStyles();
    paintSongs();
    paintCards();
    const list = $("#song-list"), cards = $("#cards");
    if (list) new MutationObserver(paintSongs).observe(list, {childList:true, subtree:true});
    if (cards) new MutationObserver(paintCards).observe(cards, {childList:true, subtree:true});
    document.querySelectorAll("#song-list .song .play img, #cards .card .symbol img").forEach(image => image.addEventListener("error", () => { image.style.display = "none"; }, {once:true}));
  }

  const controls = () => $(".controls");
  function setToolbarHidden(hidden) { controls()?.classList.toggle("toolbar-hidden", hidden); }
  function setupToolbar() {
    const style = document.createElement("style");
    style.textContent = ".controls{position:sticky;top:var(--player-dock-height,0px);z-index:90}.controls.toolbar-hidden{visibility:hidden;opacity:0;pointer-events:none}";
    document.head.appendChild(style);
    const cardsButton = $("#draw-cards"), whackButton = $("#whack-track");
    if (cardsButton && whackButton) whackButton.parentElement.insertBefore(cardsButton, whackButton);
    setToolbarHidden(false);
    const reading = $("#reading");
    cardsButton?.addEventListener("click", () => setTimeout(() => { if (reading && !reading.hidden) { paintCards(); reading.scrollIntoView({behavior:"smooth", block:"start"}); } }, 0));
  }

  const TRACK_HEALTH=24, GAME_DURATION=80, MOLE_VISIBLE_MS=460, MOLE_INTERVAL_MS=1400;
  let game, active=false, health=TRACK_HEALTH, seconds=GAME_DURATION, moleTimer, hideTimer, gameTimer;
  const player = () => window.rizneyPlayer || window.player || null;
  const playing = () => player() && window.YT && player().getPlayerState?.() === YT.PlayerState.PLAYING;
  function createGame() {
    if (game) return game;
    const panel=document.createElement("section"); panel.id="whack-a-track-game"; panel.innerHTML=`<h2>Whack-a-Track</h2><p id="wat-status" aria-live="polite"></p><p><span id="wat-time">${GAME_DURATION}</span>s</p><progress id="wat-health" max="${TRACK_HEALTH}" value="${TRACK_HEALTH}"></progress><div id="wat-board"></div><button id="wat-close" type="button">Close game</button>`;
    const board=$("#wat-board",panel); Object.assign(panel.style,{maxWidth:"min(92vw,620px)",margin:"8px auto 18px",padding:"10px 14px 14px",textAlign:"center",background:"#120b18",border:"2px solid #d4af37",borderRadius:"12px"}); Object.assign(board.style,{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:"10px",margin:"18px auto"});
    for(let i=0;i<6;i++){const hole=document.createElement("button");hole.type="button";hole.className="wat-hole";hole.textContent="🕳️";hole.dataset.active="false";hole.style.minHeight="76px";hole.onclick=()=>{if(!active||hole.dataset.active!=="true")return;hole.dataset.active="false";hole.textContent="💥";$("#wat-health",panel).value=--health;if(health<=0)finish(true)};board.append(hole)}
    $("#wat-close",panel).onclick=closeGame; ($(".player-dock")||$("main")||document.body).after(panel); panel.hidden=true; game={panel,board,status:$("#wat-status",panel)}; return game;
  }
  function hideMoles(){game.board.querySelectorAll(".wat-hole").forEach(h=>{h.dataset.active="false";h.textContent="🕳️"})}
  function spawnMole(){if(!active)return;const holes=[...game.board.children],hole=holes[Math.floor(Math.random()*holes.length)];hideMoles();hole.dataset.active="true";hole.textContent="🐭";clearTimeout(hideTimer);hideTimer=setTimeout(()=>{hole.dataset.active="false";hole.textContent="🕳️"},MOLE_VISIBLE_MS);moleTimer=setTimeout(spawnMole,MOLE_INTERVAL_MS)}
  function finish(won){active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);hideMoles();game.status.textContent=won?"💥 TRACK WHACKED!":"The track survived. Try again!"}
  function closeGame(){active=false;clearTimeout(moleTimer);clearTimeout(hideTimer);clearInterval(gameTimer);if(game)game.panel.hidden=true;setToolbarHidden(false)}
  function startGame(e){e.preventDefault();e.stopImmediatePropagation();game=createGame();game.panel.hidden=false;setToolbarHidden(true);if(!playing()){game.status.textContent="Play a track to start the game, then pause it to remove from playlist";return}health=TRACK_HEALTH;active=true;$("#wat-health",game.panel).value=health;seconds=GAME_DURATION;$("#wat-time",game.panel).textContent=seconds;gameTimer=setInterval(()=>{if(--seconds<=0)finish(false);$("#wat-time",game.panel).textContent=seconds},1000);spawnMole()}
  function init(){bindVisuals();setupToolbar();$("#whack-track")?.addEventListener("click",startGame)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
