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
        z: 0.5
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.size = 0.5;
    
    // The center is at the feet of the character.
    this.center = new THREE.Object3D();
    this.center.position.x = this.x;
    this.center.position.z = this.z;
    
    //this.mesh = Characters[this.id].model.clone();
    //this.center.add(this.mesh);

    // TODO: This is just test geometry / collision mesh. Remove.
    var boxGeometry = new THREE.BoxGeometry(this.size, 2, this.size);
    var material = Level.dinnerTableMaterial;
    var box = new THREE.Mesh(boxGeometry, material);
    box.position.y = 1;
    this.center.add(box);
    
    this.initThreeSceneObject({
        object: this.center,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};


/**
 * @constructor
 */
var PlayerCharacter = function(options) {
    this.initCharacter(options);
};

PlayerCharacter.prototype = new Character();
