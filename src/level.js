'use strict';

/**
 * @constructor
 */
var Level = function(options) {
    var defaults = {
        game: null,
        width: 5,
        depth: 5,
        levelSpec: levelData.data['1'],
        scene: null
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.state = new GJS.StateMachine({stateSet: Level.State, id: Level.State.INTRO});
    this.currentConversationTopics = [];
    
    this.levelSceneParent = new THREE.Object3D(); // Corner of the garden. At ground level.
    this.scene.add(this.levelSceneParent);
    
    this.raycaster = new THREE.Raycaster();
    
    this.objects = [];
    
    this.scenery = Level.sceneryModel.clone();
    this.scenery.rotation.y = Math.PI;
    this.scenery.position.x = Level.gridWidth * 0.5;
    this.scenery.position.z = Level.gridDepth * 0.5 + 1;
    this.scenery.castShadow = true;
    this.scenery.receiveShadow = true;
    this.scene.add(this.scenery);

    this.playerCharacter = new PlayerCharacter({level: this, sceneParent: this.levelSceneParent, x: 6.0, z: Level.gridDepth - 1.5});
    this.playerCharacter.center.rotation.y = Math.PI;
    this.objects.push(this.playerCharacter);
    
    this.guests = [];

    // These contain all the objects that are generated from tile editor tiles, like tables and chairs.
    this.tileEditorObjectParent = new THREE.Object3D();
    this.levelSceneParent.add(this.tileEditorObjectParent);
    this.tileEditorObjects = [];

    var parsedSpec = JSON.parse(this.levelSpec);
    this.passScore = parsedSpec['passScore'];
    this.failScore = parsedSpec['failScore'];
    this.tiledata = parsedSpec['tiledata'];
    this.gooseCount = parsedSpec['gooseCount'];

    this.generateTileEditorObjectsFromTiles(Level.tilemapFromData(this.tiledata));
    
    var freeTiles = this.collisionTileMap.getTileCoords(function(tile) { return !tile.isWall(); });
    for (var i = 0; i < this.gooseCount; ++i) {
        var freeTile = arrayUtil.randomItem(freeTiles);
        var goose = new Goose({level: this, sceneParent: this.levelSceneParent, x: freeTile.x + 0.5, z: freeTile.y + 0.5});
        this.objects.push(goose);
    }

    this.hoverTarget = null;

    this.devModeVisualizationParent = new THREE.Object3D();
    this.colliderVisualizer = null;
    if (DEV_MODE) {
        this.levelSceneParent.add(this.devModeVisualizationParent);
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
        this.editor = new LevelEditor(this, this.levelSceneParent);
    }
    
    this.fadingOut = false;
    
    // Reset the score texts
    this.score = 0;
    this.negativeScore = 0;
    this.addScore(0);
};

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
        'gooseCount': this.gooseCount,
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
    var isBush = function(tile) { return tile == 'b'; };
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
    var obstaclePositions = tilemap.getTileCoords(isBush);
    for (var i = 0; i < obstaclePositions.length; ++i) {
        this.addTileEditorObject(new Obstacle({
            level: this,
            sceneParent: this.tileEditorObjectParent,
            x: obstaclePositions[i].x + 0.5,
            z: obstaclePositions[i].y + 0.5,
            width: 1,
            depth: 1
        }));
    }
    this.updateCollisionGridFromObjects();
    this.reinitGuests();
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

Level.prototype.getTables = function() {
    var tables = [];
    for (var i = 0; i < this.objects.length; ++i) {
        if (this.objects[i] instanceof DinnerTable) {
            tables.push(this.objects[i]);
        }
    }
    return tables;
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
            sceneParent: this.levelSceneParent,
            sittingOn: chair
        });
        this.guests.push(guest);
        this.objects.push(guest);
    }
};

