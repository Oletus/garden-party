'use strict';

var Game = function(resizer, renderer, loadingBar) {
    this.resizer = resizer;
    this.renderer = renderer;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor( 0xffffff, 1);
    this.scene = new THREE.Scene();
    this.effectComposer = null;
    
    var camWidth = 1;
    var camHeight = 1;
    this.camera = new THREE.OrthographicCamera( camWidth / - 2, camWidth / 2, camHeight / 2, camHeight / - 2, 30, 80 );
    this.cameraControl = new GJS.OrbitCameraControl({
        camera: this.camera,
        lookAt: this.getLookAtCenter(),
        y: 30,
        orbitDistance: 30,
        relativeY: false,
        orbitAngle: Math.PI * 1.5
    });
    this.cameraControl.setLookAt(this.getLookAtCenter());
    this.updateCamera(this.resizer.width / this.resizer.height);
    
    this.loadingBar = loadingBar;

    this.time = 0;
    
    this.initializedAfterLoad = false;
    this.levelIndex = 0;
    
    this.xMoveIntent = 0;
    this.zMoveIntent = 0;

    var numPlayers = 1;
    this.input = new GJS.InputMapper(this, numPlayers);
    this.input.addListener(GJS.Gamepad.BUTTONS.UP_OR_ANALOG_UP, ['up', 'w'], this.upPress, this.upRelease);
    this.input.addListener(GJS.Gamepad.BUTTONS.DOWN_OR_ANALOG_DOWN, ['down', 's'], this.downPress, this.downRelease);
    this.input.addListener(GJS.Gamepad.BUTTONS.RIGHT_OR_ANALOG_RIGHT, ['right', 'd'], this.rightPress, this.rightRelease);
    this.input.addListener(GJS.Gamepad.BUTTONS.LEFT_OR_ANALOG_LEFT, ['left', 'a'], this.leftPress, this.leftRelease);
    
    this.input.addListener(GJS.Gamepad.BUTTONS.A, ['space'], this.spacePress);
    
    if (DEV_MODE) {
        this.input.addListener(undefined, ['c'], this.editorKeyPressFunction('c'));
        this.input.addListener(undefined, ['t'], this.editorKeyPressFunction('t'));
        this.input.addListener(undefined, ['b'], this.editorKeyPressFunction('b'));
        this.input.addListener(undefined, ['backspace'], this.editorKeyPressFunction(' '));
        this.input.addListener(undefined, ['ctrl+s'], this.editorKeyPressFunction('ctrl+s'));
        this.input.addListener(undefined, ['0'], this.devModeTakeScreenshot);
        this.input.addListener(undefined, ['n'], this.nextLevel);
    }
    this.takeScreenshot = false;
    
    Game.music.playSingular(true);
};

Game.music = new GJS.Audio('garden_party_theme');

Game.prototype.loadStaticScene = function() {
    this.guiParent = new THREE.Object3D();
    this.guiParent.position.x = 0;
    this.guiParent.position.z = 0;
    this.guiParent.rotation.y = Math.PI;
    this.scene.add(this.guiParent);
    
    this.scoreTextMaterial = DinnerTable.topicTextMaterial.clone();
    this.scoreText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'left',
        material: this.scoreTextMaterial
        });
    this.scoreText.object.position.x = -Level.gridWidth;
    this.scoreText.object.position.z = 0.2;
    this.scoreText.addToScene();
    
    this.failScoreTextMaterial = DinnerTable.topicTextMaterial.clone();
    this.failScoreText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'left',
        material: this.failScoreTextMaterial
        });
    this.failScoreText.object.position.x = -Level.gridWidth * 0.5;
    this.failScoreText.object.position.z = 0.2;
    this.failScoreText.addToScene();
    
    this.failTextMaterial = DinnerTable.failTextMaterial.clone();
    this.levelFailedText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'center',
        material: this.failTextMaterial
    });
    this.levelFailedText.setString('PARTY FAILED!');
    this.levelFailedText.object.position.x = -Level.gridWidth * 0.5;
    this.levelFailedText.object.position.z = -Level.gridDepth * 0.3;
    this.levelFailedText.object.position.y = 4.0;
    this.levelFailedText.object.scale.multiplyScalar(1.5);
    
    this.successTextMaterial = DinnerTable.scoreTextMaterial.clone();
    this.levelSuccessText = new GJS.ThreeExtrudedTextObject({
        sceneParent: this.guiParent,
        textAlign: 'center',
        material: this.successTextMaterial
    });
    this.levelSuccessText.setString('SPLENDID PARTY!');
    this.levelSuccessText.object.position.x = -Level.gridWidth * 0.5;
    this.levelSuccessText.object.position.z = -Level.gridDepth * 0.3;
    this.levelSuccessText.object.position.y = 4.0;
    this.levelSuccessText.object.scale.multiplyScalar(1.5);
};

