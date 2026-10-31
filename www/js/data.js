export const TERRAIN = {
  ocean:    { name: 'Ocean',     color: '#17394b', edge: '#245268', food: 1, production: 0, gold: 1, science: 0, passable: false, symbol: '≈' },
  coast:    { name: 'Coast',     color: '#1e6174', edge: '#328298', food: 2, production: 0, gold: 1, science: 0, passable: false, symbol: '∿' },
  grass:    { name: 'Grassland', color: '#5f8b52', edge: '#789e60', food: 2, production: 1, gold: 0, science: 0, passable: true,  symbol: '' },
  plains:   { name: 'Plains',    color: '#9b8b55', edge: '#b2a66c', food: 1, production: 2, gold: 0, science: 0, passable: true,  symbol: '' },
  forest:   { name: 'Forest',    color: '#2f6247', edge: '#497a58', food: 2, production: 2, gold: 0, science: 0, passable: true,  symbol: '♠' },
  hills:    { name: 'Hills',     color: '#746f61', edge: '#8c8575', food: 1, production: 3, gold: 0, science: 0, passable: true,  symbol: '⌃' },
  desert:   { name: 'Desert',    color: '#c29a56', edge: '#d2b36d', food: 0, production: 1, gold: 1, science: 0, passable: true,  symbol: '' },
  mountain: { name: 'Mountain',  color: '#545b63', edge: '#7e8992', food: 0, production: 0, gold: 0, science: 1, passable: false, symbol: '▲' }
};
export const RESOURCES = {
  wheat:  { name: 'Wheat',  symbol: '◆', color: '#f1cf58', food: 2, production: 0, gold: 0, science: 0 },
  iron:   { name: 'Iron',   symbol: '⬟', color: '#cad0d6', food: 0, production: 2, gold: 0, science: 0 },
  horses: { name: 'Horses', symbol: '♞', color: '#d4b08a', food: 1, production: 1, gold: 0, science: 0 },
  gems:   { name: 'Gems',   symbol: '✦', color: '#c88cff', food: 0, production: 0, gold: 3, science: 0 },
  fish:   { name: 'Fish',   symbol: '◈', color: '#8ee5ef', food: 2, production: 0, gold: 1, science: 0 },
  relics: { name: 'Relics', symbol: '✧', color: '#ffdd9a', food: 0, production: 0, gold: 1, science: 2 }
};

export const UNITS = {
  settler: { name: 'Settler', symbol: '⚑', cost: 65, strength: 2,  movement: 2, range: 1, vision: 2, maxHp: 70,  civilian: true,  requires: null },
  scout:   { name: 'Scout',   symbol: '⌖', cost: 35, strength: 11, movement: 3, range: 1, vision: 3, maxHp: 80,  civilian: false, requires: null },
  warrior: { name: 'Warrior', symbol: '⚔', cost: 45, strength: 18, movement: 2, range: 1, vision: 2, maxHp: 100, civilian: false, requires: null },
  archer:  { name: 'Archer',  symbol: '➶', cost: 60, strength: 23, movement: 2, range: 2, vision: 2, maxHp: 90,  civilian: false, requires: 'archery' },
  horseman:{ name: 'Horseman',symbol: '♞', cost: 75, strength: 29, movement: 4, range: 1, vision: 2, maxHp: 110, civilian: false, requires: 'bronze_working' },
  legion:  { name: 'Legion',  symbol: '♜', cost: 95, strength: 38, movement: 2, range: 1, vision: 2, maxHp: 130, civilian: false, requires: 'engineering' }
};

export const BUILDINGS = {
  monument: { name: 'Monument', symbol: '◫', cost: 55, yields: { culture: 3 }, requires: null },
  granary:  { name: 'Granary',  symbol: '▤', cost: 65, yields: { food: 3 }, requires: 'irrigation' },
  library:  { name: 'Library',  symbol: '▥', cost: 80, yields: { science: 4 }, requires: 'writing' },
  market:   { name: 'Market',   symbol: '¤', cost: 90, yields: { gold: 5 }, requires: 'currency' },
  barracks: { name: 'Barracks', symbol: '▣', cost: 85, yields: { production: 3 }, requires: 'bronze_working' },
  academy:  { name: 'Academy',  symbol: '⌂', cost: 140, yields: { science: 9, culture: 3 }, requires: 'education' }
};

