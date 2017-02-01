/*
	Used solely by World.js to provide collision boxes for tiles.
*/
var TileAABB = function() {
	mh.Base.call(this); // always extend Base

	this.solid = true;
	this.static = true;
	this.width = 10;
	this.height = 50;
	this.depth = 10;
	this.maxSpeed = 0;

	this.mass = 0; // 0 is immobile
	this.invmass = 0; // never adjust this directly! use setMass() instead
	this.restitution = 0.6; // bounciness, 0 to 1

	this.collisionID = 1;
	this.collisionGroup = null;
	this.type = game.Types.STATIC;

	// this.onCollision = new vgp.Signal();

	this.position = new THREE.Vector3();
	this.velocity = new vgp.Vec(); // never changes obvi

	this.min = new vgp.Vec();
	this.max = new vgp.Vec();
	this.half = new vgp.Vec(this.width/2, this.height/2, this.depth/2);

	// DEBUG
	if (game.debug) {
		var cubeGeo = new THREE.CubeGeometry(this.width, this.height, this.depth);
		var cubeMaterial = new THREE.MeshBasicMaterial({
			color: 0x08e26c,
			wireframe: true,
			shading: THREE.FlatShading
		});
		this._debugMesh = new THREE.Mesh(cubeGeo, cubeMaterial);
		this.position = this._debugMesh.position;
	}
};

TileAABB.prototype = {
	constructor: TileAABB,

	activate: function(cell) {
		// console.log(cell)
		var tile = cell.tile;
		var worldPos = tile.position;
		this.position.x = worldPos.x + this.half.x;
		this.position.y = worldPos.y - this.half.y;
		this.position.z = worldPos.z + this.half.z;

		this.min.copy(this.position).sub(this.half);
		this.max.copy(this.position).add(this.half);

		if (this.active) return; // was already active from before (this object is only used by World)
		// console.log(this.collisionID)
		this.active = true;
		// game.world.add(this); // tileAABBs are automatically added to grid cells directly
		if (game.debug) {
			mh.kai.view.add(this._debugMesh);
		}
	},

	disable: function() {
		this.active = false;
		// game.world.remove(this);
		if (game.debug) {
			mh.kai.view.remove(this._debugMesh);
		}
	},

	dispose: function() {
		// this.onCollision.dispose();
		// this.onCollision = null;
		this.position = null;
		this.velocity = null;
		this.min = null;
		this.max = null;
		this.half = null;
	}
};

module.exports = TileAABB;
