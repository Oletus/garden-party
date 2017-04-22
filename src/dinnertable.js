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
        depth: 2,
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    //this.leg = TableLeg.model.clone();
    //this.origin.add(this.leg);
    
    var boxGeometry = new THREE.BoxGeometry(this.width, 1, this.depth);
    var material = Level.dinnerTableMaterial;
    var box = new THREE.Mesh(boxGeometry, material);
    box.position.x = this.width * 0.5;
    box.position.z = this.depth * 0.5;
    box.position.y = 0.5;
    box.castShadow = true;
    box.receiveShadow = true;
    this.origin.add(box);
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

DinnerTable.prototype = new GridSceneObject();

DinnerTable.prototype.getColliderRect = function() {
    return new Rect(this.x, this.x + this.width, this.z, this.z + this.depth);
};

/**
 * @constructor
 */
var Chair = function(options) {
    var defaults = {
        level: null,
        table: null,
        x: 0,
        z: 0
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x + 0.5;
    this.origin.position.z = this.z + 0.5;
    
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
    return new Rect(this.x, this.x + 1, this.z, this.z + 1);
};

GJS.utilTHREE.loadJSONModel('chair', function(object) {
    Chair.model = object;
});
