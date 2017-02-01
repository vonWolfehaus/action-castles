
/*
	Handles lifecycle of gamepads.
	@author Corey Birnbaum http://coldconstructs.com/ @vonWolfehaus
*/
var GamepadController = function() {
	var XboxGamepad = require('../system/XboxGamepad');

	this.controllers = [];
	this.onConnect = new mh.Signal();
	this.onDisconnect = new mh.Signal();
	this.activeControllers = 0;

	// private
	this._controllerStatus = [];

	for (var i = 0; i < 4; i++) {
		this.controllers[i] = new XboxGamepad(i);
		this._controllerStatus[i] = false;
	}

	window.addEventListener('gamepadconnected', this._onConnect.bind(this), false);
	window.addEventListener('gamepaddisconnected', this._onDisconnect.bind(this), false);
};

GamepadController.prototype = {
	constructor: GamepadController,

	update: function() {
		var i, ctrl;
		if (navigator.getGamepads) {
			this._scan(); // very poorly designed, Mozilla... use events, not polling for this!
		}
		// don't need to update for this game since the gamepads are components that get updated automatically by motorhaus
		for (i = 0; i < 4; i++) {
			ctrl = this.controllers[i];
			if (ctrl.active) {
				ctrl.update();
			}
		}
	},

	dispose: function() {
		for (i = 0; i < 4; i++) {
			this.controllers[i].dispose();
		}
		// null references
		this.controllers = null;
		this.onConnect.dispose();
		this.onDisconnect.dispose();
		this.onConnect = null;
		this.onDisconnect = null;
		this._controllerStatus = null;
	},

	_addPad: function(gamepad) {
		var ctrl = this.controllers[gamepad.index];
		ctrl.register(gamepad);

		this.onConnect.dispatch(ctrl);
		this.activeControllers++;
		// console.log('addPad');
	},

	_removePad: function(gamepad) {
		var ctrl = gamepad.index ? this.controllers[gamepad.index] : this.controllers[gamepad];
		ctrl.unregister();

		this.onDisconnect.dispatch(ctrl);
		this.activeControllers--;
		// console.log('removePad');
	},

	_onConnect: function(evt) {
		this._addPad(evt.gamepad);
	},

	_onDisconnect: function(evt) {
		this._removePad(evt.gamepad);
	},

	_scan: function() {
		var i, gamepads = navigator.getGamepads();
		for (i = 0; i < gamepads.length; i++) {
			if (gamepads[i]) {
				if (this._controllerStatus[i]) {
					// this is fucking pathetic, we should be getting live references!
					this.controllers[i].setPad(gamepads[i]);
				}
				else {
					this._addPad(gamepads[i]);
					this._controllerStatus[i] = true;
				}

			}
			else if (!gamepads[i] && this._controllerStatus[i]) {
				this._removePad(i);
				this._controllerStatus[i] = false;
			}
		}
	}
};

module.exports = GamepadController;
