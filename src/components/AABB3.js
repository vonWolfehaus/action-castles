var AABB3 = function(entity, settings) {
	settings = settings || {};
	this.entity = entity || {};
	mh.Base.call(this); // always extend Base

	this.solid = true;
	this.static = false; // you can have a dynamic object that is immesurably heavy, but this will speed things up
	this.width = 50;
	this.height = 50;
	this.depth = 50;
	this.maxSpeed = 10;

	this.mass = 1; // 0 is immobile
	this.invmass = 0; // never adjust this directly! use setMass() instead
	this.restitution = 0.8; // bounciness, 0 to 1

	this.autoAdd = true;
	this.boundaryBehavior = vgp.Boundary.BOUNDARY_BOUNCE;
	this.collisionID = this.uniqueID;
	this.collisionGroup = null;
	this.type = entity.type;

	this.onCollision = new vgp.Signal();

	// attribute override
	vgp.utils.merge(this, settings);

	this.position = entity && entity.position ? entity.position : new THREE.Vector3();
	this.velocity = entity && entity.velocity ? entity.velocity : new THREE.Vector3();
	this.accel = entity && entity.accel ? entity.accel : new THREE.Vector3();

	this.min = new vgp.Vec();
	this.max = new vgp.Vec();
	this.half = new vgp.Vec(this.width/2, this.height/2, this.depth/2);

	// DEBUG
	if (game.debug) {
		var cubeGeo = new THREE.CubeGeometry(this.width, this.height, this.depth);
		var cubeMaterial = new THREE.MeshBasicMaterial({
			color: 0x891567,
			wireframe: true,
			shading: THREE.FlatShading
		});
		this._debugMesh = new THREE.Mesh(cubeGeo, cubeMaterial);
	}

	this._v = new vgp.Vec();

	// init
	this.setMass(this.mass);
	this.update();

	// prerequisite components
	this.position = mh.kai.expect(entity, 'position', THREE.Vector3);
};

// required statics for component system
AABB3.accessor = 'body'; // property name as it sits on an entity
AABB3.className = 'BODY_AABB3'; // name of component on the mh.Component object
AABB3.priority = 100; // general position in the engine's component array; updated in ascending order

AABB3.prototype = {
	constructor: AABB3,

	activate: function() {
		this.active = true;
		this.min.copy(this.position).sub(this.half);
		this.max.copy(this.position).add(this.half);

		if (this.autoAdd) {
			game.world.add(this);
		}

		if (game.debug) {
			mh.kai.view.add(this._debugMesh);
		}
	},

	disable: function() {
		this.velocity.set();
		this.accel.set();
		this.active = false;
		game.world.remove(this);

		if (game.debug) {
			mh.kai.view.remove(this._debugMesh);
		}
	},

	setMass: function(newMass) {
		this.mass = newMass;
		if (newMass <= 0) {
			this.invmass = 0;
		} else {
			this.invmass = 1 / newMass;
		}
	},

	setEntity: function(entity, settings) {
		this.position = entity.position ? entity.position : new THREE.Vector3();
		this.velocity = entity.velocity ? entity.velocity : new THREE.Vector3();
		this.accel = entity.accel ? entity.accel : new THREE.Vector3();

		settings = settings || {};
		vgp.utils.merge(this, settings);
	},

	reset: function() {
		this.setMass(this.mass); // make sure invmass is set
	},

	update: function() {
		if (this.static) return;

		var world = game.world;
		var l = this.accel.length();
		if (l !== 0 && l > this.maxSpeed) {
			this.accel.divideScalar(l);
			this.accel.multiplyScalar(this.maxSpeed);
		}

		this.accel.add(world.gravity);
		if (this.entity.jumping) {
			// let them "float" a little so they can jump farther
			this.accel.y -= world.gravity.y * 0.6;
		}

		this.velocity.multiplyScalar(world.friction);
		this.velocity.add(this.accel);

		this._v.copy(this.velocity).multiplyScalar(world.elapsed);
		this.position.add(this._v);

		this.min.copy(this.position).sub(this.half);
		this.max.copy(this.position).add(this.half);

		if (this.min.x < world.min.x) {
			this.position.x = world.min.x + this.half.x;
			this.velocity.x = -this.velocity.x * this.restitution;
		}
		else if (this.max.x > world.max.x) {
			this.position.x = world.max.x - this.half.x;
			this.velocity.x = -this.velocity.x * this.restitution;
		}

		if (this.min.z < world.min.z) {
			this.position.z = world.min.z + this.half.z;
			this.velocity.z = -this.velocity.z * this.restitution;
		}
		else if (this.max.z > world.max.z) {
			this.position.z = world.max.z - this.half.z;
			this.velocity.z = -this.velocity.z * this.restitution;
		}

		if (game.debug) {
			this._debugMesh.position.copy(this.position);
		}
	},

	dispose: function() {
		this.onCollision.dispose();
		this.onCollision = null;
		this.entity = null;
		this.position = null;
		this.velocity = null;
		this.accel = null;
		this.min = null;
		this.max = null;
	}
};

module.exports = AABB3;
