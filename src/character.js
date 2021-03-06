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
        canBePickedUp: true,
        modelSrc: Character.guestModels[mathUtil.randomInt(5)]
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.size = 0.5;
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    
    this.leftTearOrigin = new THREE.Object3D();
    this.leftTearOrigin.position.y = 1.7;
    this.leftTearOrigin.position.z = 0.25;
    this.leftTearOrigin.position.x = 0.1;
    this.leftTearOrigin.rotation.y = Math.PI * 0.5;
    this.rightTearOrigin = new THREE.Object3D();
    this.rightTearOrigin.position.y = 1.7;
    this.rightTearOrigin.position.z = 0.25;
    this.rightTearOrigin.position.x = -0.1;
    this.rightTearOrigin.rotation.y = -Math.PI * 0.5;
    this.center.add(this.leftTearOrigin);
    this.center.add(this.rightTearOrigin);
    
    this.tearsFromLeft = true;
    
    this.mesh = this.modelSrc.plank.clone();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.sittingMesh = this.modelSrc.sitting.clone();
    this.sittingMesh.castShadow = true;
    this.sittingMesh.receiveShadow = true;
    this.center.add(this.mesh);
    
    this.stunStarsMesh = Character.stunStarsModel.clone();
    this.stunStarsMesh.position.y = 2.0;
    
    this.initThreeSceneObject({
        object: this.center,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
    
    if (this.sittingOn !== null) {
        this.sitOn(this.sittingOn);
    }
    
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    this.lastTopic = null;
    this.topic = null;
    this.reactions = {}; // Emotional state ids based on topic name
    
    this.emotionalState = new GJS.StateMachine({id: Character.EmotionalState.NEUTRAL});
    this.cryingSoundPlayed = false;
    this.tearTimer = 0.0;
    
    this.state = new GJS.StateMachine({id: Character.State.NORMAL});
};

Character.State = {
    NORMAL: 0,
    STUNNED: 1
};

Character.EmotionalState = {
    HAPPY: 0,
    NEUTRAL: 1,
    SAD: 2,
    LONELY: 3
};

Character.prototype.update = function(deltaTime) {
    this.state.update(deltaTime);
    this.emotionalState.update(deltaTime);
    if (this.state.id === Character.State.STUNNED) {
        this.center.rotation.z = Math.sin(this.state.time * Math.PI * 2.0) * 0.1;
        this.stunStarsMesh.rotation.y = this.state.time * 5.0;
        if (this.state.time > Game.parameters.get('gooseBiteStunTime')) {
            Character.stunSound.stop();
            this.center.remove(this.stunStarsMesh);
            this.state.change(Character.State.NORMAL);
        }
    } else {
        this.center.rotation.z = GJS.towardsZero(this.center.rotation.z, deltaTime);
    }

    if (this.sittingOn) {
        this.setDisplayAngleFromXZ(this.sittingOn.direction.x, this.sittingOn.direction.y);
    } else if (this.carriedBy) {
        this.x = this.carriedBy.x;
        this.z = this.carriedBy.z;
    }
    
    if (this.emotionalState.id === Character.EmotionalState.SAD && this.emotionalState.time > 1.0) {
        if (!this.cryingSoundPlayed) {
            Character.cryingSounds[mathUtil.randomInt(1)].play();
            this.cryingSoundPlayed = true;
        }
        this.tearTimer += deltaTime;
        if (this.tearTimer > 0.2) {
            this.level.objects.push(new Tear({
                sceneParent: this.level.levelSceneParent,
                origin: this.tearsFromLeft ? this.leftTearOrigin : this.rightTearOrigin
            }));
            this.tearsFromLeft = !this.tearsFromLeft;
            this.tearTimer -= 0.2;
        }
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
            this.sceneParent = this.level.levelSceneParent;
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

Character.prototype.getUpFromSeat = function() {
    this.sittingOn.setSitter(null);
    this.sittingOn = null;
    this.center.remove(this.sittingMesh);
    this.center.add(this.mesh);
};

Character.prototype.sitOn = function(chair) {
    if (this.sittingOn !== null) {
        this.getUpFromSeat();
    }
    this.center.remove(this.mesh);
    this.x = chair.x;
    this.z = chair.z;
    this.sittingOn = chair;
    this.center.add(this.sittingMesh);
    chair.setSitter(this);
};

Character.prototype.setDisplayAngleFromXZ = function(x, z) {
    this.center.rotation.y = Math.atan2(x, z);
};

Character.prototype.interactionDistance = function(other) {
    var interactionPointDistance = 0.5;
    var thisVec = new Vec2(this.x + Math.sin(this.center.rotation.y) * interactionPointDistance, 
                           this.z + Math.cos(this.center.rotation.y) * interactionPointDistance);
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
        object.getUpFromSeat();
    }
    if (object.emotionalState) {
        object.emotionalState.change(Character.EmotionalState.NEUTRAL);
    }
};

Character.prototype.dropObjectOnChair = function(chair) {
    this.carrying.sitOn(chair);
    this.carrying.setCarriedBy(null);
    this.carrying = null;
};

Character.prototype.joinTopic = function(topic) {
    if (topic === this.topic) {
        this.emotionalState.changeIfDifferent(this.reactions[topic.name]);
    } else {
        if (mathUtil.random() > topic.controversy) {
            this.emotionalState.changeIfDifferent(Character.EmotionalState.HAPPY);
        } else {
            if (this.emotionalState.id !== Character.EmotionalState.SAD) {
                this.cryingSoundPlayed = false;
                this.emotionalState.change(Character.EmotionalState.SAD);
            }
        }
        this.reactions[topic.name] = this.emotionalState.id;
    }
    this.topic = topic;
};

Character.prototype.topicEnded = function() {
    this.emotionalState.changeIfDifferent(Character.EmotionalState.NEUTRAL);
};

Character.prototype.leftAlone = function() {
    this.emotionalState.changeIfDifferent(Character.EmotionalState.LONELY);
};

Character.prototype.getBitten = function() {
    this.state.change(Character.State.STUNNED);
    this.center.add(this.stunStarsMesh);

    // TODO: Limitation: sound can only play for a single character at a time at the moment.
    Character.stunSound.playSingular(true);
};



var Guest = function(options) {
    this.initCharacter(options);
};

Guest.prototype = new Character(); 


/**
 * @constructor
 */
var PlayerCharacter = function(options) {
    options.modelSrc = Character.hostessModel;
    this.initCharacter(options);
    var defaults = {
        xMoveIntent: 0,
        zMoveIntent: 0
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    // The physics class we're using handles movement in terms of x / y. However we're using three.js x / z coordinates.
    this.physicsShim = new CharacterPhysicsShim({x: this.x, y: this.z, level: this.level});
    
    this.interactionCursor = new InteractionCursor({
        sceneParent: this.sceneParent
    });
    
    this.carryingMesh = this.modelSrc.carrying.clone();
    this.carryingMesh.castShadow = true;
    this.carryingMesh.receiveShadow = true;
};

PlayerCharacter.prototype = new Character();

PlayerCharacter.prototype.update = function(deltaTime) {
    Character.prototype.update.call(this, deltaTime);
    if (this.level.state.id !== Level.State.IN_PROGRESS) {
        this.xMoveIntent = 0;
        this.zMoveIntent = 0;
    }

    var moveSpeed = Game.parameters.get('playerMoveSpeed') * (this.carrying === null ? 1.0 : 0.7);
    if (this.state.id === Character.State.STUNNED) {
        moveSpeed = 0.0;
    }
    this.physicsShim.move(deltaTime, this.xMoveIntent, this.zMoveIntent, moveSpeed);
    if (this.physicsShim.dx != 0.0 || this.physicsShim.dy != 0.0) {
        this.setDisplayAngleFromXZ(this.xMoveIntent, this.zMoveIntent);
    }

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
            this.center.remove(this.carryingMesh);
            this.center.add(this.mesh);
        } else {
            this.pickUpObject(interactionObject);
            this.center.remove(this.mesh);
            this.center.add(this.carryingMesh);
        }
    }
};

/**
 * @constructor
 */
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


/**
 * @constructor
 */
var Tear = function(options) {
    var defaults = {
        origin: null
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.mesh = new THREE.Mesh(Character.tearGeometry, Character.tearMaterial);
    this.mesh.position.copy(this.origin.getWorldPosition());

    this.direction = new THREE.Vector3(
        (mathUtil.random() - 0.5) * 0.2,
        1.0,
        (mathUtil.random() * 0.5 + 1.0)
        );
    this.direction.applyEuler(this.origin.getWorldRotation());
    
    this.initThreeSceneObject({
        object: this.mesh,
        sceneParent: options.sceneParent
    });
    this.addToScene();
};

Tear.prototype = new GJS.ThreeSceneObject();

Tear.prototype.update = function(deltaTime) {
    if (this.dead) {
        return;
    }
    if (this.object.position.y < -1) {
        this.dead = true;
        this.removeFromScene();
    }
    this.direction.y -= Game.parameters.get('teargravity') * deltaTime;
    this.object.position.addScaledVector(this.direction, deltaTime);
    var targetPos = new THREE.Vector3();
    targetPos.addVectors(this.object.position, this.direction);
    this.object.lookAt(targetPos);
};

Character.cryingSounds = [
    new GJS.Audio('crying_1'),
    new GJS.Audio('crying_2')
];
Character.stunSound = new GJS.Audio('stun');

Character.tearGeometry = new THREE.ConeGeometry(0.1, 0.2, 6);
Character.tearGeometry.rotateX(-Math.PI * 0.5);
Character.tearMaterial = new THREE.MeshPhongMaterial({ color: 0x666688, emissive: 0x222266 });
/*Character.tearMaterial.transparent = true;
Character.tearMaterial.opacity = 0.5;*/

Character.hostessModel = {plank: null, sitting: null, carrying: null};
Character.guestModels = [];
Character.stunStarsModel = null;

Character.loadModels = function() {
    GJS.utilTHREE.loadJSONModel('hostess', function(object) {
        Character.hostessModel.plank = object;
        Character.hostessModel.sitting = object;
    });
    GJS.utilTHREE.loadJSONModel('hostess_carry', function(object) {
        Character.hostessModel.carrying = object;
    });
    
    GJS.utilTHREE.loadJSONModel('stun_stars', function(object) {
        Character.stunStarsModel = object;
    });

    var loadOneQuest = function(i) {
        GJS.utilTHREE.loadJSONModel('guest' + (i + 1) + '_plank', function(object) {
            object.rotateY(Math.PI);
            Character.guestModels[i].plank = object;
        });
        GJS.utilTHREE.loadJSONModel('guest' + (i + 1) + '_sitting', function(object) {
            object.rotateY(Math.PI);
            Character.guestModels[i].sitting = object;
        });
    };
    for (var i = 0; i < 6; ++i) {
        Character.guestModels.push({plank: null, sitting: null});
        loadOneQuest(i);
    }
};

Character.loadModels();