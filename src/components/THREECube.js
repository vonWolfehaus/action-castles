/*
	Abstracts threejs cube creation so it integrates nicely into our entity-component system.
	@author Corey Birnbaum http://coldconstructs.com/ @vonWolfehaus
*/
var THREECube = function(entity, settings) {
	settings = settings || {};
	mh.Base.call(this);

	// attributes
	this.textureUrl = null;
	this.container = mh.kai.view;
	this.size = settings.size || [3, 6, 3];
	// this.dynamic = false;
	this.color = 0x156289;
	this.emissive = 0x072534;

	mh.util.overwrite(this, settings);

	// private properties
	this.entity = entity;
	this._display = null;

	// NEVER do this in production! geo and materials should be cached!
	// But I'm on vacation and this is prototype code so, meh
	var cubeGeo = new THREE.CubeGeometry(this.size[0], this.size[1], this.size[2]);
	var cubeMaterial = new THREE.MeshPhongMaterial({
		color: settings.color || 0x156289,
		shading: THREE.FlatShading,
		map: this.textureUrl ? THREE.ImageUtils.loadTexture(this.textureUrl) : null
	});

	this._display = new THREE.Mesh(cubeGeo, cubeMaterial);
	this._display.castShadow = true;
	this._display.receiveShadow = true;

	/*if (!this.dynamic) {
		this._display.matrixAutoUpdate = false;
		this._display.position.copy(entity.position);
		this._display.updateMatrix();
	}*/

	// prerequisite components
	this.position = mh.kai.expect(entity, 'position', THREE.Vector3);
	this.rotation = mh.kai.expect(entity, 'rotation', THREE.Vector3);
};

// required statics for component system
THREECube.accessor = 'view'; // property name as it sits on an entity
THREECube.className = 'VIEW_CUBE'; // name of component on the mh.Component object
THREECube.priority = 10; // general position in the engine's component array; highest updated first

THREECube.prototype = {
	constructor: THREECube,

	activate: function() {
		this.active = true;
		this.container.add(this._display);
	},

	disable: function() {
		this.active = false;
		this.container.remove(this._display);
	},

	update: function() {
		this._display.position.copy(this.position);
		this._display.rotation.setFromVector3(this.rotation);
	},

	dispose: function() {
		this.disable();

		// null references
		this.entity = null;
		this.position = null;
		this._display = null; // if you don't dispose() THREE Geometry, you'll get memory leaks FYI
	}
};

module.exports = THREECube;
