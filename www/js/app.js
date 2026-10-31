import { AGES, BUILDINGS, PRODUCTION_ITEMS, RESOURCES, TECHS, TERRAIN, UNITS } from './data.js';
import { GameEngine } from './engine.js';

const SAVE_KEY = 'empire-command-mobile-save-v1';
const engine = new GameEngine();
const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
let selected = null;
let toastTimer = 0;
let ageTimer = 0;
let renderer = null;

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Math.floor(value));
}

function vibrate(pattern = 12) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function toast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', error);
  elements.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 2600);
}

function saveGame(announce = false) {
  if (!engine.state) return;
  try {
    localStorage.setItem(SAVE_KEY, engine.serialize());
    if (announce) toast('Campaign saved on this device.');
  } catch (error) {
    toast(`Could not save: ${error.message}`, true);
  }
}

function savedGame() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function loadSavedGame() {
  const save = savedGame();
  if (!save) return false;
  try {
    engine.load(save);
    enterGame();
    toast('Campaign restored.');
    return true;
  } catch (error) {
    toast(`Save could not be opened: ${error.message}`, true);
    return false;
  }
}

function showTitle() {
  closeSheets();
  elements['start-screen'].classList.remove('hidden');
  elements.topbar.classList.add('hidden');
  elements['game-screen'].classList.add('hidden');
  elements['continue-button'].classList.toggle('hidden', !savedGame());
}

function enterGame() {
  elements['start-screen'].classList.add('hidden');
  elements.topbar.classList.remove('hidden');
  elements['game-screen'].classList.remove('hidden');
  closeSheets();
  selected = null;
  elements['selection-panel'].classList.add('empty');
  if (!renderer) renderer = new HexRenderer(elements.map, engine, handleTileTap);
  renderer.engine = engine;
  renderer.resize();
  const capital = engine.state.cities.find(city => city.owner === engine.state.playerId && city.capital)
    || engine.state.cities.find(city => city.owner === engine.state.playerId);
  if (capital) renderer.centerOn(capital.q, capital.r);
  updateAll();
  if (!engine.faction(engine.state.playerId).activeTech && engine.availableTechs().length) {
    setTimeout(() => openResearch(), 450);
  }
}

function beginNewGame() {
  const mapSize = elements['map-size-options'].querySelector('.active')?.dataset.value || 'standard';
  const difficulty = elements['difficulty-options'].querySelector('.active')?.dataset.value || 'sovereign';
  const seed = elements['seed-input'].value.trim() || undefined;
  engine.newGame({ mapSize, difficulty, seed });
  saveGame();
  enterGame();
  toast('Your first Settler can found a second city.');
}

function openSheet(id) {
  for (const sheet of document.querySelectorAll('.sheet')) sheet.classList.add('hidden');
  elements[id].classList.remove('hidden');
  elements['sheet-backdrop'].classList.remove('hidden');
}

function closeSheets() {
  for (const sheet of document.querySelectorAll('.sheet')) sheet.classList.add('hidden');
  elements['sheet-backdrop'].classList.add('hidden');
}

function updateAll() {
  if (!engine.state) return;
  updateHud();
  updateSelection();
  updateCheatToggles();
  renderer?.draw();
  if (engine.state.gameOver) showVictory();
}

function updateHud() {
  const state = engine.state;
  const player = engine.faction(state.playerId);
  elements['age-label'].textContent = AGES[state.age].name;
  elements['turn-label'].textContent = `Turn ${state.turn}`;
  elements['gold-value'].textContent = compactNumber(player.gold);
  elements['science-value'].textContent = compactNumber(player.science);
  elements['culture-value'].textContent = compactNumber(player.culture);
  elements['influence-value'].textContent = compactNumber(player.influence);
  const research = TECHS.find(tech => tech.id === player.activeTech);
  elements['research-label'].textContent = research ? `${research.name} • ${Math.min(player.science, research.cost)}/${research.cost}` : 'Choose technology';
  const readyUnits = state.units.filter(unit => unit.owner === state.playerId && unit.movement > 0).length;
  elements['end-turn-note'].textContent = readyUnits ? `${readyUnits} units ready` : 'Ready';
}

