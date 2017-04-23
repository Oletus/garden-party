'use strict';

/**
 * @constructor
 */
var Goose = function(options) {
    var defaults = {
        level: null,
        x: 0.5,
        z: 0.5
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    // The physics class we're using handles movement in terms of x / y. However we're using three.js x / z coordinates.
    this.physicsShim = new CharacterPhysicsShim({
        x: this.x,
        y: this.z,
        level: this.level,
        width: 0.85,
        height: 0.85
        });
    this.xMoveIntent = 0;
    this.zMoveIntent = 0;
    
    this.state = new GJS.StateMachine({id: Goose.State.SITTING});
    this.lastBiteTime = -10.0;
    this.sitYOffset = 0.1;
    this.walkYOffset = 0.6;
    this.startSitting();
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    // TODO: Add a proper goose model
    var gooseGeometry = new THREE.BoxGeometry(0.9, 0.5, 0.5);
    this.mesh = new THREE.Mesh(gooseGeometry, Level.dinnerTableMaterial);
    var neckGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    this.neck = new THREE.Mesh(neckGeometry, Level.dinnerTableMaterial);
    this.neck.position.y = 0.5;
    this.neck.position.x = 0.4;
    this.mesh.add(this.neck);

    this.mesh.rotation.y = Goose.modelRotationOffset;
    this.mesh.position.y = this.sitYOffset;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.center.add(this.mesh);
    
    this.initThreeSceneObject({
        object: this.center,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

Goose.prototype = new GJS.ThreeSceneObject();

Goose.State = {
    SITTING: 0,
    WALKING: 1,
    CHASING: 2,
    BITING: 3
};

Goose.prototype.randomIdleState = function() {
    if (mathUtil.random() > 0.5) {
        this.startSitting();
    } else {
        this.startWalking();
    }
};

Goose.prototype.startSitting = function() {
    this.state.change(Goose.State.SITTING);
    this.nextStateChangeTime = mathUtil.random() * 4.0 + 3.0;
};

Goose.prototype.startWalking = function() {
    var directions = this.level.collisionTileMap.getDistancesByCardinalDirection(
        this.level.collisionTileMap.tileAt(this.x, this.z),
        function(tile) { return tile.isWall(); });
    var candidates = [];
    for (var i = 0; i < 4; ++i) {
        if (directions[i] >= 2) {
            candidates.push(i);
        }
    }
    if (candidates.length > 0) {
        this.state.change(Goose.State.WALKING);
        this.nextStateChangeTime = mathUtil.random() * 2.0 + 0.8;
        var chosenDirection = arrayUtil.randomItem(candidates);
        var moveIntent = GJS.CardinalDirection.toVec2(chosenDirection);
        this.xMoveIntent = moveIntent.x;
        this.zMoveIntent = moveIntent.y;
    }
};

Goose.prototype.startChasing = function(chaseTarget) {
    this.state.change(Goose.State.CHASING);
    this.chaseTarget = chaseTarget;
    if (Math.abs(this.x - chaseTarget.x) > Math.abs(this.z - chaseTarget.z)) {
        this.xMoveIntent = chaseTarget.x - this.x;
        this.zMoveIntent = 0.0;
    } else {
        this.xMoveIntent = 0.0;
        this.zMoveIntent = chaseTarget.z - this.z;
    }
};

Goose.prototype.bite = function(biteTarget) {
    biteTarget.getBitten();
    this.state.change(Goose.State.BITING);
    this.lastBiteTime = this.state.lifeTime;
};

Goose.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    var moveSpeed = 0.0;
    if (this.state.id !== Goose.State.CHASING && this.state.lifeTime - this.lastBiteTime > Game.parameters.get('gooseBiteStunTime')) {
        // See if the goose needs to start chasing the player.
        // It will chase if the player is on its line of sight, or if the player gets very close.
        var lineOfSightRect = new Rect(this.x - 0.1, this.x + 0.1, this.z - 0.1, this.z + 0.1);
        var xOffset = Math.sin(this.center.rotation.y);
        var zOffset = Math.cos(this.center.rotation.y);
        var chaseDistance = Game.parameters.get('gooseLineOfSightChaseDistance');
        lineOfSightRect.unionRect(new Rect(
            this.x + xOffset * chaseDistance - 0.1,
            this.x + xOffset * chaseDistance + 0.1,
            this.z + zOffset * chaseDistance - 0.1,
            this.z + zOffset * chaseDistance + 0.1
            ));
        if (this.level.playerCharacter.physicsShim.getCollisionRect().intersectsRect(lineOfSightRect)) {
            this.startChasing(this.level.playerCharacter);
        }
    }
    
    if (this.state.id === Goose.State.SITTING) {
        if (this.state.time > this.nextStateChangeTime) {
            this.randomIdleState();
        }
        this.mesh.position.y = this.sitYOffset;
    } else if (this.state.id === Goose.State.WALKING) {
        moveSpeed = Game.parameters.get('gooseWalkSpeed');
        if (this.state.time > this.nextStateChangeTime && this.closeToTileCenter()) {
            this.randomIdleState();
        }
        this.mesh.position.y = this.walkYOffset + (Math.sin(this.state.lifeTime * 12.0) > 0.0 ? 0.1 : 0.0);
    } else if (this.state.id === Goose.State.CHASING) {
        moveSpeed = mathUtil.mix(Game.parameters.get('gooseWalkSpeed'), Game.parameters.get('gooseChaseSpeed'), mathUtil.clamp(0.0, 1.0, this.state.time * 1.5));
        if (this.chaseTarget.center.position.distanceTo(this.center.position) < 1.0) {
            this.bite(this.chaseTarget);
            moveSpeed = 0.0;
        }
        if ((this.chaseTarget.x - this.x) * this.xMoveIntent < 0 ||
            (this.chaseTarget.z - this.z) * this.zMoveIntent < 0) {
            this.state.change(Goose.State.WALKING);
        }
        this.mesh.position.y = this.walkYOffset + (Math.sin(this.state.lifeTime * 12.0) > 0.0 ? 0.1 : 0.0);
    } else if (this.state.id === Goose.State.BITING) {
        if (this.state.time > 0.5) {
            this.startWalking();
        }
    }
    this.physicsShim.move(deltaTime, this.xMoveIntent, this.zMoveIntent, moveSpeed);
    if (this.physicsShim.dx != 0.0 || this.physicsShim.dy != 0.0) {
        this.setDisplayAngleFromXZ(this.physicsShim.dx, this.physicsShim.dy);
        if (this.state.id !== Goose.State.SITTING && this.x === this.physicsShim.x && this.z === this.physicsShim.y) {
            this.startSitting();
        }
    }

    this.x = this.physicsShim.x;
    this.z = this.physicsShim.y;
    this.center.position.x = this.x;
    this.center.position.z = this.z;
};

Goose.prototype.closeToTileCenter = function() {
    return Math.abs(this.x - 0.5 - Math.round(this.x - 0.5)) < 0.1 && Math.abs(this.z - 0.5 - Math.round(this.z - 0.5)) < 0.1;
};

Goose.modelRotationOffset = -Math.PI * 0.5;

Goose.prototype.setDisplayAngleFromXZ = function(x, z) {
    this.center.rotation.y = Math.atan2(x, z);
};
