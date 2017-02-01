var engine = new mh.Engine();
var g = require('./global');
var CameraRig = require('./system/CameraRig');

g.debug = true;

var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
// hemiLight.color.setHSL(0.9, 1, 0.9);
hemiLight.color.setRGB(0.549, 0.78, 1);
// hemiLight.groundColor.setHSL(0.095, 1, 0.75); // brown
// hemiLight.groundColor.setRGB(0.549, 0.78, 1); // blue
// hemiLight.groundColor.setRGB(1, 0.949, 0.549); // yellow
hemiLight.position.set(0, 500, 0);

var dirLight = new THREE.DirectionalLight(0xffffff, 3);
// dirLight.color.setHSL( 0.1, 1, 0.95 );
dirLight.position.set(10, 10, 1);

mh.kai.view = new vg.Scene({
	element: document.getElementById('stage'),
	cameraPosition: {x:-100, y:100, z:100},
	light: dirLight,
	cameraType: 'OrthographicCamera',
	orthoZoom: 10
}, false);

mh.kai.view.container.add(hemiLight);
// mh.kai.view.enableShadows();

g.cameraRig = new CameraRig(mh.kai.view.camera);

var Pads = require('./system/GamepadController');
g.input = new Pads();

g.Components = mh.kai.registerComponents([
	require('./components/THREECube'),
	require('./components/StackFSM'),
	require('./components/Boid'),
	require('./components/AABB3')
]);

var firstState = 'Adventure';
engine.state.add(firstState, require('./states/Adventure'));
engine.start(firstState);
