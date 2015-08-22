var assets = {
    fighter: {
        mesh: new THREE.SphereGeometry(3),
        texture: {
            friendly: new THREE.MeshBasicMaterial({color: 0x00ff00}),
            enemy: new THREE.MeshBasicMaterial({color: 0xff0000})
        },
        size: 3
    },
    capital_ship: {
        mesh: new THREE.SphereGeometry(10),
        texture: {
            friendly: new THREE.MeshBasicMaterial({color: 0x00ff00}),
            enemy: new THREE.MeshBasicMaterial({color: 0xff0000})
        },
        size: 3
    },
    pod: {
        mesh: new THREE.SphereGeometry(1),
        texture: {
            friendly: new THREE.MeshBasicMaterial({color: 0x00ff00}),
            enemy: new THREE.MeshBasicMaterial({color: 0xff0000})
        },
        size: 3
    }
};
var physics = [];
var inputs = {
    mouse: {
        location: new THREE.Vector2(0,0),
        left: false,
        right: false
    },
    keyboard: {
        w: false,
        a: false,
        s: false,
        d: false,
        q: false,
        e: false,
        shift: false,
        space: false
    }
};

function init_renderer() {
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10e9);

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    $(window).resize(function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
    });

    return {
        renderer: renderer,
        camera: camera
    };
}

function new_ship(scene, obj, size, ai, weapons, position, velocity, vector) {
    scene.add(obj);
    obj.position.set(position.x, position.y, position.z);
    obj.rotation.clone(vector);
    return {
        object: obj,
        velocity: velocity,
        thrust: 0,
        health: 100,
        weapons: weapons,
        radius: size,
        radius_squared: size * size,
        has_collided: function (test) {
            return this.object.position.distanceToSquared(test.object.position) < (this.radius_squared + test.radius_squared);
        },
        ai: ai
    };
}

function init_game_state(scene) {
    var player = new_ship(
        scene,
        new THREE.Mesh(assets.fighter.mesh, assets.fighter.texture.friendly),
        assets.fighter.size,
        function (dt) {
            if (inputs.keyboard.w) {
                this.thrust = Math.min(3, this.thrust + dt * 0.1);
            }
            if (inputs.keyboard.s) {
                this.thrust = Math.max(-1, this.thrust - dt * 0.1);
            }
            this.object.rotateX(inputs.mouse.location.y * -dt * 0.1);
            this.object.rotateY(inputs.mouse.location.x * -dt * 0.1);
        },
        [],
        new THREE.Vector3(0,0,0),
        new THREE.Vector3(0,0,0),
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0)
    );
    physics.push(player);

    for (var n = 0; n < 10; n++) {
        var ship = new_ship(
            scene,
            new THREE.Mesh(assets.fighter.mesh, assets.fighter.texture.friendly),
            assets.fighter.size,
            function (dt) {
                this.object.rotateX(-dt * (Math.random() - 0.5));
                this.object.rotateY(-dt * (Math.random() - 0.5));
                this.thrust = Math.random() * 4 - 1;
            },
            [],
            new THREE.Vector3(Math.random() * 1000 - 500, Math.random() * 1000 - 500, Math.random() * 1000 - 500),
            new THREE.Vector3(0,0,0),
            new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0)
        );
        physics.push(ship);
    }

    return player; // change this!
}

function update_physics(dt) {
    var new_physics = [];
    for (var s in physics) {
        var obj = physics[s];
        if (obj.health < 0) {
            // TODO: make it explode
        } else {
            obj.ai(dt);
            var thrust = new THREE.Vector3(0, 0, dt * -obj.thrust);
            thrust.applyQuaternion(obj.object.quaternion);
            obj.velocity.multiplyScalar(0.9);
            obj.velocity.add(thrust);
            obj.object.position.add(obj.velocity);
            new_physics.push(obj);
        }
    }
    physics = new_physics;
}

