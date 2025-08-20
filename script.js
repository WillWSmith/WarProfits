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

// Define all ages with their factories.  Each factory defines a base weapons per
// minute (wpm), a base cost and a cost multiplier.  New ages have higher
// multipliers to make late‑game purchases more expensive.
const ages = {
  stone: {
    name: "Stone Age",
    factories: {
      /**
       * Each factory defines its base weapons per minute (wpm), base cost, cost
       * multiplier and the number owned.  To improve the initial game
       * experience we start the player with one Wood Club factory.  Without
       * this starter factory players would have zero income and no way to
       * progress.  Giving one factory provides an immediate trickle of
       * income while still encouraging players to purchase more factories.
       */
      club:    { name: "Wood Club",          baseWpm: 60,     baseCost: 50,      multiplier: 1.15, owned: 1 },
      spear:   { name: "Stone Spear",         baseWpm: 180,    baseCost: 100,     multiplier: 1.15, owned: 0 },
      sling:   { name: "Sling",               baseWpm: 400,    baseCost: 300,     multiplier: 1.15, owned: 0 },
      bow:     { name: "Bow & Stone Arrows",  baseWpm: 600,    baseCost: 600,     multiplier: 1.15, owned: 0 },
    },
  },
  bronze: {
    name: "Bronze Age",
    factories: {
      bronzeSword: { name: "Bronze Sword", baseWpm: 4000, baseCost: 3000, multiplier: 1.18, owned: 0 },
      bronzeSpear: { name: "Bronze Spear", baseWpm: 10000, baseCost: 8000, multiplier: 1.18, owned: 0 },
      bronzeAxe:   { name: "Bronze Axe",   baseWpm: 25000, baseCost: 20000, multiplier: 1.18, owned: 0 },
    },
  },
  iron: {
    name: "Iron Age",
    factories: {
      ironSword:  { name: "Iron Sword",   baseWpm: 400000,  baseCost: 300000,  multiplier: 1.22, owned: 0 },
      ironSpear:  { name: "Iron Spear",   baseWpm: 1000000, baseCost: 800000,  multiplier: 1.22, owned: 0 },
      ironCrossbow:{ name: "Iron Crossbow", baseWpm: 2500000, baseCost: 2000000, multiplier: 1.22, owned: 0 },
      ironCannon: { name: "Iron Cannon",  baseWpm: 6000000, baseCost: 5000000, multiplier: 1.22, owned: 0 },
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

// Weapon inventory produced by factories
let weaponInventory = {};

// Stats for each weapon type used in raids
const weaponStats = {
  club: { attack: 5, defense: 2, range: 1 },
  spear: { attack: 7, defense: 3, range: 2 },
  sling: { attack: 6, defense: 1, range: 5 },
  bow: { attack: 8, defense: 2, range: 6 },
  bronzeSword: { attack: 15, defense: 8, range: 2 },
  bronzeSpear: { attack: 18, defense: 10, range: 3 },
  bronzeAxe: { attack: 25, defense: 12, range: 2 },
  ironSword: { attack: 40, defense: 20, range: 2 },
  ironSpear: { attack: 50, defense: 25, range: 3 },
  ironCrossbow: { attack: 70, defense: 15, range: 8 },
  ironCannon: { attack: 120, defense: 30, range: 10 },
};

// Map each weapon to its technology tier so raids pit similar eras
const weaponTiers = {
  club: "stone",
  spear: "stone",
  sling: "stone",
  bow: "stone",
  bronzeSword: "bronze",
  bronzeSpear: "bronze",
  bronzeAxe: "bronze",
  ironSword: "iron",
  ironSpear: "iron",
  ironCrossbow: "iron",
  ironCannon: "iron",
};

// Enemy archetypes for raids, each aligned with a tech tier
const enemyTypes = [
  {
    name: "Bandit Horde",
    tier: "stone",
    wealth: 1.0,
    weaponEffectiveness: { club: 1.2, spear: 1.1, sling: 1.0, bow: 0.8 },
  },
  {
    name: "Mercenary Company",
    tier: "bronze",
    wealth: 1.5,
    weaponEffectiveness: { bronzeSword: 1.2, bronzeSpear: 1.1, bow: 1.1 },
  },
  {
    name: "Royal Guard",
    tier: "iron",
    wealth: 2.0,
    weaponEffectiveness: { ironSword: 1.2, ironSpear: 1.2, ironCrossbow: 1.3, ironCannon: 1.4 },
  },
];

const outcomeSVGs = {
  completeVictory: `<svg width="80" height="50"><polygon points="40,5 47,32 75,32 52,47 60,75 40,58 20,75 28,47 5,32 33,32" fill="#ffd700"/></svg>`,
  victory: `<svg width="80" height="50"><polyline points="10,25 30,40 70,10" stroke="#0f0" stroke-width="8" fill="none"/></svg>`,
  loss: `<svg width="80" height="50"><line x1="10" y1="10" x2="70" y2="40" stroke="#f00" stroke-width="8"/><line x1="70" y1="10" x2="10" y2="40" stroke="#f00" stroke-width="8"/></svg>`,
  completeLoss: `<svg width="80" height="50"><circle cx="40" cy="25" r="24" stroke="#f00" stroke-width="6" fill="none"/><line x1="15" y1="10" x2="65" y2="40" stroke="#f00" stroke-width="6"/><line x1="65" y1="10" x2="15" y2="40" stroke="#f00" stroke-width="6"/></svg>`
};

// Siege mission state
let siegeMission = {
  active: false,
  endTime: 0,
  reward: 0,
  weaponType: "",
  weaponsSent: 0,
};

// Scientist data
const scientists = {
  count: 0,
  baseCost: 1000,
  costMultiplier: 1.2,
};

// Simple audio/visual feedback for purchases
const purchaseAudio = new Audio("sounds/ka-ching.mp3");

function playPurchaseSound() {
  purchaseAudio.currentTime = 0;
  purchaseAudio.play();
}

function flashElement(el) {
  if (!el) return;
  el.classList.add("purchase-flash");
  setTimeout(() => el.classList.remove("purchase-flash"), 500);
}

// Initialize weapon inventory with zero counts for each factory
function initInventory() {
  for (const ageKey in ages) {
    const age = ages[ageKey];
    for (const key in age.factories) {
      if (weaponInventory[key] === undefined) {
        weaponInventory[key] = 0;
      }
    }
  }
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
 * Determine the effective WPM for a factory with milestone bonuses.
 * Every 25 factories owned doubles the base WPM.
 */
function getEffectiveWpm(factory) {
  const milestones = Math.floor(factory.owned / 25);
  return factory.baseWpm * Math.pow(2, milestones);
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
    // Display production in weapons per hour (wph)
    const wph = factory.baseWpm * 60;
    const effectiveWph = getEffectiveWpm(factory) * 60;
    const output = factory.owned > 0 ? factory.owned * effectiveWph : wph;
    div.setAttribute(
      "title",
      `Each ${factory.name} factory produces ${wph.toLocaleString()} weapons/hr. Every 25 owned doubles output.`
    );
    div.innerHTML = `
      <h3>${factory.name}</h3>
      <p id="${ageKey}-${key}-info">${factory.owned} owned — +${output.toLocaleString()} weapons/hr${factory.owned === 0 ? " each" : ""}</p>
      <button id="buy-${ageKey}-${key}">Buy ($${cost.toLocaleString()})</button>
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
      const buyBtn = document.getElementById(`buy-${ageKey}-${key}`);
      const card = document.getElementById(`${ageKey}-${key}-card`);

      const effectiveWpm = getEffectiveWpm(f);
      const effectiveWph = effectiveWpm * 60;
      const baseWph = f.baseWpm * 60;
      const rate = f.owned > 0 ? f.owned * effectiveWph : baseWph;
      if (info) {
        info.textContent = `${f.owned} owned — +${rate.toLocaleString()} weapons/hr${f.owned === 0 ? ' each' : ''}`;
      }

      if (buyBtn) {
        buyBtn.textContent = `Buy ($${getFactoryCost(f).toLocaleString()})`;
      }

      if (card) {
        const remainder = f.owned % 25;
        const nextBonus = remainder === 0 ? 25 : 25 - remainder;
        card.title = `Each ${f.name} factory produces ${effectiveWph.toLocaleString()} weapons/hr. ${f.owned} owned. ${nextBonus} until next bonus.`;
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
    updateUI();
    playPurchaseSound();
    flashElement(cardElement);
  }
}

/**
 * Calculate total income per second from all unlocked ages.
 */
function calculateWeaponProductionPerSecond() {
  const wps = {};
  for (const ageKey in ages) {
    if (!agesUnlocked[ageKey]) continue;
    const age = ages[ageKey];
    for (const key in age.factories) {
      const f = age.factories[key];
      const amount = (f.owned * getEffectiveWpm(f)) / 60;
      wps[key] = (wps[key] || 0) + amount;
    }
  }
  return wps;
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

// Update weapon inventory display
function updateInventoryUI() {
  const list = document.getElementById("weaponInventory");
  if (!list) return;
  list.innerHTML = "";
  for (const key in weaponInventory) {
    const li = document.createElement("li");
    li.textContent = `${getFactoryNameByKey(key)}: ${Math.floor(weaponInventory[key]).toLocaleString()}`;
    list.appendChild(li);
  }
  populateWeaponOptions();
}

// Update siege mission UI
function updateSiegeUI() {
  const status = document.getElementById("siegeStatus");
  const controls = document.getElementById("siegeControls");
  if (!status || !controls) return;
  if (siegeMission.active) {
    controls.style.display = "none";
    const remaining = Math.max(0, siegeMission.endTime - Date.now());
    const hrs = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    status.textContent = `Siege in progress: ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    controls.style.display = "block";
    status.textContent = "No siege in progress.";
  }
}

// Populate weapon dropdown for siege mission
function populateWeaponOptions() {
  const select = document.getElementById("siegeWeaponSelect");
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  for (const key in weaponInventory) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getFactoryNameByKey(key);
    select.appendChild(option);
  }
  if (weaponInventory[current] !== undefined) {
    select.value = current;
  }
}

function getFactoryNameByKey(key) {
  for (const ageKey in ages) {
    const f = ages[ageKey].factories;
    if (f[key]) return f[key].name;
  }
  return key;
}

// Start a siege mission
function startSiegeMission() {
  const select = document.getElementById("siegeWeaponSelect");
  const amountInput = document.getElementById("siegeWeaponAmount");
  const type = select.value;
  const amount = parseInt(amountInput.value, 10);
  if (!type || isNaN(amount) || amount <= 0) return;
  if ((weaponInventory[type] || 0) < amount) {
    alert("Not enough weapons for this siege.");
    return;
  }
  weaponInventory[type] -= amount;
  const reward = amount * 10;
  siegeMission = {
    active: true,
    endTime: Date.now() + 14 * 60 * 60 * 1000,
    reward,
    weaponType: type,
    weaponsSent: amount,
  };
  updateSiegeUI();
}

function showRaidModal() {
  const modal = document.getElementById("raidModal");
  if (modal) {
    modal.style.display = "flex";
    populateRaidLoadout();
    const resultDiv = document.getElementById("raidResult");
    if (resultDiv) resultDiv.innerHTML = "";
    const svg = document.getElementById("battlefield");
    if (svg) svg.innerHTML = "";
    const loadout = document.getElementById("raidLoadout");
    const sendBtn = document.getElementById("sendRaid");
    if (loadout) loadout.style.display = "block";
    if (sendBtn) sendBtn.style.display = "inline-block";
  }
}

function closeRaidModal() {
  const modal = document.getElementById("raidModal");
  if (modal) modal.style.display = "none";
}

function populateRaidLoadout() {
  const container = document.getElementById("raidLoadout");
  if (!container) return;
  container.innerHTML = "";
  for (const key in weaponInventory) {
    const div = document.createElement("div");
    const available = Math.floor(weaponInventory[key]);
    const label = document.createElement("label");
    label.textContent = `${getFactoryNameByKey(key)} (${available} available):`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = 0;
    input.max = available;
    input.id = `raid_${key}`;
    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  }
}

// Generate a random enemy based on player army size
function generateEnemy(playerTotal, tier) {
  const candidates = enemyTypes.filter((t) => t.tier === tier);
  const type = candidates[Math.floor(Math.random() * candidates.length)];
  const ratio = 0.6 + Math.random() * 0.6; // 60% to 120%
  const total = Math.max(1, Math.floor(playerTotal * ratio));
  const army = {};
  const weaponKeys = Object.keys(weaponStats).filter((k) => weaponTiers[k] === tier);
  for (let i = 0; i < total; i++) {
    const w = weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
    army[w] = (army[w] || 0) + 1;
  }
  return { type, army, total };
}

function calcArmyStats(army, effectiveness = {}) {
  let power = 0;
  let total = 0;
  for (const key in army) {
    const count = army[key];
    const stats = weaponStats[key];
    const eff = effectiveness[key] || 1;
    power += count * (stats.attack + stats.defense * 0.5 + stats.range * 0.3) * eff;
    total += count;
  }
  return { power, total };
}

function simulateBattle(playerArmy, enemy) {
  const playerStats = calcArmyStats(playerArmy);
  const enemyStats = calcArmyStats(enemy.army, enemy.type.weaponEffectiveness);
  const playerPower = playerStats.power * (0.9 + Math.random() * 0.2);
  const enemyPower = enemyStats.power * (0.9 + Math.random() * 0.2);
  const playerWin = playerPower >= enemyPower;
  const totalPower = playerPower + enemyPower;
  const playerCasualties = Math.min(playerStats.total, Math.floor((enemyPower / totalPower) * playerStats.total));
  const enemyCasualties = Math.min(enemyStats.total, Math.floor((playerPower / totalPower) * enemyStats.total));
  const victoryScale = Math.abs(playerPower - enemyPower) / Math.max(playerPower, enemyPower);
  const baseReward = 10 * enemyStats.total;
  const reward = playerWin ? Math.floor(baseReward * enemy.type.wealth * (1 + victoryScale)) : 0;
  return { playerWin, playerCasualties, enemyCasualties, reward, enemyType: enemy.type.name, enemyTotal: enemyStats.total };
}

function startRaid() {
  const army = {};
  let total = 0;
  for (const key in weaponInventory) {
    const input = document.getElementById(`raid_${key}`);
    if (!input) continue;
    const val = parseInt(input.value, 10) || 0;
    if (val > 0) {
      if (val > weaponInventory[key]) {
        alert("Not enough weapons for this raid.");
        return;
      }
      army[key] = val;
      total += val;
    }
  }
  if (total === 0) {
    alert("Select weapons to send on the raid.");
    return;
  }
  // Determine highest tech tier used by the player
  let playerTier = "stone";
  for (const key in army) {
    const tier = weaponTiers[key] || "stone";
    if (tier === "iron") playerTier = "iron";
    else if (tier === "bronze" && playerTier === "stone") playerTier = "bronze";
  }
  // Deduct weapons sent on the raid
  for (const key in army) {
    weaponInventory[key] -= army[key];
  }
  const enemy = generateEnemy(total, playerTier);
  const result = simulateBattle(army, enemy);
  // Return surviving weapons exactly distributed
  const survivors = total - result.playerCasualties;
  if (survivors > 0) {
    const keys = Object.keys(army);
    const survivorDist = {};
    let remaining = survivors;
    keys.forEach((key) => {
      const survive = Math.floor((army[key] / total) * survivors);
      survivorDist[key] = survive;
      remaining -= survive;
    });
    let idx = 0;
    while (remaining > 0) {
      const key = keys[idx % keys.length];
      survivorDist[key] += 1;
      remaining--;
      idx++;
    }
    for (const key of keys) {
      weaponInventory[key] = (weaponInventory[key] || 0) + survivorDist[key];
    }
  }
  if (result.playerWin) {
    gameState.money += result.reward;
  }
  updateUI();
  const loadout = document.getElementById("raidLoadout");
  const sendBtn = document.getElementById("sendRaid");
  const output = document.getElementById("raidResult");
  if (loadout) loadout.style.display = "none";
  if (sendBtn) sendBtn.style.display = "none";
  if (output) output.innerHTML = "";
  renderBattlefield(total, result.playerCasualties, result.enemyTotal, result.enemyCasualties, () => {
    showRaidResult(result, total, enemy);
  });
}

function showRaidResult(result, playerTotal, enemy) {
  const output = document.getElementById("raidResult");
  if (!output) return;
  const outcome = getOutcomeType(result, playerTotal);
  output.innerHTML = `<div class="battle-result ${result.playerWin ? "victory" : "defeat"}">` +
    `${outcomeSVGs[outcome]}` +
    `<h3>${result.playerWin ? "Victory" : "Defeat"}</h3>` +
    `<p>Enemy: ${result.enemyType}</p>` +
    `<p>Reward: $${result.reward}</p>` +
    `<p>Your losses: ${result.playerCasualties} / ${playerTotal}</p>` +
    `<p>Enemy losses: ${result.enemyCasualties} / ${result.enemyTotal}</p>` +
    `</div>`;
  const loadout = document.getElementById("raidLoadout");
  const sendBtn = document.getElementById("sendRaid");
  if (loadout) loadout.style.display = "block";
  if (sendBtn) sendBtn.style.display = "inline-block";
  populateRaidLoadout();
}

function renderBattlefield(playerTotal, playerCas, enemyTotal, enemyCas, callback) {
  const svg = document.getElementById("battlefield");
  if (!svg) return;
  svg.innerHTML = "";
  const duration = 5000;

  // Background
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", 0);
  bg.setAttribute("y", 0);
  bg.setAttribute("width", 400);
  bg.setAttribute("height", 100);
  bg.setAttribute("fill", "#253422");
  svg.appendChild(bg);

  const playerDisplay = Math.min(10, playerTotal);
  const enemyDisplay = Math.min(10, enemyTotal);
  const playerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const enemyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(playerGroup);
  svg.appendChild(enemyGroup);

  for (let i = 0; i < playerDisplay; i++) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const y = 20 + (i % 5) * 15;
    c.setAttribute("cx", 40 + Math.floor(i / 5) * 10);
    c.setAttribute("cy", y);
    c.setAttribute("r", 5);
    c.setAttribute("class", "soldier player");
    const anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    anim.setAttribute("attributeName", "cx");
    anim.setAttribute("from", c.getAttribute("cx"));
    anim.setAttribute("to", 200 - Math.floor(i / 5) * 10);
    anim.setAttribute("dur", `${duration}ms`);
    anim.setAttribute("fill", "freeze");
    c.appendChild(anim);
    playerGroup.appendChild(c);
    anim.beginElement();
  }

  for (let i = 0; i < enemyDisplay; i++) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const y = 80 - (i % 5) * 15;
    c.setAttribute("cx", 360 - Math.floor(i / 5) * 10);
    c.setAttribute("cy", y);
    c.setAttribute("r", 5);
    c.setAttribute("class", "soldier enemy");
    const anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    anim.setAttribute("attributeName", "cx");
    anim.setAttribute("from", c.getAttribute("cx"));
    anim.setAttribute("to", 200 + Math.floor(i / 5) * 10);
    anim.setAttribute("dur", `${duration}ms`);
    anim.setAttribute("fill", "freeze");
    c.appendChild(anim);
    enemyGroup.appendChild(c);
    anim.beginElement();
  }

  // After movement, fade out casualties
  setTimeout(() => {
    const pLoss = Math.round((playerCas / playerTotal) * playerDisplay);
    const eLoss = Math.round((enemyCas / enemyTotal) * enemyDisplay);
    const pSoldiers = Array.from(playerGroup.children);
    const eSoldiers = Array.from(enemyGroup.children);
    for (let i = 0; i < pLoss && i < pSoldiers.length; i++) {
      pSoldiers[i].setAttribute("fill", "#555");
    }
    for (let i = 0; i < eLoss && i < eSoldiers.length; i++) {
      eSoldiers[i].setAttribute("fill", "#555");
    }
    if (callback) callback();
  }, duration);
}