function updateSelection() {
  const panel = elements['selection-panel'];
  if (!selected || !engine.state) {
    panel.classList.add('empty');
    return;
  }
  const symbol = elements['selection-symbol'];
  const kicker = elements['selection-kicker'];
  const name = elements['selection-name'];
  const detail = elements['selection-detail'];
  const stats = elements['selection-stats'];
  const actions = elements['action-row'];
  actions.innerHTML = '';
  stats.innerHTML = '';

  if (selected.type === 'unit') {
    const unit = engine.unit(selected.id);
    if (!unit) {
      selected = null;
      panel.classList.add('empty');
      return;
    }
    const definition = UNITS[unit.type];
    const faction = engine.faction(unit.owner);
    symbol.textContent = definition.symbol;
    symbol.style.color = faction.color;
    kicker.textContent = unit.owner === engine.state.playerId ? 'YOUR UNIT' : faction.name.toUpperCase();
    name.textContent = definition.name;
    detail.textContent = `${engine.tile(unit.q, unit.r).terrain.replace(/^./, value => value.toUpperCase())} • ${unit.veteran ? `Veteran ${unit.veteran}` : 'Regular'}`;
    stats.innerHTML = `<span>♥ <b>${Math.max(0, unit.hp)}/${definition.maxHp}</b></span><span>⚔ <b>${definition.strength}</b></span><span>➤ <b>${unit.movement}/${definition.movement}</b></span>`;
    if (unit.owner === engine.state.playerId) {
      if (unit.type === 'settler') addAction('Found City', 'primary', () => runAction(engine.foundCity(unit.id)));
      if (!definition.civilian) addAction(unit.fortified ? 'Fortified' : 'Fortify', '', () => runAction(engine.fortifyUnit(unit.id)));
      addAction('Center', '', () => renderer.centerOn(unit.q, unit.r));
    }
  } else if (selected.type === 'city') {
    const city = engine.city(selected.id);
    if (!city) {
      selected = null;
      panel.classList.add('empty');
      return;
    }
    const faction = engine.faction(city.owner);
    const yields = engine.cityYields(city);
    const production = PRODUCTION_ITEMS[city.productionItem];
    symbol.textContent = city.capital ? '♛' : '⌂';
    symbol.style.color = faction.color;
    kicker.textContent = city.owner === engine.state.playerId ? 'YOUR CITY' : faction.name.toUpperCase();
    name.textContent = city.name;
    detail.textContent = production ? `${production.name} • ${city.productionProgress}/${production.cost}` : 'Awaiting new production';
    stats.innerHTML = `<span>☻ <b>${city.population}</b></span><span>◆ <b>+${yields.science}</b></span><span>⚒ <b>+${yields.production}</b></span><span>● <b>+${yields.gold}</b></span><span>♥ <b>${city.hp}/${city.maxHp}</b></span>`;
    if (city.owner === engine.state.playerId) {
      addAction(production ? 'Change Project' : 'Choose Project', 'primary', () => openProduction(city.id));
      addAction('Center', '', () => renderer.centerOn(city.q, city.r));
    }
  } else {
    const tile = engine.tile(selected.q, selected.r);
    if (!tile) return;
    const terrain = TERRAIN[tile.terrain];
    const resource = tile.resource ? RESOURCES[tile.resource] : null;
    symbol.textContent = resource?.symbol || terrain.symbol || '⬡';
    symbol.style.color = resource?.color || 'var(--cyan-bright)';
    kicker.textContent = 'TERRAIN';
    name.textContent = terrain.name;
    detail.textContent = resource ? resource.name : tile.owner === null ? 'Unclaimed land' : `${engine.faction(tile.owner).adjective} territory`;
    stats.innerHTML = `<span>Food <b>${terrain.food + (resource?.food || 0)}</b></span><span>Production <b>${terrain.production + (resource?.production || 0)}</b></span><span>Gold <b>${terrain.gold + (resource?.gold || 0)}</b></span>`;
  }
  panel.classList.remove('empty');
}

function addAction(label, className, handler) {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', event => {
    event.stopPropagation();
    handler();
  });
  elements['action-row'].append(button);
}

function runAction(result) {
  toast(result.message, !result.ok);
  if (result.ok) {
    vibrate();
    saveGame();
  }
  updateAll();
}

