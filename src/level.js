'use strict';

/**
 * @constructor
 */
var Level = function(options) {
    var defaults = {
        game: null,
        width: 5,
        depth: 5,
        cameraAspect: 16 / 9,
        levelSpec: levelData.data['1']
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.state = new GJS.StateMachine({stateSet: Level.State, id: Level.State.INTRO});
    this.currentConversationTopics = [];
    
    this.scene = new THREE.Scene();
    this.gardenParent = new THREE.Object3D(); // Corner of the garden. At ground level.
    this.scene.add(this.gardenParent);
    
    this.setupLights();

    //this.camera = new THREE.PerspectiveCamera( 20, this.cameraAspect, 30, 80 );
    var camWidth = 17;
    var camHeight = 17 / this.cameraAspect;
    this.camera = new THREE.OrthographicCamera( camWidth / - 2, camWidth / 2, camHeight / 2, camHeight / - 2, 30, 80 );
    this.raycaster = new THREE.Raycaster();
    
    this.objects = [];

    this.cameraControl = new GJS.OrbitCameraControl({
        camera: this.camera,
        lookAt: this.getLookAtCenter(),
        y: 30,
        orbitDistance: 30,
        relativeY: false,
        orbitAngle: Math.PI * 1.5
    });
    
    this.scenery = Level.sceneryModel.clone();
    this.scenery.rotation.y = Math.PI;
    this.scenery.position.x = Level.gridWidth * 0.5;
    this.scenery.position.z = Level.gridDepth * 0.5 + 1;
    this.scenery.castShadow = true;
    this.scenery.receiveShadow = true;
    this.scene.add(this.scenery);

    this.playerCharacter = new PlayerCharacter({level: this, sceneParent: this.gardenParent, x: 1.5, z: 1.5});
    this.objects.push(this.playerCharacter);
    
    this.goose = new Goose({level: this, sceneParent: this.gardenParent, x: 3.5, z: 9.5});
    this.objects.push(this.goose);
    
    this.guests = [];

    // These contain all the objects that are generated from tile editor tiles, like tables and chairs.
    this.tileEditorObjectParent = new THREE.Object3D();
    this.gardenParent.add(this.tileEditorObjectParent);
    this.tileEditorObjects = [];

    var parsedSpec = JSON.parse(this.levelSpec);
    this.passScore = parsedSpec['passScore'];
    this.failScore = parsedSpec['failScore'];
    this.tiledata = parsedSpec['tiledata'];
    this.generateTileEditorObjectsFromTiles(Level.tilemapFromData(this.tiledata));
    this.updateCollisionGridFromObjects();
    
    this.reinitGuests();

    this.hoverTarget = null;

    this.devModeVisualizationParent = new THREE.Object3D();
    this.colliderVisualizer = null;
    if (DEV_MODE) {
        this.gardenParent.add(this.devModeVisualizationParent);
        var axisHelper = new THREE.AxisHelper( 3.5 );
        this.devModeVisualizationParent.add( axisHelper );
        var gridSize = Math.max(Level.gridWidth, Level.gridDepth);
        var divisions = gridSize;
        var gridHelper = new THREE.GridHelper(gridSize, divisions);
        gridHelper.position.y = 0.1;
        gridHelper.position.x = gridSize / 2;
        gridHelper.position.z = gridSize / 2;
        this.devModeVisualizationParent.add(gridHelper);

        this.colliderVisualizer = new THREE.Object3D();
        this.devModeVisualizationParent.add(this.colliderVisualizer);
        this.updateColliderVisualizer();

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

        this.devModeVisualizationParent.add(this.gridVisualizer);
    }

    if (DEV_MODE) {
        this.editor = new LevelEditor(this, this.gardenParent);
    }

    this.effectComposer = null;
    
    this.guiParent = new THREE.Object3D();
    this.guiParent.position.x = Level.gridWidth;
    this.guiParent.position.z = -0.2;
    this.guiParent.rotation.y = Math.PI;
    this.gardenParent.add(this.guiParent);
    
    this.score = 0;
    this.negativeScore = 0;
    this.scoreText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'left'
        });
    this.failScoreText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'left'
        });
    this.addScore(0);
    this.scoreText.addToScene();
    this.failScoreText.object.position.x = Level.gridWidth * 0.5;
    this.failScoreText.addToScene();
};