function pointerLockElement() {
    return document.pointerLockElement ||
            document.mozPointerLockElement ||
            document.webkitPointerLockElement;
}

function init_input_handlers(canvas) {
    document.body.onclick = document.body.requestPointerLock ||
            document.body.mozRequestPointerLock ||
            document.body.webkitRequestPointerLock;

    function moveCallback(e) {
        inputs.mouse.location.x = e.movementX ||
                e.mozMovementX ||
                e.webkitMovementX ||
                0;
        inputs.mouse.location.y = e.movementY ||
                e.mozMovementY      ||
                e.webkitMovementY   ||
                0;
    }

    function changeCallback(evt) {
        console.log("change callback is has been called", evt);
        if (document.pointerLockElement === document.body ||
            document.mozPointerLockElement === document.body ||
            document.webkitPointerLockElement === document.body) {
            // Pointer was just locked
            // Enable the mousemove listener
            document.addEventListener("mousemove", moveCallback, false);
        } else {
            // Pointer was just unlocked
            // Disable the mousemove listener
            document.removeEventListener("mousemove", moveCallback, false);
        }
    }

    document.addEventListener('pointerlockchange', changeCallback, false);
    document.addEventListener('mozpointerlockchange', changeCallback, false);
    document.addEventListener('webkitpointerlockchange', changeCallback, false);

    function lockError(e) {
        console.log("Pointer lock failed", e);
    }

    document.addEventListener('pointerlockerror', lockError, false);
    document.addEventListener('mozpointerlockerror', lockError, false);
    document.addEventListener('webkitpointerlockerror', lockError, false);


    // Ask the browser to lock the pointer)
    console.log("Requesting pointer lock");
    document.body.requestPointerLock();


    var win = $(window);
    win.keydown(function (evt) {
        switch (evt.which) {
            case 87:
                inputs.keyboard.w = true;
                break;
            case 65:
                inputs.keyboard.a = true;
                break;
            case 83:
                inputs.keyboard.s = true;
                break;
            case 68:
                inputs.keyboard.d = true;
                break;
            case 81:
                inputs.keyboard.q = true;
                break;
            case 69:
                inputs.keyboard.e = true;
                break;
            case 16:
                inputs.keyboard.shift = true;
                break;
            case 32:
                inputs.keyboard.space = true;
                break;
        }
    });
    win.keyup(function (evt) {
        switch (evt.which) {
            case 87:
                inputs.keyboard.w = false;
                break;
            case 65:
                inputs.keyboard.a = false;
                break;
            case 83:
                inputs.keyboard.s = false;
                break;
            case 68:
                inputs.keyboard.d = false;
                break;
            case 81:
                inputs.keyboard.q = false;
                break;
            case 69:
                inputs.keyboard.e = false;
                break;
            case 16:
                inputs.keyboard.shift = false;
                break;
            case 32:
                inputs.keyboard.space = false;
                break;
        }
    });
    win.mousedown(function (evt) {
        switch (evt.which) {
            case 1:
                inputs.mouse.left = true;
                break;
            case 3:
                inputs.mouse.right = true;
                break;
        }
    });
    win.mouseup(function (evt) {
        switch (evt.which) {
            case 1:
                inputs.mouse.left = false;
                break;
            case 3:
                inputs.mouse.right = false;
                break;
        }
    });
}

var player = null;

function init() {
    var renderer = init_renderer(),
        scene = new THREE.Scene(),
        //player = init_game_state(scene),
        last = 0,
        render = function (now) {
            if (pointerLockElement()) update_physics((now - last)/1000);
            last = now;
            renderer.camera.position.copy(player.object.position);
            renderer.camera.rotation.copy(player.object.rotation);
            renderer.renderer.render(scene, renderer.camera);
            requestAnimationFrame(render);
        };
    player = init_game_state(scene);


    init_input_handlers(renderer.renderer.domElement);

    requestAnimationFrame(render);
}
