var g = {
	board: null,
	grid: null,
	world: null,
	nextLevel: 0,

	inputBlocked: false,
	input: null,

	cameraRig: null,

	Components: null,
	Types: {
		STATIC: 'static', // all static environment objects like tiles, trees, buildings
		DYNAMIC: 'dynamic', // regular entities
		FAST: 'fast' // projectiles and weapons
	},
	Groups: {
		ENEMY: 'enemy',
		ALLY: 'ally'
	},
	Commands: {
		DEFEND_ME: 'defend me',
		DEFEND_CASTLE: 'defend our castle',
		ATTACK: 'attack',
		ATTACK_CASTLE: 'attack enemy castle'
	}
};

module.exports = g;
window.game = g; // you should NEVER put anything in the global scope but then again you shouldn't make web games either
