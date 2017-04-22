'use strict';

/**
 * @constructor
 */
var Character = function() {
};

Character.prototype = new GJS.ThreeSceneObject();

Character.prototype.initCharacter = function(options) {
    var defaults = {
        level: null,
        x: 0.5,
        z: 0.5
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.size = 0.5;
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    //this.mesh = Characters[this.id].model.clone();
    //this.center.add(this.mesh);

    // TODO: This is just test geometry / collision mesh. Remove.
    var boxGeometry = new THREE.BoxGeometry(this.size, 2, this.size);
    var box = new THREE.Mesh(boxGeometry, Level.dinnerTableMaterial);
    box.position.y = 1;
    this.center.add(box);
    var boxGeometry = new THREE.BoxGeometry(1.0, 0.1, 0.1);
    var nose = new THREE.Mesh(boxGeometry, Level.dinnerTableMaterial);
    nose.position.y = 1.5;
    nose.position.x = 0.5;
    this.center.add(nose);
    
    this.initThreeSceneObject({
        object: this.center,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

Character.prototype.update = function(deltaTime) {
    
};


var PlayerPhysicsShim = function(options) {
    this.init(options);
};

PlayerPhysicsShim.prototype = new GJS.PlatformingObject();

/**
 * Get the object's collision rectangle in case the object is positioned at x, y.
 * Override this instead of getCollisionRect or getLastCollisionRect.
 * @param {number} x Horizontal position.
 * @param {number} y Vertical position.
 * @return {Rect} Collision rectangle.
 */
PlayerPhysicsShim.prototype.getPositionedCollisionRect = function(x, y) {
    var width = 0.5;
    var height = 0.5;
    return new Rect(x - width * 0.5, x + width * 0.5,
                    y - height * 0.5, y + height * 0.5);
};

/**
 * @constructor
 */
var PlayerCharacter = function(options) {
    this.initCharacter(options);
    var defaults = {
        xMoveIntent: 0,
        zMoveIntent: 0
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    // The physics class we're using handles movement in terms of x / y. However we're using three.js x / z coordinates.
    this.physicsShim = new PlayerPhysicsShim({x: this.x, y: this.z});
};

PlayerCharacter.prototype = new Character();

PlayerCharacter.prototype.update = function(deltaTime) {
    Character.prototype.update.call(this, deltaTime);

    this.physicsShim.dx = mathUtil.clamp(-1.0, 1.0, this.xMoveIntent);
    this.physicsShim.dy = mathUtil.clamp(-1.0, 1.0, this.zMoveIntent);
    // Normalize the movement speed: Make sure that diagonal movement speed is the same as horizontal/vertical.
    if (this.physicsShim.dx != 0.0 || this.physicsShim.dy != 0.0) {
        var movementMult = 1.0 / Math.sqrt(Math.pow(this.physicsShim.dx, 2) + Math.pow(this.physicsShim.dy, 2));
        this.physicsShim.dx *= movementMult;
        this.physicsShim.dy *= movementMult;
        var displayAngle = Math.atan2(this.physicsShim.dx, this.physicsShim.dy) - Math.PI * 0.5;
        this.center.rotation.y = displayAngle;
    }
    this.physicsShim.dx *= Game.parameters.get('playerMoveSpeed');
    this.physicsShim.dy *= Game.parameters.get('playerMoveSpeed');
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'x', [this.level.physicalCollisionTileMap]);
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'y', [this.level.physicalCollisionTileMap]);

    this.x = this.physicsShim.x;
    this.z = this.physicsShim.y;
    this.center.position.x = this.x;
    this.center.position.z = this.z;
};
