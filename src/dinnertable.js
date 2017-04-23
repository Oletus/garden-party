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
    this.conversationTime = 0.0;
    this.oldConversationTime = 0.0;
    this.chairs = [];
    
    this.discussionTopic = null;
    this.unfinishedTopicSitters = []; // Used to manage that simply reintroducing the same people to the same table doesn't change the topic
    
    this.conversationScore = 0;
    
    this.topicTextMaterial = DinnerTable.topicTextMaterial.clone();
    this.textParent = new THREE.Object3D();
    this.textParent.position.y = 1.5;
    this.center.add(this.textParent);

    this.topicTextParent = new THREE.Object3D();
    this.topicTextParent.visible = false;
    this.textParent.add(this.topicTextParent);
    
    this.topicTitleTextMesh = this.createTextMesh('TOPIC:', this.topicTextMaterial);
    this.topicTitleTextMesh.position.y = 0.6;
    this.topicTextParent.add(this.topicTitleTextMesh);

    {
        this.scoreTextMaterial = DinnerTable.scoreTextMaterial.clone();
        this.scoreTextMaterial.transparent = true;
        this.scoreTextParent = new THREE.Object3D();
        this.scoreTextParent.visible = false;
        this.textParent.add(this.scoreTextParent);
        
        var pleasantTextMesh = this.createTextMesh('PLEASANT', this.scoreTextMaterial);
        pleasantTextMesh.position.y = 0.6;
        this.scoreTextParent.add(pleasantTextMesh);
        var conversationTextMesh = this.createTextMesh('CONVERSATION!', this.scoreTextMaterial);
        this.scoreTextParent.add(conversationTextMesh);
    }
    
    {
        this.failTextMaterial = DinnerTable.failTextMaterial.clone();
        this.failTextMaterial.transparent = true;
        this.failTextParent = new THREE.Object3D();
        this.failTextParent.visible = false;
        this.textParent.add(this.failTextParent);
        
        var dreadfulTextMesh = this.createTextMesh('DREADFUL', this.failTextMaterial);
        dreadfulTextMesh.position.y = 0.6;
        this.failTextParent.add(dreadfulTextMesh);
        var conversationTextMesh = this.createTextMesh('CONVERSATION!', this.failTextMaterial);
        this.failTextParent.add(conversationTextMesh);
    }
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

DinnerTable.prototype = new GridSceneObject();

DinnerTable.State = {
    SCORING_TOPIC: 0,
    NO_TOPIC: 1,
    TOPIC: 2,
    REMOVING_TOPIC: 3
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

DinnerTable.topicTextMaterial = new THREE.MeshPhongMaterial( { color: 0x333333, specular: 0x000000 } );
DinnerTable.scoreTextMaterial = new THREE.MeshPhongMaterial( { color: 0x888833, specular: 0x000000, emissive: 0x444433} );
DinnerTable.failTextMaterial = new THREE.MeshPhongMaterial( { color: 0x880000, specular: 0x000000, emissive: 0x550000 } );

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
    this.topicTextParent.rotation.y = Math.PI;
    this.topicTextParent.visible = true;
    this.topicTextParent.add(this.topicTextMesh);
};

DinnerTable.prototype.update = function(deltaTime) {
    this.topicTextParent.rotation.y += deltaTime * 0.5;
    if (this.topicTextParent.rotation.y > -Math.PI * 0.5) {
        this.topicTextParent.rotation.y -= Math.PI;
    }
    
    this.state.update(deltaTime);
    if (this.state.id === DinnerTable.State.SCORING_TOPIC) {
        var textParent = this.getConversationScoreTextParent();
        textParent.position.y = this.state.time;
        textParent.children[0].material.opacity = mathUtil.clamp(0.0, 1.0, Math.min(this.state.time, 3.0 - this.state.time));
        if (this.state.time > 3.0) {
            this.state.change(DinnerTable.State.NO_TOPIC);
            textParent.visible = false;
        }
    } else if (this.state.id === DinnerTable.State.NO_TOPIC) {
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
        this.conversationTime += deltaTime;
        if (this.conversationTime > Game.parameters.get('maxTimePerDiscussionTopic')) {
            this.unfinishedTopicSitters = [];
            var sitters = this.getSitters();
            this.conversationScore = 1;
            for (var i = 0; i < sitters.length; ++i) {
                if (sitters[i].emotionalState.id === Character.EmotionalState.SAD) {
                    this.conversationScore = -1;
                }
            }
            this.endTopic();
        }
    } else if (this.state.id === DinnerTable.State.REMOVING_TOPIC) {
        this.topicTextMaterial.opacity = mathUtil.clamp(0.0, this.topicTextMaterial.opacity, 1.0 - this.state.time);
        if (this.state.time > 1.0) {
            this.topicTextParent.visible = false;
            if (this.conversationScore !== 0) {
                this.state.change(DinnerTable.State.SCORING_TOPIC);
                var textParent = this.getConversationScoreTextParent();
                textParent.visible = true;
                textParent.position.y = 0.0;
                textParent.rotation.y = Math.PI;
            } else {
                this.state.change(DinnerTable.State.NO_TOPIC);
            }
        }
    }
};

DinnerTable.prototype.getConversationScoreTextParent = function() {
    return this.conversationScore > 0 ? this.scoreTextParent : this.failTextParent;
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
        if (continueOldConversation) {
            this.conversationTime = this.oldConversationTime;
        } else {
            if (this.discussionTopic === null) {
                this.discussionTopic = arrayUtil.randomItem(conversationData);
            } else {
                var newDiscussionTopic = this.discussionTopic;
                while (newDiscussionTopic === this.discussionTopic) {
                    newDiscussionTopic = arrayUtil.randomItem(conversationData);
                }
                this.discussionTopic = newDiscussionTopic;
            }
            this.conversationTime = 0.0;
        }
        this.conversationScore = 0;
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
        this.oldConversationTime = this.state.time;
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
