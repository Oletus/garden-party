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
        width: 0.5,
        height: 0.5
        });
    this.xMoveIntent = 0;
    this.zMoveIntent = 0;
    
    this.state = new GJS.StateMachine({id: Goose.State.SITTING});
    this.lastBiteTime = -10.0;
    this.sitYOffset = -0.2;
    this.walkYOffset = 0.1;
    this.startSitting();
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    this.meshParent = new THREE.Object3D();
    this.meshParent.position.y = this.sitYOffset;
    this.center.add(this.meshParent);

    this.mesh = Goose.model.clone();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.attackMesh = Goose.attackModel.clone();
    this.attackMesh.castShadow = true;
    this.attackMesh.receiveShadow = true;
    
    this.meshParent.add(this.mesh);
    
    
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
    WALKING_REALIGNING: 2,
    CHASING: 3,
    BITING: 4
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

Goose.prototype.getDistancesToWalls = function() {
    return this.level.collisionTileMap.getDistancesByCardinalDirection(
        this.level.collisionTileMap.tileAt(this.x, this.z),
        function(tile) { return tile.isWall(); });
};

Goose.prototype.startRealign = function() {
    this.state.change(Goose.State.WALKING_REALIGNING);
    this.walkTarget = new Vec2(Math.round(this.x - 0.5) + 0.5, Math.round(this.z - 0.5) + 0.5);
    this.xMoveIntent = this.walkTarget.x - this.x;
    this.zMoveIntent = this.walkTarget.y - this.z;
};

Goose.prototype.startWalking = function() {
    if (!this.closeToTileCenter()) {
        this.startRealign();
        return;
    }
    var wallDistances = this.getDistancesToWalls();
    var goodCandidates = [];
    var possibleCandidates = [];
    var playerCharacterDiffVec = new Vec2(this.level.playerCharacter.x - this.x, this.level.playerCharacter.z - this.z);
    playerCharacterDiffVec.normalize();
    for (var i = 0; i < 4; ++i) {
        if (wallDistances[i] >= 2) {
            possibleCandidates.push(i);
            if (this.canBite()) {
                goodCandidates.push(i);
            } else {
                // Check that we don't walk towards / through the player in case we're not able to bite.
                var directionVec = GJS.CardinalDirection.toVec2(i);
                if (playerCharacterDiffVec.dotProduct(directionVec) < 0.3) {
                    goodCandidates.push(i);
                }
            }
        }
    }
    if (goodCandidates.length > 0) {
        possibleCandidates = goodCandidates;
    }
    if (possibleCandidates.length > 0) {
        this.state.change(Goose.State.WALKING);
        var chosenDirection = arrayUtil.randomItem(possibleCandidates);
        var moveIntent = GJS.CardinalDirection.toVec2(chosenDirection);
        var moveTiles = mathUtil.clamp(1, wallDistances[chosenDirection] - 1, Math.round(mathUtil.random() * 5 + 0.5));
        this.walkTarget = new Vec2(this.x + moveIntent.x * moveTiles, this.z + moveIntent.y * moveTiles);
        this.xMoveIntent = moveIntent.x;
        this.zMoveIntent = moveIntent.y;
    }
};

Goose.prototype.startChasing = function(chaseTarget) {
    this.state.change(Goose.State.CHASING);
    Goose.attackSound.play();
    this.chaseTarget = chaseTarget;
    if (Math.abs(this.x - chaseTarget.x) <= Math.abs(this.z - chaseTarget.z) * 2.0 &&
        Math.abs(this.z - chaseTarget.z) <= Math.abs(this.x - chaseTarget.x) * 2.0 &&
        chaseTarget.center.position.distanceTo(this.center.position) < 1.5) {
        this.xMoveIntent = chaseTarget.x - this.x;
        this.zMoveIntent = chaseTarget.z - this.z;
    } else {
        if (Math.abs(this.x - chaseTarget.x) > Math.abs(this.z - chaseTarget.z)) {
            this.xMoveIntent = chaseTarget.x - this.x;
            this.zMoveIntent = 0.0;
        } else {
            this.xMoveIntent = 0.0;
            this.zMoveIntent = chaseTarget.z - this.z;
        }
    }
};

Goose.prototype.canBite = function() {
    return this.state.lifeTime - this.lastBiteTime > Game.parameters.get('gooseBiteStunTime');
};

Goose.prototype.bite = function(biteTarget) {
    biteTarget.getBitten();
    this.state.change(Goose.State.BITING);
    Goose.biteSound.play();
    this.meshParent.remove(this.mesh);
    this.meshParent.add(this.attackMesh);
    this.lastBiteTime = this.state.lifeTime;
};

