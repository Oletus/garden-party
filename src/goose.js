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
    this.sitYOffset = 0.1;
    this.walkYOffset = 0.6;
    this.startSitting();
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
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
    this.state.change(Goose.State.WALKING);
    this.nextStateChangeTime = mathUtil.random() * 2.0 + 0.8;
    if (mathUtil.random() < 0.5) {
        this.xMoveIntent = mathUtil.random() < 0.5 ? -1.0 : 1.0;
        this.zMoveIntent = 0.0;
    } else {
        this.xMoveIntent = 0.0;
        this.zMoveIntent = mathUtil.random() < 0.5 ? -1.0 : 1.0;
    }
};

Goose.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    var moveSpeed = 0.0;
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
        this.mesh.position.y = this.walkYOffset + (Math.sin(this.state.time * 12.0) > 0.0 ? 0.1 : 0.0);
    } else {
        moveSpeed = Game.parameters.get('gooseChaseSpeed');
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
