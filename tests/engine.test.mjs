import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../www/js/engine.js';
import { TECHS, UNITS } from '../www/js/data.js';

function makeGame(overrides = {}) {
  const game = new GameEngine();
  game.newGame({ seed: 'mobile-test-world', mapSize: 'standard', difficulty: 'sovereign', ...overrides });
  return game;
}

test('new games are deterministic and contain four playable empires', () => {
  const first = makeGame();
  const second = makeGame();
  assert.equal(first.state.factions.length, 4);
  assert.equal(first.state.cities.length, 4);
  assert.deepEqual(
    first.state.tiles.map(tile => [tile.terrain, tile.resource]),
    second.state.tiles.map(tile => [tile.terrain, tile.resource])
  );
  assert.ok(first.state.units.some(unit => unit.owner === 0 && unit.type === 'settler'));
  assert.ok(first.state.tiles.some(tile => tile.discovered.includes(0)));
});

test('movement obeys adjacency and infinite movement command', () => {
  const game = makeGame();
  const scout = game.state.units.find(unit => unit.owner === 0 && unit.type === 'scout');
  const destination = game.neighbors(scout.q, scout.r).find(tile => game.canEnter(scout, tile) && !game.unitAt(tile.q, tile.r));
  assert.ok(destination);
  const before = scout.movement;
  assert.equal(game.moveUnit(scout.id, destination.q, destination.r).ok, true);
  assert.equal(scout.movement, before - 1);
  game.applyCheat('infiniteMovement');
  const secondDestination = game.neighbors(scout.q, scout.r).find(tile => game.canEnter(scout, tile) && !game.unitAt(tile.q, tile.r));
  const movementBeforeCheatMove = scout.movement;
  assert.equal(game.moveUnit(scout.id, secondDestination.q, secondDestination.r).ok, true);
  assert.equal(scout.movement, movementBeforeCheatMove);
});

test('settlers found cities and are consumed', () => {
  const game = makeGame();
  const settler = game.state.units.find(unit => unit.owner === 0 && unit.type === 'settler');
  const site = game.state.tiles.find(tile => game.isLand(tile)
    && game.state.cities.every(city => game.distance(tile.q, tile.r, city.q, city.r) >= 3)
    && !game.unitAt(tile.q, tile.r));
  assert.ok(site);
  settler.q = site.q;
  settler.r = site.r;
  const citiesBefore = game.state.cities.length;
  const result = game.foundCity(settler.id);
  assert.equal(result.ok, true);
  assert.equal(game.state.cities.length, citiesBefore + 1);
  assert.equal(game.unit(settler.id), null);
});

test('command console grants resources, unlocks technology, and spawns units', () => {
  const game = makeGame();
  const player = game.faction(0);
  const goldBefore = player.gold;
  assert.equal(game.applyCheat('gold').ok, true);
  assert.equal(player.gold, goldBefore + 100000);
  game.applyCheat('unlockTechs');
  assert.equal(player.completedTechs.length, TECHS.length);
  const unitsBefore = game.state.units.filter(unit => unit.owner === 0).length;
  assert.equal(game.applyCheat('spawn', { type: 'legion' }).ok, true);
  assert.equal(game.state.units.filter(unit => unit.owner === 0).length, unitsBefore + 1);
  assert.ok(game.state.units.some(unit => unit.owner === 0 && unit.type === 'legion' && unit.hp === UNITS.legion.maxHp));
});

test('one-hit combat removes an adjacent enemy unit', () => {
  const game = makeGame();
  const attacker = game.state.units.find(unit => unit.owner === 0 && unit.type === 'warrior');
  const targetTile = game.neighbors(attacker.q, attacker.r).find(tile => game.canEnter(attacker, tile) && !game.unitAt(tile.q, tile.r));
  assert.ok(targetTile);
  const defender = game.createUnit(1, 'warrior', targetTile.q, targetTile.r);
  game.applyCheat('oneHit');
  const result = game.moveUnit(attacker.id, targetTile.q, targetTile.r);
  assert.equal(result.ok, true);
  assert.equal(game.unit(defender.id), null);
});

test('research gates end turn and a complete turn advances the simulation', () => {
  const game = makeGame();
  const blocked = game.endTurn();
  assert.equal(blocked.ok, false);
  assert.equal(blocked.needsResearch, true);
  const available = game.availableTechs(0);
  assert.ok(available.length > 0);
  assert.equal(game.chooseResearch(available[0].id).ok, true);
  assert.equal(game.endTurn().ok, true);
  assert.equal(game.state.turn, 2);
});

test('save data round-trips without losing command toggles or world state', () => {
  const game = makeGame({ mapSize: 'compact', difficulty: 'explorer' });
  game.applyCheat('godMode');
  game.applyCheat('reveal');
  const serialized = game.serialize();
  const restored = new GameEngine();
  restored.load(serialized);
  assert.equal(restored.state.mapSize, 'compact');
  assert.equal(restored.state.difficulty, 'explorer');
  assert.equal(restored.state.cheats.godMode, true);
  assert.equal(restored.state.cheats.revealMap, true);
  assert.deepEqual(restored.state.tiles, game.state.tiles);
});

