var assets = {
    fighter: {
        size: 3,
        turn_rate: 0.5
    },
    capital_ship: {
        size: 7.5,
        turn_rate: 0.1
    },
    pod: {
        size: 3
    },
    earth: {},
    missile: {
        size: 1,
        turn_rate: 5
    },
    rocket: {
        size: 1,
    }
};
var physics = [], explosions = [], lasers = [];
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
        camera.updateProjectionMatrix();
    });

    return {
        renderer: renderer,
        camera: camera
    };
}

function new_laser_beam(scene, origin, vector, length) {
    var geometry = new THREE.Geometry(),
        material = new THREE.LineBasicMaterial({color: 0xff0000}),
        beam, end;

    geometry.vertices.push(origin.clone());
    end = new THREE.Vector3(0,0,-length);
    end.applyQuaternion(vector);
    end.add(origin);
    geometry.vertices.push(end);
    beam = new THREE.Line(geometry, material);
    beam.life = 0.25;
    lasers.push(beam);
    beam.scene = scene;
    scene.add(beam);
}

var raycaster = new THREE.Raycaster();

function get_models_except(ship) {
    var models = [];
    for (var m = 0; m < physics.length; m++) {
        if (physics[m] == ship) continue;
        models.push(physics[m].object);
    }
    return models;
}

function get_ship_from_collision(collisions) {
    if (collisions.length == 0) return null;
    var collision = collisions[0],
        distance = collision.distance,
        point = collision.point,
        ship = collision.object;
    while (!ship.hasOwnProperty("ship")) {
        ship = ship.parent;
    }
    ship = ship.ship;
    return {
        ship: ship,
        distance: distance,
        point: point
    };
}

function new_laser(strength) {
    return {
        name: "LASER",
        capacity: 100,
        status: function () {
            return Math.round(Math.max(this.capacity, 0)) + "%";
        },
        update: function (dt, ship) {
            if (ship.weapon_fire_cooldown > 0) return;
            this.capacity = Math.min(this.capacity + dt * 25, 100);
        },
        fire: function (dt, ship) {
            if (ship.weapon_fire_cooldown > 0) return;
            if (this.capacity < 0) {
                return;
            }
            ship.weapon_fire_cooldown += 0.3;
            this.capacity -= 10;
            var vec = new THREE.Vector3(0,0,-1);
            vec.applyQuaternion(ship.object.quaternion);
            vec.normalize();
            raycaster.set(ship.object.position, vec);
            var models = get_models_except(ship);
            var collisions = raycaster.intersectObjects(models, true);
            var target = get_ship_from_collision(collisions);
            if (target) {
                target.ship.health -= strength;
                new_laser_beam(ship.scene, ship.object.position, ship.object.quaternion, target.distance);
                create_explosion(ship.scene, target.point, target.ship.velocity, target.ship.object.quaternion, 5);
            } else {
                new_laser_beam(ship.scene, ship.object.position, ship.object.quaternion, 100);
            }
        }
    }
}

function new_missile() {
    return {
        name: "MISSILE",
        capacity: 25,
        status: function () {
            return this.capacity + "/25";
        },
        update: function (dt, ship) {},
        fire: function (dt, ship) {
            if (ship.weapon_fire_cooldown > 0) return;
            if (this.capacity <= 0) {
                send_comms_message("&gt;OUT OF MISSILES&lt;");
                ship.weapon_fire_cooldown += 0.2;
                return;
            }
            this.capacity -= 1;
            ship.weapon_fire_cooldown += 0.6;

            var vec = new THREE.Vector3(0,0,-1);
            vec.applyQuaternion(ship.object.quaternion);
            vec.normalize();
            raycaster.set(ship.object.position, vec);
            var models = get_models_except(ship);
            var collisions = raycaster.intersectObjects(models, true);
            var aim = get_ship_from_collision(collisions), target = null;

            if (aim) {
                target = aim.ship;
            }

            var missile = new_ship(
                ship.scene,
                assets.missile.model.clone(),
                assets.missile.size,
                missile_ai,
                [],
                (new THREE.Vector3(0, 0, -5)).applyQuaternion(ship.object.quaternion).add(ship.object.position),
                ship.velocity.clone().multiplyScalar(2),
                (new THREE.Euler()).setFromQuaternion(ship.object.quaternion),
                150,
                assets.missile.turn_rate,
                ship.faction,
                "missile"
            );
            missile.target = target;
            physics.push(missile);
        }
    }
}

