'use strict';

// Requires utiljs.js

if (typeof GJS === "undefined") {
    var GJS = {};
}

/**
 * An object that owns a THREE.Object3D.
 * @constructor
 */
GJS.ThreeSceneObject = function() {
};

/**
 * Initialize.
 * @param {Object} options Options with the following keys:
 *   sceneParent (Object3D): Parent of the object in the scene.
 *   object (Object3D): Object that this object will own and add under sceneParent.
 */
GJS.ThreeSceneObject.prototype.initThreeSceneObject = function(options) {
    var defaults = {
        sceneParent: null,
        object: null
    };
    objectUtil.initWithDefaults(this, defaults, options);
    this._inScene = false;
};

/**
 * Add this object to the scene if it is not there.
 */
GJS.ThreeSceneObject.prototype.addToScene = function() {
    if (!this._inScene) {
        this.sceneParent.add(this.object);
        this._inScene = true;
    }
};

/**
 * Remove this object from the scene if it is in there.
 */
GJS.ThreeSceneObject.prototype.removeFromScene = function() {
    if (this._inScene) {
        this.sceneParent.remove(this.object);
        this._inScene = false;
    }
};

/**
 * @param {THREE.Object3D} object Object to query.
 * @return {boolean} True if object is in the owned part of the scene graph.
 */
GJS.ThreeSceneObject.prototype.ownsSceneObject = function(object) {
    var matches = false;
    this.getOwnQueryObject().traverse(function(obj) {
        if (obj === object) {
            matches = true;
        }
    });
    return matches;
};

/**
 * Override this to customize which parts of the scene this object is considered to own for the purposes of
 * ownsSceneObject.
 * @return {THREE.Object3D} object this object owns
 */
GJS.ThreeSceneObject.prototype.getOwnQueryObject = function() {
    return this.object;
};

/**
 * Update the object. Override this to do time-based updates.
 */
GJS.ThreeSceneObject.prototype.update = function(deltaTime) {
};



/**
 * An object that owns a text string that's displayed as a Three.js scene object.
 * @constructor
 */
GJS.ThreeTextObject = function() {
};

GJS.ThreeTextObject.prototype = new GJS.ThreeSceneObject();

GJS.ThreeTextObject.prototype.initThreeTextObject = function(options) {
    var defaults = {
        string: "",
        maxRowLength: -1,
        rowSpacing: 1.3
    };
    objectUtil.initWithDefaults(this, defaults, options);
    
    this.initThreeSceneObject(options);
    this.object = new THREE.Object3D();
    
    var string = this.string;
    this.string = "";
    this.setString(string);
};

/**
 * @param {string} string
 */
GJS.ThreeTextObject.prototype.setString = function(string) {
    this.string = string;
    this.stringSplitToRows = stringUtil.splitToRows(this.string, this.maxRowLength);
};

/**
 * An object that displays a text string as an extruded Three.js mesh.
 * @constructor
 */
GJS.ThreeExtrudedTextObject = function(options) {
    var defaults = {
        material: GJS.ThreeExtrudedTextObject.defaultMaterial,
        font: GJS.ThreeExtrudedTextObject.defaultFont
    };
    objectUtil.initWithDefaults(this, defaults, options);
    this.initThreeTextObject(options);
};

GJS.ThreeExtrudedTextObject.defaultMaterial = new THREE.MeshPhongMaterial( { color: 0x333333, specular: 0x000000 } );
GJS.ThreeExtrudedTextObject.defaultFont = null;

GJS.ThreeExtrudedTextObject.prototype = new GJS.ThreeTextObject();

GJS.ThreeExtrudedTextObject.prototype.setString = function(string) {
    if (string != this.string) {
        GJS.ThreeTextObject.prototype.setString.call(this, string);
        while (this.object.children.length > 0) {
            this.object.remove(this.object.children[0]);
        }
        for (var i = 0; i < this.stringSplitToRows.length; ++i) {
            var rowMesh = this._createTextMesh(this.stringSplitToRows[i]);
            rowMesh.position.y = (this.stringSplitToRows.length - i - 0.5) * this.rowSpacing;
            this.object.add(rowMesh);
        }
    }
};

GJS.ThreeExtrudedTextObject.prototype._createTextMesh = function(string) {
    var textGeo = new THREE.TextGeometry( string, {
        font: this.font,
        size: 1,
        height: 0.1,
        curveSegments: 1,
        bevelEnabled: false,
    });
    textGeo.center();
    var textMesh = new THREE.Mesh( textGeo, this.material );
    return textMesh;
};