Game.prototype.setupLights = function() {
    this.scene.add(new THREE.AmbientLight(0xC2E4FF, 1.5));
    var mainLight = new THREE.DirectionalLight(0xffbff7, 1.0);
    mainLight.position.set(0.5, 1, 0.6).normalize();
    this.scene.add(mainLight);

    var spotLight = new THREE.SpotLight(0xffbff7, 1, 0, Math.PI * 0.15);
    this.spotLight = spotLight;
    spotLight.position.set( 0.5 * 250, 250, 0.6 * 250 );
    spotLight.target = new THREE.Object3D();
    this.scene.add(spotLight.target);
    this.updateSpotLightTarget();

    spotLight.castShadow = true;
    var shadowFovDegrees = 4;
    spotLight.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( shadowFovDegrees, 1, 240, 380 ) );
    spotLight.shadow.bias = 0.0001;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.scene.add( spotLight );

    /*var helper = new THREE.CameraHelper( spotLight.shadow.camera );
    this.scene.add(helper);*/
};

Game.prototype.updateSpotLightTarget = function() {
    var spotTarget = new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5);
    this.spotLight.target.position.set(spotTarget.x, spotTarget.y, spotTarget.z);
};

Game.prototype.getLookAtCenter = function() {
    if (this.camera instanceof THREE.PerspectiveCamera) {
        return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.42);
    } else {
        return new THREE.Vector3(Level.gridWidth * 0.5, 0.0, Level.gridDepth * 0.5 + 1);
    }
};

Game.prototype.initPostprocessing = function(renderer) {
    // Setup render pass
    var renderPass = new THREE.RenderPass( this.scene, this.camera );

    var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    // TODO: Should the depth render target be resized on canvas resize?
    this.depthRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, pars );
    this.depthRenderTarget.texture.name = "SSAOShader.rt";
    
    this.aaPass = new THREE.SMAAPass( window.innerWidth, window.innerHeight );

    // Setup SSAO pass
    this.ssaoPass = new THREE.ShaderPass( THREE.SSAOShader );
    //this.ssaoPass.uniforms[ "tDiffuse" ].value will be set by ShaderPass
    this.ssaoPass.uniforms[ "tDepth" ].value = this.depthRenderTarget.texture;
    this.ssaoPass.uniforms[ 'size' ].value.set( window.innerWidth, window.innerHeight );
    this.ssaoPass.uniforms[ 'cameraNear' ].value = this.camera.near;
    this.ssaoPass.uniforms[ 'cameraFar' ].value = this.camera.far;
    this.ssaoPass.uniforms[ 'onlyAO' ].value = false;
    this.ssaoPass.uniforms[ 'aoClamp' ].value = 0.3;
    this.ssaoPass.uniforms[ 'lumInfluence' ].value = 0.5;

    // Add pass to effect composer
    this.effectComposer = new THREE.EffectComposer( renderer );
    this.effectComposer.addPass( renderPass );
    this.effectComposer.addPass( this.ssaoPass );
    this.ssaoPass.renderToScreen = false;
    this.effectComposer.addPass( this.aaPass );
    this.aaPass.renderToScreen = true;
};

Game.prototype.updateCamera = function(cameraAspect) {
    this.cameraAspect = cameraAspect;
    if (this.camera instanceof THREE.PerspectiveCamera) {
        this.camera.aspect = this.cameraAspect;
    } else {
        var camWidth = 17;
        var camHeight = 17 / this.cameraAspect;
        this.camera.left = camWidth / - 2;
        this.camera.right = camWidth / 2;
        this.camera.top = camHeight / 2;
        this.camera.bottom = camHeight / - 2;
    }
    this.camera.updateProjectionMatrix();
};

