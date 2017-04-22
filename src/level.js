'use strict';

/**
 * @constructor
 */
var Level = function(options) {
    var defaults = {
        width: 5,
        depth: 5,
        cameraAspect: 16 / 9
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.state = new GJS.StateMachine({stateSet: Level.State, id: Level.State.INTRO});
    
    this.scene = new THREE.Scene();
    this.gardenParent = new THREE.Object3D(); // Corner of the garden. At ground level.
    this.scene.add(this.gardenParent);
    
    if (DEV_MODE) {
        var axisHelper = new THREE.AxisHelper( 3.5 );
        this.gardenParent.add( axisHelper );
    }

    this.camera = new THREE.PerspectiveCamera( 40, this.cameraAspect, 1, 500000 );
    this.raycaster = new THREE.Raycaster();
    
    this.objects = [];

    this.cameraControl = new GJS.OrbitCameraControl({
        camera: this.camera,
        lookAt: this.getLookAtCenter(),
        y: 5,
        relativeY: false,
        orbitAngle: Math.PI * 0.9
    });

    // Test level objects
    var dinnerTable = new DinnerTable({sceneParent: this.gardenParent});
};

Level.State = {
    INTRO: 0,
    IN_PROGRESS: 1,
    SUCCESS: 2,
    FAIL: 3
};

Level.dinnerTableMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

Level.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    this.cameraControl.update(deltaTime);
    this.cameraControl.setLookAt(this.getLookAtCenter());

    // TODO: Remove this. Here just to test the rendering.
    this.cameraControl.moveOrbitAngle(deltaTime * 0.1);

    for (var i = 0; i < this.objects.length; ++i) {
        this.objects[i].update(deltaTime);
    }
};

Level.prototype.render = function(renderer) {
    renderer.render(this.scene, this.camera);
};

Level.prototype.getLookAtCenter = function() {
    return new THREE.Vector3(0.0, 0.0, 0.0);
};