function handleTileTap(tile) {
  if (!engine.state || !tile) return;
  const visible = tile.visible.includes(engine.state.playerId) || engine.state.cheats.revealMap;
  const tappedUnit = visible ? engine.unitAt(tile.q, tile.r) : null;
  const tappedCity = visible ? engine.cityAt(tile.q, tile.r) : null;
  if (tappedUnit?.owner === engine.state.playerId) {
    selected = tappedCity?.owner === engine.state.playerId && selected?.type === 'unit' && selected.id === tappedUnit.id
      ? { type: 'city', id: tappedCity.id }
      : { type: 'unit', id: tappedUnit.id };
    vibrate(8);
    updateAll();
    return;
  }
  if (tappedCity?.owner === engine.state.playerId && (!selected || selected.type !== 'unit')) {
    selected = { type: 'city', id: tappedCity.id };
    vibrate(8);
    updateAll();
    return;
  }
  if (selected?.type === 'unit') {
    const unit = engine.unit(selected.id);
    if (unit?.owner === engine.state.playerId && engine.distance(unit.q, unit.r, tile.q, tile.r) === 1) {
      const result = engine.moveUnit(unit.id, tile.q, tile.r);
      toast(result.message, !result.ok);
      if (result.ok) {
        vibrate(tappedUnit || tappedCity ? [22, 30, 22] : 10);
        if (!engine.unit(unit.id)) selected = null;
        saveGame();
      }
      updateAll();
      return;
    }
  }
  if (tappedUnit && visible) selected = { type: 'unit', id: tappedUnit.id };
  else if (tappedCity && visible) selected = { type: 'city', id: tappedCity.id };
  else selected = { type: 'tile', q: tile.q, r: tile.r };
  vibrate(8);
  updateAll();
}

function openResearch() {
  if (!engine.state) return;
  const faction = engine.faction(engine.state.playerId);
  const available = engine.availableTechs();
  const list = elements['research-list'];
  list.innerHTML = '';
  const heading = document.createElement('p');
  heading.className = 'section-label';
  heading.textContent = `Available science: ${Math.floor(faction.science)}`;
  list.append(heading);
  for (const tech of TECHS.filter(item => !faction.completedTechs.includes(item.id))) {
    const canChoose = available.some(item => item.id === tech.id);
    const button = document.createElement('button');
    button.className = `info-card${canChoose ? '' : ' locked'}`;
    button.disabled = !canChoose;
    const missing = tech.requires.filter(id => !faction.completedTechs.includes(id)).map(id => TECHS.find(item => item.id === id)?.name).join(', ');
    button.innerHTML = `<span class="card-symbol">⌬</span><span class="card-copy"><strong>${tech.name}</strong><small>${canChoose ? tech.description : `Requires ${missing}`}</small></span><span class="card-cost">◆ ${tech.cost}</span>`;
    button.addEventListener('click', () => {
      runAction(engine.chooseResearch(tech.id));
      closeSheets();
    });
    list.append(button);
  }
  openSheet('research-sheet');
}

function openProduction(cityId) {
  const city = engine.city(cityId);
  if (!city) return;
  const list = elements['production-list'];
  list.innerHTML = '';
  const yields = engine.cityYields(city);
  const heading = document.createElement('p');
  heading.className = 'section-label';
  heading.textContent = `${city.name} • ${yields.production} production per turn`;
  list.append(heading);
  for (const item of engine.availableProduction(cityId)) {
    const button = document.createElement('button');
    button.className = 'info-card';
    const detail = item.type === 'unit'
      ? `${item.strength} strength • ${item.movement} movement`
      : Object.entries(item.yields).map(([type, amount]) => `+${amount} ${type}`).join(' • ');
    button.innerHTML = `<span class="card-symbol">${item.symbol}</span><span class="card-copy"><strong>${item.name}</strong><small>${detail}</small></span><span class="card-cost">⚒ ${item.cost}</span>`;
    button.addEventListener('click', () => {
      runAction(engine.queueProduction(cityId, item.key));
      closeSheets();
    });
    list.append(button);
  }
  openSheet('production-sheet');
}

function openChronicle() {
  const list = elements['chronicle-list'];
  list.innerHTML = engine.state.log.map(entry => `<article class="chronicle-entry ${entry.type}"><small>T${entry.turn}</small><p>${entry.message}</p></article>`).join('');
  openSheet('chronicle-sheet');
}

