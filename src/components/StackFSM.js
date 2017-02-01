/*
	Stack-based Finite State Machine.
	@author Corey Birnbaum http://coldconstructs.com/ @vonWolfehaus
*/
var StackFSM = function(entity) {
	mh.Base.call(this);

	// public properties
	this.state = null;
	this.stack = [];
	this.entity = entity;

	this.stateChanged = new mh.Signal();

	// private
	this._activeContext = null;
	this._activeFunction = null;
	this._prevFunction = null;
};

// required statics for component system
StackFSM.accessor = 'stack'; // property name as it sits on an entity
StackFSM.className = 'STACK_FSM'; // name of component on the component definition object
StackFSM.priority = 5; // general position in the engine's component array; the lower, the earlier it's updated
StackFSM.post = false; // whether or not this component will have a postUpdate() called on it

StackFSM.prototype = {
	constructor: StackFSM,

	activate: function() {
		this.active = true;
	},

	disable: function() {
		this.active = false;
		this.reset();
	},

	reset: function() {
		this.stack.length = 0;
		this._prevFunction = null;
		this._activeFunction = null;
	},

	pushState: function(state, ctx) {
		if (state !== this._activeFunction) {
			this.stack.push(state);
			this._activeContext = ctx;

			if (!this.active) {
				this.activate();
			}
		}
	},

	popState: function() {
		this.stack.pop();
		this._activeFunction = this.stack.length ? this.stack[this.stack.length - 1] : null;
		if (!this._activeFunction) {
			this.stateChanged.dispatch(this.state, 'null');
			this._prevFunction = null;
			this.disable();
		}
	},

	update: function() {
		this._activeFunction = this.stack.length ? this.stack[this.stack.length - 1] : null;
		if (this._activeFunction) {
			// monitor changes so entity can react to unique situations
			if (this._activeFunction !== this._prevFunction) {
				this.state = this._activeFunction.name;
				this.stateChanged.dispatch(this._prevFunction ? this._prevFunction.name : 'null', this.state);
				this._prevFunction = this._activeFunction;
			}

			this._activeFunction.call(this._activeContext);
		}
	},

	dispose: function() {
		this.entity = null;
		this._activeFunction = null;
		this._prevFunction = null;
		this.stack = null;
		this.stateChanged.dispose();
		this.stateChanged = null;
	}
};

module.exports = StackFSM;