Level.prototype.canvasMove = function(viewportPos) {
    if (DEV_MODE) {
        this.raycaster.setFromCamera(viewportPos, this.game.camera);
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

    var i = 0;
    while (i < this.objects.length) {
        this.objects[i].update(deltaTime);
        if (this.objects[i].dead) {
            this.objects.splice(i, 1);
        } else {
            ++i;
        }
    }
    
    var tables = this.getTables();
    var allTablesPleasantAndFarFromOver = true;
    for (var i = 0; i < tables.length; ++i) {
        if (tables[i].state.id === DinnerTable.State.TOPIC) {
            if (tables[i].getConversationScore() < 0) {
                allTablesPleasantAndFarFromOver = false;
            } else if (tables[i].conversationTime > tables[i].conversationDuration - 3.5) {
                allTablesPleasantAndFarFromOver = false;
            }
        } else if (tables[i].getSitters().length > 1) {
            allTablesPleasantAndFarFromOver = false;
        }
    }
    if (allTablesPleasantAndFarFromOver) {
        // Fast forward at least one table so that the player is not bored.
        tables = arrayUtil.shuffle(tables);
        for (var i = 0; i < tables.length; ++i) {
            if (tables[i].state.id === DinnerTable.State.TOPIC) {
                tables[i].conversationTime = tables[i].conversationDuration - 3.0;
                break;
            }
        }
    }

    if (this.editor) {
        this.editor.update(deltaTime);
        this.tiledata = this.editor.getTileData();
    }
    
    if (this.state.lifeTime < this.lastScoreTime + 3.0) {
        var colorFade = mathUtil.clamp(0.0, 1.0, (this.state.lifeTime - this.lastScoreTime) * 0.5);
        this.game.scoreTextMaterial.color.copy(DinnerTable.scoreTextMaterial.color);
        this.game.scoreTextMaterial.emissive.copy(DinnerTable.scoreTextMaterial.emissive);
        this.game.scoreTextMaterial.color.lerp(DinnerTable.topicTextMaterial.color, colorFade);
        this.game.scoreTextMaterial.emissive.lerp(DinnerTable.topicTextMaterial.emissive, colorFade);
    }
    if (this.state.lifeTime < this.lastFailScoreTime + 3.0) {
        var colorFade = mathUtil.clamp(0.0, 1.0, (this.state.lifeTime - this.lastFailScoreTime) * 0.5);
        this.game.failScoreTextMaterial.color.copy(DinnerTable.failTextMaterial.color);
        this.game.failScoreTextMaterial.emissive.copy(DinnerTable.failTextMaterial.emissive);
        this.game.failScoreTextMaterial.color.lerp(DinnerTable.topicTextMaterial.color, colorFade);
        this.game.failScoreTextMaterial.emissive.lerp(DinnerTable.topicTextMaterial.emissive, colorFade);
    }
};

Level.prototype.addScore = function(scoreDelta) {
    if (this.state.id === Level.State.IN_PROGRESS) {
        if (scoreDelta > 0) {
            Level.victorySound.play();
            this.score += scoreDelta;
            this.lastScoreTime = this.state.lifeTime;
        } else if (scoreDelta < 0) {
            Level.awwSound.play();
            this.negativeScore -= scoreDelta;
            this.lastFailScoreTime = this.state.lifeTime;
        }
    }
    // TODO: Don't recreate the text models if not needed.
    this.game.scoreText.setString('SCORE: ' + this.score + '/' + this.passScore);
    this.game.failScoreText.setString(' FAILURES: ' + this.negativeScore + '/' + this.failScore);
    if (this.state.id === Level.State.IN_PROGRESS) {
        if (this.negativeScore >= this.failScore) {
            this.state.change(Level.State.FAIL);
            this.game.levelFailedText.addToScene();
            this.game.levelContinueFailedText.addToScene();
        } else if (this.score >= this.passScore) {
            this.state.change(Level.State.SUCCESS);
            this.game.levelSuccessText.addToScene();
            this.game.levelContinueText.addToScene();
        }
    }
};

Level.prototype.render = function() {
    this.devModeVisualizationParent.visible = Game.parameters.get('debugVisualizations');
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
