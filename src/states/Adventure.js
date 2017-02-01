module.exports = {
	create: function() {
		this.ready = false;
		this.grid = new vg.SqrGrid();
		this.grid.load('./assets/maps/test1.json', this.start, this)
		game.grid = this.grid;
		// console.log(game.world)

		mh.tower.playerCommand = new mh.Signal();
	},

	start: function() {
		var Box = require('../entities/Box');

		var board = new vg.Board(this.grid);
		game.board = board;

		var gen = new vg.GeneratedTileManager(board);
		gen.makeTiles();

		mh.kai.view.add(board.group);
		mh.kai.view.focusOn(board.group);

		var World = require('../system/World');
		game.world = new World();

		var b = new Box(new THREE.Vector3(-15, 10, -5));
		b.activate();
		this.player = b;

		this.ready = true;
	},

	update: function() {
		if (!this.ready) return;

		game.input.update();
		game.world.update();
		mh.kai.view.render();
	},

	dispose: function() {
		// game.board.dispose();
		game.input.dispose();
		game.grid.dispose();
		game.world.dispose();

		mh.tower.playerCommand.dispose();
	}
};