function openEmpire() {
  const player = engine.faction(engine.state.playerId);
  const playerCities = engine.state.cities.filter(city => city.owner === player.id);
  const population = playerCities.reduce((sum, city) => sum + city.population, 0);
  const content = elements['empire-content'];
  const ranking = [...engine.state.factions].sort((a, b) => b.score - a.score);
  content.innerHTML = `
    <div class="empire-hero"><h3>${player.name}</h3><p>${AGES[engine.state.age].subtitle}. Complete Future Flight or capture every rival city to win.</p></div>
    <div class="metric-grid">
      <div class="metric"><small>Cities</small><strong>${playerCities.length}</strong></div>
      <div class="metric"><small>Population</small><strong>${population}</strong></div>
      <div class="metric"><small>Technologies</small><strong>${player.completedTechs.length}/${TECHS.length}</strong></div>
      <div class="metric"><small>Legacy Score</small><strong>${engine.calculateScore(player.id)}</strong></div>
    </div>
    <h3>World ranking</h3>
    <div class="ranking">${ranking.map((faction, index) => `<div class="rank-row"><span>${index + 1}</span><span><i style="background:${faction.color};display:inline-block;margin-right:7px"></i>${faction.name}</span><strong>${engine.calculateScore(faction.id)}</strong></div>`).join('')}</div>`;
  openSheet('empire-sheet');
}

function applyCheat(button) {
  const action = button.dataset.cheat;
  const payload = {};
  if (action === 'spawn') payload.type = button.dataset.unit;
  if (selected?.type === 'city') payload.cityId = selected.id;
  if (selected?.type === 'tile') ({ q: payload.q, r: payload.r } = selected);
  if (selected?.type === 'unit') {
    const unit = engine.unit(selected.id);
    if (unit) ({ q: payload.q, r: payload.r } = unit);
  }
  const result = engine.applyCheat(action, payload);
  toast(result.message, !result.ok);
  if (result.ok) {
    vibrate([15, 20, 15]);
    saveGame();
  }
  updateAll();
}

function updateCheatToggles() {
  if (!engine.state) return;
  for (const button of elements['cheat-sheet'].querySelectorAll('[data-toggle]')) {
    button.classList.toggle('active', Boolean(engine.state.cheats[button.dataset.toggle]));
  }
}

function nextReadyUnit() {
  const units = engine.state.units.filter(unit => unit.owner === engine.state.playerId && unit.movement > 0);
  if (!units.length) return toast('No units have movement remaining.');
  const currentIndex = selected?.type === 'unit' ? units.findIndex(unit => unit.id === selected.id) : -1;
  const unit = units[(currentIndex + 1) % units.length];
  selected = { type: 'unit', id: unit.id };
  renderer.centerOn(unit.q, unit.r);
  updateAll();
}

function endTurn() {
  const previousAge = engine.state.age;
  const result = engine.endTurn();
  if (result.needsResearch) {
    toast(result.message, true);
    openResearch();
    return;
  }
  toast(result.message, !result.ok);
  if (result.ok) {
    vibrate(18);
    saveGame();
    if (engine.state.age !== previousAge) showAgeBanner();
  }
  updateAll();
}

function showAgeBanner() {
  clearTimeout(ageTimer);
  const age = AGES[engine.state.age];
  elements['age-banner'].querySelector('strong').textContent = age.name;
  elements['age-banner'].querySelector('span').textContent = age.subtitle;
  elements['age-banner'].classList.remove('hidden');
  ageTimer = setTimeout(() => elements['age-banner'].classList.add('hidden'), 2600);
}

function showVictory() {
  const winner = engine.faction(engine.state.winner.factionId);
  const playerWon = winner.id === engine.state.playerId;
  elements['victory-title'].textContent = playerWon ? engine.state.winner.victoryType : 'A Rival Ascends';
  elements['victory-copy'].textContent = playerWon
    ? `${winner.name} will be remembered across every age.`
    : `${winner.name} achieved a ${engine.state.winner.victoryType}. Your legacy remains in the chronicle.`;
  const ranking = [...engine.state.factions].sort((a, b) => engine.calculateScore(b.id) - engine.calculateScore(a.id));
  elements['victory-scores'].innerHTML = ranking.map((faction, index) => `<div class="rank-row"><span>${index + 1}</span><span><i style="background:${faction.color};display:inline-block;margin-right:7px"></i>${faction.name}</span><strong>${engine.calculateScore(faction.id)}</strong></div>`).join('');
  openSheet('victory-sheet');
}