Level.prototype.updateCamera = function(cameraAspect) {
    this.cameraAspect = cameraAspect;
    if (this.camera instanceof THREE.PerspectiveCamera) {
        this.camera.aspect = cameraAspect;
    } else {
        var camWidth = 17;
        var camHeight = 17 / this.cameraAspect;
        this.camera.left = camWidth / - 2;
        this.camera.right = camWidth / 2;
        this.camera.top = camHeight / 2;
        this.camera.bottom = camHeight / - 2;
    }
    this.camera.updateProjectionMatrix();
}

Level.tilemapFromData = function(tiledata) {
    return new GJS.TileMap({
        width: tiledata[0].length,
        height: tiledata.length,
        initTile: GJS.TileMap.initFromData(tiledata)
    });
};

Level.prototype.getSpec = function() {
    return JSON.stringify({
        'passScore': this.passScore,
        'failScore': this.failScore,
        'tiledata': this.tiledata
    });
};

/**
 * @param {GJS.ThreeSceneObject} tileEditorObject
 */
Level.prototype.addTileEditorObject = function(tileEditorObject) {
    this.tileEditorObjects.push(tileEditorObject);
    this.objects.push(tileEditorObject);
    if (tileEditorObject.sceneParent !== this.tileEditorObjectParent) {
        console.log("Error: Tile editor objects should have tileEditorObjectParent as their scene parent!", tileEditorObject);
    }
};

Level.prototype.removeObjects = function(objectsToRemove) {
    for (var i = 0; i < objectsToRemove.length; ++i) {
        objectsToRemove[i].removeFromScene();
        var objectIndex = this.objects.indexOf(objectsToRemove[i]);
        if (objectIndex >= 0) {
            this.objects.splice(objectIndex, 1);
        }
    }
    objectsToRemove.splice(0, objectsToRemove.length);
};

Level.prototype.generateTileEditorObjectsFromTiles = function(tilemap) {
    var isTable = function(tile) { return tile == 't'; };
    var isChair = function(tile) { return tile == 'c'; };
    var tableRects = tilemap.groupTilesToRectangles(isTable);
    for (var i = 0; i < tableRects.length; ++i) {
        this.addTileEditorObject(new DinnerTable({
            level: this,
            sceneParent: this.tileEditorObjectParent,
            x: tableRects[i].left,
            z: tableRects[i].top,
            width: tableRects[i].width(),
            depth: tableRects[i].height()
            }));
    }
    var chairPositions = tilemap.getTileCoords(isChair);
    for (var i = 0; i < chairPositions.length; ++i) {
        var tableDirection = GJS.CardinalDirection.toVec2(tilemap.getNearestTileDirection(chairPositions[i], isTable));
        
        var chairX = chairPositions[i].x + 0.5;
        var chairZ = chairPositions[i].y + 0.5
        
        // Associate chair with the nearest table
        var dinnerTableLookupPosition = new Vec2(chairX, chairZ);
        var table = null;
        if (tableDirection !== undefined) {
            while (table === null) {
                dinnerTableLookupPosition.translate(tableDirection);
                for (var j = 0; j < this.objects.length; ++j) {
                    if (this.objects[j] instanceof DinnerTable) {
                        if (this.objects[j].getColliderRect().containsVec2(dinnerTableLookupPosition)) {
                            table = this.objects[j];
                        }
                    }
                }
            }
        } else {
            tableDirection = new Vec2(1, 0);
        }
        this.addTileEditorObject(new Chair({
            level: this,
            sceneParent: this.tileEditorObjectParent,
            x: chairX,
            z: chairZ,
            direction: tableDirection,
            table: table
            }));
    }
    this.updateCollisionGridFromObjects();
};

Level.prototype.updateCollisionGridFromObjects = function() {
    this.collisionTileMap = new GJS.TileMap({
        width: Level.gridWidth,
        height: Level.gridDepth,
        initTile: function(x, y) {
            if ((x < 3 || x > Level.gridWidth - 4) && y == Level.gridDepth - 2) {
                return new GJS.WallTile();
            }
            return new GJS.PlatformingTile();
        },
        initEdgeTile: function() { return new GJS.WallTile(); }
    });
    
    for (var i = 0; i < this.tileEditorObjects.length; ++i) {
        var colliderRect = this.tileEditorObjects[i].getColliderRect();
        if (colliderRect) {
            for (var x = colliderRect.left; x < colliderRect.right; ++x) {
                for (var z = colliderRect.top; z < colliderRect.bottom; ++z) {
                    this.collisionTileMap.tiles[z][x] = new GJS.WallTile();
                }
            }
        }
    }

    // Note that we're using platforming physics, just without the gravity to resolve character collisions.
    this.physicalCollisionTileMap = new GJS.PlatformingTileMap();
    this.physicalCollisionTileMap.init({tileMap: this.collisionTileMap});
    this.updateColliderVisualizer();
};