function new_rocket() {
    return {
        name: "ROCKET",
        capacity: 75,
        status: function () {
            return this.capacity + "/75";
        },
        update: function (dt, ship) {},
        fire: function (dt, ship) {
            if (ship.weapon_fire_cooldown > 0) return;
            if (this.capacity <= 0) {
                send_comms_message("&gt;OUT OF ROCKETS&lt;");
                ship.weapon_fire_cooldown += 0.2;
                return;
            }
            this.capacity -= 1;
            ship.weapon_fire_cooldown += 0.3;

            var rocket = new_ship(
                ship.scene,
                assets.rocket.model.clone(),
                assets.rocket.size,
                rocket_ai,
                [],
                (new THREE.Vector3(0, 0, -5)).applyQuaternion(ship.object.quaternion).add(ship.object.position),
                ship.velocity.clone().multiplyScalar(5),
                (new THREE.Euler()).setFromQuaternion(ship.object.quaternion),
                75,
                assets.rocket.turn_rate,
                ship.faction,
                "rocket"
            );
            physics.push(rocket);
        }
    }
}

function new_ship(scene, obj, size, ai, weapons, position, velocity, vector, explodes, turn_rate, faction, type) {
    scene.add(obj);
    obj.position.set(position.x, position.y, position.z);
    obj.rotation.copy(vector);
    var ship = {
        object: obj,
        velocity: velocity,
        thrust: 0,
        health: 100,
        dead: false,
        weapons: weapons,
        radius: size,
        weapon_fire_cooldown: 0,
        weapon_change_cooldown: 0,
        selected_weapon: 0,
        change_weapon: function (forwards) {
            if (this.weapon_change_cooldown <= 0) {
                if (forwards) {
                    this.selected_weapon = (this.selected_weapon + 1) % this.weapons.length;
                } else {
                    this.selected_weapon = (this.selected_weapon + this.weapons.length - 1) % this.weapons.length;
                }
                this.weapon_change_cooldown += 0.250;
            }
        },
        current_weapon: function () {
            return this.weapons[this.selected_weapon];
        },
        next_weapon: function () {
            return this.weapons[(this.selected_weapon + 1) % this.weapons.length];
        },
        previous_weapon: function () {
            return this.weapons[(this.selected_weapon + this.weapons.length - 1) % this.weapons.length];
        },
        radius_squared: size * size,
        has_collided: function (test) {
            return this.object.position.distanceToSquared(test.object.position) < (this.radius_squared + test.radius_squared);
        },
        ai: ai,
        scene: scene,
        explodes: explodes,
        turn_rate: turn_rate,
        faction: faction,
        target: null,
        type: type
    };
    obj.ship = ship;
    return ship;
}

function random_element(array) {
    var n = Math.floor(Math.random() * array.length);
    return array[n];
}

function acquire_target(targeter) {
    var min_distance = 10e9, candidate = null;
    for (var s = 0; s < physics.length; s++) {
        var ship = physics[s];
        if (ship.faction === targeter.faction) continue;
        var distance = ship.object.position.clone().sub(targeter.object.position).length();
        if (distance < min_distance) {
            min_distance = distance;
            candidate = ship;
        }
    }
    return candidate;
}

