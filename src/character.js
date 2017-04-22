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
    var material = Level.dinnerTableMaterial;
    var box = new THREE.Mesh(boxGeometry, material);
    box.position.y = 1;
    this.center.add(box);
    
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
        level: null
    };
    
    // The physics class we're using handles movement in terms of x / y. However we're using three.js x / z coordinates.
    this.physicsShim = new PlayerPhysicsShim({x: this.x, y: this.z});
};

PlayerCharacter.prototype = new Character();

PlayerCharacter.prototype.update = function(deltaTime) {
    Character.prototype.update.call(this, deltaTime);

    this.physicsShim.dx = 0.0;
    this.physicsShim.dy = 1.0;
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'x', [this.level.physicalCollisionTileMap]);
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'y', [this.level.physicalCollisionTileMap]);
    
    this.x = this.physicsShim.x;
    this.z = this.physicsShim.y;
    this.center.position.x = this.x;
    this.center.position.z = this.z;
};