Level.prototype.updateColliderVisualizer = function() {
    if (this.colliderVisualizer) {
        while(this.colliderVisualizer.children.length > 0){ 
            this.colliderVisualizer.remove(this.colliderVisualizer.children[0]);
        }
        var colliderBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
        for (var x = 0; x < this.collisionTileMap.width; ++x) {
            for (var z = 0; z < this.collisionTileMap.height; ++z) {
                if (this.collisionTileMap.tiles[z][x].isWall()) {
                    var tileColliderVisualizer = new THREE.Mesh(colliderBoxGeometry, Level.colliderDebugMaterial);
                    tileColliderVisualizer.position.y = 0.5;
                    tileColliderVisualizer.position.x = x + 0.5;
                    tileColliderVisualizer.position.z = z + 0.5;
                    this.colliderVisualizer.add(tileColliderVisualizer);
                }
            }
        }
    }
};

Level.prototype.getChairs = function() {
    var chairs = [];
    for (var i = 0; i < this.objects.length; ++i) {
        if (this.objects[i] instanceof Chair) {
            chairs.push(this.objects[i]);
        }
    }
    return chairs;
};

Level.prototype.reinitGuests = function() {
    this.removeObjects(this.guests);
    var chairs = this.getChairs();
    var guestsCount = chairs.length - 3;
    var chairsToPopulate = arrayUtil.randomSubset(chairs, guestsCount);
    for (var i = 0; i < chairsToPopulate.length; ++i) {
        var chair = chairsToPopulate[i];
        var guest = new Guest({
            level: this,
            sceneParent: this.gardenParent,
            sittingOn: chair
        });
        this.guests.push(guest);
        this.objects.push(guest);
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

Level.gridWidth = 16;
Level.gridDepth = 14;

Level.State = {
    INTRO: 0,
    IN_PROGRESS: 1,
    SUCCESS: 2,
    FAIL: 3
};

Level.dinnerTableMaterial = new THREE.MeshPhongMaterial( { color: 0x777777 } );
Level.chairMaterial = new THREE.MeshPhongMaterial( { color: 0xaa7733 } );
Level.groundMaterial = new THREE.MeshPhongMaterial( { color: 0x66cc00 } );
Level.colliderDebugMaterial = new THREE.MeshBasicMaterial( { color: 0xff0088, wireframe: true } );

// Setup depth pass
Level.depthMaterial = new THREE.MeshDepthMaterial();
Level.depthMaterial.depthPacking = THREE.RGBADepthPacking;
Level.depthMaterial.blending = THREE.NoBlending;

Level.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    if (this.state.id === Level.State.INTRO) {
        if (this.state.time > 1.0) {
            this.state.change(Level.State.IN_PROGRESS);
        }
    }

    this.cameraControl.update(deltaTime);
    this.cameraControl.setLookAt(this.getLookAtCenter());

    var i = 0;
    while (i < this.objects.length) {
        this.objects[i].update(deltaTime);
        if (this.objects[i].dead) {
            this.objects.splice(i, 1);
        } else {
            ++i;
        }
    }

    if (this.editor) {
        this.editor.update(deltaTime);
        this.tiledata = this.editor.getTileData();
    }
};

Level.prototype.addScore = function(scoreDelta) {
    if (this.state.id === Level.State.IN_PROGRESS) {
        if (scoreDelta > 0) {
            Level.victorySound.play();
            this.score += scoreDelta;
        } else if (scoreDelta < 0) {
            Level.awwSound.play();
            this.negativeScore -= scoreDelta;
        }
    }
    // TODO: Don't recreate the text models if not needed.
    this.scoreText.setString('SCORE: ' + this.score + '/' + this.passScore);
    this.failScoreText.setString(' FAILURES: ' + this.negativeScore + '/' + this.failScore);
    if (this.state.id === Level.State.IN_PROGRESS) {
        if (this.negativeScore >= this.failScore) {
            this.state.change(Level.State.FAIL);
        } else if (this.score >= this.passScore) {
            this.state.change(Level.State.SUCCESS);
        }
    }
};

Level.prototype.initPostprocessing = function(renderer) {
    // TODO: This should be done once per renderer init, not per level init.

    // Setup render pass
    var renderPass = new THREE.RenderPass( this.scene, this.camera );

    var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    // TODO: Should the depth render target be resized on canvas resize?
    this.depthRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, pars );
    this.depthRenderTarget.texture.name = "SSAOShader.rt";
    
    this.aaPass = new THREE.SMAAPass( window.innerWidth, window.innerHeight );

    // Setup SSAO pass
    this.ssaoPass = new THREE.ShaderPass( THREE.SSAOShader );
    //this.ssaoPass.uniforms[ "tDiffuse" ].value will be set by ShaderPass
    this.ssaoPass.uniforms[ "tDepth" ].value = this.depthRenderTarget.texture;
    this.ssaoPass.uniforms[ 'size' ].value.set( window.innerWidth, window.innerHeight );
    this.ssaoPass.uniforms[ 'cameraNear' ].value = this.camera.near;
    this.ssaoPass.uniforms[ 'cameraFar' ].value = this.camera.far;
    this.ssaoPass.uniforms[ 'onlyAO' ].value = false;
    this.ssaoPass.uniforms[ 'aoClamp' ].value = 0.3;
    this.ssaoPass.uniforms[ 'lumInfluence' ].value = 0.5;

    // Add pass to effect composer
    this.effectComposer = new THREE.EffectComposer( renderer );
    this.effectComposer.addPass( renderPass );
    this.effectComposer.addPass( this.ssaoPass );
    this.ssaoPass.renderToScreen = false;
    this.effectComposer.addPass( this.aaPass );
    this.aaPass.renderToScreen = true;
};