function fighter_ai(dt) {
    this.target = acquire_target(this);

    if (this.target !== null) {
        var target_vector = this.target.object.position.clone().sub(this.object.position),
            range = target_vector.length(),
            velocity_vector = (new THREE.Vector3(0, 0, -1)).applyQuaternion(this.object.quaternion),
            angle = velocity_vector.angleTo(target_vector),
            lerp_amount = Math.min((this.turn_rate * dt) /angle, 1),
            angle_thrust = (1 - (angle / Math.PI)) * 4 - 1,
            distance_thrust = Math.min(Math.max((range - 50) / 10, -3), 3);

        var quaternion = (new THREE.Quaternion()).setFromUnitVectors(velocity_vector.normalize(), target_vector.normalize());
        quaternion.multiply(this.object.quaternion);
        this.object.quaternion.slerp(quaternion, lerp_amount);
        this.thrust = Math.min(angle_thrust, distance_thrust);
        if (angle < 0.2 && range < 100) {
            if (this.thrust > -1) this.current_weapon().fire(dt, this);
        }
    }
}

function missile_ai(dt) {
    this.target = acquire_target(this);
    this.health -= 10 * dt;
    if (this.target !== null) {
        var target_vector = this.target.object.position.clone().sub(this.object.position),
            range = target_vector.length(),
            velocity_vector = (new THREE.Vector3(0, 0, -1)).applyQuaternion(this.object.quaternion),
            angle = velocity_vector.angleTo(target_vector),
            lerp_amount = Math.min((this.turn_rate * dt) /angle, 1),
            angle_thrust = (1 - (angle / Math.PI)) * 3 + 3.5;

        console.log(this.target.faction, this.target.type, range);
        var quaternion = (new THREE.Quaternion()).setFromUnitVectors(velocity_vector.normalize(), target_vector.normalize());
        quaternion.multiply(this.object.quaternion);
        this.object.quaternion.slerp(quaternion, lerp_amount);
        this.thrust = angle_thrust;
        if (range * range < this.explodes) {
            this.dead = true;
        }
    }
}

function rocket_ai(dt) {
    this.target = acquire_target(this);
    this.thrust = 10;
    this.health -= 15 * dt;
    if (this.target !== null) {
        var target_vector = this.target.object.position.clone().sub(this.object.position),
            range = target_vector.lengthSq();

        if (range < this.explodes) {
            this.dead = true
        }
    }
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
            if (inputs.keyboard.d) this.change_weapon(true);
            if (inputs.keyboard.a) this.change_weapon(false);
            if (inputs.mouse.left) this.current_weapon().fire(dt, this);
            if (inputs.mouse.right) this.next_weapon().fire(dt, this);

            this.health = Math.min(100, this.health + (this.health / 15 * dt));
        },
        [
            new_laser(5),
            new_missile(),
            new_rocket()
        ],
        new THREE.Vector3(0,0,0),
        new THREE.Vector3(0,0,0),
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0),
        false,
        assets.fighter.turn_rate,
        "player",
        "experimental ship"
    );
    physics.push(player);

    var n, ship;

    // Enemies
    for (n = 0; n < 5; n++) {
        ship = new_ship(
            scene,
            assets.fighter.model.clone(),
            assets.fighter.size,
            fighter_ai,
            [
                new_laser(5)
            ],
            new THREE.Vector3(Math.random() * 1000 - 500, Math.random() * 1000 - 500, Math.random() * 1000 - 500),
            new THREE.Vector3(0,0,0),
            new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0),
            false,
            assets.fighter.turn_rate,
            "police",
            "fighter"
        );
        physics.push(ship);
    }

    ship = new_ship(
        scene,
        assets.capital_ship.model.clone(),
        assets.capital_ship.size,
        fighter_ai,
        [
            new_laser(20),
            new_rocket()
        ],
        new THREE.Vector3(Math.random() * 1000 - 500, Math.random() * 1000 - 500, Math.random() * 1000 - 500),
        new THREE.Vector3(0,0,0),
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0),
        false,
        assets.fighter.turn_rate,
        "police",
        "capital ship"
    );
    physics.push(ship);


    return player; // change this!
}

