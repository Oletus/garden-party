'use strict';

var CharacterPhysicsShim = function(options) {
    this.level = options.level;
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
    var width = 0.5;
    var height = 0.5;
    return new Rect(x - width * 0.5, x + width * 0.5,
                    y - height * 0.5, y + height * 0.5);
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