export const TECHS = [
  { id: 'pottery',        name: 'Pottery',        cost: 24,  age: 0, requires: [],                   description: 'Unlocks Irrigation and sturdier settlements.' },
  { id: 'animal_husbandry', name: 'Animal Husbandry', cost: 24, age: 0, requires: [],               description: 'Reveals the value of horses and open terrain.' },
  { id: 'writing',        name: 'Writing',        cost: 38,  age: 0, requires: ['pottery'],          description: 'Unlocks Libraries for additional science.' },
  { id: 'irrigation',     name: 'Irrigation',     cost: 38,  age: 0, requires: ['pottery'],          description: 'Unlocks Granaries and stronger city growth.' },
  { id: 'archery',        name: 'Archery',        cost: 42,  age: 0, requires: ['animal_husbandry'], description: 'Unlocks the ranged Archer unit.' },
  { id: 'bronze_working', name: 'Bronze Working', cost: 58, age: 0, requires: ['animal_husbandry'], description: 'Unlocks Barracks and Horsemen.' },
  { id: 'currency',       name: 'Currency',       cost: 72,  age: 1, requires: ['writing'],          description: 'Unlocks Markets and a stronger treasury.' },
  { id: 'engineering',    name: 'Engineering',    cost: 88,  age: 1, requires: ['bronze_working', 'irrigation'], description: 'Unlocks powerful Legion units.' },
  { id: 'education',      name: 'Education',      cost: 105, age: 1, requires: ['currency'],         description: 'Unlocks Academies and accelerates research.' },
  { id: 'navigation',     name: 'Navigation',     cost: 120, age: 1, requires: ['engineering'],      description: 'Allows military units to cross coastal water.' },
  { id: 'industrialization', name: 'Industrialization', cost: 155, age: 2, requires: ['education', 'engineering'], description: 'Doubles production from city buildings.' },
  { id: 'flight',         name: 'Flight',         cost: 190, age: 2, requires: ['navigation', 'industrialization'], description: 'A decisive step toward scientific victory.' },
  { id: 'future_flight',  name: 'Future Flight',  cost: 240, age: 2, requires: ['flight'],           description: 'Completing this technology wins a Science Victory.' }
];

export const FACTION_TEMPLATES = [
  { name: 'Auroran League', adjective: 'Auroran', color: '#54d4db', dark: '#183f50', capital: 'Dawnspire', cities: ['Dawnspire', 'Lumen', 'Solace', 'Meridian', 'Radiant'] },
  { name: 'Ember Crown', adjective: 'Ember', color: '#ef6b57', dark: '#5b2022', capital: 'Cinderhall', cities: ['Cinderhall', 'Pyre', 'Ashford', 'Red Keep', 'Furnace'] },
  { name: 'Verdant Compact', adjective: 'Verdant', color: '#8dcb65', dark: '#29482d', capital: 'Greenhaven', cities: ['Greenhaven', 'Mossgate', 'Thornwall', 'Willow', 'Canopy'] },
  { name: 'Violet Dominion', adjective: 'Violet', color: '#bc83ea', dark: '#422b61', capital: 'Amethyst', cities: ['Amethyst', 'Iris', 'Mauve', 'Nightbloom', 'Orchid'] }
];

export const AGES = [
  { name: 'Age of Origins', subtitle: 'Settlements become empires' },
  { name: 'Age of Discovery', subtitle: 'Knowledge redraws the world' },
  { name: 'Age of Ascendance', subtitle: 'Civilizations reach for the sky' }
];

export const MAP_SIZES = {
  compact: { name: 'Compact', cols: 14, rows: 10 },
  standard: { name: 'Standard', cols: 18, rows: 12 },
  grand: { name: 'Grand', cols: 24, rows: 15 }
};

export const DIFFICULTIES = {
  explorer: { name: 'Explorer', aiYield: 0.82, aiStrength: 0.88, description: 'Relaxed expansion and forgiving combat.' },
  sovereign: { name: 'Sovereign', aiYield: 1, aiStrength: 1, description: 'Balanced AI and an even contest.' },
  immortal: { name: 'Immortal', aiYield: 1.3, aiStrength: 1.18, description: 'Faster rivals with a combat advantage.' }
};

export const PRODUCTION_ITEMS = {
  ...Object.fromEntries(Object.entries(UNITS).map(([id, item]) => [`unit:${id}`, { ...item, id, type: 'unit' }])),
  ...Object.fromEntries(Object.entries(BUILDINGS).map(([id, item]) => [`building:${id}`, { ...item, id, type: 'building' }]))
};