function update_ships(dt) {
    var new_physics = [],
        detonations = [],
        s, target;
    while (physics.length > 0) {
        var ship = physics.pop();
        ship.ai(dt);
        ship.weapon_fire_cooldown = Math.max(0, ship.weapon_fire_cooldown - dt);
        ship.weapon_change_cooldown = Math.max(0, ship.weapon_change_cooldown - dt);
        var thrust = new THREE.Vector3(0, 0, dt * -ship.thrust);
        thrust.applyQuaternion(ship.object.quaternion);
        ship.velocity.multiplyScalar(0.97);
        ship.velocity.add(thrust);
        ship.object.position.add(ship.velocity);

        for (var w=0; w < ship.weapons.length; w++) {
            ship.weapons[w].update(dt, ship);
        }

        for (s=0; s < physics.length; s++) {
            target = physics[s];
            if (ship.has_collided(target)) {
                ship.health -= target.radius_squared * 10 * dt;
                create_explosion(ship.scene, ship.object.position, ship.velocity, ship.object.quaternion, 5);
                target.health -= ship.radius_squared * 10 * dt;
                create_explosion(target.scene, target.object.position, target.velocity, target.object.quaternion, 5);
            }
        }

        if (ship.health < 0) ship.dead = true;
        if (ship.dead) {
            create_explosion(ship.scene, ship.object.position, ship.velocity, ship.object.quaternion, 50);
            if (ship.explodes) {
                detonations.push({location: ship.object.position.clone(), power: ship.explodes});
            } else {
                send_comms_message(ship.faction.toUpperCase() + " " + ship.type.toUpperCase() + " DESTROYED");
            }
            ship.scene.remove(ship.object);
        } else {
            new_physics.push(ship);
        }
    }
    physics = new_physics;
    for (var d in detonations) {
        var detonation = detonations[d];
        for (s=0; s < physics.length; s++) {
            target = physics[s];
            var distance = detonation.location.distanceToSquared(target.object.position);
            if (distance < detonation.power) {
                target.health -= detonation.power;
                console.log("Hit", target.faction, target.type, "for", detonation.power, "dmage now at", target.health)
            }
        }
    }
}

function update_laser_beams(dt) {
    var new_lasers = [];
    while (lasers.length > 0) {
        var laser = lasers.pop();
        laser.life -= dt;
        if (laser.life < 0) {
            laser.scene.remove(laser);
        } else {
            new_lasers.push(laser);
        }
    }
    lasers = new_lasers;
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
    }

    document.addEventListener('pointerlockerror', lockError, false);
    document.addEventListener('mozpointerlockerror', lockError, false);
    document.addEventListener('webkitpointerlockerror', lockError, false);


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
        if (!pointerLockElement()) return;
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

function send_comms_message(message) {
    var line = $("<li>" + message + "</li>");
    ui_console.find("#chat ul").prepend(line)
}

function update_ui(dt) {
    if (player.dead) {
        ui_console.hide();
        return;
    }

    var thrust = Math.round(player.thrust * 100) / 2.5,
        shields = Math.round(player.health * 10) / 10,
        velocity = Math.round(player.velocity.length() * 50);
    ui_console.find("#engines .value").text(velocity + "m/s");
    if (thrust > 100) ui_console.find("#engines .value").addClass("error");
    else ui_console.find("#engines .value").removeClass("error");

    ui_console.find("#shields .value").text(shields + "%");
    ui_console.find("#shields .value").removeClass("error warning");
    if (shields < 33) ui_console.find("#shields .value").addClass("warning");
    else if (shields < 66) ui_console.find("#shields .value").addClass("error");

    var weapon_selected = player.current_weapon(),
        next_weapon = player.next_weapon(),
        previous_wepon = player.previous_weapon();
    ui_console.find("#weapon-selected .title").html(weapon_selected.name);
    ui_console.find("#weapon-selected .value").html(weapon_selected.status());

    ui_console.find("#weapon-right .title").html(next_weapon.name);
    ui_console.find("#weapon-right .value").html(next_weapon.status());

    ui_console.find("#weapon-left .title").html(previous_wepon.name);
    ui_console.find("#weapon-left .value").html(previous_wepon.status());
}

