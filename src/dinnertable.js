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
    leg.position.y = 0.5;
    
    leg.position.x = x;
    leg.position.z = z;
    this.center.add(leg);
}

DinnerTable.prototype.getColliderRect = function() {
    return new Rect(this.x, this.x + this.width, this.z, this.z + this.depth);
};

DinnerTable.textMaterial = new THREE.MeshPhongMaterial( { color: 0x333333, specular: 0x000000 } );

DinnerTable.prototype.createTextMesh = function(text) {
    var textGeo = new THREE.TextGeometry( text, {
        font: Level.font,
        size: 0.4,
        height: 0.05,
        curveSegments: 1,
        bevelEnabled: false,
    });
    textGeo.center();
    var textMesh = new THREE.Mesh( textGeo, DinnerTable.textMaterial.clone() );
    textMesh.position.z = 0.1;
    return textMesh;
};

DinnerTable.prototype.setText = function(text) {
    if (this.textMesh) {
        this.center.remove(this.textMesh);
    }
    this.textMesh = this.createTextMesh(text);
    this.textMesh.position.y = 1.5;
    this.textMesh.rotation.y = Math.PI;
    this.center.add(this.textMesh);
};

DinnerTable.prototype.update = function(deltaTime) {
    if (this.textMesh) {
        this.textMesh.rotation.y += deltaTime;
    }
    
    this.state.update(deltaTime);
    if (this.state.id === DinnerTable.State.NO_TOPIC) {
        if (this.state.time > 1.0) {
            this.trySetTopic();
        }
    } else if (this.state.id === DinnerTable.State.TOPIC) {
        if (this.state.time > 1.0) {
            this.textMesh.material.opacity = 1.0;
            this.textMesh.material.transparent = false;
        } else {
            this.textMesh.material.opacity = this.state.time;
        }
        if (this.getSitters().length <= 1) {
            this.textMesh.material.transparent = true;
            this.state.change(DinnerTable.State.REMOVING_TOPIC);
        }
    } else if (this.state.id === DinnerTable.State.REMOVING_TOPIC) {
        this.textMesh.material.opacity = mathUtil.clamp(0.0, this.textMesh.material.opacity, 1.0 - this.state.time);
        if (this.state.time > 1.0) {
            this.textMesh.visible = false;
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

DinnerTable.prototype.trySetTopic = function() {
    var sitters = this.getSitters();
    if (sitters.length > 1) {
        this.discussionTopic = arrayUtil.randomItem(conversationData);
        this.setText(this.discussionTopic.name);
        this.textMesh.material.opacity = 0.0;
        this.textMesh.material.transparent = true;
        this.state.change(DinnerTable.State.TOPIC);
        
        for (var i = 0; i < sitters.length; ++i) {
            sitters[i].newTopic();
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

GJS.utilTHREE.loadJSONModel('chair', function(object) {
    Chair.model = object;
});
