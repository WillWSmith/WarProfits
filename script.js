/*
 * WarProfits Standard Edition
 *
 * This version expands the original prototype into a richer idle game with
 * three ages—Stone, Bronze and Iron—each containing its own set of
 * factories.  Players hire scientists to progress through research tasks
 * that unlock the next age.  Costs scale exponentially with the number
 * owned, while factory output receives milestone bonuses every 25
 * purchases, following common balance patterns in incremental games【922296306697143†L53-L61】.
 */

// ***** AGE & FACTORY DEFINITIONS *****

// Define all ages with their factories.  Each factory defines a base gold per
// minute (gpm), a base cost and a cost multiplier.  New ages have higher
// multipliers to make late‑game purchases more expensive.
const ages = {
  stone: {
    name: "Stone Age",
    factories: {
      /**
       * Each factory defines its base gold per minute (gpm), base cost, cost
       * multiplier and the number owned.  To improve the initial game
       * experience we start the player with one Wood Club factory.  Without
       * this starter factory players would have zero income and no way to
       * progress.  Giving one factory provides an immediate trickle of
       * income while still encouraging players to purchase more factories.
       */
      club:    { name: "Wood Club",          baseGpm: 60,     baseCost: 50,      multiplier: 1.15, owned: 1 },
      spear:   { name: "Stone Spear",         baseGpm: 180,    baseCost: 100,     multiplier: 1.15, owned: 0 },
      sling:   { name: "Sling",               baseGpm: 400,    baseCost: 300,     multiplier: 1.15, owned: 0 },
      bow:     { name: "Bow & Stone Arrows",  baseGpm: 600,    baseCost: 600,     multiplier: 1.15, owned: 0 },
    },
  },
  bronze: {
    name: "Bronze Age",
    factories: {
      bronzeSword: { name: "Bronze Sword", baseGpm: 4000, baseCost: 3000, multiplier: 1.18, owned: 0 },
      bronzeSpear: { name: "Bronze Spear", baseGpm: 10000, baseCost: 8000, multiplier: 1.18, owned: 0 },
      bronzeAxe:   { name: "Bronze Axe",   baseGpm: 25000, baseCost: 20000, multiplier: 1.18, owned: 0 },
    },
  },
  iron: {
    name: "Iron Age",
    factories: {
      ironSword:  { name: "Iron Sword",   baseGpm: 400000,  baseCost: 300000,  multiplier: 1.22, owned: 0 },
      ironSpear:  { name: "Iron Spear",   baseGpm: 1000000, baseCost: 800000,  multiplier: 1.22, owned: 0 },
      ironCrossbow:{ name: "Iron Crossbow", baseGpm: 2500000, baseCost: 2000000, multiplier: 1.22, owned: 0 },
      ironCannon: { name: "Iron Cannon",  baseGpm: 6000000, baseCost: 5000000, multiplier: 1.22, owned: 0 },
    },
  },
};

// Keep track of which ages are unlocked (stone is always unlocked)
const agesUnlocked = {
  stone: true,
  bronze: false,
  iron: false,
};

// Research tasks queue.  Each task unlocks the corresponding age.
const researchTasks = [
  { name: "Unlock Bronze Age", ageKey: "bronze", required: 10000, unlocked: false },
  { name: "Unlock Iron Age",   ageKey: "iron",   required: 200000, unlocked: false },
];

let currentResearchIndex = 0;

// Global game state
let gameState = {
  money: 0,
  lastUpdate: Date.now(),
};

// Scientist data
const scientists = {
  count: 0,
  baseCost: 1000,
  costMultiplier: 1.2,
};

// Simple audio/visual feedback for purchases
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPurchaseSound() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.1;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function flashElement(el) {
  if (!el) return;
  el.classList.add("purchase-flash");
  setTimeout(() => el.classList.remove("purchase-flash"), 500);
}

// ***** UTILITY FUNCTIONS *****

/**
 * Calculate the cost of the next purchase of a factory.
 * Costs grow exponentially: baseCost × multiplier^owned【922296306697143†L53-L60】.
 */
function getFactoryCost(factory) {
  return Math.floor(factory.baseCost * Math.pow(factory.multiplier, factory.owned));
}

/**
 * Determine the effective GPM for a factory with milestone bonuses.
 * Every 25 factories owned doubles the base GPM.
 */
function getEffectiveGpm(factory) {
  const milestones = Math.floor(factory.owned / 25);
  return factory.baseGpm * Math.pow(2, milestones);
}

/**
 * Initialize factory UI for a specific age.  Creates cards and attaches buy
 * listeners.  This is called when the page loads and when new ages are
 * unlocked.
 */
