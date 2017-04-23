'use strict';

/**
 * @constructor
 */
var GridSceneObject = function() {
};

GridSceneObject.prototype = new GJS.ThreeSceneObject();

GridSceneObject.prototype.getColliderRect = function() {
    return null;
};

/**
 * @constructor
 */
var DinnerTable = function(options) {
    var defaults = {
        level: null,
        x: 0,
        z: 0,
        width: 2,
        depth: 2
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    this.center = new THREE.Object3D();
    this.center.position.x = this.width * 0.5;
    this.center.position.z = this.depth * 0.5;
    this.origin.add(this.center);
    
    var legOffsetX = this.width * 0.5 - 0.2;
    var legOffsetZ = this.depth * 0.5 - 0.2;
    this.addLeg(legOffsetX, legOffsetZ);
    this.addLeg(legOffsetX, -legOffsetZ);
    this.addLeg(-legOffsetX, legOffsetZ);
    this.addLeg(-legOffsetX, -legOffsetZ);
    
    var boxGeometry = new THREE.BoxGeometry(this.width - 0.1, 0.1, this.depth - 0.1);
    var material = Level.dinnerTableMaterial;
    var box = new THREE.Mesh(boxGeometry, material);
    box.position.y = 1.0;
    box.castShadow = true;
    box.receiveShadow = true;
    this.center.add(box);
    
    this.state = new GJS.StateMachine({stateSet: DinnerTable.State, id: DinnerTable.State.NO_TOPIC});
    this.chairs = [];
    
    this.discussionTopic = null;
    this.unfinishedTopicSitters = []; // Used to manage that simply reintroducing the same people to the same table doesn't change the topic
    
    this.topicTextMaterial = DinnerTable.textMaterial.clone();
    this.textParent = new THREE.Object3D();
    this.textParent.position.y = 1.5;
    this.center.add(this.textParent);

    this.topicTextParent = new THREE.Object3D();
    this.topicTextParent.visible = false;
    this.textParent.add(this.topicTextParent);
    
    this.topicTitleTextMesh = this.createTextMesh('TOPIC:', this.topicTextMaterial);
    this.topicTitleTextMesh.position.y = 0.6;
    this.topicTextParent.add(this.topicTitleTextMesh);
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

DinnerTable.prototype = new GridSceneObject();

DinnerTable.State = {
    NO_TOPIC: 0,
    TOPIC: 1,
    REMOVING_TOPIC: 2
};

DinnerTable.prototype.addLeg = function(x, z) {
    //var leg = TableLeg.model.clone();
    var legGeometry = new THREE.BoxGeometry(0.1, 1.0, 0.1);
    var material = Level.dinnerTableMaterial;
    var leg = new THREE.Mesh(legGeometry, material);
    leg.castShadow = true;
    leg.receiveShadow = true;
    leg.position.y = 0.5;
    
    leg.position.x = x;
    leg.position.z = z;
    this.center.add(leg);
}

DinnerTable.prototype.getColliderRect = function() {
    return new Rect(this.x, this.x + this.width, this.z, this.z + this.depth);
};

DinnerTable.textMaterial = new THREE.MeshPhongMaterial( { color: 0x333333, specular: 0x000000 } );
DinnerTable.scoreTextMaterial = new THREE.MeshPhongMaterial( { color: 0x888833, specular: 0x000000, emissive: 0x444433} );

DinnerTable.prototype.createTextMesh = function(text, material) {
    var textGeo = new THREE.TextGeometry( text, {
        font: Level.font,
        size: 0.4,
        height: 0.05,
        curveSegments: 1,
        bevelEnabled: false,
    });
    textGeo.center();
    var textMesh = new THREE.Mesh( textGeo, material );
    return textMesh;
};

DinnerTable.prototype.setTopicText = function(text) {
    if (this.topicTextMesh) {
        this.topicTextParent.remove(this.topicTextMesh);
    }
    this.topicTextMesh = this.createTextMesh(text, this.topicTextMaterial);
    this.textParent.rotation.y = Math.PI;
    this.topicTextParent.visible = true;
    this.topicTextParent.add(this.topicTextMesh);
};

DinnerTable.prototype.update = function(deltaTime) {
    this.textParent.rotation.y += deltaTime * 0.5;
    if (this.textParent.rotation.y > -Math.PI * 0.5) {
        this.textParent.rotation.y -= Math.PI;
    }
    
    this.state.update(deltaTime);
    if (this.state.id === DinnerTable.State.NO_TOPIC) {
        if (this.state.time > 1.0) {
            this.trySetTopic();
        }
    } else if (this.state.id === DinnerTable.State.TOPIC) {
        if (this.state.time > 1.0) {
            this.topicTextMaterial.opacity = 1.0;
            this.topicTextMaterial.transparent = false;
        } else {
            this.topicTextMaterial.opacity = this.state.time;
        }
        if (this.state.time > Game.parameters.get('maxTimePerDiscussionTopic')) {
            this.endTopic();
            this.unfinishedTopicSitters = [];
        }
    } else if (this.state.id === DinnerTable.State.REMOVING_TOPIC) {
        this.topicTextMaterial.opacity = mathUtil.clamp(0.0, this.topicTextMaterial.opacity, 1.0 - this.state.time);
        if (this.state.time > 1.0) {
            this.topicTextParent.visible = false;
            this.state.change(DinnerTable.State.NO_TOPIC);
        }
    }
};

DinnerTable.prototype.getSitters = function() {
    var sitters = [];
    for (var i = 0; i < this.chairs.length; ++i) {
        if (this.chairs[i].sitter) {
            sitters.push(this.chairs[i].sitter);
        }
    }
    return sitters;
};

DinnerTable.prototype.updateUnfinishedTopicSitters = function() {
    this.unfinishedTopicSitters = this.getSitters().slice();
};

DinnerTable.prototype.endTopic = function() {
    this.state.change(DinnerTable.State.REMOVING_TOPIC);
    this.topicTextMaterial.transparent = true;
    var sitters = this.getSitters();
    for (var i = 0; i < sitters.length; ++i) {
        sitters[i].topicEnded();
    }
};

DinnerTable.prototype.trySetTopic = function() {
    var sitters = this.getSitters();
    if (sitters.length > 1) {
        var continueOldConversation = true;
        for (var i = 0; i < sitters.length; ++i) {
            if (this.unfinishedTopicSitters.indexOf(sitters[i]) < 0) {
                continueOldConversation = false;
            }
        }
        if (!continueOldConversation) {
            if (this.discussionTopic === null) {
                this.discussionTopic = arrayUtil.randomItem(conversationData);
            } else {
                var newDiscussionTopic = this.discussionTopic;
                while (newDiscussionTopic === this.discussionTopic) {
                    newDiscussionTopic = arrayUtil.randomItem(conversationData);
                }
                this.discussionTopic = newDiscussionTopic;
            }
        }
        this.setTopicText(this.discussionTopic.name);
        this.topicTextMaterial.opacity = 0.0;
        this.topicTextMaterial.transparent = true;
        this.state.change(DinnerTable.State.TOPIC);

        for (var i = 0; i < sitters.length; ++i) {
            sitters[i].joinTopic(this.discussionTopic);
        }
        this.updateUnfinishedTopicSitters();
    }
};

DinnerTable.prototype.addedSitter = function(sitter) {
    if (this.state.id === DinnerTable.State.TOPIC) {
        sitter.joinTopic(this.discussionTopic);
        this.updateUnfinishedTopicSitters();
    }
};

DinnerTable.prototype.removedSitter = function(sitter) {
    var sitters = this.getSitters();
    if (sitters.length <= 1) {
        this.endTopic();
        if (sitters.length === 1) {
            sitters[0].leftAlone();
        }
    }
};


/**
 * @constructor
 */
var Chair = function(options) {
    var defaults = {
        level: null,
        table: null,
        x: 0,
        z: 0,
        direction: new Vec2(1, 0),
        sitter: null
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    if (this.table) {
        this.table.chairs.push(this);
    }
    
    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    this.setDisplayAngleFromXZ(this.direction.x, this.direction.y);
    
    var model = Chair.model.clone();
    model.castShadow = true;
    model.receiveShadow = true;
    this.origin.add(model);
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

Chair.prototype = new GridSceneObject();

Chair.prototype.getColliderRect = function() {
    return new Rect(this.x - 0.5, this.x + 0.5, this.z - 0.5, this.z + 0.5);
};

Chair.prototype.setDisplayAngleFromXZ = function(x, z) {
    this.origin.rotation.y = Math.atan2(x, z) + Math.PI;
};

Chair.prototype.setSitter = function(sitter) {
    if (sitter === this.sitter) {
        return;
    }
    var previousSitter = this.sitter;
    this.sitter = sitter;
    if (this.table) {
        if (previousSitter !== null) {
            this.table.removedSitter(previousSitter);
        }
        if (sitter !== null) {
            this.table.addedSitter(this.sitter);
        }
    }
};

GJS.utilTHREE.loadJSONModel('chair', function(object) {
    Chair.model = object;
});
