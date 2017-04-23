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
        z: 0.5,
        sittingOn: null,
        carriedBy: null,
        carrying: null,
        canBePickedUp: true
    };
    objectUtil.initWithDefaults(this, defaults, options);

    if (this.sittingOn !== null) {
        this.sitOn(this.sittingOn);
    }
    
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
    box.castShadow = true;
    box.receiveShadow = true;
    this.center.add(box);

    var noseGeometry = new THREE.BoxGeometry(0.1, 0.1, 1.0);
    var nose = new THREE.Mesh(noseGeometry, Level.dinnerTableMaterial);
    nose.position.y = 1.5;
    nose.position.z = -0.5;
    nose.castShadow = true;
    nose.receiveShadow = true;
    this.center.add(nose);
    
    this.initThreeSceneObject({
        object: this.center,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

Character.prototype.update = function(deltaTime) {
    if (this.sittingOn) {
        this.setDisplayAngleFromXZ(this.sittingOn.direction.x, this.sittingOn.direction.y);
    } else if (this.carriedBy) {
        this.x = this.carriedBy.x;
        this.z = this.carriedBy.z;
    }
};

Character.prototype.setCarriedBy = function(carriedBy) {
    if (this.carriedBy !== carriedBy) {
        this.removeFromScene();
        if (carriedBy) {
            this.sceneParent = carriedBy.center;
            this.center.position.y = 2.2;
            this.center.rotation.x = Math.PI * 0.5;
            this.center.rotation.y = 0.0;
            this.center.position.z = -1.0;
            this.center.position.x = 0.0;
            this.canBePickedUp = false;
        } else {
            this.sceneParent = this.level.gardenParent;
            this.center.position.y = 0.0;
            this.center.rotation.x = 0.0;
            this.center.position.x = this.x;
            this.center.position.z = this.z;
            this.canBePickedUp = true;
        }
        this.carriedBy = carriedBy;
        this.addToScene();
    }
};

Character.prototype.sitOn = function(chair) {
    if (this.sittingOn !== null) {
        this.sittingOn.sitter = null;
    }
    this.x = chair.x;
    this.z = chair.z;
    this.sittingOn = chair;
    chair.sitter = this;
};

Character.prototype.setDisplayAngleFromXZ = function(x, z) {
    this.center.rotation.y = Math.atan2(x, z) + Math.PI;
};

Character.prototype.interactionDistance = function(other) {
    var interactionPointDistance = 0.5;
    var thisVec = new Vec2(this.x + Math.sin(this.center.rotation.y - Math.PI) * interactionPointDistance, 
                           this.z + Math.cos(this.center.rotation.y - Math.PI) * interactionPointDistance);
    var otherVec = new Vec2(other.x, other.z);
    return thisVec.distance(otherVec);
};

Character.prototype.getNearestForInteraction = function(fromSet, matchFunc) {
    var nearest = null;
    for (var i = 0; i < fromSet.length; ++i) {
        var candidate = fromSet[i];
        if (matchFunc(candidate)) {
            if (nearest === null || this.interactionDistance(candidate) < this.interactionDistance(nearest)) {
                nearest = candidate;
            }
        }
    }
    return nearest;
};

Character.prototype.pickUpObject = function(object) {
    object.setCarriedBy(this);
    this.carrying = object;
    if (object.sittingOn) {
        object.sittingOn.sitter = null;
        object.sittingOn = null;
    }
};

Character.prototype.dropObjectOnChair = function(chair) {
    this.carrying.sitOn(chair);
    this.carrying.setCarriedBy(null);
    this.carrying = null;
};

Character.prototype.newTopic = function() {
    
};


var Guest = function(options) {
    this.initCharacter(options);
};

Guest.prototype = new Character(); 


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
    
    this.interactionCursor = new InteractionCursor({
        sceneParent: this.sceneParent
    });
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
        this.setDisplayAngleFromXZ(this.physicsShim.dx, this.physicsShim.dy);
    }
    this.physicsShim.dx *= Game.parameters.get('playerMoveSpeed');
    this.physicsShim.dy *= Game.parameters.get('playerMoveSpeed');
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'x', [this.level.physicalCollisionTileMap]);
    GJS.PlatformingPhysics.moveAndCollide(this.physicsShim, deltaTime, 'y', [this.level.physicalCollisionTileMap]);

    this.x = this.physicsShim.x;
    this.z = this.physicsShim.y;
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    var interactionObject = this.getPickUpInteractionObject();
    if (interactionObject !== null) {
        this.interactionCursor.object.visible = true;
        this.interactionCursor.object.position.x = interactionObject.x;
        this.interactionCursor.object.position.z = interactionObject.z;
        this.interactionCursor.update(deltaTime);
    } else {
        this.interactionCursor.object.visible = false;
    }
};

PlayerCharacter.prototype.getPickUpInteractionObject = function() {
    if (this.carrying !== null) {
        if (this.carrying instanceof Character) {
            var nearest = this.getNearestForInteraction(this.level.getChairs(), function(chair) { return chair.sitter === null; });
            if (nearest !== null && this.interactionDistance(nearest) < 1.0) {
                return nearest;
            }
        }
    } else {
        var nearest = this.getNearestForInteraction(this.level.guests, function(guest) { return guest.canBePickedUp; });
        if (nearest !== null && this.interactionDistance(nearest) < 1.0) {
            return nearest;
        }
    }
    return null;
};

PlayerCharacter.prototype.tryPickUpOrDrop = function() {
    var interactionObject = this.getPickUpInteractionObject();
    if (interactionObject !== null) {
        if (this.carrying !== null) {
            this.dropObjectOnChair(interactionObject);
        } else {
            this.pickUpObject(interactionObject);
        }
    }
};


var InteractionCursor = function(options) {
    var defaults = {
        color: 0xbb3366
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.arrow = this.createArrowMesh();
    this.arrow.rotation.z = -Math.PI * 0.5;
    this.arrow.position.y = 2.5;
    
    this.initThreeSceneObject({
        object: this.arrow,
        sceneParent: options.sceneParent
    });
    this.addToScene();
};

InteractionCursor.prototype = new GJS.ThreeSceneObject();

InteractionCursor.material = function(color, emissiveColor) {
    if (emissiveColor === undefined) emissiveColor = 0x772222;
    var material = new THREE.MeshPhongMaterial( { color: color, emissive: emissiveColor } );
    material.transparent = true;
    material.opacity = 0.7;
    return material;
};

InteractionCursor.prototype.createArrowMesh = function() {
    var shape = GJS.utilTHREE.createArrowShape(0.6, 0.4, 0.3, 0.2);
    var line = new THREE.LineCurve3(new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(0, 0, 0.1));
    var extrudeSettings = {
        steps: 1,
        bevelEnabled: false,
        extrudePath: line
    };
    var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    return new THREE.Mesh(geometry, InteractionCursor.material(this.color));
};

InteractionCursor.prototype.update = function(deltaTime) {
    this.arrow.rotation.y += deltaTime * Math.PI * 0.5;
};