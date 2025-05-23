// Factory definitions with name, gold per minute (gpm), icon, owned count, base cost, and cost multiplier
const factories = {
  club:  { name: "Wood Club",          gpm: 60,  icon: "🪵", owned: 0, baseCost: 50,   multiplier: 1.15 },  // Fixed cost from 0 to 50
  spear: { name: "Stone Spear",        gpm: 180, icon: "🪨", owned: 0, baseCost: 100,  multiplier: 1.15 },
  sling: { name: "Sling",              gpm: 400, icon: "🥎", owned: 0, baseCost: 300,  multiplier: 1.15 },
  bow:   { name: "Bow & Stone Arrows",gpm: 600, icon: "🏹", owned: 0, baseCost: 600,  multiplier: 1.15 },
};

// Game state object holds current money and last update timestamp
let gameState = {
  money: 0,
  lastUpdate: Date.now(),
};

// Calculate cost for buying the next factory of the given type
function getFactoryCost(key) {
  const factory = factories[key];
  return Math.floor(factory.baseCost * Math.pow(factory.multiplier, factory.owned));
}

// Initialize factories UI, create buttons and info for each factory
function initFactoriesUI() {
  const container = document.getElementById("factories-container");
  container.innerHTML = ""; // Clear previous content

  for (const key in factories) {
    const factory = factories[key];
    const div = document.createElement("div");
    div.id = `factory-${key}`;
    div.innerHTML = `
      <h3>${factory.icon} ${factory.name} Factory</h3>
      <p id="info-${key}">Produces $${factory.gpm}/min each</p>
      <p id="owned-${key}" style="display:none;">Owned: <span id="count-${key}">0</span></p>
      <button id="buy-${key}">Buy ${factory.name} Factory ($${getFactoryCost(key)})</button>
    `;
    container.appendChild(div);

    // Add click event listener to buy button
    document.getElementById(`buy-${key}`).addEventListener("click", () => buyFactory(key));
  }
}

// Update the UI: money, factories info, owned counts, and buttons
function updateUI() {
  // Update total money display (rounded down)
  document.getElementById("money").textContent = Math.floor(gameState.money);

  // Update each factory's info, owned count, and buy button text
  for (const key in factories) {
    const f = factories[key];
    const owned = f.owned;
    const info = document.getElementById(`info-${key}`);
    const ownedElem = document.getElementById(`owned-${key}`);
    const count = document.getElementById(`count-${key}`);
    const buyButton = document.getElementById(`buy-${key}`);

    if (owned > 0) {
      info.textContent = `Producing $${owned * f.gpm}/min total`;
      ownedElem.style.display = "block";
      count.textContent = owned;
    } else {
      info.textContent = `Produces $${f.gpm}/min each`;
      ownedElem.style.display = "none";
    }

    if (buyButton) {
      buyButton.textContent = `Buy ${f.name} Factory ($${getFactoryCost(key)})`;
    }
  }

  // Update scientist hire button with current cost
  const nextCost = Math.floor(
    research.scientists.baseCost * Math.pow(research.scientists.costMultiplier, research.scientists.count)
  );
  document.getElementById("buyScientist").textContent = `Hire Scientist ($${nextCost})`;

  // Update research progress UI
  updateResearchUI();
}

// Update research progress and scientist count display
function updateResearchUI() {
  document.getElementById("researchProgress").textContent =
    `Progress: ${Math.min(100, (research.current.progress / research.current.required * 100)).toFixed(2)}%`;
  document.getElementById("scientistCount").textContent =
    `Scientists: ${research.scientists.count}`;
}

// Buy a factory if enough money; deduct cost, increase owned count, update UI
function buyFactory(key) {
  const cost = getFactoryCost(key);
  if (gameState.money >= cost) {
    gameState.money -= cost;
    factories[key].owned += 1;
    updateUI();
  }
}

// Research system state with current research and scientists count/cost
const research = {
  current: {
    name: "Unlock Bronze Age",
    progress: 0,     // research progress points
    required: 1000,  // points needed to unlock
    unlocked: false,
  },
  scientists: {
    count: 0,
    baseCost: 1000,
    costMultiplier: 1.15,
  }
};

// Update research progress based on elapsed seconds and scientist count with diminishing returns
function updateResearch(elapsedSeconds) {
  if (research.current.unlocked) return;

  const baseRate = 1; // base research points per second
  const scientists = research.scientists.count;
  const progressRate = baseRate * Math.log2(scientists + 1); // diminishing returns on scientists

  research.current.progress += progressRate * elapsedSeconds;

  if (research.current.progress >= research.current.required) {
    research.current.unlocked = true;
    alert("🎉 Bronze Age Unlocked!");
  }
}

// Buy a scientist if enough money; deduct cost, increase count, update UI
function buyScientist() {
  const cost = Math.floor(research.scientists.baseCost * Math.pow(research.scientists.costMultiplier, research.scientists.count));
  if (gameState.money >= cost) {
    gameState.money -= cost;
    research.scientists.count += 1;
    updateUI();
  }
}

// Main game loop: calculates income, updates money, research, and UI every second
function gameLoop() {
  const now = Date.now();
  const elapsed = (now - gameState.lastUpdate) / 1000;
  gameState.lastUpdate = now;

  let incomePerSec = 0;
  for (const key in factories) {
    incomePerSec += (factories[key].owned * factories[key].gpm) / 60; // convert gpm to gps
  }

  gameState.money += incomePerSec * elapsed;
  updateResearch(elapsed);
  updateUI();
}

// Save game state to localStorage
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

// Load game state from localStorage
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

// Display a temporary save notice on the screen
function showSaveNotice() {
  const notice = document.getElementById("saveNotice");
  notice.style.display = "block";
  notice.style.opacity = "1";
  setTimeout(() => notice.style.opacity = "0", 2000);
  setTimeout(() => notice.style.display = "none", 3000);
}

// Event listeners for save button and scientist purchase
document.getElementById("saveButton").addEventListener("click", saveGame);
document.getElementById("buyScientist").addEventListener("click", buyScientist);

// Initialize the game on page load
loadGame();
initFactoriesUI();
updateUI();

// Start the main game loop and autosave intervals
setInterval(gameLoop, 1000);
setInterval(saveGame, 300000);