var player = null;

function create_starfield(scene) {
    var geometry = new THREE.Geometry(),
        material = new THREE.PointCloudMaterial({color: 0xffffff, size: 1}),
        vec;

    for (var n=0; n < 2000; n++) {
        vec = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        vec.normalize();
        vec.setLength(Math.round(Math.random() * 100) * 10e6);
        geometry.vertices.push(vec);
    }

    scene.add(new THREE.PointCloud(geometry, material));
}

function create_earth(scene) {
    var geometry = new THREE.Geometry(),
        material = new THREE.PointCloudMaterial({color: 0xffffff, size: 100, map: assets.earth.map, sizeAttenuation: false, transparent: true});

    geometry.vertices.push(new THREE.Vector3(0, 1e6 - 100, 0));

    scene.add(new THREE.PointCloud(geometry, material));
}

function _init() {
    var renderer = init_renderer(),
        scene = new THREE.Scene(),
        //player = init_game_state(scene),
        last = 0,
        render = function (now) {
            var dt = (now - last)/1000;
            if (pointerLockElement() || player.dead) {
                update_ships(dt);
                update_explosions(dt);
                update_laser_beams(dt);
            }
            update_ui(dt);
            last = now;
            //renderer.camera.position.copy(player.object.position);
            //renderer.camera.rotation.copy(player.object.rotation);
            renderer.renderer.render(scene, renderer.camera);
            requestAnimationFrame(render);
        };
    create_starfield(scene);
    create_earth(scene);
    player = init_game_state(scene);
    //renderer.camera.position.z = 150;
    //renderer.camera.position.y = 50;
    renderer.camera.position.z = -20;
    player.object.add(renderer.camera);

    var ambient = new THREE.AmbientLight(0x444444);
    scene.add(ambient);

    var directional = new THREE.DirectionalLight(0xffffff, 0.625);
    directional.position.set(0, 1000, 0);
    scene.add(directional);

    init_input_handlers(renderer.renderer.domElement);

    requestAnimationFrame(render);
}

var colladaLoader1 = new THREE.ColladaLoader({convertUpAxis: true}),
    colladaLoader2 = new THREE.ColladaLoader({convertUpAxis: true}),
    textureLoader = new THREE.TextureLoader(),
    required = [
        {
            loader: colladaLoader1,
            url: "models/fighter.dae",
            callback: function (collada) {
                var dae = collada.scene.children[0];
                dae.scale.x = dae.scale.y = dae.scale.z = 3/39;
                dae.updateMatrix();
                assets.fighter.model = dae;
            }
        },
        {
            loader: colladaLoader1,
            url: "models/capital.dae",
            callback: function (collada) {
                var dae = collada.scene.children[0];
                dae.scale.x = dae.scale.y = dae.scale.z = 3/39;
                dae.updateMatrix();
                assets.capital_ship.model = dae;
            }
        },
        {
            loader: colladaLoader2,
            url: "models/missile.dae",
            callback: function (collada) {
                var dae = collada.scene.children[0];
                dae.scale.x = dae.scale.y = dae.scale.z = 3/39;
                dae.updateMatrix();
                assets.missile.model = dae;
                assets.rocket.model = dae;
            }
        },
        {
            loader: textureLoader,
            url: "models/earth.png",
            callback: function (image) {
                assets.earth.map = image;
            }
        }
    ];

function init() {
    if (required.length > 0) {
        var asset = required.pop();
        asset.loader.load(asset.url, function (loaded) {
            asset.callback(loaded);
            init();
        })
    } else {
        _init();
    }

}
