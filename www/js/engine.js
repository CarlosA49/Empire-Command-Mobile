import {
  AGES,
  BUILDINGS,
  DIFFICULTIES,
  FACTION_TEMPLATES,
  MAP_SIZES,
  PRODUCTION_ITEMS,
  RESOURCES,
  TECHS,
  TERRAIN,
  UNITS
} from './data.js';

export const SAVE_VERSION = 1;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tileHash(x, y, seed) {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export class SeededRandom {
  constructor(seed = Date.now()) {
    this.state = hashString(seed) || 0x6d2b79f5;
  }

  next() {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(minimum, maximum) {
    return Math.floor(this.next() * (maximum - minimum + 1)) + minimum;
  }

  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
}

export class GameEngine {
  constructor() {
    this.state = null;
    this.random = new SeededRandom();
  }

  newGame(options = {}) {
    const sizeKey = MAP_SIZES[options.mapSize] ? options.mapSize : 'standard';
    const difficultyKey = DIFFICULTIES[options.difficulty] ? options.difficulty : 'sovereign';
    const dimensions = MAP_SIZES[sizeKey];
    const seed = String(options.seed || Math.floor(Date.now() / 1000));
    this.random = new SeededRandom(seed);
    this.state = {
      version: SAVE_VERSION,
      seed,
      rngState: this.random.state,
      mapSize: sizeKey,
      difficulty: difficultyKey,
      cols: dimensions.cols,
      rows: dimensions.rows,
      turn: 1,
      age: 0,
      nextId: 1,
      playerId: 0,
      winner: null,
      gameOver: false,
      tiles: [],
      factions: [],
      cities: [],
      units: [],
      log: [],
      cheats: {
        enabled: false,
        revealMap: false,
        infiniteMovement: false,
        godMode: false,
        oneHit: false
      }
    };

    this.generateMap();
    this.createFactions();
    this.placeStartingEmpires();
    for (const faction of this.state.factions) this.recomputeVisibility(faction.id);
    this.log(`The ${AGES[0].name} begins. Guide the Auroran League to greatness.`, 'age');
    this.commitRandom();
    return this.state;
  }

  commitRandom() {
    if (this.state) this.state.rngState = this.random.state >>> 0;
  }

  generateMap() {
    const { cols, rows } = this.state;
    const seed = hashString(this.state.seed);
    const tiles = [];
    for (let r = 0; r < rows; r += 1) {
      for (let q = 0; q < cols; q += 1) {
        const edgeDistance = Math.min(q, cols - q - 1, r, rows - r - 1);
        const edgePenalty = edgeDistance === 0 ? 0.23 : edgeDistance === 1 ? 0.08 : 0;
        const broad = (
          tileHash(Math.floor(q / 3), Math.floor(r / 3), seed) +
          tileHash(Math.floor((q + 2) / 3), Math.floor((r + 1) / 3), seed ^ 0xa511e9b3)
        ) / 2;
        const detail = tileHash(q, r, seed ^ 0x9e3779b9);
        const elevation = broad * 0.72 + detail * 0.28 - edgePenalty;
        const moisture = tileHash(q + 91, r - 37, seed ^ 0x85ebca6b);
        let terrain = 'grass';
        if (elevation < 0.29) terrain = 'ocean';
        else if (elevation < 0.36) terrain = 'coast';
        else if (elevation > 0.84) terrain = 'mountain';
        else if (elevation > 0.71) terrain = 'hills';
        else if (moisture < 0.23) terrain = 'desert';
        else if (moisture > 0.7) terrain = 'forest';
        else if (moisture < 0.43) terrain = 'plains';

        let resource = null;
        const resourceRoll = tileHash(q - 20, r + 50, seed ^ 0xc2b2ae35);
        if (resourceRoll > 0.86) {
          if (terrain === 'coast') resource = 'fish';
          else if (terrain === 'hills' || terrain === 'mountain') resource = resourceRoll > 0.94 ? 'gems' : 'iron';
          else if (terrain === 'grass' || terrain === 'plains') resource = resourceRoll > 0.94 ? 'horses' : 'wheat';
          else if (terrain === 'desert') resource = 'relics';
        }
        tiles.push({ q, r, terrain, resource, owner: null, cityId: null, improvement: null, discovered: [], visible: [] });
      }
    }
    this.state.tiles = tiles;
  }

  createFactions() {
    this.state.factions = FACTION_TEMPLATES.map((template, id) => ({
      id,
      ...template,
      human: id === 0,
      alive: true,
      gold: id === 0 ? 120 : 100,
      science: 0,
      culture: 0,
      influence: 25,
      completedTechs: [],
      activeTech: id === 0 ? null : id % 2 ? 'animal_husbandry' : 'pottery',
      cityNameIndex: 1,
      score: 0
    }));
  }

  placeStartingEmpires() {
    const { cols, rows } = this.state;
    const starts = [
      { q: 2, r: 2 },
      { q: cols - 3, r: rows - 3 },
      { q: cols - 3, r: 2 },
      { q: 2, r: rows - 3 }
    ];
    starts.forEach((start, owner) => {
      this.prepareStart(start.q, start.r);
      const faction = this.faction(owner);
      this.createCity(owner, start.q, start.r, faction.capital, true);
      const open = this.neighbors(start.q, start.r).filter(tile => this.isLand(tile));
      this.createUnit(owner, 'warrior', open[0]?.q ?? start.q, open[0]?.r ?? start.r);
      this.createUnit(owner, 'scout', open[1]?.q ?? start.q, open[1]?.r ?? start.r);
      if (owner === 0 || this.state.mapSize !== 'compact') {
        this.createUnit(owner, 'settler', open[2]?.q ?? start.q, open[2]?.r ?? start.r);
      }
    });
  }

  prepareStart(q, r) {
    for (const tile of this.tilesWithin(q, r, 2)) {
      if (this.distance(q, r, tile.q, tile.r) <= 1 || !this.isLand(tile)) {
        tile.terrain = this.distance(q, r, tile.q, tile.r) === 0 ? 'grass' : (tileHash(tile.q, tile.r, hashString(this.state.seed)) > 0.5 ? 'plains' : 'forest');
      }
    }
  }

  nextId(prefix) {
    const id = `${prefix}-${this.state.nextId}`;
    this.state.nextId += 1;
    return id;
  }

  createCity(owner, q, r, name = null, capital = false) {
    const faction = this.faction(owner);
    const city = {
      id: this.nextId('city'),
      owner,
      name: name || faction.cities[faction.cityNameIndex++ % faction.cities.length],
      q,
      r,
      capital,
      population: 1,
      hp: 200,
      maxHp: 200,
      foodStored: 0,
      productionProgress: 0,
      productionItem: capital ? 'unit:warrior' : 'building:monument',
      buildings: capital ? ['monument'] : []
    };
    this.state.cities.push(city);
    const center = this.tile(q, r);
    center.cityId = city.id;
    center.owner = owner;
    for (const tile of this.tilesWithin(q, r, 1)) {
      if (tile.owner === null || tile.owner === owner) tile.owner = owner;
    }
    this.log(`${faction.name} founded ${city.name}.`, owner === this.state.playerId ? 'good' : 'world');
    return city;
  }

  createUnit(owner, type, q, r) {
    const definition = UNITS[type];
    if (!definition || !this.tile(q, r)) return null;
    const unit = {
      id: this.nextId('unit'),
      owner,
      type,
      q,
      r,
      hp: definition.maxHp,
      movement: definition.movement,
      fortified: false,
      veteran: 0
    };
    this.state.units.push(unit);
    this.revealAround(owner, q, r, definition.vision);
    return unit;
  }

  tile(q, r) {
    if (q < 0 || r < 0 || q >= this.state.cols || r >= this.state.rows) return null;
    return this.state.tiles[r * this.state.cols + q] || null;
  }

  faction(id) {
    return this.state.factions.find(faction => faction.id === Number(id)) || null;
  }

  city(id) {
    return this.state.cities.find(city => city.id === id) || null;
  }

  unit(id) {
    return this.state.units.find(unit => unit.id === id) || null;
  }

  unitAt(q, r) {
    return this.state.units.find(unit => unit.q === q && unit.r === r) || null;
  }

  cityAt(q, r) {
    const tile = this.tile(q, r);
    return tile?.cityId ? this.city(tile.cityId) : null;
  }

  neighbors(q, r) {
    const odd = r & 1;
    const offsets = odd
      ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
      : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return offsets.map(([dq, dr]) => this.tile(q + dq, r + dr)).filter(Boolean);
  }

  offsetToCube(q, r) {
    const x = q - (r - (r & 1)) / 2;
    const z = r;
    return { x, y: -x - z, z };
  }

  distance(q1, r1, q2, r2) {
    const a = this.offsetToCube(q1, r1);
    const b = this.offsetToCube(q2, r2);
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
  }

  tilesWithin(q, r, radius) {
    return this.state.tiles.filter(tile => this.distance(q, r, tile.q, tile.r) <= radius);
  }

  isLand(tile) {
    return tile && !['ocean', 'coast', 'mountain'].includes(tile.terrain);
  }

  canEnter(unit, tile) {
    if (!tile || tile.terrain === 'mountain' || tile.terrain === 'ocean') return false;
    if (tile.terrain === 'coast') {
      return !UNITS[unit.type].civilian && this.faction(unit.owner).completedTechs.includes('navigation');
    }
    return true;
  }

  revealAround(owner, q, r, radius) {
    for (const tile of this.tilesWithin(q, r, radius)) {
      if (!tile.discovered.includes(owner)) tile.discovered.push(owner);
      if (!tile.visible.includes(owner)) tile.visible.push(owner);
    }
  }

  recomputeVisibility(owner) {
    for (const tile of this.state.tiles) tile.visible = tile.visible.filter(id => id !== owner);
    for (const city of this.state.cities.filter(item => item.owner === owner)) this.revealAround(owner, city.q, city.r, 2);
    for (const unit of this.state.units.filter(item => item.owner === owner)) this.revealAround(owner, unit.q, unit.r, UNITS[unit.type].vision);
  }

  moveUnit(unitId, q, r, actorId = this.state.playerId) {
    if (this.state.gameOver) return { ok: false, message: 'The campaign has ended.' };
    const unit = this.unit(unitId);
    const target = this.tile(q, r);
    if (!unit || unit.owner !== actorId) return { ok: false, message: 'That unit is not under your command.' };
    if (unit.movement <= 0) return { ok: false, message: 'This unit has no movement remaining.' };
    if (this.distance(unit.q, unit.r, q, r) !== 1) return { ok: false, message: 'Choose an adjacent hex.' };
    if (!this.canEnter(unit, target)) return { ok: false, message: `${TERRAIN[target?.terrain]?.name || 'That terrain'} is impassable.` };

    const defender = this.unitAt(q, r);
    if (defender) {
      if (defender.owner === unit.owner) return { ok: false, message: 'Another friendly unit occupies that hex.' };
      if (UNITS[unit.type].civilian) return { ok: false, message: 'Civilian units cannot attack.' };
      return this.attackUnit(unit, defender);
    }
    const city = this.cityAt(q, r);
    if (city && city.owner !== unit.owner) {
      if (UNITS[unit.type].civilian) return { ok: false, message: 'Civilian units cannot attack cities.' };
      return this.attackCity(unit, city);
    }

    unit.q = q;
    unit.r = r;
    unit.fortified = false;
    if (!(unit.owner === this.state.playerId && this.state.cheats.infiniteMovement)) unit.movement -= 1;
    this.revealAround(unit.owner, q, r, UNITS[unit.type].vision);
    return { ok: true, message: `${UNITS[unit.type].name} moved.` };
  }

  attackUnit(attacker, defender) {
    const difficulty = DIFFICULTIES[this.state.difficulty];
    let attackStrength = UNITS[attacker.type].strength * (1 + attacker.veteran * 0.08);
    let defenseStrength = UNITS[defender.type].strength * (defender.fortified ? 1.22 : 1);
    if (attacker.owner !== this.state.playerId) attackStrength *= difficulty.aiStrength;
    if (defender.owner !== this.state.playerId) defenseStrength *= difficulty.aiStrength;
    let damage = clamp(Math.round(22 + (attackStrength - defenseStrength) * 1.15 + this.random.integer(-5, 6)), 8, 82);
    let retaliation = UNITS[attacker.type].range > 1 ? 0 : clamp(Math.round(13 + (defenseStrength - attackStrength) * 0.55 + this.random.integer(-3, 4)), 4, 42);
    if (attacker.owner === this.state.playerId && this.state.cheats.oneHit) damage = defender.hp;
    if (defender.owner === this.state.playerId && this.state.cheats.godMode) damage = 0;
    if (attacker.owner === this.state.playerId && this.state.cheats.godMode) retaliation = 0;
    defender.hp -= damage;
    attacker.hp -= retaliation;
    attacker.movement = attacker.owner === this.state.playerId && this.state.cheats.infiniteMovement ? attacker.movement : Math.max(0, attacker.movement - 1);
    const defenderName = UNITS[defender.type].name;
    if (defender.hp <= 0) {
      this.removeUnit(defender.id);
      attacker.veteran = Math.min(3, attacker.veteran + 1);
      this.log(`${UNITS[attacker.type].name} defeated an enemy ${defenderName}.`, attacker.owner === 0 ? 'good' : 'danger');
    }
    if (attacker.hp <= 0) this.removeUnit(attacker.id);
    this.commitRandom();
    this.checkVictory();
    return { ok: true, message: `Combat: ${damage} damage dealt${retaliation ? `, ${retaliation} received` : ''}.` };
  }

  attackCity(attacker, city) {
    const difficulty = DIFFICULTIES[this.state.difficulty];
    let strength = UNITS[attacker.type].strength * (attacker.owner === 0 ? 1 : difficulty.aiStrength);
    let damage = clamp(Math.round(strength * 1.35 + this.random.integer(-4, 8)), 12, 75);
    let retaliation = clamp(Math.round(25 - strength * 0.25), 7, 24);
    if (attacker.owner === 0 && this.state.cheats.oneHit) damage = city.hp;
    if (city.owner === 0 && this.state.cheats.godMode) damage = 0;
    if (attacker.owner === 0 && this.state.cheats.godMode) retaliation = 0;
    city.hp -= damage;
    attacker.hp -= retaliation;
    attacker.movement = attacker.owner === 0 && this.state.cheats.infiniteMovement ? attacker.movement : Math.max(0, attacker.movement - 1);
    if (city.hp <= 0 && attacker.hp > 0) {
      const formerOwner = city.owner;
      city.owner = attacker.owner;
      city.hp = Math.round(city.maxHp * 0.45);
      city.capital = false;
      for (const tile of this.tilesWithin(city.q, city.r, 1)) {
        if (tile.owner === formerOwner) tile.owner = attacker.owner;
      }
      this.log(`${this.faction(attacker.owner).name} captured ${city.name}!`, attacker.owner === 0 ? 'good' : 'danger');
    } else if (city.hp <= 0) {
      city.hp = 1;
    }
    if (attacker.hp <= 0) this.removeUnit(attacker.id);
    this.commitRandom();
    this.checkVictory();
    return { ok: true, message: `${city.name} took ${damage} damage.` };
  }

  removeUnit(unitId) {
    this.state.units = this.state.units.filter(unit => unit.id !== unitId);
  }

  fortifyUnit(unitId) {
    const unit = this.unit(unitId);
    if (!unit || unit.owner !== this.state.playerId || UNITS[unit.type].civilian) return { ok: false, message: 'That unit cannot fortify.' };
    unit.fortified = true;
    unit.movement = 0;
    return { ok: true, message: `${UNITS[unit.type].name} fortified and will heal next turn.` };
  }

  foundCity(unitId) {
    const unit = this.unit(unitId);
    if (!unit || unit.owner !== this.state.playerId || unit.type !== 'settler') return { ok: false, message: 'Select one of your Settlers.' };
    const site = this.tile(unit.q, unit.r);
    if (!this.isLand(site)) return { ok: false, message: 'Cities need a land hex.' };
    if (site.owner !== null && site.owner !== unit.owner) return { ok: false, message: 'You cannot found a city in rival territory.' };
    const nearest = this.state.cities.reduce((minimum, city) => Math.min(minimum, this.distance(unit.q, unit.r, city.q, city.r)), Infinity);
    if (nearest < 3) return { ok: false, message: 'Found at least three hexes from another city.' };
    const city = this.createCity(unit.owner, unit.q, unit.r);
    this.removeUnit(unit.id);
    this.recomputeVisibility(unit.owner);
    return { ok: true, message: `${city.name} was founded.` };
  }

  availableTechs(factionId = this.state.playerId) {
    const faction = this.faction(factionId);
    return TECHS.filter(tech => !faction.completedTechs.includes(tech.id) && tech.requires.every(required => faction.completedTechs.includes(required)));
  }

  chooseResearch(techId, factionId = this.state.playerId) {
    const faction = this.faction(factionId);
    const tech = TECHS.find(item => item.id === techId);
    if (!faction || !tech || !this.availableTechs(factionId).some(item => item.id === techId)) {
      return { ok: false, message: 'That technology is not available yet.' };
    }
    faction.activeTech = techId;
    return { ok: true, message: `Research begun: ${tech.name}.` };
  }

  availableProduction(cityId) {
    const city = this.city(cityId);
    if (!city) return [];
    const faction = this.faction(city.owner);
    return Object.entries(PRODUCTION_ITEMS)
      .filter(([, item]) => !item.requires || faction.completedTechs.includes(item.requires))
      .filter(([, item]) => item.type !== 'building' || !city.buildings.includes(item.id))
      .map(([key, item]) => ({ key, ...item }));
  }

  queueProduction(cityId, itemKey) {
    const city = this.city(cityId);
    if (!city || city.owner !== this.state.playerId) return { ok: false, message: 'Select one of your cities.' };
    if (!this.availableProduction(cityId).some(item => item.key === itemKey)) return { ok: false, message: 'That project is unavailable.' };
    city.productionItem = itemKey;
    city.productionProgress = 0;
    return { ok: true, message: `${city.name} started ${PRODUCTION_ITEMS[itemKey].name}.` };
  }

  cityYields(city) {
    const totals = { food: 0, production: 0, gold: 0, science: 1, culture: 1 };
    const workable = this.tilesWithin(city.q, city.r, 1)
      .filter(tile => tile.owner === city.owner)
      .sort((a, b) => {
        const ay = TERRAIN[a.terrain].food + TERRAIN[a.terrain].production + (a.resource ? 2 : 0);
        const by = TERRAIN[b.terrain].food + TERRAIN[b.terrain].production + (b.resource ? 2 : 0);
        return by - ay;
      })
      .slice(0, city.population + 1);
    for (const tile of workable) {
      const base = TERRAIN[tile.terrain];
      totals.food += base.food;
      totals.production += base.production;
      totals.gold += base.gold;
      totals.science += base.science;
      if (tile.resource) {
        const resource = RESOURCES[tile.resource];
        totals.food += resource.food;
        totals.production += resource.production;
        totals.gold += resource.gold;
        totals.science += resource.science;
      }
    }
    for (const buildingId of city.buildings) {
      const building = BUILDINGS[buildingId];
      for (const [yieldType, amount] of Object.entries(building?.yields || {})) totals[yieldType] += amount;
    }
    if (this.faction(city.owner).completedTechs.includes('industrialization')) totals.production += Math.ceil(city.buildings.length * 1.5);
    return totals;
  }

  processFaction(factionId) {
    const faction = this.faction(factionId);
    const modifier = factionId === this.state.playerId ? 1 : DIFFICULTIES[this.state.difficulty].aiYield;
    for (const city of this.state.cities.filter(item => item.owner === factionId)) {
      const yields = this.cityYields(city);
      faction.gold += Math.round(yields.gold * modifier);
      faction.science += Math.round(yields.science * modifier);
      faction.culture += Math.round(yields.culture * modifier);
      faction.influence += Math.max(1, Math.round(city.population * 0.5 * modifier));
      city.foodStored += Math.round(Math.max(1, yields.food - city.population * 2) * modifier);
      city.productionProgress += Math.round(yields.production * modifier);
      city.hp = Math.min(city.maxHp, city.hp + 12);
      const growthCost = 12 + city.population * 8;
      if (city.foodStored >= growthCost) {
        city.foodStored -= growthCost;
        city.population += 1;
        this.claimCityTile(city);
        this.log(`${city.name} grew to ${city.population} population.`, factionId === 0 ? 'good' : 'world');
      }
      this.resolveProduction(city);
    }
    this.resolveResearch(faction);
    faction.score = this.calculateScore(faction.id);
  }

  claimCityTile(city) {
    const candidates = this.tilesWithin(city.q, city.r, 2).filter(tile => tile.owner === null && tile.terrain !== 'ocean');
    if (candidates.length) this.random.pick(candidates).owner = city.owner;
  }

  resolveProduction(city) {
    if (!city.productionItem) return { ok: false, reason: 'empty' };
    const item = PRODUCTION_ITEMS[city.productionItem];
    if (!item || city.productionProgress < item.cost) return { ok: false, reason: 'incomplete' };
    city.productionProgress -= item.cost;
    if (item.type === 'building') {
      if (!city.buildings.includes(item.id)) city.buildings.push(item.id);
      this.log(`${city.name} completed a ${item.name}.`, city.owner === 0 ? 'good' : 'world');
    } else {
      const spawn = this.findOpenTile(city.q, city.r);
      if (spawn) {
        this.createUnit(city.owner, item.id, spawn.q, spawn.r);
        this.log(`${city.name} trained a ${item.name}.`, city.owner === 0 ? 'good' : 'world');
      } else {
        city.productionProgress = item.cost;
        return { ok: false, reason: 'blocked' };
      }
    }
    city.productionItem = null;
    return { ok: true, item };
  }

  resolveResearch(faction) {
    if (!faction.activeTech) return;
    const tech = TECHS.find(item => item.id === faction.activeTech);
    if (!tech || faction.science < tech.cost) return;
    faction.science -= tech.cost;
    faction.completedTechs.push(tech.id);
    faction.activeTech = null;
    this.log(`${faction.name} discovered ${tech.name}.`, faction.id === 0 ? 'good' : 'world');
    if (tech.id === 'future_flight') this.finishGame(faction.id, 'Science Victory');
  }

  findOpenTile(q, r, owner = null) {
    const candidates = [this.tile(q, r), ...this.neighbors(q, r), ...this.tilesWithin(q, r, 2)]
      .filter(Boolean)
      .filter(tile => this.isLand(tile) && !this.unitAt(tile.q, tile.r));
    return candidates.find(tile => owner === null || tile.owner === owner) || candidates[0] || null;
  }

  endTurn() {
    if (this.state.gameOver) return { ok: false, message: 'The campaign has ended.' };
    const player = this.faction(this.state.playerId);
    if (!player.activeTech && this.availableTechs(player.id).length) return { ok: false, needsResearch: true, message: 'Choose a technology before ending the turn.' };
    this.processFaction(player.id);
    for (const faction of this.state.factions.filter(item => item.id !== player.id && item.alive)) {
      if (!faction.activeTech) this.chooseAIResearch(faction);
      this.processFaction(faction.id);
      this.runAI(faction.id);
    }
    this.state.turn += 1;
    const nextAge = Math.min(2, Math.floor((this.state.turn - 1) / 25));
    if (nextAge !== this.state.age) {
      this.state.age = nextAge;
      this.log(`${AGES[nextAge].name} has begun — ${AGES[nextAge].subtitle}.`, 'age');
    }
    for (const unit of this.state.units) {
      unit.movement = UNITS[unit.type].movement;
      if (unit.fortified) unit.hp = Math.min(UNITS[unit.type].maxHp, unit.hp + 12);
    }
    for (const faction of this.state.factions) this.recomputeVisibility(faction.id);
    this.commitRandom();
    this.checkVictory();
    return { ok: true, message: `Turn ${this.state.turn} — ${AGES[this.state.age].name}.` };
  }

  chooseAIResearch(faction) {
    const choices = this.availableTechs(faction.id);
    if (choices.length) faction.activeTech = this.random.pick(choices).id;
  }

  runAI(factionId) {
    const faction = this.faction(factionId);
    for (const city of this.state.cities.filter(item => item.owner === factionId)) {
      if (!city.productionItem) {
        const choices = this.availableProduction(city.id).filter(item => item.type === 'unit' || city.buildings.length < 4);
        if (choices.length) city.productionItem = this.random.pick(choices).key;
      }
    }
    const units = this.state.units.filter(unit => unit.owner === factionId);
    for (const unit of units) {
      if (!this.unit(unit.id)) continue;
      if (unit.type === 'settler') {
        const nearest = this.state.cities.reduce((minimum, city) => Math.min(minimum, this.distance(unit.q, unit.r, city.q, city.r)), Infinity);
        const site = this.tile(unit.q, unit.r);
        if (nearest >= 4 && this.isLand(site) && (site.owner === null || site.owner === factionId)) {
          this.createCity(factionId, unit.q, unit.r);
          this.removeUnit(unit.id);
          continue;
        }
      }
      const targets = [
        ...this.state.cities.filter(city => city.owner !== factionId).map(city => ({ q: city.q, r: city.r })),
        ...this.state.units.filter(other => other.owner !== factionId && !UNITS[other.type].civilian).map(other => ({ q: other.q, r: other.r }))
      ];
      if (!targets.length) continue;
      const target = targets.sort((a, b) => this.distance(unit.q, unit.r, a.q, a.r) - this.distance(unit.q, unit.r, b.q, b.r))[0];
      const choices = this.neighbors(unit.q, unit.r)
        .filter(tile => this.canEnter(unit, tile))
        .filter(tile => {
          const occupant = this.unitAt(tile.q, tile.r);
          const city = this.cityAt(tile.q, tile.r);
          if (occupant?.owner === factionId) return false;
          if (UNITS[unit.type].civilian && (occupant || (city && city.owner !== factionId))) return false;
          return true;
        })
        .sort((a, b) => this.distance(a.q, a.r, target.q, target.r) - this.distance(b.q, b.r, target.q, target.r));
      if (choices.length && unit.movement > 0) this.moveUnit(unit.id, choices[0].q, choices[0].r, factionId);
    }
    faction.score = this.calculateScore(factionId);
  }

  calculateScore(factionId) {
    const faction = this.faction(factionId);
    const cities = this.state.cities.filter(city => city.owner === factionId);
    const population = cities.reduce((sum, city) => sum + city.population, 0);
    const buildings = cities.reduce((sum, city) => sum + city.buildings.length, 0);
    const units = this.state.units.filter(unit => unit.owner === factionId).length;
    return population * 12 + cities.length * 30 + buildings * 8 + units * 5 + faction.completedTechs.length * 14 + Math.floor(faction.culture / 10);
  }

  checkVictory() {
    if (this.state.gameOver) return;
    const playerId = this.state.playerId;
    const canRecover = factionId => this.state.cities.some(city => city.owner === factionId)
      || this.state.units.some(unit => unit.owner === factionId && unit.type === 'settler');
    for (const faction of this.state.factions) {
      faction.alive = canRecover(faction.id);
      faction.score = this.calculateScore(faction.id);
    }
    const rank = factions => [...factions].sort((a, b) => this.calculateScore(b.id) - this.calculateScore(a.id));
    const playerHasFutureFlight = this.faction(playerId).completedTechs.includes('future_flight');
    if (playerHasFutureFlight) return this.finishGame(playerId, 'Science Victory');
    const opponentsWithCities = this.state.cities.some(city => city.owner !== playerId);
    if (!opponentsWithCities) return this.finishGame(playerId, 'Domination Victory');
    if (!canRecover(playerId)) {
      const contenders = this.state.factions.filter(faction => faction.id !== playerId && canRecover(faction.id));
      const leader = rank(contenders)[0];
      return this.finishGame(leader.id, 'Conquest');
    }
    if (this.state.turn >= 80) {
      const leader = rank(this.state.factions.filter(faction => canRecover(faction.id)))[0];
      return this.finishGame(leader.id, 'Legacy Victory');
    }
  }

  finishGame(winnerId, victoryType) {
    this.state.winner = { factionId: winnerId, victoryType };
    this.state.gameOver = true;
    this.log(`${this.faction(winnerId).name} achieved a ${victoryType}!`, winnerId === 0 ? 'age' : 'danger');
  }

  applyCheat(action, payload = {}) {
    const player = this.faction(this.state.playerId);
    let message = '';
    switch (action) {
      case 'gold':
        player.gold += 100000;
        message = 'Granted 100,000 gold.';
        break;
      case 'influence':
        player.influence += 10000;
        message = 'Granted 10,000 influence.';
        break;
      case 'science':
        player.science += 100000;
        message = 'Granted 100,000 science.';
        break;
      case 'culture':
        player.culture += 100000;
        message = 'Granted 100,000 culture.';
        break;
      case 'heal':
        for (const unit of this.state.units.filter(unit => unit.owner === player.id)) unit.hp = UNITS[unit.type].maxHp;
        for (const city of this.state.cities.filter(city => city.owner === player.id)) city.hp = city.maxHp;
        message = 'All units and cities fully healed.';
        break;
      case 'movement':
        for (const unit of this.state.units.filter(unit => unit.owner === player.id)) unit.movement = UNITS[unit.type].movement;
        message = 'Movement restored for every unit.';
        break;
      case 'reveal':
        this.state.cheats.revealMap = !this.state.cheats.revealMap;
        message = `Reveal map ${this.state.cheats.revealMap ? 'enabled' : 'disabled'}.`;
        break;
      case 'infiniteMovement':
        this.state.cheats.infiniteMovement = !this.state.cheats.infiniteMovement;
        message = `Infinite movement ${this.state.cheats.infiniteMovement ? 'enabled' : 'disabled'}.`;
        break;
      case 'godMode':
        this.state.cheats.godMode = !this.state.cheats.godMode;
        message = `God mode ${this.state.cheats.godMode ? 'enabled' : 'disabled'}.`;
        break;
      case 'oneHit':
        this.state.cheats.oneHit = !this.state.cheats.oneHit;
        message = `One-hit combat ${this.state.cheats.oneHit ? 'enabled' : 'disabled'}.`;
        break;
      case 'unlockTechs':
        player.completedTechs = TECHS.map(tech => tech.id);
        player.activeTech = null;
        message = 'All technologies unlocked.';
        break;
      case 'completeProduction': {
        const city = this.city(payload.cityId) || this.state.cities.find(item => item.owner === player.id);
        if (!city?.productionItem) return { ok: false, message: 'No active city production to complete.' };
        const production = PRODUCTION_ITEMS[city.productionItem];
        if (!production) return { ok: false, message: 'That production project is invalid.' };
        city.productionProgress = production.cost;
        const completed = this.resolveProduction(city);
        if (!completed.ok) return { ok: false, message: 'No open land hex is available for the completed unit.' };
        message = `${city.name} completed its production instantly.`;
        break;
      }
      case 'spawn': {
        const type = UNITS[payload.type] ? payload.type : 'warrior';
        const preferred = this.tile(payload.q, payload.r);
        const capital = this.state.cities.find(city => city.owner === player.id);
        const spawn = preferred && this.isLand(preferred) && !this.unitAt(preferred.q, preferred.r)
          ? preferred
          : this.findOpenTile(capital?.q ?? 0, capital?.r ?? 0, player.id);
        if (!spawn) return { ok: false, message: 'No open land hex is available.' };
        this.createUnit(player.id, type, spawn.q, spawn.r);
        message = `Spawned a ${UNITS[type].name}.`;
        break;
      }
      case 'advanceAge':
        if (this.state.age >= AGES.length - 1) return { ok: false, message: 'The final age has already begun.' };
        this.state.age += 1;
        this.state.turn = Math.max(this.state.turn, this.state.age * 25 + 1);
        message = `Advanced to the ${AGES[this.state.age].name}.`;
        break;
      default:
        return { ok: false, message: 'Unknown command.' };
    }
    this.state.cheats.enabled = true;
    this.log(`Command Console: ${message}`, 'cheat');
    return { ok: true, message };
  }

  log(message, type = 'world') {
    this.state.log.unshift({ turn: this.state.turn, message, type });
    this.state.log = this.state.log.slice(0, 80);
  }

  serialize() {
    if (!this.state) throw new Error('No active game to save.');
    this.commitRandom();
    return JSON.stringify(this.state);
  }

  load(serialized) {
    const data = typeof serialized === 'string' ? JSON.parse(serialized) : structuredClone(serialized);
    if (!data || data.version !== SAVE_VERSION
      || !Number.isInteger(data.cols) || data.cols <= 0
      || !Number.isInteger(data.rows) || data.rows <= 0
      || !Array.isArray(data.tiles) || !Array.isArray(data.factions)
      || !Array.isArray(data.cities) || !Array.isArray(data.units) || !Array.isArray(data.log)
      || !data.cheats || typeof data.cheats !== 'object') {
      throw new Error('This save is missing data or uses an unsupported version.');
    }
    if (data.tiles.length !== data.cols * data.rows) throw new Error('The map data is incomplete.');
    if (data.units.some(unit => !UNITS[unit.type] || !data.factions.some(faction => faction.id === unit.owner))) {
      throw new Error('The save contains an invalid unit.');
    }
    if (data.cities.some(city => !data.factions.some(faction => faction.id === city.owner) || !data.tiles.some(tile => tile.q === city.q && tile.r === city.r))) {
      throw new Error('The save contains an invalid city.');
    }
    this.state = data;
    this.random = new SeededRandom(data.seed);
    this.random.state = Number.isInteger(data.rngState) ? data.rngState >>> 0 : hashString(data.seed);
    return this.state;
  }
}