test('civilian units cannot attack enemy units or cities', () => {
  const game = makeGame();
  const settler = game.state.units.find(unit => unit.owner === 0 && unit.type === 'settler');
  const targetTile = game.neighbors(settler.q, settler.r).find(tile => game.canEnter(settler, tile) && !game.unitAt(tile.q, tile.r) && !game.cityAt(tile.q, tile.r));
  assert.ok(targetTile);
  const defender = game.createUnit(1, 'warrior', targetTile.q, targetTile.r);
  const defenderHp = defender.hp;
  const result = game.moveUnit(settler.id, targetTile.q, targetTile.r);
  assert.equal(result.ok, false);
  assert.equal(defender.hp, defenderHp);
  assert.equal(game.unit(settler.id), settler);
});

test('settlers cannot found cities in rival territory', () => {
  const game = makeGame();
  const settler = game.state.units.find(unit => unit.owner === 0 && unit.type === 'settler');
  const site = game.state.tiles.find(tile => game.isLand(tile)
    && game.state.cities.every(city => game.distance(tile.q, tile.r, city.q, city.r) >= 3)
    && !game.unitAt(tile.q, tile.r));
  assert.ok(site);
  site.owner = 1;
  settler.q = site.q;
  settler.r = site.r;
  const citiesBefore = game.state.cities.length;
  const result = game.foundCity(settler.id);
  assert.equal(result.ok, false);
  assert.equal(game.state.cities.length, citiesBefore);
  assert.equal(site.owner, 1);
});

test('conquest cannot declare an eliminated faction the winner from a stale score', () => {
  const game = makeGame();
  for (const city of game.state.cities.filter(city => city.owner === 0)) city.owner = 1;
  game.state.units = game.state.units.filter(unit => unit.owner !== 0 || unit.type !== 'settler');
  game.faction(0).score = 999999;
  for (const faction of game.state.factions.filter(faction => faction.id !== 0)) faction.score = 0;
  game.checkVictory();
  assert.equal(game.state.gameOver, true);
  assert.notEqual(game.state.winner.factionId, 0);
});

test('instant production reports failure when a unit has nowhere to spawn', () => {
  const game = makeGame();
  const city = game.state.cities.find(city => city.owner === 0);
  city.productionItem = 'unit:warrior';
  city.productionProgress = 0;
  game.findOpenTile = () => null;
  const result = game.applyCheat('completeProduction', { cityId: city.id });
  assert.equal(result.ok, false);
  assert.equal(city.productionItem, 'unit:warrior');
});

test('a city survives at one health when its attacker also falls', () => {
  const game = makeGame();
  const city = game.state.cities.find(city => city.owner === 1);
  const adjacent = game.neighbors(city.q, city.r).find(tile => game.canEnter({ type: 'warrior', owner: 0 }, tile) && !game.unitAt(tile.q, tile.r));
  assert.ok(adjacent);
  const attacker = game.createUnit(0, 'warrior', adjacent.q, adjacent.r);
  attacker.hp = 1;
  city.hp = 1;
  const result = game.moveUnit(attacker.id, city.q, city.r);
  assert.equal(result.ok, true);
  assert.equal(game.unit(attacker.id), null);
  assert.equal(city.owner, 1);
  assert.equal(city.hp, 1);
});

test('long campaigns preserve core state invariants across map sizes and difficulties', () => {
  const configurations = [
    { mapSize: 'compact', difficulty: 'explorer' },
    { mapSize: 'standard', difficulty: 'sovereign' },
    { mapSize: 'grand', difficulty: 'immortal' }
  ];
  for (let index = 0; index < 12; index += 1) {
    const game = makeGame({ ...configurations[index % configurations.length], seed: `audit-${index}` });
    for (let turn = 0; turn < 85 && !game.state.gameOver; turn += 1) {
      const player = game.faction(0);
      if (!player.activeTech) {
        const available = game.availableTechs();
        if (available.length) game.chooseResearch(available[0].id);
      }
      game.endTurn();
      const ids = [...game.state.cities, ...game.state.units].map(item => item.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const city of game.state.cities) {
        const center = game.tile(city.q, city.r);
        assert.equal(center.cityId, city.id);
        assert.equal(center.owner, city.owner);
        assert.ok(city.hp > 0 && city.hp <= city.maxHp);
      }
      for (const unit of game.state.units) {
        assert.ok(game.tile(unit.q, unit.r));
        assert.ok(UNITS[unit.type]);
        assert.ok(unit.hp > 0 && unit.hp <= UNITS[unit.type].maxHp);
        assert.ok(Number.isFinite(unit.movement) && unit.movement >= 0);
      }
    }
  }
});
