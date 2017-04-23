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
    
    this.setText('topic');
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

DinnerTable.prototype = new GridSceneObject();

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
        size: 0.5,
        height: 0.05,
        curveSegments: 1,
        bevelEnabled: false,
    });
    textGeo.center();
    var textMesh = new THREE.Mesh( textGeo, DinnerTable.textMaterial );
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
    this.textMesh.rotation.y += deltaTime;
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
    
    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    this.setDisplayAngleFromXZ(this.direction.x, this.direction.y);
    
    /*var boxGeometry = new THREE.BoxGeometry(0.5, 0.7, 0.5);
    var material = Level.chairMaterial;
    var chairBox = new THREE.Mesh(boxGeometry, material);
    chairBox.position.y = 0.35;
    chairBox.castShadow = true;
    chairBox.receiveShadow = true;
    this.origin.add(chairBox);*/
    
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
