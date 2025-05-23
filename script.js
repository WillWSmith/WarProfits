const factories = {
  club: { name: "Wood Club", gpm: 60, icon: "🪵", owned: 0 },
  spear: { name: "Stone Spear", gpm: 180, icon: "🪨", owned: 0 },
  bow: { name: "Bow & Stone Arrows", gpm: 600, icon: "🏹", owned: 0 },
};

let gameState = {
  money: 0,
  lastUpdate: Date.now(),
};

function initFactoriesUI() {
  const container = document.getElementById("factories-container");
  container.innerHTML = "";

  for (const key in factories) {
    const factory = factories[key];
    const div = document.createElement("div");
    div.id = `factory-${key}`;
    div.innerHTML = `
      <h3>${factory.icon} ${factory.name} Factory</h3>
      <p id="info-${key}">Produces $${factory.gpm}/min each</p>
      <p id="owned-${key}" style="display:none;">Owned: <span id="count-${key}">0</span></p>
      <button id="buy-${key}">Buy ${factory.name} Factory (Free)</button>
    `;
    container.appendChild(div);

    document.getElementById(`buy-${key}`).addEventListener("click", () => buyFactory(key));
  }
}

function updateUI() {
  document.getElementById("money").textContent = Math.floor(gameState.money);
  for (const key in factories) {
    const f = factories[key];
    const owned = f.owned;
    const info = document.getElementById(`info-${key}`);
    const ownedElem = document.getElementById(`owned-${key}`);
    const count = document.getElementById(`count-${key}`);

    if (owned > 0) {
      info.textContent = `Producing $${owned * f.gpm}/min total`;
      ownedElem.style.display = "block";
      count.textContent = owned;
    } else {
      info.textContent = `Produces $${f.gpm}/min each`;
      ownedElem.style.display = "none";
    }
  }
  // Update scientist hire button with new cost
const nextCost = Math.floor(
  research.scientists.baseCost * Math.pow(research.scientists.costMultiplier, research.scientists.count)
);
document.getElementById("buyScientist").textContent = `Hire Scientist ($${nextCost})`;

  updateResearchUI();
}

function updateResearchUI() {
  document.getElementById("researchProgress").textContent =
    `Progress: ${Math.min(100, (research.current.progress / research.current.required * 100)).toFixed(2)}%`;
  document.getElementById("scientistCount").textContent =
    `Scientists: ${research.scientists.count}`;
}


function buyFactory(key) {
  factories[key].owned += 1;
  updateUI();
}

const research = {
  current: {
    name: "Unlock Bronze Age",
    progress: 0, // 0 to 100
    required: 1000, // base total points to reach
    unlocked: false,
  },
  scientists: {
    count: 0,
    baseCost: 1000,
    costMultiplier: 1.15
  }
};

function updateResearch(elapsedSeconds) {
  if (research.current.unlocked) return;

  const baseRate = 1; // base points per second
  const scientists = research.scientists.count;
  const progressRate = baseRate * Math.log2(scientists + 1); // diminishing returns

  research.current.progress += progressRate * elapsedSeconds;

  if (research.current.progress >= research.current.required) {
    research.current.unlocked = true;
    alert("🎉 Bronze Age Unlocked!");
  }
}

function buyScientist() {
  const cost = Math.floor(research.scientists.baseCost * Math.pow(research.scientists.costMultiplier, research.scientists.count));
  if (gameState.money >= cost) {
    gameState.money -= cost;
    research.scientists.count += 1;
    updateUI();
  }
}


function gameLoop() {
  const now = Date.now();
  const elapsed = (now - gameState.lastUpdate) / 1000;
  gameState.lastUpdate = now;

  let incomePerSec = 0;
  for (const key in factories) {
    incomePerSec += (factories[key].owned * factories[key].gpm) / 60;
  }

  gameState.money += incomePerSec * elapsed;
  updateResearch(elapsed);
  updateUI();
}

function saveGame() {
  const saveData = {
    money: gameState.money,
    lastUpdate: Date.now(),
  };
  for (const key in factories) {
    saveData[key + "Factories"] = factories[key].owned;
  }
  localStorage.setItem("warprofits-save", JSON.stringify(saveData));
  showSaveNotice();
}

function loadGame() {
  const saved = localStorage.getItem("warprofits-save");
  if (saved) {
    const data = JSON.parse(saved);
    gameState.money = data.money || 0;
    gameState.lastUpdate = data.lastUpdate || Date.now();
    for (const key in factories) {
      factories[key].owned = data[key + "Factories"] || 0;
    }
  }
}

function showSaveNotice() {
  const notice = document.getElementById("saveNotice");
  notice.style.display = "block";
  notice.style.opacity = "1";
  setTimeout(() => notice.style.opacity = "0", 2000);
  setTimeout(() => notice.style.display = "none", 3000);
}

document.getElementById("saveButton").addEventListener("click", saveGame);
document.getElementById("buyScientist").addEventListener("click", buyScientist);

// Start game
loadGame();
initFactoriesUI();
updateUI();
setInterval(gameLoop, 1000);
setInterval(saveGame, 300000);
