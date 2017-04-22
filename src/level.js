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
    
    this.setupLights();

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
        y: 15,
        relativeY: false,
        orbitAngle: Math.PI * 1.5
    });
    
    // TODO: Temporary ground, replace with scenery.
    var groundGeometry = new THREE.PlaneGeometry(Level.gridWidth, Level.gridDepth);
    groundGeometry.rotateX(-Math.PI * 0.5);
    this.scenery = new THREE.Mesh(groundGeometry, Level.groundMaterial);
    this.scenery.position.x = Level.gridWidth * 0.5;
    this.scenery.position.z = Level.gridDepth * 0.5;
    this.scenery.castShadow = true;
    this.scenery.receiveShadow = true;
    this.scene.add(this.scenery);

    this.playerCharacter = new PlayerCharacter({level: this, sceneParent: this.gardenParent, x: 1.5, z: 1.5});
    this.objects.push(this.playerCharacter);

    // Test level objects
    var dinnerTable = new DinnerTable({sceneParent: this.gardenParent, z: 2, x: 2, width: 2, depth: 3});
    var chair = new Chair({sceneParent: this.gardenParent, z: 2, x: 4});

    // Note that we're using platforming physics, just without the gravity to resolve character collisions.
    this.collisionTileMap = new GJS.TileMap({
        width: Level.gridWidth,
        height: Level.gridDepth,
        initTile: function() { return new GJS.PlatformingTile(); },
        initEdgeTile: function() {return new GJS.WallTile(); }
    });
    this.physicalCollisionTileMap = new GJS.PlatformingTileMap();
    this.physicalCollisionTileMap.init({tileMap: this.collisionTileMap});

    this.hoverTarget = null;

    if (DEV_MODE) {
        var colliderVisualizer = new THREE.Object3D();
        var colliderBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
        for (var x = 0; x < this.collisionTileMap.width; ++x) {
            for (var z = 0; z < this.collisionTileMap.height; ++z) {
                if (this.collisionTileMap.tiles[z][x].isWall()) {
                    var tileColliderVisualizer = new THREE.Mesh(colliderBoxGeometry, Level.colliderDebugMaterial);
                    tileColliderVisualizer.position.y = 0.5;
                    tileColliderVisualizer.position.x = x + 0.5;
                    tileColliderVisualizer.position.z = z + 0.5;
                    colliderVisualizer.add(tileColliderVisualizer);
                }
            }
        }
        this.gardenParent.add(colliderVisualizer);

        // Add a box to every grid tile for raycasting the editor cursor in debug mode
        this.gridVisualizer = new THREE.Object3D();

        var planeGeometry = new THREE.BoxGeometry(1, 1, 0.1);
        var invisibleMaterial = new THREE.Material();
        invisibleMaterial.visible = false;

        for (var x = 0; x < Level.gridWidth; ++x) {
            for (var z = 0; z < Level.gridDepth; ++z) {
                var invisibleMesh = new THREE.Mesh(planeGeometry, invisibleMaterial);
                invisibleMesh.position.y = 0;
                invisibleMesh.position.x = x + 0.5;
                invisibleMesh.position.z = z + 0.5;
                this.gridVisualizer.add(invisibleMesh);
            }
        }

        this.gardenParent.add(this.gridVisualizer);
    }

    if (DEV_MODE) {
        this.editor = new LevelEditor(this, this.gardenParent);
    }
};

Level.prototype.canvasMove = function(viewportPos) {
    if (DEV_MODE) {
        this.raycaster.setFromCamera(viewportPos, this.camera);
        var intersects = this.raycaster.intersectObject(this.gridVisualizer, true);

        if (intersects.length > 0) {
            this.hoverTarget = intersects[0];
        }
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

Level.dinnerTableMaterial = new THREE.MeshPhongMaterial( { color: 0xeeeeee } );
Level.chairMaterial = new THREE.MeshPhongMaterial( { color: 0xaa7733 } );
Level.groundMaterial = new THREE.MeshPhongMaterial( { color: 0x66cc00 } );
Level.colliderDebugMaterial = new THREE.MeshBasicMaterial( { color: 0xff0088, wireframe: true } );

Level.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);

    this.cameraControl.update(deltaTime);
    this.cameraControl.setLookAt(this.getLookAtCenter());
    this.cameraControl.set

    for (var i = 0; i < this.objects.length; ++i) {
        this.objects[i].update(deltaTime);
    }

    if (this.editor) {
        this.editor.update(deltaTime);
    }
};

Level.prototype.render = function(renderer) {
    renderer.render(this.scene, this.camera);
};

Level.prototype.getLookAtCenter = function() {
    return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5);
};

Level.prototype.setupLights = function() {
    this.scene.add(new THREE.AmbientLight(0x333333));
    var mainLight = new THREE.DirectionalLight(0xaaa588, 1);
    mainLight.position.set(0.5, 1, -1).normalize();
    this.scene.add(mainLight);

    var spotLight = new THREE.SpotLight(0x665555, 1, 0, Math.PI * 0.15);
    this.spotLight = spotLight;
    spotLight.position.set( 125, 250, -250 );
    spotLight.target = new THREE.Object3D();
    this.scene.add(spotLight.target);
    this.updateSpotLightTarget();

    spotLight.castShadow = true;
    var shadowFovDegrees = 3;
    spotLight.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( shadowFovDegrees, 1, 100, 400 ) );
    spotLight.shadow.bias = -0.0001;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.scene.add( spotLight );

    /*var helper = new THREE.CameraHelper( spotLight.shadow.camera );
    this.scene.add(helper);*/

    var fillLight = new THREE.DirectionalLight(0x333355, 1);
    fillLight.position.set(-1, 1, 1).normalize();
    this.scene.add(fillLight);
};

Level.prototype.updateSpotLightTarget = function() {
    var spotTarget = this.getLookAtCenter();
    this.spotLight.target.position.set(spotTarget.x, spotTarget.y, spotTarget.z);
};
