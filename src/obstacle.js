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
        z: 0,
        width: 1,
        depth: 1
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.origin = new THREE.Object3D();
    this.origin.position.x = this.x;
    this.origin.position.z = this.z;
    
    Obstacle.getWidthDepthKey(this.width, this.depth);
    
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
    return new Rect(this.x - this.width * 0.5, this.x + this.width * 0.5, this.z - this.depth * 0.5, this.z + this.depth * 0.5);
};

Obstacle.getWidthDepthKey = function(width, depth) {
    return '' + width + 'x' + depth;
}

Obstacle.modelData = [
    {
        name: 'bush_1',
        width: 1,
        depth: 1
    },
    {
        name: 'bush_2',
        width: 1,
        depth: 1
    },
    {
        name: 'bush_3',
        width: 1,
        depth: 1
    },
    {
        name: 'bush_4',
        width: 1,
        depth: 1
    },
    {
        name: 'bush_5',
        width: 1,
        depth: 1
    }
];

Obstacle.models = [];
Obstacle.modelsByWidthDepth = {};

Obstacle.loadModels = function() {
    var loadOneModel = function(i) {
        GJS.utilTHREE.loadJSONModel(Obstacle.modelData[i].name, function(object) {
            Obstacle.models[i] = object;
            var WidthDepthKey = Obstacle.getWidthDepthKey(Obstacle.modelData[i].width, Obstacle.modelData[i].depth);
            if (!Obstacle.modelsByWidthDepth.hasOwnProperty(WidthDepthKey)) {
                Obstacle.modelsByWidthDepth[WidthDepthKey] = [];
            }
            Obstacle.modelsByWidthDepth[WidthDepthKey].push(object);
        });
    };
    for (var i = 0; i < Obstacle.modelData.length; ++i) {
        Obstacle.models.push(null);
        loadOneModel(i);
    }
};

Obstacle.loadModels();
