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
        var gridSize = Math.max(Level.gridWidth, Level.gridDepth);
        var divisions = gridSize;
        var gridHelper = new THREE.GridHelper(gridSize, divisions);
        gridHelper.position.y = 0.1;
        gridHelper.position.x = gridSize / 2;
        gridHelper.position.z = gridSize / 2;
        this.gardenParent.add(gridHelper);
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
    
    // TODO: Temporary ground, replace with scenery.
    var groundGeometry = new THREE.PlaneGeometry(Level.gridWidth, Level.gridDepth);
    groundGeometry.rotateX(-Math.PI * 0.5);
    this.scenery = new THREE.Mesh(groundGeometry, Level.groundMaterial);
    this.scenery.position.x = Level.gridWidth * 0.5;
    this.scenery.position.z = Level.gridDepth * 0.5;
    this.scene.add(this.scenery);

    this.playerCharacter = new PlayerCharacter({sceneParent: this.gardenParent, x: 1.5, z: 1.5});

    // Test level objects
    var dinnerTable = new DinnerTable({sceneParent: this.gardenParent, z: 2, x: 2, width: 2, depth: 3});
    
    this.collisionTileMap = new GJS.TileMap({
        width: Level.gridWidth,
        height: Level.gridDepth,
        initEdgeTile: function() {return 'x'}
    });
    
    if (DEV_MODE) {
        var colliderVisualizer = new THREE.Object3D();
        for (var x = 0; x < this.collisionTileMap.width; ++x) {
            for (var z = 0; z < this.collisionTileMap.height; ++z) {
                if (this.collisionTileMap.tiles[z][x] === 'x') {
                    var boxGeometry = new THREE.BoxGeometry(1, 1, 1);
                    var tileColliderVisualizer = new THREE.Mesh(boxGeometry, Level.colliderDebugMaterial);
                    tileColliderVisualizer.position.y = 0.5;
                    tileColliderVisualizer.position.x = x + 0.5;
                    tileColliderVisualizer.position.z = z + 0.5;
                    colliderVisualizer.add(tileColliderVisualizer);
                }
            }
        }
        this.gardenParent.add(colliderVisualizer);
    }
};

Level.gridWidth = 17;
Level.gridDepth = 17;

Level.State = {
    INTRO: 0,
    IN_PROGRESS: 1,
    SUCCESS: 2,
    FAIL: 3
};

Level.dinnerTableMaterial = new THREE.MeshBasicMaterial( { color: 0xeeeeee } );
Level.groundMaterial = new THREE.MeshBasicMaterial( { color: 0x66cc00 } );
Level.colliderDebugMaterial = new THREE.MeshBasicMaterial( { color: 0xff0088, wireframe: true } );

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
    return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5);
};