function getOutcomeType(result, playerTotal) {
  const playerRatio = result.playerCasualties / playerTotal;
  const enemyRatio = result.enemyCasualties / result.enemyTotal;
  if (result.playerWin) {
    if (playerRatio <= 0.1 && enemyRatio >= 0.9) return "completeVictory";
    return "victory";
  }
  if (playerRatio >= 0.9 && enemyRatio <= 0.1) return "completeLoss";
  return "loss";
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
    weaponInventory,
    siegeMission,
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
    weaponInventory = data.weaponInventory || {};
    siegeMission = data.siegeMission || { active: false, endTime: 0, reward: 0, weaponType: "", weaponsSent: 0 };
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

  const production = calculateWeaponProductionPerSecond();
  for (const key in production) {
    weaponInventory[key] += production[key] * elapsed;
  }

  // Resolve siege mission rewards
  if (siegeMission.active && now >= siegeMission.endTime) {
    gameState.money += siegeMission.reward;
    siegeMission.active = false;
  }

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
  updateInventoryUI();
  updateSiegeUI();
}

// ***** INITIALIZATION *****
window.addEventListener("DOMContentLoaded", () => {
  loadGame();
  initInventory();
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
  const startSiegeBtn = document.getElementById("startSiege");
  if (startSiegeBtn) startSiegeBtn.addEventListener("click", startSiegeMission);
  const raidBtn = document.getElementById("raidButton");
  if (raidBtn) raidBtn.addEventListener("click", showRaidModal);
  const closeRaidBtn = document.getElementById("closeRaid");
  if (closeRaidBtn) closeRaidBtn.addEventListener("click", closeRaidModal);
  const sendRaidBtn = document.getElementById("sendRaid");
  if (sendRaidBtn) sendRaidBtn.addEventListener("click", startRaid);

  // Start loops
  setInterval(gameLoop, 1000);
  setInterval(saveGame, 300000);
});