Goose.prototype.chaseIfPlayerInDirection = function(chaseDirection, maxChaseDistance) {
    var lineOfSightRect = new Rect(this.x - 0.1, this.x + 0.1, this.z - 0.1, this.z + 0.1);
    var directionVec = GJS.CardinalDirection.toVec2(chaseDirection);
    lineOfSightRect.unionRect(new Rect(
        this.x + directionVec.x * maxChaseDistance - 0.1,
        this.x + directionVec.x * maxChaseDistance + 0.1,
        this.z + directionVec.y * maxChaseDistance - 0.1,
        this.z + directionVec.y * maxChaseDistance + 0.1
        ));
    if (this.level.playerCharacter.physicsShim.getCollisionRect().intersectsRect(lineOfSightRect)) {
        var wallDistances = this.getDistancesToWalls();
        var distanceToPlayer = this.level.playerCharacter.center.position.distanceTo(this.center.position);
        if (wallDistances[chaseDirection] > distanceToPlayer) {
            this.startChasing(this.level.playerCharacter);
        }
    }
}

Goose.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    var moveSpeed = 0.0;
    if (this.state.id !== Goose.State.CHASING && this.state.id !== Goose.State.WALKING_REALIGNING && this.canBite()) {
        // See if the goose needs to start chasing the player.
        // It will chase if the player is on its line of sight, or if the player gets very close.
        var distanceToPlayer = this.level.playerCharacter.center.position.distanceTo(this.center.position);
        
        if (distanceToPlayer < 1.5) {
            this.startChasing(this.level.playerCharacter);
        } else {
            var directionVec = new Vec2(Math.sin(this.center.rotation.y), Math.cos(this.center.rotation.y));
            var chaseDirection = GJS.CardinalDirection.fromVec2(directionVec);
            this.chaseIfPlayerInDirection(chaseDirection, Game.parameters.get('gooseLineOfSightChaseDistance'));
            if (this.state.id === Goose.State.SITTING) {
                this.chaseIfPlayerInDirection(GJS.CardinalDirection.next(chaseDirection), Game.parameters.get('gooseSideChaseDistance'));
                this.chaseIfPlayerInDirection(GJS.CardinalDirection.previous(chaseDirection), Game.parameters.get('gooseSideChaseDistance'));
            }
        }
    }
    
    if (this.state.id === Goose.State.SITTING) {
        if (this.state.time > this.nextStateChangeTime) {
            this.randomIdleState();
        }
        this.meshParent.position.y = this.sitYOffset;
    } else if (this.state.id === Goose.State.WALKING || this.state.id === Goose.State.WALKING_REALIGNING) {
        moveSpeed = Game.parameters.get('gooseWalkSpeed');
        if (!this.walkTarget) {
            // This happens after chasing -> walking transition.
            if (this.state.time > 0.3 && this.closeToTileCenter()) {
                this.startSitting();
            } else if (this.state.time > 1.0) {
                this.startRealign();
            }
        } else if (this.closeToTarget()) {
            if (this.state.id === Goose.State.WALKING) {
                this.randomIdleState();
            } else {
                this.startWalking();
            }
        }
        this.meshParent.position.y = this.walkYOffset + (Math.sin(this.state.lifeTime * 12.0) > 0.0 ? 0.1 : 0.0);
    } else if (this.state.id === Goose.State.CHASING) {
        moveSpeed = mathUtil.mix(Game.parameters.get('gooseWalkSpeed'), Game.parameters.get('gooseChaseSpeed'), mathUtil.clamp(0.0, 1.0, this.state.time * 1.5));
        if (this.chaseTarget.center.position.distanceTo(this.center.position) < 1.0) {
            this.bite(this.chaseTarget);
            moveSpeed = 0.0;
        }
        if ((this.chaseTarget.x - this.x) * this.xMoveIntent < 0 ||
            (this.chaseTarget.z - this.z) * this.zMoveIntent < 0) {
            this.state.change(Goose.State.WALKING);
            this.walkTarget = undefined;
        }
        this.meshParent.position.y = this.walkYOffset + (Math.sin(this.state.lifeTime * 12.0) > 0.0 ? 0.1 : 0.0);
    } else if (this.state.id === Goose.State.BITING) {
        if (this.state.time > 0.5) {
            this.meshParent.remove(this.attackMesh);
            this.meshParent.add(this.mesh);
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
    return Math.abs(this.x - 0.5 - Math.round(this.x - 0.5)) < 0.05 && Math.abs(this.z - 0.5 - Math.round(this.z - 0.5)) < 0.05;
};

Goose.prototype.closeToTarget = function() {
    return this.walkTarget.distance(new Vec2(this.x, this.z)) < 0.05;
};

Goose.prototype.setDisplayAngleFromXZ = function(x, z) {
    this.center.rotation.y = Math.atan2(x, z);
};

Goose.attackSound = new GJS.Audio('goose_attack');
Goose.biteSound = new GJS.Audio('goose_bite');

Goose.model = null;
Goose.attackModel = null;

GJS.utilTHREE.loadJSONModel('goose', function(object) {
    Goose.model = object;
});
GJS.utilTHREE.loadJSONModel('goose_attack', function(object) {
    Goose.attackModel = object;
});
