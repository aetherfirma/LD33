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
var physics = [], explosions = [];
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
        dead: false,
        weapons: weapons,
        radius: size,
        radius_squared: size * size,
        has_collided: function (test) {
            return this.object.position.distanceToSquared(test.object.position) < (this.radius_squared + test.radius_squared);
        },
        ai: ai,
        scene: scene
    };
}

function init_game_state(scene) {
    var player = new_ship(
        scene,
        assets.fighter.model.clone(),
        assets.fighter.size,
        function (dt) {
            if (inputs.keyboard.w) {
                this.thrust = Math.min(3, this.thrust + dt * 0.75);
            }
            if (inputs.keyboard.s) {
                this.thrust = Math.max(-1, this.thrust - dt * 0.75);
            }
            this.object.rotateX(inputs.mouse.location.y * -dt * 0.1);
            this.object.rotateY(inputs.mouse.location.x * -dt * 0.1);
            if (this.thrust > 2.5) {
                var damage = (this.thrust - 2.45) * dt;
                this.health -= damage;
            }
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
            assets.fighter.model.clone(),
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
    while (physics.length > 0) {
        var ship = physics.pop();
        ship.ai(dt);
        var thrust = new THREE.Vector3(0, 0, dt * -ship.thrust);
        thrust.applyQuaternion(ship.object.quaternion);
        ship.velocity.multiplyScalar(0.99);
        ship.velocity.add(thrust);
        ship.object.position.add(ship.velocity);

        for (var s=0; s < physics.length; s++) {
            var target = physics[s];
            if (ship.has_collided(target)) {
                if (ship == player) {
                    target.dead = true;
                } else if (target == player) {
                    ship.dead = true;
                } else // REMOVE THIS
                if (ship.radius > target.radius) {
                    ship.health -= target.radius_squared;
                    target.dead = true;
                } else if (ship.radius < target.radius) {
                    target.health -= ship.radius_squared;
                    ship.dead = true;
                } else {
                    ship.dead = target.dead = true;
                }
            }
        }

        if (ship.health < 0) ship.dead = true;
        if (ship.dead) {
            create_explosion(ship.scene, ship.object.position, ship.velocity, ship.object.quaternion, 50);
            ship.scene.remove(ship.object);
        } else {
            new_physics.push(ship);
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

function create_explosion(scene, position, velocity, vector, size) {
    var geometry = new THREE.Geometry(),
        material = new THREE.PointCloudMaterial({
            color: Math.round(Math.random() * 0x88 + 0x87) * 0x10000,
            size: 30
        }),
        cloud = new THREE.PointCloud(geometry, material);
    for (var i=0; i < size; i++) {
        var particle = position.clone();
        particle.velocity = velocity.clone();
        particle.velocity.applyQuaternion(vector);
        particle.velocity.add(new THREE.Vector3((Math.random() * 10 - 5) * 20, (Math.random() * 10 - 5) * 20, (Math.random() * 10 - 5) * 20));
        geometry.vertices.push(particle);
    }
    cloud.sortParticles = true;
    cloud.scene = scene;
    cloud.lifetime = Math.random() * 5 + 2;
    cloud.alive = 0;
    cloud.particles = size;
    scene.add(cloud);
    explosions.push(cloud);
}

function update_explosions(dt) {
    var new_explosions = [];
    while (explosions.length > 0) {
        var explosion = explosions.pop();
        explosion.alive += dt;
        if (explosion.alive > explosion.lifetime) {
            explosion.scene.remove(explosion);
            continue;
        }
        for (var i=0; i < explosion.geometry.vertices.length; i++) {
            var particle = explosion.geometry.vertices[i];
            var velocity = particle.velocity.clone();
            velocity.multiplyScalar(dt);
            particle.add(velocity);
        }
        explosion.geometry.verticesNeedUpdate = true;
        new_explosions.push(explosion);
    }
    explosions = new_explosions;
}

var ui_console = $("#console");

function update_ui(dt) {
    if (!pointerLockElement()) {
        ui_console.text("PAUSED");
    } else {
        var thrust = Math.round(player.thrust * 100) / 2.5,
            shields = Math.round(player.health * 10) / 10,
            velocity = Math.round(player.velocity.length() * 50);
            msg = "";
        msg += "ENGINES:<br>";
        if (thrust > 100) {
            msg += "<span style='color:red;'>" + thrust + "%</span>/" + velocity + "m/s";
        } else {
            msg += thrust + "%/" + velocity + "m/s";
        }
        msg += "<br>HULL INTEGRITY:<br>";
        if (shields < 25) {
            msg += "<span style='color:red;'>" + shields + "%</span>";
        } else if (shields < 50) {
            msg += "<span style='color:orange;'>" + shields + "%</span>";
        } else {
            msg += shields + "%";
        }
        ui_console.html(msg);
    }
}

var player = null;

function _init() {
    var renderer = init_renderer(),
        scene = new THREE.Scene(),
        //player = init_game_state(scene),
        last = 0,
        render = function (now) {
            var dt = (now - last)/1000;
            if (pointerLockElement()) {
                update_physics(dt);
                update_explosions(dt);
            }
            update_ui(dt);
            last = now;
            //renderer.camera.position.copy(player.object.position);
            //renderer.camera.rotation.copy(player.object.rotation);
            renderer.renderer.render(scene, renderer.camera);
            requestAnimationFrame(render);
        };
    player = init_game_state(scene);
    //renderer.camera.position.z = 150;
    //renderer.camera.position.y = 50;
    renderer.camera.position.z = -20;
    player.object.add(renderer.camera);

    var ambient = new THREE.AmbientLight(0x888888);
    scene.add(ambient);

    var directional = new THREE.DirectionalLight(0xffffff, 0.5);
    directional.position.set(0, 1000, 0);
    scene.add(directional);

    init_input_handlers(renderer.renderer.domElement);

    requestAnimationFrame(render);
}

function init() {
    var loader = new THREE.ColladaLoader({convertUpAxis: true});
    loader.load("models/fighter.dae", function (collada) {
        var dae = collada.scene.children[0];
        dae.scale.x = dae.scale.y = dae.scale.z = 3/39;
        dae.updateMatrix();
        assets.fighter.model = dae;
        _init();
    });
}
