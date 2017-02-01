mh.Health = function(entity, settings) {
	settings = settings || {};
	mh.Base.call(this);

	// attributes
	this.max = 100;
	this.overage = 0;
	this.alive = false;
	this.active = false; // this component doesn't need to be updated

	// attribute override
	mh.util.overwrite(this, settings);

	this.onDeath = new mh.Signal();
	this.onDamage = new mh.Signal();
	this.onHeal = new mh.Signal();
	this.onFull = new mh.Signal();
	this.onActivate = new mh.Signal();

	// private properties
	this.entity = entity;
	this._meter = 0;
};

// required statics for component system
mh.Health.accessor = 'health'; // property name as it sits on an entity
mh.Health.className = 'HEALTH'; // name of component on the ComponenDef object
mh.Health.priority = 100; // general position in the engine's component array; highest updated first

mh.Health.prototype = {
	constructor: mh.Health,

	activate: function() {
		this._meter = this.max;
		this.alive = true;
		this.onActivate.dispatch(this._meter, this.entity);
	},

	change: function(amount) {
		if (!this.alive) return 0;

		this._meter += amount;

		if (this._meter <= 0) {
			this._meter = 0;
			this.alive = false;

			this.onDeath.dispatch(amount, this.entity);
		}
		else {
			if (this._meter > this.max + this.overage) {
				this._meter = this.max;

				this.onFull.dispatch(amount);
			}

			if (amount < 0) this.onDamage.dispatch(amount);
			else this.onHeal.dispatch(amount);
		}

		return this._meter;
	},

	drain: function(amount) {
		if (!this.alive) return 0;

		if (this._meter > this.max) {
			this._meter -= amount;
			if (this._meter <= this.max) {
				this._meter = this.max;

				this.onFull.dispatch(amount);
			}
		}
		return this._meter;
	},

	dispose: function() {
		// remove signal callbacks
		this.onDeath.dispose();
		this.onDamage.dispose();
		this.onHeal.dispose();
		this.onFull.dispose();

		// null references
		this.entity = null;
		this.deathSignal = null;
		this.onDamage = null;
		this.onHeal = null;
		this.onFull = null;
	}
};