function initAgeUI(ageKey) {
  const age = ages[ageKey];
  const container = document.getElementById(`${ageKey}-factories-container`);
  container.innerHTML = "";
  for (const key in age.factories) {
    const factory = age.factories[key];
    const div = document.createElement("div");
    div.classList.add("factory-card");
    div.id = `${ageKey}-${key}-card`;

    const cost = getFactoryCost(factory);
    // Display production in gold per hour (gph) rather than per minute.
    const gph = factory.baseGpm * 60;
    div.setAttribute(
      "title",
      `Each ${factory.name} factory produces $${gph.toLocaleString()}/hr. Every 25 owned doubles output.`
    );
    div.innerHTML = `
      <h3>${factory.name} Factory</h3>
      <p id="${ageKey}-${key}-info">Produces $${gph.toLocaleString()}/hr each</p>
      <p id="${ageKey}-${key}-owned" style="display:none;">Owned: <span id="${ageKey}-${key}-count">0</span></p>
      <button id="buy-${ageKey}-${key}">Buy ${factory.name} Factory ($${cost.toLocaleString()})</button>
    `;
    container.appendChild(div);
    const btn = div.querySelector("button");
    btn.addEventListener("click", () => buyFactory(ageKey, key, div));
  }
}

/**
 * Update factory UI for all ages.
 */
function updateFactoriesUI() {
  for (const ageKey in ages) {
    if (!agesUnlocked[ageKey]) continue;
    const age = ages[ageKey];
    for (const key in age.factories) {
      const f = age.factories[key];
      const info = document.getElementById(`${ageKey}-${key}-info`);
      const ownedElem = document.getElementById(`${ageKey}-${key}-owned`);
      const countElem = document.getElementById(`${ageKey}-${key}-count`);
      const buyBtn = document.getElementById(`buy-${ageKey}-${key}`);
      const card = document.getElementById(`${ageKey}-${key}-card`);

      const effectiveGpm = getEffectiveGpm(f);
      const effectiveGph = effectiveGpm * 60;
      if (f.owned > 0) {
        // Show production per hour for owned factories
        info.textContent = `Producing $${(f.owned * effectiveGph).toLocaleString()}/hr total`;
        ownedElem.style.display = "block";
        countElem.textContent = f.owned;
      } else {
        // Show base production per hour when none owned
        info.textContent = `Produces $${(f.baseGpm * 60).toLocaleString()}/hr each`;
        ownedElem.style.display = "none";
      }

      if (buyBtn) {
        buyBtn.textContent = `Buy ${f.name} Factory ($${getFactoryCost(f).toLocaleString()})`;
      }

      if (card) {
        const remainder = f.owned % 25;
        const nextBonus = remainder === 0 ? 25 : 25 - remainder;
        card.title = `Each ${f.name} factory produces $${effectiveGph.toLocaleString()}/hr. Owned: ${f.owned}. ${nextBonus} until next bonus.`;
      }
    }
  }
}

/**
 * Purchase a factory for a given age.
 */
function buyFactory(ageKey, factoryKey, cardElement) {
  const factory = ages[ageKey].factories[factoryKey];
  const cost = getFactoryCost(factory);
  if (gameState.money >= cost) {
    gameState.money -= cost;
    factory.owned += 1;
    updateFactoriesUI();
    playPurchaseSound();
    flashElement(cardElement);
  }
}

/**
 * Calculate total income per second from all unlocked ages.
 */
function calculateIncomePerSecond() {
  let gps = 0;
  for (const ageKey in ages) {
    if (!agesUnlocked[ageKey]) continue;
    const age = ages[ageKey];
    for (const key in age.factories) {
      const f = age.factories[key];
      gps += (f.owned * getEffectiveGpm(f)) / 60;
    }
  }
  return gps;
}

/**
 * Update research progress.  Uses diminishing returns via log2(scientists+1).
 * When current research completes, unlocks the next age and advances to the
 * next research task.
 */
function updateResearch(elapsed) {
  const task = researchTasks[currentResearchIndex];
  if (!task) return; // no more research
  // If already unlocked, skip
  if (task.unlocked) return;
  const rate = Math.log2(scientists.count + 1);
  task.progress = (task.progress || 0) + rate * elapsed;
  if (task.progress >= task.required) {
    task.unlocked = true;
    unlockAge(task.ageKey);
    currentResearchIndex += 1;
    // Update research task display
    updateResearchUI();
    alert(`${ages[task.ageKey].name} Unlocked!`);
  }
}

/**
 * Unlock an age: reveal its section and initialize its UI.
 */
function unlockAge(ageKey) {
  if (!agesUnlocked[ageKey]) {
    agesUnlocked[ageKey] = true;
    const section = document.getElementById(`${ageKey}-age-section`);
    if (section) section.style.display = "block";
    initAgeUI(ageKey);
    updateFactoriesUI();
  }
}

/**
 * Update research UI elements: name, progress, scientists.
 */
