var g = require('../global');
var Minion = require('./Minion');

// constructor
var Box3 = function(pos, settings) {
	settings = settings || {};
	mh.Base.call(this);

	// attributes
	this.size = [3, 6, 3];
	this.dynamic = true;
	this.type = game.Types.DYNAMIC;
	this.gameGroup = game.Groups.ALLY;
	this.runSpeed = 60;
	this.jumpSpeed = 200;
	this.airFriction = 0.5;
	this.pad = null;

	/*var sharedAttr = {
		size: this.size,
		dynamic: this.dynamic
	};

	mh.util.merge(sharedAttr, settings);*/

	this.position = pos.clone();
	this.velocity = new THREE.Vector3();

	mh.kai.addComponent(this, g.Components.VIEW_CUBE, {
		size: this.size
	});
	mh.kai.addComponent(this, g.Components.BODY_AABB3, {
		width: this.size[0],
		height: this.size[1],
		depth: this.size[2],
		maxSpeed: 20,
		mass: 20
	});
	mh.kai.addComponent(this, g.Components.STACK_FSM);

	this.body.onCollision.add(this.onCollide, this);

	var self = this;
	// TODO: notify user if pad is there or not
	game.input.onConnect.add(function(ctrl) {
		self.pad = ctrl;
		ctrl.onDown.add(self.onBtnPress, self);
	});

	game.input.onDisconnect.add(function(ctrl) {
		self.pad = null;
	});

	this._jumpCount = 0;
	this._curVel = new THREE.Vector3();
	this._vec = new THREE.Vector3();
	this._up = new THREE.Vector3(0, -1, 0);
	this._originalCamRot = game.cameraRig.orbitOffset;
};

Box3.prototype = {
	constructor: Box3,

	/*-------------------------------------------------------------------------------
									PUBLIC
	-------------------------------------------------------------------------------*/

	activate: function() {
		this.view.activate();
		this.body.activate();

		this.stack.pushState(this.idle, this);
	},

	disable: function() {
		this.view.disable();
		this.body.disable();
		this.stack.reset();
	},

	onBtnPress: function(btnId, btnObj) {
		switch (btnId) {
			case mh.XBOX.X:
				mh.tower.playerCommand.dispatch(g.Commands.DEFEND_ME, this.position);
				break;
			case mh.XBOX.Y:
				var m = new Minion();
				// console.log(this.position)
				m.activate(this.position.x+mh.util.random(3), this.position.y, this.position.z+mh.util.random(3));
				break;
			case mh.XBOX.A:
				// -14.9 is the rate of gravity in this game
				if (!this.jumping && this.velocity.y >= -14.9) {
					this.jumping = true;
					// this.position.y += 0.5;
					this.velocity.multiplyScalar(1.5);
					this.velocity.y += this.jumpSpeed;
					this.body.accel.y += this.jumpSpeed;
					this._curVel.x = this.velocity.x;
					this._curVel.z = this.velocity.z;
				}
				break;
			case mh.XBOX.LB:
				game.cameraRig.targetOrbit -= mh.util.PI;
				break;
			case mh.XBOX.RB:
				if (game.debug) {
					game.cameraRig.targetOrbit = this._originalCamRot; // TODO: modulus so limit to -360, 360
				}
				else {
					game.cameraRig.targetOrbit += mh.util.PI;
				}
				break;
		}
	},

	onCollide: function(other, manifold) {
		if (other.type === game.Types.STATIC) {
			// check manifold for a collision underneath us, meaning we just collided with the ground from a jump
			if (this.jumping/* && manifold.normal.y < 0*/) {
				this.jumping = false;
				console.log(manifold.normal.y)
				// if so, do particle effect and make sound
			}
			else if (manifold.normal.x != 0 || manifold.normal.z != 0) {
				// if the player runs into a static object (ie a tile), check its height - if it's a step, then...
				if (Math.round(other.position.y + other.half.y - this.position.y - this.body.half.y) === -game.board.tileHeightStep) {
					// ...automatically step up the entity
					this.position.y += game.board.tileHeightStep + 0.1; // TODO: WTF it only steps onto tiles coming from a positive direction??
				}
			}
		}
	},

	idle: function() {
		if (!this.pad) return;

		// rightStick orbits camera, also track player around
		game.cameraRig.update(this.position, game.debug ? this.pad.rightAxis.x * 0.05 : 0);
		game.cameraRig.cam.zoom -= this.pad.rightAxis.y * 0.05;
		game.cameraRig.cam.updateProjectionMatrix();

		// TODO: fix: up/down/etc get reveresed when camera is at 90 degrees from default angle
		this._vec.x = this.pad.leftAxis.x;
		this._vec.z = this.pad.leftAxis.y;
		this._vec.applyAxisAngle(this._up, game.cameraRig.orbitOffset + 0.785398163397);

		if (this.jumping) {
			this.velocity.x = this._curVel.x + this._vec.x * (this.runSpeed * this.airFriction);
			this.velocity.z = this._curVel.z + this._vec.z * (this.runSpeed * this.airFriction);
		}
		else {
			this.velocity.x = this._vec.x * this.runSpeed;
			this.velocity.z = this._vec.z * this.runSpeed;
		}

		/*if (this.jumping) {
			this.velocity.x = this._curVel.x + this.pad.leftAxis.x * (this.runSpeed * this.airFriction);
			this.velocity.z = this._curVel.z + this.pad.leftAxis.y * (this.runSpeed * this.airFriction);
		}
		else {
			this.velocity.x = this.pad.leftAxis.x * this.runSpeed;
			this.velocity.z = this.pad.leftAxis.y * this.runSpeed;
		}*/


	},

	dispose: function() {
		// dispose components
		mh.kai.removeComponent(this, g.Components.VIEW_CUBE);
		mh.kai.removeComponent(this, g.Components.BODY_AABB3);
		mh.kai.removeComponent(this, g.Components.STACK_FSM);

		// null references
		this.position = null;
		this.velocity = null;
	}

};

module.exports = Box3;