Game.prototype.render = function() {
    if (this.level) {
        var fadeOpacity = 0.0; // Opacity of black fader over the game (implemented by fading the canvas)
        if (this.level.state.id === Level.State.INTRO) {
            fadeOpacity = 1.0 - this.level.state.time;
        } else if (this.level.fadingOut) {
            fadeOpacity = this.level.state.time;
        }
        this.resizer.canvas.style.opacity = mathUtil.clamp(0.0, 1.0, 1.0 - fadeOpacity);
        
        this.spotLight.castShadow = Game.parameters.get('shadowsEnabled');
        this.level.render();
        if (Game.parameters.get('postProcessingEnabled')) {
            if (this.effectComposer === null) {
                this.initPostprocessing(this.renderer);
            }
            // Render depth into depthRenderTarget
            this.scene.overrideMaterial = Level.depthMaterial;
            this.renderer.render( this.scene, this.camera, this.depthRenderTarget, true );

            // Render renderPass and SSAO shaderPass
            this.scene.overrideMaterial = null;
            this.effectComposer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    var that = this;
    if (this.takeScreenshot) {
        this.renderer.domElement.toBlob(function(blob) {
            saveAs(blob, 'screenshot.png');
            that.takeScreenshot = false;
        });
        this.takeScreenshot = false;
    }
    
    return this.renderer;
};

Game.prototype.loadLevel = function() {
    if (this.level) {
        this.scene.remove(this.level.levelSceneParent);
        this.levelFailedText.removeFromScene();
        this.levelSuccessText.removeFromScene();
    }
    this.level = new Level({
        game: this,
        levelSpec: levelData.data[levelData.levelSequence[this.levelIndex]],
        scene: this.scene
    });
};

Game.prototype.update = function(deltaTime) {
    this.time += deltaTime;
    this.input.update();
    
    if (this.level) {
        this.level.update(deltaTime);
        if (this.level.fadingOut && this.level.state.time > 1.0) {
            if (this.level.state.id === Level.State.SUCCESS) {
                this.nextLevel();
            } else if (this.level.state.id === Level.State.FAIL) {
                this.restartLevel();
            }
        }
    }
    
    GJS.Audio.muteAll(Game.parameters.get('muteAudio'));

    // Call initialization function after all model assets have been loaded.
    if (this.loadingBar.finished() && !this.initializedAfterLoad) {
        this.loadStaticScene();
        this.setupLights();
        this.loadLevel();
        this.initializedAfterLoad = true;
    }
};

Game.prototype.nextLevel = function() {
    if (this.levelIndex < levelData.levelSequence.length - 1) {
        ++this.levelIndex;
        this.loadLevel();
    } else {
        this.restartLevel();
    }
};

Game.prototype.restartLevel = function() {
    this.loadLevel();
};

Game.prototype.editorKeyPressFunction = function(key) {
    var that = this;
    return function() {
        if (that.level) {
            that.level.editor.keyPress(key);
        }
    };
};

Game.prototype.updateMoveIntent = function() {
    if (this.level && this.level.state.id === Level.State.IN_PROGRESS) {
        this.level.playerCharacter.zMoveIntent = this.zMoveIntent;
        this.level.playerCharacter.xMoveIntent = this.xMoveIntent;
    }
};

Game.prototype.upPress = function() {
    this.zMoveIntent += 1.0;
    this.updateMoveIntent();
};

Game.prototype.downPress = function() {
    this.zMoveIntent -= 1.0;
    this.updateMoveIntent();
};

Game.prototype.upRelease = function() {
    this.zMoveIntent -= 1.0;
    this.updateMoveIntent();
};

Game.prototype.downRelease = function() {
    this.zMoveIntent += 1.0;
    this.updateMoveIntent();
};

Game.prototype.rightPress = function() {
    this.xMoveIntent -= 1.0;
    this.updateMoveIntent();
};

Game.prototype.leftPress = function() {
    this.xMoveIntent += 1.0;
    this.updateMoveIntent();
};

Game.prototype.rightRelease = function() {
    this.xMoveIntent += 1.0;
    this.updateMoveIntent();
};

Game.prototype.leftRelease = function() {
    this.xMoveIntent -= 1.0;
    this.updateMoveIntent();
};

Game.prototype.spacePress = function() {
    if (this.level) {
        if (this.level.state.id === Level.State.IN_PROGRESS) {
            this.level.playerCharacter.tryPickUpOrDrop();
        } else if ((this.level.state.id === Level.State.FAIL || this.level.state.id === Level.State.SUCCESS) && !this.level.fadingOut && this.level.state.time > 1.0) {
            this.level.fadingOut = true;
            this.level.state.change(this.level.state.id);
        }
    }
};

/**
 * Mouse/touch handler for pressing down a mouse button or touch.
 * @param {Object} event With following keys:
 *   current: Vec2 with current pointer coordinates in the canvas coordinate system.
 *   lastDown: Vec2 with coordinates of the latest press event in the canvas coordinate system.
 *   isDown: Boolean telling if the pointer is down.
 *   index: Integer index of the pointer being tracked.
 */
Game.prototype.canvasPress = function(event) {
};

/**
 * Mouse/touch handler for releasing a mouse button or touch.
 * @param {Object} event With following keys:
 *   current: Vec2 with current pointer coordinates in the canvas coordinate system.
 *   lastDown: Vec2 with coordinates of the latest press event in the canvas coordinate system.
 *   isDown: Boolean telling if the pointer is down.
 *   index: Integer index of the pointer being tracked.
 */
Game.prototype.canvasRelease = function(event) {
};

/**
 * Mouse/touch handler when a pointer is being moved.
 * @param {Object} event With following keys:
 *   current: Vec2 with current pointer coordinates in the canvas coordinate system.
 *   lastDown: Vec2 with coordinates of the latest press event in the canvas coordinate system.
 *   isDown: Boolean telling if the pointer is down.
 *   index: Integer index of the pointer being tracked.
 */
Game.prototype.canvasMove = function(event) {
    if (this.level) {
        this.level.canvasMove(this.viewportPos(event));
    }
};

Game.prototype.viewportPos = function(event) {
    var canvasPos = new Vec2(event.currentPosition.x, event.currentPosition.y);
    canvasPos.x = 2 * canvasPos.x / this.resizer.canvas.width - 1;
    canvasPos.y = 1 - 2 * canvasPos.y / this.resizer.canvas.height;
    return new THREE.Vector3(canvasPos.x, canvasPos.y, 0);
};

/**
 * Set the takeScreenshot flag so that a screenshot is taken on the next frame.
 */
Game.prototype.devModeTakeScreenshot = function() {
    this.takeScreenshot = true;
};

// Parameters added here can be tuned at run time when in developer mode
Game.parameters = new GJS.GameParameters({
    'muteAudio': {initial: false},
    'playerMoveSpeed': {initial: 5.0},
    'gooseWalkSpeed': {initial: 2.0},
    'gooseChaseSpeed': {initial: 6.0},
    'gooseLineOfSightChaseDistance': {initial: 4.0},
    'gooseBiteStunTime': {initial: 2.0},
    'maxTimePerDiscussionTopic': {initial: 20.0},
    'postProcessingEnabled': {initial: true},
    'shadowsEnabled': {initial: true},
    'debugVisualizations': {initial: false},
    'teargravity': {initial: 6.0}
});

var DEV_MODE = querystringUtil.get('devMode') !== undefined;

window['start'] = function() {
    var DEBUG_MAIN_LOOP = DEV_MODE && true; // Set to true to allow fast-forwarding main loop with 'f'
    Game.parameters.set('muteAudio', (DEV_MODE && true)); // Set to true if sounds annoy developers
    
    mathUtil.seedrandom();
    
    var game;
    
    var renderer = new THREE.WebGLRenderer(/*{antialias: true}*/);
    var canvasWrapper = document.createElement('div');
    canvasWrapper.appendChild(renderer.domElement);

    GJS.commonUI.createUI({
        parent: canvasWrapper,
        fullscreenElement: document.body,
        twitterAccount: 'Oletus',
        fillStyle: '#000000',
        opacity: 0.5,
        scale: 1
    });

    var resizer = new GJS.CanvasResizer({
        mode: GJS.CanvasResizer.Mode.FIXED_ASPECT_RATIO,
        canvas: renderer.domElement,
        wrapperElement: canvasWrapper,
        width: 16,
        height: 12,
        setCanvasSizeCallback: function(width, height) {
            renderer.setSize(width, height);
            if (game !== undefined && game.level) {
                game.updateCamera(width / height);
                if (game.effectComposer !== null) {
                    game.effectComposer.setSize(width, height);
                    game.aaPass.setSize(width, height);
                    game.depthRenderTarget.setSize(width, height);
                    game.ssaoPass.uniforms[ 'size' ].value.set(width, height);
                }
            }
        }
    });

    // Initialize after CanvasResizer so it is always drawn on top
    if (DEV_MODE) {
        Game.parameters.initGUI();
    }

    var loadingBar = new GJS.LoadingBar();
    game = new Game(resizer, renderer, loadingBar);
    
    // Create event handlers for mouse and touch based input that will call on the canvas* members of game.
    resizer.createPointerEventListener(game, true);
    
    startMainLoop([resizer, game, loadingBar, resizer.pixelator()], {debugMode: DEBUG_MAIN_LOOP});
};
