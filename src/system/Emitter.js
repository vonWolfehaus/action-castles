/*
	A basic particle emitter: point and area emission, and a few dynamic force types.
	Does not require an entity.
	Based on https://github.com/city41/particle.js
	@author Corey Birnbaum http://coldconstructs.com/ @vonWolfehaus
*/
mh.Emitter = function(entity, settings) {
	settings = settings || {};
	mh.Base.call(this);

	// adjustable properties available to override in settings
	this.width = 10; // setting a nice default
	this.height = 10;
	this.container = mh.mh.kai.stage; // puts particles on top of everything
	this.blend = false;

	this.emitType = mh.Emitter.EmitType.Point;
	this.emitDuration = -1; // how long to emit for, in seconds, or -1 for forever
	this.emitAngle = 0; // angle at which particles are emitted only in radians
	this.emitAngleVar = mh.util.TAU; // "spread" of emission based around emitAngle in radians; default is full circle
	this.emitSpeed = 10;
	this.emitSpeedVar = 0;
	this.emitRate = 30; // how many per second

	this.particleDuration = 1; // in seconds
	this.particleDurationVar = 0;
	this.particleScaleInit = 1; // 0 - 1
	this.particleScaleVar = 0; // 0 - 1
	// this.particleScaleAccel = 1;

	this.particleAlphaInit = 1; // 0 - 1
	this.particleAlphaAccel = -2; // how fast to fade in (positive) or out (negative)
	this.particleAlphaAccelDelay = 0.5; // seconds to wait before applying alpha accel

	this.particleRotationAccel = 0; // particle sprite spin speed
	this.particleRotationAccelVar = 0.2; // randomize starting particle sprite rotation speed

	this.particleRadialAccel = 0;
	this.particleRadialAccelVar = 0;

	this.particleTangentialAccel = 0;
	this.particleTangentialAccelVar = 0;

	this.particleGravity = null;

	mh.util.overwrite(this, settings);

	this.particleGravity = this.particleGravity || {x: 0, y: 0};

	// public
	this.entity = entity || null; // avoiding undefined
	this.duration = 0;
	this.position = new mh.Vec2(); // get rid of Pixi's Point in favor of Vec2
	if (!this.uri) {
		throw new Error('[Emitter] You must pass in an image uri through the settings parameter');
	}
	// this.texture = PIXI.Texture.fromImage(settings.uri);
	// this.texture.frame = new PIXI.Rectangle(this.offsetX, this.offsetY, this.width, this.height);

	// base
	this.uniqueID = mh.util.generateID();
	this.active = false;

	// private
	this._force = new mh.Vec2(); // aggregate force applied to each particle on update(), resets on each iteration, do not use
	this._vec = new mh.Vec2(); // scratch Vec2 for update(), do not use
	this._emitTimer = 0;
	this._pool = new mh.DualPool(mh.Particle, this, 15);
	this._emissionSum = 0;
};

// inherit from PIXI SpriteBatch
// mh.Emitter.prototype = Object.create(PIXI.SpriteBatch.prototype);
mh.Emitter.prototype.constructor = mh.Emitter;

// required statics for component system
mh.Emitter.accessor = 'emitter'; // property name as it sits on an entity
mh.Emitter.className = 'EMITTER'; // name of component on the definition list object
mh.Emitter.priority = 50; // general position in the engine's component array; updated in ascending order


/*-------------------------------------------------------------------------------
									COMPONENT INTERFACE
-------------------------------------------------------------------------------*/

mh.Emitter.prototype.activate = function() {
	this.active = true;
	this.container.addChild(this);
	this.visible = true;
	this.duration = 0;
	this._emissionSum = this.emitRate * mh.kai.elapsed;
};

mh.Emitter.prototype.disable = function() {
	this.active = false;
	this.container.removeChild(this);
	this._pool.freeAll();
};

mh.Emitter.prototype.update = function() {
	var i, p, o, l = this._pool.busy; // only loop through active particles

	this.duration += mh.kai.elapsed;
	if (this.emitDuration === -1 || this.duration < this.emitDuration) {
		// we can still emit
		this._emissionSum += this.emitRate * mh.kai.elapsed;
		if (this._emissionSum >= 1) {
			i = Math.floor(this._emissionSum);
			this.emit(i);
			this._emissionSum -= i;
		}
	}
	else {
		// we are done emitting but we need to wait until all particles finish
		if (this._pool.busy.length === 0) {
			this.disable();
			return;
		}
	}

	o = l.first;
	while (o) {
		p = o.obj; // update our active particles
		o = o.next;

		p.duration += mh.kai.elapsed;
		if (p.alpha < 0 || p.duration >= this.particleDuration) {
			p.visible = false; // no need to disable, it gets taken out of the busy list when recycled
			this._pool.recycle(p);
			continue;
		}

		if (p.fadeDelay <= 0) {
			p.alpha += this.particleAlphaAccel * mh.kai.elapsed;
		}
		else {
			p.fadeDelay -= mh.kai.elapsed;
		}

		this._vec.set(p.vx, p.vy); // normalized velocity
		this._force.copy(this._vec); // velocity

		this._force.multiplyScalar(p.radialAccel);

		this._vec.normalize();
		this._vec.perp();
		this._vec.multiplyScalar(p.tangentialAccel);
		// sum acceleration forces and integrate
		p.vx += (this._force.x + this._vec.x + this.particleGravity.x) * mh.kai.elapsed;
		p.vy += (this._force.y + this._vec.y + this.particleGravity.y) * mh.kai.elapsed;
		p.position.x += p.vx * mh.kai.elapsed;
		p.position.y += p.vy * mh.kai.elapsed;
		p.rotation += p.rotationAccel * mh.kai.elapsed;
	}
};

