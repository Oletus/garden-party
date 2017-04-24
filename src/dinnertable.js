'use strict';

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
    this.conversationDuration = Game.parameters.get('maxTimePerDiscussionTopic');
    this.chairs = [];
    
    this.discussionTopic = null;
    this.unfinishedTopicSitters = []; // Used to manage that simply reintroducing the same people to the same table doesn't change the topic
    
    this.conversationScore = 0;
    
    this.textParent = new THREE.Object3D();
    this.textParent.position.y = 1.5;
    this.center.add(this.textParent);

    this.topicTextMaterial = DinnerTable.topicTextMaterial.clone();
    this.scoreTextMaterial = DinnerTable.scoreTextMaterial.clone();
    this.scoreTextMaterial.transparent = true;
    this.failTextMaterial = DinnerTable.failTextMaterial.clone();
    this.failTextMaterial.transparent = true;
    
    this.topicText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.textParent,
        material: this.topicTextMaterial
        });
    this.topicText.object.scale.multiplyScalar(0.6);
    this.scoreText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.textParent,
        string: 'PLEASANT CONVERSATION!',
        maxRowLength: 15,
        material: this.scoreTextMaterial
        });
    this.scoreText.object.scale.multiplyScalar(0.6);
    this.failText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.textParent,
        string: 'DREADFUL CONVERSATION!',
        maxRowLength: 15,
        material: this.failTextMaterial
        });
    this.failText.object.scale.multiplyScalar(0.6);
    
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

DinnerTable.prototype.setTopicText = function(text) {
    this.topicText.setString(['TOPIC:', text]);
    this.topicText.object.rotation.y = Math.PI;
    this.topicText.addToScene();
};

DinnerTable.prototype.update = function(deltaTime) {
    this.topicText.object.rotation.y += deltaTime * 0.5;
    if (this.topicText.object.rotation.y > -Math.PI * 0.5) {
        this.topicText.object.rotation.y -= Math.PI;
    }
    
    this.state.update(deltaTime);
    if (this.state.id === DinnerTable.State.SCORING_TOPIC) {
        var text = this.getConversationScoreText();
        text.object.position.y = this.state.time;
        // TODO: This is hacky... should choose the material object to change some other way
        text.object.children[0].material.opacity = mathUtil.clamp(0.0, 1.0, Math.min(this.state.time, 3.0 - this.state.time));
        if (this.state.time > 3.0) {
            this.state.change(DinnerTable.State.NO_TOPIC);
            text.removeFromScene();
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
        if (this.level.state.id !== Level.State.IN_PROGRESS) {
            this.endTopic();
        } else if (this.conversationTime > this.conversationDuration) {
            this.unfinishedTopicSitters = [];
            this.conversationTime = 0.0;
            this.conversationScore = this.getConversationScore();
            this.endTopic();
        }
    } else if (this.state.id === DinnerTable.State.REMOVING_TOPIC) {
        this.topicTextMaterial.opacity = mathUtil.clamp(0.0, this.topicTextMaterial.opacity, 1.0 - this.state.time);
        if (this.state.time > 1.0) {
            this.topicText.removeFromScene();
            if (this.conversationScore !== 0) {
                this.state.change(DinnerTable.State.SCORING_TOPIC);
                var text = this.getConversationScoreText();
                text.addToScene();
                text.object.position.y = 0.0;
                text.object.rotation.y = Math.PI;
                this.level.addScore(this.conversationScore);
            } else {
                this.state.change(DinnerTable.State.NO_TOPIC);
            }
        }
    }
};

DinnerTable.prototype.getConversationScore = function() {
    var sitters = this.getSitters();
    for (var i = 0; i < sitters.length; ++i) {
        if (sitters[i].emotionalState.id === Character.EmotionalState.SAD) {
            return -1;
        }
    }
    return 1;
};

DinnerTable.prototype.getConversationScoreText = function() {
    return this.conversationScore > 0 ? this.scoreText : this.failText;
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
    // The topic may still be continued at a later time.
    this.state.change(DinnerTable.State.REMOVING_TOPIC);
    this.topicTextMaterial.transparent = true;
    var sitters = this.getSitters();
    for (var i = 0; i < sitters.length; ++i) {
        sitters[i].topicEnded();
    }
};

DinnerTable.prototype.trySetTopic = function() {
    if (this.level.state.id !== Level.State.IN_PROGRESS) {
        return;
    }
    var sitters = this.getSitters();
    if (sitters.length > 1) {
        var continueOldConversation = true;
        for (var i = 0; i < sitters.length; ++i) {
            if (this.unfinishedTopicSitters.indexOf(sitters[i]) < 0) {
                continueOldConversation = false;
            }
        }
        if (!continueOldConversation) {
            // Make sure that the topic isn't the same in multiple tables at once, and that the same topic isn't chosen
            // twice in a row.
            var possibleTopics = arrayUtil.filterArray(conversationData, this.level.currentConversationTopics);
            if (this.discussionTopic !== null) {
                this.level.currentConversationTopics.splice(this.level.currentConversationTopics.indexOf(this.discussionTopic), 1);
            }
            this.discussionTopic = arrayUtil.randomItem(possibleTopics);
            this.level.currentConversationTopics.push(this.discussionTopic);
            this.conversationTime = 0.0;
            var range = Game.parameters.get('maxTimePerDiscussionTopic') - Game.parameters.get('minTimePerDiscussionTopic');
            this.conversationDuration = Game.parameters.get('minTimePerDiscussionTopic') + range * mathUtil.random();
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
