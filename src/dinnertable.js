'use strict';

/**
 * @constructor
 */
var DinnerTable = function(options) {
    var defaults = {
        level: null,
        width: 2,
        depth: 2
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.origin = new THREE.Object3D();
    
    //this.leg = TableLeg.model.clone();
    //this.origin.add(this.leg);
    
    var boxGeometry = new THREE.BoxGeometry(this.width, 1, this.depth);
    var material = Level.dinnerTableMaterial;
    var box = new THREE.Mesh(boxGeometry, material);
    box.position.y = -1;
    this.origin.add(box);
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

DinnerTable.prototype = new GJS.ThreeSceneObject();
