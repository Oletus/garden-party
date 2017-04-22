'use strict';

var LevelEditor = function(level, sceneParent) {
    this.level = level;
    this.sceneParent = sceneParent;
    this.chosenY = 0;

    this.editorCursor = new EditorCursor({
        level: this.level,
        sceneParent: this.sceneParent,
        color: 0xff0000,
        y: this.chosenY + 0.7
    });

    this.editorCursor.addToScene();
};

LevelEditor.prototype.update = function(deltaTime) {
    if (this.level.hoverTarget) {
        this.editorCursor.gridX = Math.floor(this.level.hoverTarget.object.position.x);
        this.editorCursor.gridZ = Math.floor(this.level.hoverTarget.object.position.z);
    }
    this.editorCursor.update(deltaTime);
};

var EditorCursor = function(options) {
    var defaults = {
        level: null,
        gridX: 0,
        gridZ: 0,
        color: 0xaaccff,
        y: 1.0
    };
    objectUtil.initWithDefaults(this, defaults, options);

    this.mesh = this.createMesh();
    this.origin = new THREE.Object3D();
    this.origin.add(this.mesh);

    this.initThreeSceneObject({
        object: this.origin,
        sceneParent: options.sceneParent
    });
};

EditorCursor.prototype = new GJS.ThreeSceneObject();

EditorCursor.material = function(color, emissiveColor) {
    if (emissiveColor === undefined) emissiveColor = 0xffff00;
    var material = new THREE.MeshPhongMaterial( { color: color, emissive: emissiveColor } );
    material.transparent = true;
    material.opacity = 0.7;
    return material;
};

EditorCursor.prototype.update = function(deltaTime) {
    this.object.position.x = this.gridX + 0.5;
    this.object.position.z = this.gridZ + 0.5;
    this.mesh.rotation.y += deltaTime;
};

EditorCursor.prototype.createMesh = function() {
    var shape = GJS.utilTHREE.createSquareWithHoleShape(1, 0.6);
    var line = new THREE.LineCurve3(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 0.1, 0));
    var extrudeSettings = {
        steps: 1,
        bevelEnabled: false,
        extrudePath: line
    };
    var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    return new THREE.Mesh(geometry, EditorCursor.material(this.color));
};