class HexRenderer {
  constructor(canvas, gameEngine, onTap) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.engine = gameEngine;
    this.onTap = onTap;
    this.baseSize = 35;
    this.zoom = 1;
    this.camera = { x: 70, y: 105 };
    this.width = 0;
    this.height = 0;
    this.pointers = new Map();
    this.gesture = null;
    this.bindEvents();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const previousCenter = this.width && this.height ? {
      x: (this.width / 2 - this.camera.x) / this.zoom,
      y: (this.height / 2 - this.camera.y) / this.zoom
    } : null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (previousCenter) {
      this.camera.x = this.width / 2 - previousCenter.x * this.zoom;
      this.camera.y = this.height / 2 - previousCenter.y * this.zoom;
    }
    this.draw();
  }

  worldCenter(q, r) {
    return {
      x: Math.sqrt(3) * this.baseSize * (q + 0.5 * (r & 1)),
      y: this.baseSize * 1.5 * r
    };
  }

  screenCenter(q, r) {
    const point = this.worldCenter(q, r);
    return { x: point.x * this.zoom + this.camera.x, y: point.y * this.zoom + this.camera.y };
  }

  centerOn(q, r) {
    const point = this.worldCenter(q, r);
    this.camera.x = this.width / 2 - point.x * this.zoom;
    this.camera.y = this.height / 2 - point.y * this.zoom;
    this.draw();
  }

  setZoom(value, anchorX = this.width / 2, anchorY = this.height / 2) {
    const old = this.zoom;
    this.zoom = Math.max(0.55, Math.min(1.75, value));
    const worldX = (anchorX - this.camera.x) / old;
    const worldY = (anchorY - this.camera.y) / old;
    this.camera.x = anchorX - worldX * this.zoom;
    this.camera.y = anchorY - worldY * this.zoom;
    this.draw();
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', event => {
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (this.pointers.size === 1) {
        this.gesture = { startCamera: { ...this.camera }, moved: false, time: performance.now() };
      } else if (this.pointers.size === 2) {
        const points = [...this.pointers.values()];
        this.gesture = {
          pinchDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
          startZoom: this.zoom,
          moved: true
        };
      }
    });
    this.canvas.addEventListener('pointermove', event => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (this.pointers.size === 1 && this.gesture?.startCamera) {
        const only = [...this.pointers.values()][0];
        const dx = only.x - only.startX;
        const dy = only.y - only.startY;
        if (Math.hypot(dx, dy) > 6) this.gesture.moved = true;
        this.camera.x = this.gesture.startCamera.x + dx;
        this.camera.y = this.gesture.startCamera.y + dy;
        this.draw();
      } else if (this.pointers.size === 2) {
        const points = [...this.pointers.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        this.setZoom(this.gesture.startZoom * distance / Math.max(1, this.gesture.pinchDistance), midpoint.x, midpoint.y);
      }
    });
    const finish = event => {
      const pointer = this.pointers.get(event.pointerId);
      const wasTap = this.pointers.size === 1 && pointer && !this.gesture?.moved && performance.now() - this.gesture.time < 450;
      this.pointers.delete(event.pointerId);
      if (wasTap) this.onTap(this.pickTile(event.clientX, event.clientY));
      if (this.pointers.size === 1) {
        const remaining = [...this.pointers.values()][0];
        remaining.startX = remaining.x;
        remaining.startY = remaining.y;
        this.gesture = { startCamera: { ...this.camera }, moved: true, time: performance.now() };
      }
    };
    this.canvas.addEventListener('pointerup', finish);
    this.canvas.addEventListener('pointercancel', finish);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.setZoom(this.zoom * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
    }, { passive: false });
  }

  pickTile(x, y) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const tile of this.engine.state.tiles) {
      const center = this.screenCenter(tile.q, tile.r);
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance < nearestDistance) {
        nearest = tile;
        nearestDistance = distance;
      }
    }
    return nearestDistance <= this.baseSize * this.zoom * 1.05 ? nearest : null;
  }

  pathHex(x, y, radius) {
    const context = this.context;
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = Math.PI / 180 * (60 * index - 30);
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
  }

  draw() {
    if (!this.engine.state || !this.width) return;
    const context = this.context;
    const state = this.engine.state;
    context.fillStyle = '#07151d';
    context.fillRect(0, 0, this.width, this.height);
    const radius = this.baseSize * this.zoom;
    for (const tile of state.tiles) {
      const center = this.screenCenter(tile.q, tile.r);
      if (center.x < -radius || center.y < -radius || center.x > this.width + radius || center.y > this.height + radius) continue;
      const discovered = tile.discovered.includes(state.playerId) || state.cheats.revealMap;
      const visible = tile.visible.includes(state.playerId) || state.cheats.revealMap;
      this.pathHex(center.x, center.y, radius - 1);
      context.fillStyle = discovered ? TERRAIN[tile.terrain].color : '#071018';
      context.fill();
      context.strokeStyle = discovered ? TERRAIN[tile.terrain].edge : '#12242d';
      context.lineWidth = 1;
      context.stroke();
      if (!discovered) continue;

      if (tile.owner !== null) {
        this.pathHex(center.x, center.y, radius - 3);
        context.strokeStyle = this.engine.faction(tile.owner).color;
        context.globalAlpha = visible ? 0.58 : 0.22;
        context.lineWidth = Math.max(1.4, 2.4 * this.zoom);
        context.stroke();
        context.globalAlpha = 1;
      }
      const terrain = TERRAIN[tile.terrain];
      if (terrain.symbol && radius > 20) {
        context.fillStyle = 'rgba(6, 20, 24, .46)';
        context.font = `${Math.round(radius * .54)}px Georgia`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(terrain.symbol, center.x, center.y + 1);
      }
      if (tile.resource && visible && radius > 18) {
        const resource = RESOURCES[tile.resource];
        context.beginPath();
        context.arc(center.x + radius * .47, center.y - radius * .35, Math.max(7, radius * .2), 0, Math.PI * 2);
        context.fillStyle = 'rgba(4, 14, 20, .82)';
        context.fill();
        context.fillStyle = resource.color;
        context.font = `700 ${Math.max(8, radius * .22)}px sans-serif`;
        context.fillText(resource.symbol, center.x + radius * .47, center.y - radius * .34);
      }
      if (!visible) {
        this.pathHex(center.x, center.y, radius - 1);
        context.fillStyle = 'rgba(5, 13, 18, .56)';
        context.fill();
      }
    }

    for (const city of state.cities) {
      const tile = this.engine.tile(city.q, city.r);
      if (!tile.visible.includes(state.playerId) && !state.cheats.revealMap) continue;
      const center = this.screenCenter(city.q, city.r);
      const faction = this.engine.faction(city.owner);
      context.beginPath();
      context.arc(center.x, center.y, Math.max(11, radius * .35), 0, Math.PI * 2);
      context.fillStyle = faction.dark;
      context.fill();
      context.strokeStyle = faction.color;
      context.lineWidth = 2.5;
      context.stroke();
      context.fillStyle = faction.color;
      context.font = `700 ${Math.max(12, radius * .36)}px Georgia`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(city.capital ? '♛' : '⌂', center.x, center.y + 1);
      if (radius > 22) {
        const labelWidth = Math.max(62, city.name.length * 6 + 22);
        context.fillStyle = 'rgba(3, 12, 17, .9)';
        context.fillRect(center.x - labelWidth / 2, center.y + radius * .43, labelWidth, 17);
        context.fillStyle = '#f2f7f6';
        context.font = '700 9px sans-serif';
        context.fillText(`${city.name}  ${city.population}`, center.x, center.y + radius * .43 + 9);
      }
    }

    for (const unit of state.units) {
      const tile = this.engine.tile(unit.q, unit.r);
      if (!tile.visible.includes(state.playerId) && !state.cheats.revealMap) continue;
      const center = this.screenCenter(unit.q, unit.r);
      const faction = this.engine.faction(unit.owner);
      const definition = UNITS[unit.type];
      const offset = this.engine.cityAt(unit.q, unit.r) ? { x: -radius * .42, y: -radius * .22 } : { x: 0, y: 0 };
      context.beginPath();
      context.arc(center.x + offset.x, center.y + offset.y, Math.max(10, radius * .31), 0, Math.PI * 2);
      context.fillStyle = faction.dark;
      context.fill();
      context.strokeStyle = faction.color;
      context.lineWidth = unit.owner === state.playerId ? 2.5 : 2;
      context.stroke();
      context.fillStyle = '#fff';
      context.font = `700 ${Math.max(11, radius * .34)}px Georgia`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(definition.symbol, center.x + offset.x, center.y + offset.y + 1);
      if (unit.hp < definition.maxHp) {
        const width = Math.max(18, radius * .65);
        context.fillStyle = '#291718';
        context.fillRect(center.x + offset.x - width / 2, center.y + offset.y + radius * .34, width, 3);
        context.fillStyle = unit.hp / definition.maxHp > .4 ? '#7ed485' : '#ef7062';
        context.fillRect(center.x + offset.x - width / 2, center.y + offset.y + radius * .34, width * Math.max(0, unit.hp / definition.maxHp), 3);
      }
    }

    if (selected) {
      let q = selected.q;
      let r = selected.r;
      if (selected.type === 'unit') ({ q, r } = this.engine.unit(selected.id) || {});
      if (selected.type === 'city') ({ q, r } = this.engine.city(selected.id) || {});
      if (Number.isFinite(q) && Number.isFinite(r)) {
        const center = this.screenCenter(q, r);
        this.pathHex(center.x, center.y, radius - 3);
        context.strokeStyle = '#fff5b5';
        context.lineWidth = 3;
        context.shadowColor = '#e8c36d';
        context.shadowBlur = 10;
        context.stroke();
        context.shadowBlur = 0;
      }
    }
  }
}

