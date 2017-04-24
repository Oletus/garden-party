'use strict';

var Game = function(resizer, renderer, loadingBar) {
    this.resizer = resizer;
    this.renderer = renderer;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor( 0xffffff, 1);
    this.loadingBar = loadingBar;

    this.time = 0;
    
    this.initializedAfterLoad = false;
    this.levelIndex = 0;

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
        this.input.addListener(undefined, ['backspace'], this.editorKeyPressFunction(' '));
        this.input.addListener(undefined, ['ctrl+s'], this.editorKeyPressFunction('ctrl+s'));
        this.input.addListener(undefined, ['0'], this.devModeTakeScreenshot);
    }
    this.takeScreenshot = false;
    
    Game.music.playSingular(true);
};

Game.music = new GJS.Audio('garden_party_theme');

Game.prototype.loadLevel = function() {
    this.level = new Level({
        game: this,
        cameraAspect: this.resizer.width / this.resizer.height,
        levelSpec: levelData.data[levelData.levelSequence[this.levelIndex]]
    });
};

Game.prototype.render = function() {
    if (this.level) {
        var fadeOpacity = 0.0; // Opacity of black fader over the game (implemented by fading the canvas)
        if (this.level.state.id === Level.State.INTRO) {
            fadeOpacity = 1.0 - this.level.state.time;
        } else if (this.level.state.id === Level.State.SUCCESS || this.level.state.id === Level.State.FAIL) {
            fadeOpacity = this.level.state.time;
        }
        this.resizer.canvas.style.opacity = mathUtil.clamp(0.0, 1.0, 1.0 - fadeOpacity);
        this.level.render(this.renderer);
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

Game.prototype.update = function(deltaTime) {
    this.time += deltaTime;
    this.input.update();
    
    if (this.level) {
        this.level.update(deltaTime);
        if (this.level.state.id === Level.State.SUCCESS && this.level.state.time > 1.0) {
            this.nextLevel();
        } else if (this.level.state.id === Level.State.FAIL && this.level.state.time > 1.0) {
            this.restartLevel();
        }
    }
    
    GJS.Audio.muteAll(Game.parameters.get('muteAudio'));

    // Call initialization function after all model assets have been loaded.
    if (this.loadingBar.finished() && !this.initializedAfterLoad) {
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

Game.prototype.upPress = function() {
    if (this.level) {
        this.level.playerCharacter.zMoveIntent += 1.0;
    }
};

Game.prototype.downPress = function() {
    if (this.level) {
        this.level.playerCharacter.zMoveIntent -= 1.0;
    }
};

Game.prototype.upRelease = function() {
    if (this.level) {
        this.level.playerCharacter.zMoveIntent -= 1.0;
    }
};

Game.prototype.downRelease = function() {
    if (this.level) {
        this.level.playerCharacter.zMoveIntent += 1.0;
    }
};

Game.prototype.rightPress = function() {
    if (this.level) {
        this.level.playerCharacter.xMoveIntent -= 1.0;
    }
};

Game.prototype.leftPress = function() {
    if (this.level) {
        this.level.playerCharacter.xMoveIntent += 1.0;
    }
};

Game.prototype.rightRelease = function() {
    if (this.level) {
        this.level.playerCharacter.xMoveIntent += 1.0;
    }
};

Game.prototype.leftRelease = function() {
    if (this.level) {
        this.level.playerCharacter.xMoveIntent -= 1.0;
    }
};

Game.prototype.spacePress = function() {
    if (this.level) {
        this.level.playerCharacter.tryPickUpOrDrop();
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
                game.level.updateCamera(width / height);
                if (game.level.effectComposer !== null) {
                    game.level.effectComposer.setSize(width, height);
                    game.level.aaPass.setSize(width, height);
                    game.level.depthRenderTarget.setSize(width, height);
                    game.level.ssaoPass.uniforms[ 'size' ].value.set(width, height);
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
