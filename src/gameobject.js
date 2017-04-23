'use strict';

var CharacterPhysicsShim = function(options) {
    var defaults = {
        level: null,
        width: 0.5,
        height: 0.5,
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.init(options);
};

CharacterPhysicsShim.prototype = new GJS.PlatformingObject();

/**
 * Get the object's collision rectangle in case the object is positioned at x, y.
 * Override this instead of getCollisionRect or getLastCollisionRect.
 * @param {number} x Horizontal position.
 * @param {number} y Vertical position.
 * @return {Rect} Collision rectangle.
 */
CharacterPhysicsShim.prototype.getPositionedCollisionRect = function(x, y) {
    return new Rect(x - this.width * 0.5, x + this.width * 0.5,
                    y - this.height * 0.5, y + this.height * 0.5);
};

CharacterPhysicsShim.prototype.move = function(deltaTime, xMoveIntent, zMoveIntent, moveSpeed) {
    this.dx = mathUtil.clamp(-1.0, 1.0, xMoveIntent);
    this.dy = mathUtil.clamp(-1.0, 1.0, zMoveIntent);
    // Normalize the movement speed: Make sure that diagonal movement speed is the same as horizontal/vertical.
    if (this.dx != 0.0 || this.dy != 0.0) {
        var movementMult = 1.0 / Math.sqrt(Math.pow(this.dx, 2) + Math.pow(this.dy, 2));
        this.dx *= movementMult;
        this.dy *= movementMult;
    }
    this.dx *= moveSpeed;
    this.dy *= moveSpeed;
    GJS.PlatformingPhysics.moveAndCollide(this, deltaTime, 'x', [this.level.physicalCollisionTileMap]);
    GJS.PlatformingPhysics.moveAndCollide(this, deltaTime, 'y', [this.level.physicalCollisionTileMap]);
};
