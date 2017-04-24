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
var Obstacle = function(options) {
    var defaults = {
        level: null,
        x: 0,
        z: 0
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    this.model = arrayUtil.randomItem(Obstacle.models).clone();
    this.model.castShadow = true;
    this.model.receiveShadow = true;
    this.origin.add(this.model);
    
    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
    
    this.addToScene();
};

Obstacle.prototype = new GridSceneObject();

Obstacle.prototype.getColliderRect = function() {
    return new Rect(this.x - 0.5, this.x + 0.5, this.z - 0.5, this.z + 0.5);
};


Obstacle.models = [];

Obstacle.loadModels = function() {
    var obstacleModelIds = [
        'bush_1',
        'bush_2',
        'bush_3',
        'bush_4',
        'bush_5'
    ];
    var loadOneModel = function(i) {
        GJS.utilTHREE.loadJSONModel(obstacleModelIds[i], function(object) {
            Obstacle.models[i] = object;
        });
    };
    for (var i = 0; i < obstacleModelIds.length; ++i) {
        Obstacle.models.push(null);
        loadOneModel(i);
    }
};

Obstacle.loadModels();
