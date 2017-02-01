var g = require('../global');
var steer = require('../system/steering');

var Minion = function() {
	mh.Base.call(this);

	// attributes
	this.size = [2, 3, 2];
	this.dynamic = true;
	this.type = game.Types.DYNAMIC;
	this.gameGroup = game.Groups.ALLY;
	this.maxSpeed = 60;
	this.jumpSpeed = 300;
	this.airFriction = 0.5;

	this.path = null;

	// base components
	this.position = new THREE.Vector3();
	this.velocity = new THREE.Vector3();

	// complex components
	mh.kai.addComponent(this, g.Components.VIEW_CUBE, {
		size: this.size,
		color: 0x14c21c
	});
	mh.kai.addComponent(this, g.Components.BODY_AABB3, {
		width: this.size[0],
		height: this.size[1],
		depth: this.size[2],
		maxSpeed: 40,
		mass: 1
	});
	mh.kai.addComponent(this, g.Components.BOID, {

	});
	mh.kai.addComponent(this, g.Components.STACK_FSM);

	mh.tower.playerCommand.add(this.onCommand, this);
};

Minion.prototype = {
	constructor: Minion,

	activate: function(posx, posy, posz) {
		this.active = true;
		this.position.set(posx, posy, posz);

		this.view.activate();
		this.body.activate();
		this.boid.activate();

		this.stack.pushState(this.idle, this);
	},

	disable: function() {
		this.active = false;
		this.view.disable();
		this.body.disable();
		this.boid.disable();
		this.stack.reset();
	},

	dispose: function() {
		// dispose components
		mh.kai.removeComponent(this, g.Components.VIEW_CUBE);
		mh.kai.removeComponent(this, g.Components.BODY_AABB3);
		mh.kai.removeComponent(this, g.Components.STACK_FSM);

		// null references
		this.position = null;
		this.velocity = null;
	},

	onCollide: function(other, manifold) {

	},

	onCommand: function(command, data) {
		// console.log('[Minion] received command:', command);
		switch (command) {
			case g.Commands.DEFEND_ME:
				/*var cellA = game.grid.getCellAt(this.position);
				var cellB = game.grid.getCellAt(data);
				var path = game.board.finder.findPath(cellA, cellB, this.pathingHeuristic, game.grid);
				for (var i = 0; i < path.length; i++) {
					path[i] = path[i].tile.position;
				}
				this.path = path;
				this.boid._currentPathNode = 0;*/
				this.path = data;
				// console.log(path)
				break;
		}
	},

	idle: function() {
		if (this.path) {
			// steer.followPath(this.boid, this.path, false);
			steer.seek(this.boid, this.path);
		}
	},

	pathingHeuristic: function(origin, next) {
		// example of how to filter out neighbors that are too tall to traverse
		// but allows the algorithm to "jump" down to whatever depth
		if (next.h - origin.h > 10) {
			return false; // no, filter out next
		}
		return true; // yes, keep next for consideration
	}

};

module.exports = Minion;