Level.prototype.render = function(renderer) {
    this.spotLight.castShadow = Game.parameters.get('shadowsEnabled');
    this.devModeVisualizationParent.visible = Game.parameters.get('debugVisualizations');
    if (Game.parameters.get('postProcessingEnabled')) {
        if (this.effectComposer === null) {
            this.initPostprocessing(renderer);
        }
        // Render depth into depthRenderTarget
        this.scene.overrideMaterial = Level.depthMaterial;
        renderer.render( this.scene, this.camera, this.depthRenderTarget, true );

        // Render renderPass and SSAO shaderPass
        this.scene.overrideMaterial = null;
        this.effectComposer.render();
    } else {
        renderer.render(this.scene, this.camera);
    }
};

Level.prototype.getLookAtCenter = function() {
    if (this.camera instanceof THREE.PerspectiveCamera) {
        return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.42);
    } else {
        return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5 + 1);
    }
};

Level.prototype.setupLights = function() {
    this.scene.add(new THREE.AmbientLight(0xC2E4FF, 1.5));
    var mainLight = new THREE.DirectionalLight(0xffbff7, 1.0);
    mainLight.position.set(0.5, 1, 0.6).normalize();
    this.scene.add(mainLight);

    var spotLight = new THREE.SpotLight(0xffbff7, 1, 0, Math.PI * 0.15);
    this.spotLight = spotLight;
    spotLight.position.set( 0.5 * 250, 250, 0.6 * 250 );
    spotLight.target = new THREE.Object3D();
    this.scene.add(spotLight.target);
    this.updateSpotLightTarget();

    spotLight.castShadow = true;
    var shadowFovDegrees = 4;
    spotLight.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( shadowFovDegrees, 1, 240, 380 ) );
    spotLight.shadow.bias = 0.0001;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.scene.add( spotLight );

    /*var helper = new THREE.CameraHelper( spotLight.shadow.camera );
    this.scene.add(helper);*/
};

Level.prototype.updateSpotLightTarget = function() {
    var spotTarget = new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5);
    this.spotLight.target.position.set(spotTarget.x, spotTarget.y, spotTarget.z);
};

Level.victorySound = new GJS.Audio('victory');
Level.awwSound = new GJS.Audio('aww');

Level.sceneryModel = null;

GJS.utilTHREE.loadFont('aldo_the_apache_regular', function(font) {
    GJS.ThreeExtrudedTextObject.defaultFont = font;
});
GJS.utilTHREE.loadJSONModel('base_layer', function(object) {
    Level.sceneryModel = object;
});