function updateResearchUI() {
  const task = researchTasks[currentResearchIndex];
  const taskElem = document.getElementById("researchTask");
  const progressElem = document.getElementById("researchProgress");
  const scientistElem = document.getElementById("scientistCount");

  if (task) {
    const progressPercent = Math.min(100, ((task.progress || 0) / task.required) * 100);
    taskElem.textContent = `Research: ${task.name}`;
    progressElem.textContent = `Progress: ${progressPercent.toFixed(2)}%`;
  } else {
    taskElem.textContent = "All research completed";
    progressElem.textContent = "Progress: 100%";
  }
  scientistElem.textContent = `Scientists: ${scientists.count}`;

  // Update buy button cost
  const cost = Math.floor(scientists.baseCost * Math.pow(scientists.costMultiplier, scientists.count));
  document.getElementById("buyScientist").textContent = `Hire Scientist ($${cost.toLocaleString()})`;
}

/**
 * Hire a scientist if enough money is available.
 */
function hireScientist() {
  const cost = Math.floor(scientists.baseCost * Math.pow(scientists.costMultiplier, scientists.count));
  if (gameState.money >= cost) {
    gameState.money -= cost;
    scientists.count += 1;
    updateResearchUI();
  }
}

/**
 * Save the game state to localStorage.
 */
function saveGame() {
  const data = {
    money: gameState.money,
    lastUpdate: Date.now(),
    scientists: scientists.count,
    agesUnlocked,
    ageFactories: {},
    researchIndex: currentResearchIndex,
    researchProgress: {},
  };
  // Save factory counts per age
  for (const ageKey in ages) {
    data.ageFactories[ageKey] = {};
    for (const key in ages[ageKey].factories) {
      data.ageFactories[ageKey][key] = ages[ageKey].factories[key].owned;
    }
  }
  // Save research progress for each task
  researchTasks.forEach((task, idx) => {
    data.researchProgress[idx] = task.progress || 0;
    data[`taskUnlocked_${idx}`] = task.unlocked;
  });
  localStorage.setItem("warprofits-standard-save", JSON.stringify(data));
  showSaveNotice();
}

/**
 * Load the game state from localStorage.
 */
function loadGame() {
  const saved = localStorage.getItem("warprofits-standard-save");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    gameState.money = data.money || 0;
    gameState.lastUpdate = data.lastUpdate || Date.now();
    scientists.count = data.scientists || 0;
    // Restore unlocked ages
    for (const ageKey in agesUnlocked) {
      agesUnlocked[ageKey] = data.agesUnlocked ? data.agesUnlocked[ageKey] : (ageKey === "stone");
    }
    // Restore factory counts
    for (const ageKey in data.ageFactories) {
      for (const key in data.ageFactories[ageKey]) {
        if (ages[ageKey] && ages[ageKey].factories[key] !== undefined) {
          ages[ageKey].factories[key].owned = data.ageFactories[ageKey][key];
        }
      }
    }
    // Restore research index and progress
    currentResearchIndex = data.researchIndex || 0;
    researchTasks.forEach((task, idx) => {
      task.progress = data.researchProgress ? data.researchProgress[idx] : 0;
      task.unlocked = data[`taskUnlocked_${idx}`] || false;
    });
  } catch (e) {
    console.error("Failed to load save:", e);
  }
}

/**
 * Show a temporary save notice.
 */
function showSaveNotice() {
  const notice = document.getElementById("saveNotice");
  notice.style.display = "block";
  notice.style.opacity = "1";
  setTimeout(() => (notice.style.opacity = "0"), 2000);
  setTimeout(() => (notice.style.display = "none"), 3000);
}

/**
 * Main game loop: update money, research progress and UI.
 */
function gameLoop() {
  const now = Date.now();
  const elapsed = (now - gameState.lastUpdate) / 1000;
  gameState.lastUpdate = now;

  const income = calculateIncomePerSecond();
  gameState.money += income * elapsed;

  // Update research
  updateResearch(elapsed);

  // Update UI elements
  updateUI();
}

/**
 * Update money display, factories and research UI.
 */
function updateUI() {
  document.getElementById("money").textContent = Math.floor(gameState.money).toLocaleString();
  updateFactoriesUI();
  updateResearchUI();
}

// ***** INITIALIZATION *****
window.addEventListener("DOMContentLoaded", () => {
  loadGame();
  // If there is no existing save, ensure the player starts with one Wood Club factory
  if (!localStorage.getItem("warprofits-standard-save")) {
    // Guarantee at least one starter factory for initial income
    if (ages.stone && ages.stone.factories && ages.stone.factories.club) {
      ages.stone.factories.club.owned = 1;
    }
  }

  // Initialize UI for each unlocked age
  for (const ageKey in ages) {
    if (agesUnlocked[ageKey]) {
      const section = document.getElementById(`${ageKey}-age-section`);
      if (section) section.style.display = "block";
      initAgeUI(ageKey);
    }
  }
  updateFactoriesUI();
  updateResearchUI();
  updateUI();

  // Event listeners
  document.getElementById("buyScientist").addEventListener("click", hireScientist);
  document.getElementById("saveButton").addEventListener("click", saveGame);

  // Start loops
  setInterval(gameLoop, 1000);
  setInterval(saveGame, 300000);
});