elements['new-game-button'].addEventListener('click', () => openSheet('new-game-sheet'));
elements['continue-button'].addEventListener('click', loadSavedGame);
elements['begin-campaign'].addEventListener('click', beginNewGame);
elements['sheet-backdrop'].addEventListener('click', closeSheets);
for (const button of document.querySelectorAll('.sheet-close')) button.addEventListener('click', closeSheets);
for (const groupId of ['map-size-options', 'difficulty-options']) {
  elements[groupId].addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    for (const sibling of elements[groupId].querySelectorAll('button')) sibling.classList.toggle('active', sibling === button);
  });
}
elements['research-button'].addEventListener('click', openResearch);
elements['cheat-button'].addEventListener('click', () => { updateCheatToggles(); openSheet('cheat-sheet'); });
elements['log-button'].addEventListener('click', openChronicle);
elements['empire-button'].addEventListener('click', openEmpire);
elements['menu-button'].addEventListener('click', () => openSheet('menu-sheet'));
elements['close-selection'].addEventListener('click', () => { selected = null; updateAll(); });
elements['next-unit-button'].addEventListener('click', nextReadyUnit);
elements['end-turn-button'].addEventListener('click', endTurn);
elements['zoom-in'].addEventListener('click', () => renderer?.setZoom(renderer.zoom * 1.18));
elements['zoom-out'].addEventListener('click', () => renderer?.setZoom(renderer.zoom / 1.18));
elements['center-map'].addEventListener('click', () => {
  const capital = engine.state?.cities.find(city => city.owner === engine.state.playerId && city.capital) || engine.state?.cities.find(city => city.owner === engine.state.playerId);
  if (capital) renderer.centerOn(capital.q, capital.r);
});
elements['cheat-sheet'].addEventListener('click', event => {
  const button = event.target.closest('[data-cheat]');
  if (button) applyCheat(button);
});
elements['save-game'].addEventListener('click', () => saveGame(true));
elements['how-to-play'].addEventListener('click', () => openSheet('help-sheet'));
elements['menu-new-game'].addEventListener('click', () => openSheet('new-game-sheet'));
elements['return-title'].addEventListener('click', () => { saveGame(); showTitle(); });
elements['victory-new-game'].addEventListener('click', () => openSheet('new-game-sheet'));
elements['age-banner'].addEventListener('click', () => elements['age-banner'].classList.add('hidden'));

window.addEventListener('keydown', event => {
  if (!engine.state || !elements['start-screen'].classList.contains('hidden')) return;
  if (event.target instanceof Element && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
  const sheetOpen = Boolean(document.querySelector('.sheet:not(.hidden)'));
  if (event.key === 'Escape') closeSheets();
  if (event.key === 'Enter' && !sheetOpen) endTurn();
  if (!sheetOpen && event.key.toLowerCase() === 'c') openSheet('cheat-sheet');
  if (!sheetOpen && event.key.toLowerCase() === 'r') openResearch();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
window.addEventListener('beforeunload', () => saveGame());

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

showTitle();
