var CameraRig = function(cam) {
	this.pivot = new THREE.Object3D();
	this.cam = cam;

	this.pivot.add(this.cam);
	mh.kai.view.add(this.pivot);

	this.pos = this.pivot.position;
	this.cam.lookAt(this.pos);

	this.orbitOffset = 0//3.92699; // 360 - 90 - 45 degrees in radians
	this.targetOrbit = this.orbitOffset;
	this._vec = new THREE.Vector3();
	this.targetPos = new THREE.Vector3();

	this.deadzone = 10;
	this.halfDeadzone = this.deadzone / 2;
	this.deadzoneY = 2;
};

CameraRig.prototype = {
	constructor: CameraRig,

	update: function(target, newAngleOffset) {
		/*
			the targetPos is a point inside a "box" as defined by deadzone, where the deadzone surrounds the target (the player),
			so when the target tries to go outside the box, that's when the targetPos will keep up. then using lerp it smoothly follows
			targetPos, creating a very simply free-roaming area for the target point that doesn't jar the player if they move around
			too fast. hopefully that makes sense but i'm writing all this code n comments drunk rn, sorry
		*/
		if (this.targetPos.x < target.x - this.deadzone) {
			this.targetPos.x = target.x - this.deadzone;
		}
		else if (this.targetPos.x > target.x + this.halfDeadzone) {
			this.targetPos.x = target.x + this.halfDeadzone;
		}

		if (this.targetPos.y < target.y - this.deadzoneY) {
			this.targetPos.y = target.y - this.deadzoneY;
		}
		else if (this.targetPos.y > target.y + this.deadzoneY) {
			this.targetPos.y = target.y + this.deadzoneY;
		}

		if (this.targetPos.z < target.z - this.halfDeadzone) {
			this.targetPos.z = target.z - this.halfDeadzone;
		}
		else if (this.targetPos.z > target.z + this.deadzone) {
			this.targetPos.z = target.z + this.deadzone;
		}

		this.pos.lerp(this.targetPos, 0.1);

		// rotate the camera smoothly
		this.targetOrbit += newAngleOffset;
		this.orbitOffset += (this.targetOrbit - this.orbitOffset) * 0.1;
		this.pivot.rotation.y = this.orbitOffset;
	}
};

module.exports = CameraRig;
