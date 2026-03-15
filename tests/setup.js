// Simulate browser global so window.Game = window.Game || {} works
global.window = global;
// Load config first — all other modules depend on Game.Config
require('../js/config.js');