mh.Emitter.prototype.dispose = function() {
	this.removeChildren();
	this.texture.destroy();
	this._pool.dispose();
	this._pool = null;
	this.forces = null;
};

/*-------------------------------------------------------------------------------
									PUBLIC
-------------------------------------------------------------------------------*/

mh.Emitter.prototype.emit = function(amt) {
	var Type = mh.Emitter.EmitType;
	var a, i, ii, p;
	// positions are relative to emitter (Pixi handles child coordinates)
	for (i = 0; i < amt; i++) {
		p = this._pool.get();
		p.activate();
		p.duration = mh.util.random(this.particleDurationVar);
		p.rotation = mh.util.random(this.particleRotationAccelVar * mh.util.TAU);
		ii = this.particleScaleInit + mh.util.random(this.particleScaleVar);
		p.scale.set(ii, ii);
		p.alpha = this.particleAlphaInit;
		p.fadeDelay = this.particleAlphaAccelDelay;
		// p.blendMode = this.blend ? PIXI.blendModes.ADD : PIXI.blendModes.NORMAL;
		// velocity
		a = this.emitAngle + mh.util.random(this.emitAngleVar);
		ii = this.emitSpeed + mh.util.random(this.emitSpeedVar);
		p.vx = Math.cos(a) * ii;
		p.vy = -Math.sin(a) * ii;
		// forces
		p.radialAccel = this.particleRadialAccel + mh.util.random(this.particleRadialAccelVar);
		p.tangentialAccel = this.particleTangentialAccel + mh.util.random(this.particleTangentialAccelVar);
		p.rotationAccel = this.particleRotationAccel + mh.util.random(this.particleRotationAccelVar);
		// position
		switch (this.emitType) {
			case Type.Rect:
				p.position.x = mh.util.randomInt(this._width);
				p.position.y = mh.util.randomInt(this._height);
				break;
			case Type.Circle:
				a = Math.random() * mh.util.TAU;
				ii = Math.random();
				p.position.x = ii * this._width * Math.cos(a);
				p.position.y = ii * this._height * Math.sin(a);
				break;
			case Type.CircleUniform:
				a = Math.random() * mh.util.TAU;
				ii = Math.sqrt(Math.random());
				p.position.x = ii * this._width * Math.cos(a);
				p.position.y = ii * this._height * Math.sin(a);
				break;
			case Type.Ring:
				a = mh.util.random(mh.util.TAU);
				p.position.x = Math.cos(a) * this._width;
				p.position.y = Math.sin(a) * this._height;
				break;
			default: // Point
				p.position.x = 0;
				p.position.y = 0;
				break;
		}
	}
};

/*-------------------------------------------------------------------------------
									STATIC
-------------------------------------------------------------------------------*/

mh.Emitter.EmitType = {
	Point: 0,
	Rect: 2,
	Circle: 4,
	CircleUniform: 5,
	Ring: 6
};

/*-------------------------------------------------------------------------------
									PARTICLE
-------------------------------------------------------------------------------*/

/*
	The Emitter will instantiate these as necessary, so you only need to mess with the Emitter and it will efficiently apply it to its children.
*/
mh.Particle = function(parent) {
	// PIXI.Sprite.call(this, parent.texture);
	this.uniqueID = mh.util.generateID();

	parent.addChildAt(this, 0);
	this.anchor.set(0.5, 0.5);
	// TODO: frame either the whole sprite or if its width is greater than its height, choose random frame

	this.active = false;
	this.visible = false;
	this.duration = 0;
	this.fadeDelay = 0;
	this.vx = 0;
	this.vy = 0;
	this.radialAccel = 0;
	this.tangentialAccel = 0;
	this.rotationAccel = 0;
};

// inherit from PIXI Sprite
// mh.Particle.prototype = Object.create(PIXI.Sprite.prototype);
mh.Particle.prototype.constructor = mh.Particle;

mh.Particle.prototype.activate = function() {
	// many of these are overwritten by the emitter when spawned
	this.active = true;
	this.visible = true;
	this.alpha = 1;
	this.duration = 0;
	this.rotation = 0;
	this.vx = 0;
	this.vy = 0;
	this.radialAccel = 0;
	this.tangentialAccel = 0;
	this.rotationAccel = 0;
};

mh.Particle.prototype.disable = function() {
	this.active = false;
	this.visible = false;
};
