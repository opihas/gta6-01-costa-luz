/* Costa Luz: deterministic city and frame-rate-independent game rules. */
const CostaSim = (() => {
  'use strict';

  const SIZE = 2448;
  const GRID = 272;
  const ROAD = 96;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const jobs = [
    {
      name: 'A Favor for Inez', goal: 'Talk to Inez at the market crossing',
      x: 864, y: 592, kind: 'visit',
      line: 'INEZ: Varela bought the port with stolen wages. His ledger can prove it. Borrow my coral coupe. We are taking our city back.'
    },
    {
      name: 'Borrowed Wheels', goal: 'Take the coral coupe beside Inez',
      x: 900, y: 592, kind: 'car',
      line: 'INEZ: Nice and quiet, right? Head for Pier Seven. The gate is on the east side of the container yard.'
    },
    {
      name: 'Pier Seven', goal: 'Drive to the marked container gate',
      x: 1408, y: 864, kind: 'drive',
      line: 'INEZ: Varela left three security drones. Get out, disable them, and find the amber ledger case inside the yard.'
    },
    {
      name: 'Cargo Dispute', goal: 'Disable three drones, then collect the ledger',
      x: 1540, y: 1000, kind: 'cargo',
      line: 'INEZ: The whole payroll is here. Dispatch is on his money too. Lose the patrols, then bring the book to my marina garage.'
    },
    {
      name: 'Off the Record', goal: 'Lose your wanted level; enter the marina garage',
      x: 1952, y: 1136, kind: 'escape',
      line: 'INEZ: You made it. I copied the pages. Rádio Maré will broadcast them. One last delivery, on foot at the transmitter.'
    },
    {
      name: 'Open Frequency', goal: 'Deliver the evidence to Rádio Maré on foot',
      x: 1680, y: 1408, kind: 'visit',
      line: 'INEZ: Listen. That is our city hearing the truth. Varela is finished. You have a place here, driver. Costa Luz is yours.'
    }
  ];
  const services = [
    { x: 1952, y: 1136, name: 'SOL GARAGE', kind: 'repair', color: '#90f3cd' },
    { x: 1408, y: 1680, name: 'CHROMA / RESPRAY', kind: 'paint', color: '#ef99ba' },
    { x: 592, y: 1136, name: 'MERCADO COURIER', kind: 'courier', color: '#ffd382' }
  ];
  const deliveryStops = [
    { x: 1136, y: 320, name: 'Centro pharmacy' },
    { x: 1952, y: 1952, name: 'Waterfront café' },
    { x: 864, y: 1952, name: 'South market' }
  ];

  function randomSource(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  function createWorld() {
    const random = randomSource(31863);
    const walls = ['#e8b18c', '#e5cb9d', '#8fc9bf', '#cf8b88', '#a6bccc', '#d4b79d'];
    const roofs = ['#fff0cf', '#efd1ad', '#c8e0ce', '#f3b99f', '#e4dce3'];
    const colors = ['#ef675b', '#e9bb58', '#46adb2', '#eee9d5', '#6379b8', '#99687e'];
    const buildings = [];
    const trees = [];
    const parks = [];
    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        const x = gx * GRID + ROAD + 12;
        const y = gy * GRID + ROAD + 12;
        const yard = (gx === 5 && gy === 3) || (gx === 0 && gy === 0);
        if (yard || (gx + gy * 3) % 7 === 3) {
          parks.push({ x, y, yard });
          if (!yard) {
            for (let i = 0; i < 6; i++) {
              trees.push({ x: x + 19 + i % 3 * 52, y: y + 18 + Math.floor(i / 3) * 112, seed: random() });
            }
          }
          continue;
        }
        for (let i = 0; i < 4; i++) {
          const downtown = gx >= 2 && gx <= 5 && gy <= 4;
          buildings.push({
            x: x + i % 2 * 83, y: y + Math.floor(i / 2) * 83,
            w: 56 + random() * 13, d: 56 + random() * 13,
            h: 24 + random() * (downtown ? 96 : 39),
            wall: walls[Math.floor(random() * walls.length)],
            roof: roofs[Math.floor(random() * roofs.length)], id: buildings.length
          });
        }
        trees.push({ x: x - 5, y: y + 75, seed: random() }, { x: x + 75, y: y - 5, seed: random() });
      }
    }
    const cars = [{
      id: 0, x: 900, y: 592, angle: 0, speed: 0, color: '#ff6755',
      special: true, model: 'Brisa Coupe', hp: 100, traffic: false
    }];
    for (let i = 0; i < 48; i++) {
      const horizontal = i % 2 === 0;
      const positive = i % 4 < 2;
      const lane = (i % 9) * GRID + (positive ? 66 : 30);
      const position = random() * (SIZE - 200) + 60;
      cars.push({
        id: i + 1, x: horizontal ? position : lane, y: horizontal ? lane : position,
        angle: horizontal ? (positive ? 0 : Math.PI) : (positive ? Math.PI / 2 : -Math.PI / 2),
        speed: 45 + random() * 35, cruise: 45 + random() * 35,
        traffic: i < 38, hp: 100, color: colors[i % colors.length],
        model: ['Brisa Sedan', 'Duna Hatch', 'Solano Wagon'][i % 3]
      });
    }
    const people = Array.from({ length: 96 }, (_, i) => ({
      x: random() * (SIZE - 160) + 10, y: (i % 9) * GRID + (i % 2 ? 8 : 88),
      speed: 13 + random() * 17, sign: i % 3 ? 1 : -1,
      color: walls[i % walls.length], phase: random() * 6, panic: 0
    }));
    const packages = [
      { x: 864, y: 864 }, { x: 1136, y: 1408 }, { x: 1680, y: 1952 },
      { x: 1952, y: 864 }, { x: 592, y: 1680 }
    ];
    return { buildings, trees, parks, cars, people, packages };
  }

  function createState() {
    return {
      world: createWorld(), player: { x: 864, y: 592, angle: 0, hp: 100 },
      car: null, time: 0, wanted: 0, heat: 0, cash: 0, job: 0,
      cops: [], drones: [], effects: [], shots: [], skidmarks: [],
      message: '', messageUntil: 0, cooldown: 0, respawn: 0, spotted: false,
      showMap: false, mode: 'title', deliveries: 0, delivery: null, collected: [],
      stats: { cars: 0, shots: 0, distance: 0 }, completionUntil: 0,
      savedUntil: 0, ambientAt: 26
    };
  }

  function traversable(world, x, y, radius = 7) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < radius || y < radius || x > SIZE - radius - 120 || y > SIZE - radius) return false;
    return !world.buildings.some(b =>
      x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.d
    );
  }

  function move(world, object, dx, dy, radius) {
    let blocked = false;
    if (traversable(world, object.x + dx, object.y, radius)) object.x += dx;
    else blocked = true;
    if (traversable(world, object.x, object.y + dy, radius)) object.y += dy;
    else blocked = true;
    return blocked;
  }

  function sight(world, a, b) {
    const samples = Math.max(2, Math.ceil(distance(a, b) / 18));
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      if (!traversable(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0)) return false;
    }
    return true;
  }

  function announce(state, text, duration = 7) {
    state.message = text;
    state.messageUntil = state.time + duration;
  }

  function addHeat(state, amount) {
    state.heat = Math.min(100, state.heat + amount);
    state.wanted = Math.ceil(state.heat / 20);
  }

  function finishJob(state, play) {
    const job = jobs[state.job];
    if (!job) return;
    state.job++;
    state.cash += 250 + state.job * 75;
    state.completionUntil = state.time + 3;
    announce(state, job.line, 11);
    play('success');
    if (state.job === 3) {
      state.drones = [0, 1, 2].map(i => ({
        x: 1540 + i * 35, y: 955 + (i % 2) * 49,
        hp: 2, phase: i * 2.1, cooldown: 2 + i * .6
      }));
    }
    if (state.job === 4) addHeat(state, 58);
    if (state.job === jobs.length) play('finale');
  }

  function prompt(state) {
    const p = state.player;
    if (state.car) return 'W / S accelerate · A / D steer · SPACE brake · E exit';
    const job = jobs[state.job];
    if (job && distance(p, job) < 39) {
      if (job.kind === 'cargo' && state.drones.length) return `MOUSE + CLICK · Disable ${state.drones.length} security drones`;
      if (job.kind === 'escape' && state.wanted) return 'Lose your wanted level before entering the garage';
      if (job.kind === 'drive') return 'Bring a vehicle to this gate';
      if (job.kind !== 'car') return 'E · ' + (job.kind === 'cargo' ? 'Collect the ledger' : job.kind === 'escape' ? 'Enter safe garage' : 'Talk / deliver');
    }
    if (state.delivery && distance(p, state.delivery) < 40) return 'E · Deliver courier parcel / $180';
    const service = services.find(s => distance(p, s) < 38);
    if (service) return 'E · ' + ({ repair: 'Recover health and repair nearby car / free', paint: 'Respray nearby vehicle / $80', courier: 'Take a courier contract / $180 reward' })[service.kind];
    if (state.world.cars.some(c => distance(c, p) < 44)) return 'E · Take vehicle';
    return '';
  }

  function interact(state, play) {
    const p = state.player;
    const job = jobs[state.job];
    if (!state.car && job && distance(p, job) < 39) {
      if (job.kind === 'visit' || (job.kind === 'cargo' && !state.drones.length) || (job.kind === 'escape' && !state.wanted)) {
        finishJob(state, play);
        return;
      }
    }
    if (state.car) {
      const car = state.car;
      if (Math.abs(car.speed) > 70) { announce(state, 'Slow down before getting out.'); return; }
      for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
        const x = car.x + Math.cos(car.angle + offset) * 27;
        const y = car.y + Math.sin(car.angle + offset) * 27;
        if (!traversable(state.world, x, y, 7)) continue;
        Object.assign(p, { x, y, angle: car.angle });
        car.speed = 0;
        state.car = null;
        play('door');
        return;
      }
      announce(state, 'The door is blocked. Move the car.');
      return;
    }
    if (state.delivery && distance(p, state.delivery) < 40) {
      state.delivery = null;
      state.deliveries++;
      state.cash += 180;
      announce(state, 'COURIER: On time. $180 transferred. There is always another run at Mercado Courier.');
      play('success');
      return;
    }
    const service = services.find(s => distance(p, s) < 38);
    if (service) {
      const nearby = state.world.cars.find(c => distance(p, c) < 95);
      if (service.kind === 'repair') {
        p.hp = 100;
        if (nearby) nearby.hp = 100;
        announce(state, 'SOL GARAGE: Patched you up. Bring a car here for a free repair.');
      } else if (service.kind === 'paint') {
        if (!nearby) { announce(state, 'CHROMA: Park a vehicle next to the shop first.'); return; }
        if (state.cash < 80) { announce(state, 'CHROMA: A new coat costs $80.'); return; }
        if (state.spotted) { announce(state, 'CHROMA: Lose the patrol watching you first.'); return; }
        state.cash -= 80;
        nearby.color = ['#79cdb6', '#f1c26a', '#c48fb2'][state.stats.cars % 3];
        state.heat = state.wanted = 0;
        announce(state, 'CHROMA: Fresh color. Plates changed. You are off the radar.');
      } else if (!state.delivery) {
        state.delivery = { ...deliveryStops[state.deliveries % deliveryStops.length] };
        announce(state, `COURIER: Parcel for ${state.delivery.name}. Follow the blue map marker. Get out and press E to deliver.`);
      } else announce(state, 'COURIER: Finish your current delivery first. Follow the blue map marker.');
      play('save');
      return;
    }
    const nearby = state.world.cars.filter(c => distance(p, c) < 44).sort((a, b) => distance(p, a) - distance(p, b));
    if (!nearby.length) return;
    const car = nearby[0];
    state.car = car;
    car.traffic = false;
    const loaner = job?.kind === 'car' && car.special;
    if (!car.claimed) {
      car.claimed = true;
      state.stats.cars++;
      // Inez hands over her own coupe for the story, so that one is a loan, not a theft.
      if (!loaner) {
        addHeat(state, car.special ? 19 : 26);
        announce(state, `DISPATCH: Stolen ${car.model} reported. Break line of sight to lose patrols.`);
      }
    }
    Object.assign(p, { x: car.x, y: car.y });
    if (loaner) finishJob(state, play);
    play('door');
  }

  function firePulse(state, aim, play) {
    if (state.car || state.cooldown > 0 || state.mode !== 'play') return;
    const p = state.player;
    const heading = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.angle = heading;
    state.cooldown = .26;
    state.stats.shots++;
    const targets = [...state.drones, ...state.cops].filter(target =>
      distance(p, target) < 245 && Math.abs(angleDelta(heading, Math.atan2(target.y - p.y, target.x - p.x))) < .24 && sight(state.world, p, target)
    );
    const target = targets.sort((a, b) => distance(p, a) - distance(p, b))[0];
    const end = target || { x: p.x + Math.cos(heading) * 200, y: p.y + Math.sin(heading) * 200 };
    state.effects.push({ x: end.x, y: end.y, fromX: p.x, fromY: p.y, until: state.time + .16, hit: !!target });
    if (target) {
      target.hp--;
      if (target.hp <= 0) {
        state.drones = state.drones.filter(d => d !== target);
        state.cops = state.cops.filter(c => c !== target);
        state.cash += 35;
        play('disable');
      }
    }
    state.world.people.forEach(person => { if (distance(person, p) < 180) person.panic = 4; });
    if (state.job !== 3 || target?.police) addHeat(state, 7);
    play('pulse');
  }

  function updateTraffic(state, dt) {
    const cars = state.world.cars;
    for (const car of cars) {
      if (!car.traffic) continue;
      const head = { x: car.x + Math.cos(car.angle) * 38, y: car.y + Math.sin(car.angle) * 38 };
      const blocked = cars.some(other => other !== car && distance(head, other) < 25);
      const xLane = (car.x % GRID + GRID) % GRID;
      const yLane = (car.y % GRID + GRID) % GRID;
      const intersection = xLane < ROAD && yLane < ROAD;
      const greenHorizontal = Math.floor(state.time / 7) % 2 === 0;
      const horizontal = Math.abs(Math.cos(car.angle)) > .5;
      const lightStop = intersection && (horizontal !== greenHorizontal) && (horizontal ? xLane < 26 : yLane < 26);
      car.speed += ((blocked || lightStop ? 0 : car.cruise) - car.speed) * Math.min(1, dt * 4);
      car.x = (car.x + Math.cos(car.angle) * car.speed * dt + SIZE - 120) % (SIZE - 120);
      car.y = (car.y + Math.sin(car.angle) * car.speed * dt + SIZE) % SIZE;
    }
    for (const person of state.world.people) {
      person.panic = Math.max(0, person.panic - dt);
      const nearCar = state.car && Math.abs(state.car.speed) > 90 && distance(person, state.car) < 65;
      if (nearCar) person.panic = 2;
      const speed = person.speed * (person.panic ? 2.8 : 1);
      person.x = (person.x + speed * dt * person.sign + SIZE - 120) % (SIZE - 120);
    }
  }

  // Story jobs that need wheels keep a drivable car within reach: the city lends you one rather
  // than stranding the mission after a crash.
  function ensureRide(state) {
    const job = jobs[state.job];
    if (!job || (job.kind !== 'drive' && job.kind !== 'car') || state.car) return;
    const p = state.player;
    if (state.world.cars.some(c => distance(c, p) < 115)) return;
    const spare = state.world.cars.find(c => c.traffic && !c.claimed);
    if (!spare) return;
    for (const [dx, dy, angle] of [[74, 0, 0], [-74, 0, Math.PI], [0, 74, Math.PI / 2], [0, -74, -Math.PI / 2]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!traversable(state.world, x, y, 14)) continue;
      Object.assign(spare, { x, y, angle, speed: 0, traffic: false, hp: 100 });
      return;
    }
  }

  function updatePatrols(state, dt) {
    const p = state.player;
    state.spotted = state.cops.some(c => distance(c, p) < 245 && sight(state.world, c, p));
    state.heat = Math.max(0, state.heat - dt * (state.spotted ? .14 : 3.8));
    state.wanted = Math.ceil(state.heat / 20);
    if (!state.wanted) { state.cops = []; return; }
    if (state.cops.length < Math.min(5, state.wanted + 1) && state.time > state.respawn) {
      state.respawn = state.time + 5;
      const side = state.cops.length % 2 ? -1 : 1;
      const laneX = clamp(Math.floor(p.x / GRID) * GRID + 48 + side * GRID, 48, 2224);
      const laneY = clamp(Math.round((p.y - 48) / GRID) * GRID + 48, 48, 2400);
      state.cops.push({ x: laneX, y: laneY, angle: side > 0 ? Math.PI : 0, hp: 3, police: true, color: '#338eb0' });
    }
    for (const cop of state.cops) {
      let target = p;
      if (!sight(state.world, cop, p)) {
        const x = clamp(Math.floor(cop.x / GRID) * GRID + 48, 48, 2224);
        const y = clamp(Math.floor(cop.y / GRID) * GRID + 48, 48, 2400);
        if (Math.abs(cop.x - x) > 10 && Math.abs(cop.y - y) > 10) {
          target = Math.abs(cop.x - x) < Math.abs(cop.y - y) ? { x, y: cop.y } : { x: cop.x, y };
        } else if (Math.abs(p.x - cop.x) > Math.abs(p.y - cop.y)) {
          target = Math.abs(cop.y - y) > 10 ? { x: cop.x, y } : { x: p.x, y };
        } else target = Math.abs(cop.x - x) > 10 ? { x, y: cop.y } : { x, y: p.y };
      }
      const heading = Math.atan2(target.y - cop.y, target.x - cop.x);
      cop.angle += clamp(angleDelta(cop.angle, heading), -dt * 5, dt * 5);
      const speed = 80 + state.wanted * 14;
      if (distance(p, cop) > 24) move(state.world, cop, Math.cos(heading) * speed * dt, Math.sin(heading) * speed * dt, 12);
      if (distance(p, cop) < 39) {
        p.hp -= dt * (state.car ? 5 : 12);
        if (state.car) state.car.hp -= dt * 3;
      }
    }
  }

  function recover(state) {
    const p = state.player;
    if (state.car) state.car.speed = 0;
    state.car = null;
    state.cops = [];
    state.heat = state.wanted = 0;
    state.spotted = false;
    const job = jobs[state.job];
    const x = job ? Math.floor(job.x / GRID) * GRID + 48 : 864;
    const y = job ? Math.floor(job.y / GRID) * GRID + 48 : 592;
    Object.assign(p, { x, y, hp: 100 });
    state.cash = Math.max(0, state.cash - 100);
    // A job that needs wheels always leaves one within reach, so a wipeout never strands the story.
    const needsCar = job && (job.kind === 'drive' || job.kind === 'car');
    const courtesy = needsCar ? state.world.cars.find(c => c.traffic && c !== state.car) : null;
    if (courtesy) {
      for (const spot of [[62, 0], [-62, 0], [0, 62], [0, -62]]) {
        const cx = x + spot[0];
        const cy = y + spot[1];
        if (!traversable(state.world, cx, cy, 14)) continue;
        Object.assign(courtesy, { x: cx, y: cy, speed: 0, traffic: false, hp: 100, angle: spot[0] ? (spot[0] > 0 ? 0 : Math.PI) : (spot[1] > 0 ? Math.PI / 2 : -Math.PI / 2) });
        break;
      }
    }
    announce(state, 'CLINIC: Back on your feet. $100 recovery fee. Your mission is still active.');
  }

  function step(state, input, dt, play) {
    state.time += dt;
    updateTraffic(state, dt);
    if (state.mode !== 'play') return;
    state.cooldown = Math.max(0, state.cooldown - dt);
    const p = state.player;
    const oldX = p.x;
    const oldY = p.y;
    const { world, car } = state;
    if (car) {
      const throttle = input.y < 0 ? 210 : input.y > 0 ? -255 : 0;
      car.speed += throttle * dt;
      car.speed *= Math.exp(-(input.brake ? 5.8 : input.y ? .4 : .85) * dt);
      car.speed = clamp(car.speed, -72, 260 * (.55 + car.hp / 220));
      // Steering only flips when the driver is actually reversing; a wall bounce must not invert it.
      const reversing = input.y > 0 && car.speed < 0;
      car.angle += input.x * (input.brake ? 2.7 : 1.65) * dt * clamp(Math.abs(car.speed) / 65, 0, 1) * (reversing ? -1 : 1);
      if (input.brake && Math.abs(car.speed) > 50) {
        state.skidmarks.push({ x: car.x, y: car.y, angle: car.angle, until: state.time + 8 });
      }
      if (move(world, car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 12)) {
        // Only a hard hit hurts the car; ordinary city driving should never wreck it.
        if (Math.abs(car.speed) > 128) { car.hp = Math.max(0, car.hp - (Math.abs(car.speed) - 110) * .006); play('bump'); }
        car.speed *= -.12;
      }
      for (const other of world.cars) {
        if (other === car || distance(car, other) >= 28 || Math.abs(car.speed) < 40) continue;
        other.speed *= .4;
        car.hp = Math.max(0, car.hp - 1.4);
        car.speed *= -.32;
        addHeat(state, 3);
        play('bump');
        break;
      }
      car.hp = Math.min(100, car.hp + dt * .8);
      Object.assign(p, { x: car.x, y: car.y, angle: car.angle });
      if (car.hp <= 0) {
        // A wrecked engine strands the car, not the story: you step out and Sol Garage can tow it.
        car.hp = 26;
        car.speed = 0;
        state.car = null;
        const spot = [[30, 0], [-30, 0], [0, 30], [0, -30]].find(([dx, dy]) =>
          traversable(state.world, car.x + dx, car.y + dy, 7));
        if (spot) Object.assign(p, { x: car.x + spot[0], y: car.y + spot[1] });
        announce(state, 'The engine seized. Step out and find another ride, or bring this one to Sol Garage.');
        play('bump');
      }
    } else if (input.x || input.y) {
      const dx = input.x + input.y;
      const dy = input.y - input.x;
      const norm = Math.hypot(dx, dy);
      p.angle = Math.atan2(dy, dx);
      const speed = input.sprint ? 165 : 108;
      move(world, p, dx / norm * speed * dt, dy / norm * speed * dt, 7);
    }
    state.stats.distance += Math.hypot(p.x - oldX, p.y - oldY);
    const job = jobs[state.job];
    if (job?.kind === 'drive' && state.car && distance(p, job) < 62) finishJob(state, play);
    ensureRide(state);
    for (const drone of state.drones) {
      const d = distance(p, drone);
      drone.cooldown -= dt;
      if (d < 245 && d > 65) move(world, drone, (p.x - drone.x) / d * dt * 24, (p.y - drone.y) / d * dt * 24, 6);
      if (d < 230 && drone.cooldown <= 0 && sight(world, drone, p)) {
        drone.cooldown = 2.5;
        const a = Math.atan2(p.y - drone.y, p.x - drone.x);
        state.shots.push({ x: drone.x, y: drone.y, dx: Math.cos(a) * 125, dy: Math.sin(a) * 125, life: 2.3 });
        play('enemy');
      }
    }
    for (const shot of state.shots) {
      shot.x += shot.dx * dt;
      shot.y += shot.dy * dt;
      shot.life -= dt;
      if (!traversable(world, shot.x, shot.y, 1)) shot.life = 0;
      if (distance(shot, p) < (state.car ? 17 : 12)) { p.hp -= 9; shot.life = 0; play('bump'); }
    }
    state.shots = state.shots.filter(s => s.life > 0);
    updatePatrols(state, dt);
    state.effects = state.effects.filter(e => e.until > state.time);
    state.skidmarks = state.skidmarks.filter(s => s.until > state.time).slice(-150);
    world.packages.forEach((item, index) => {
      if (!state.collected.includes(index) && distance(p, item) < 24) {
        state.collected.push(index);
        state.cash += 120;
        announce(state, `Found a lost harbor cache / $120 · ${state.collected.length} of 5 recovered.`);
        play('save');
      }
    });
    if (p.hp <= 0) recover(state);
    else if (!state.wanted && !state.drones.some(d => distance(d, p) < 240)) p.hp = Math.min(100, p.hp + dt * 4);
    if (state.time > state.ambientAt && state.time > state.messageUntil && !state.wanted) {
      state.ambientAt = state.time + 42;
      const lines = [
        'RÁDIO MARÉ / The coast is clear, the coffee is strong. Good morning, Costa Luz.',
        'CITY GUIDE / Blue markers are courier jobs. Green is Sol Garage. Pink is Chroma Respray.',
        'RÁDIO MARÉ / Missing wages. Silent officials. Someone at the harbor knows why.',
        'CITY GUIDE / Explore the waterfront for five lost harbor caches. Each pays $120.'
      ];
      announce(state, lines[Math.floor(state.time / 42) % lines.length], 7);
    }
  }

  function saveData(state) {
    return {
      version: 2, job: state.job, cash: state.cash, player: { ...state.player },
      drones: state.drones.map(d => ({ ...d })), deliveries: state.deliveries,
      delivery: state.delivery, collected: [...state.collected], stats: { ...state.stats },
      car: state.car ? { ...state.car } : null,
      coupe: { ...state.world.cars[0] }
    };
  }

  function restore(saved) {
    const state = createState();
    if (!saved || saved.version !== 2 || !Number.isInteger(saved.job) || saved.job < 0 || saved.job > jobs.length) return null;
    if (!saved.player || !traversable(state.world, saved.player.x, saved.player.y, 7) || !Number.isFinite(saved.cash) || saved.cash < 0) return null;
    Object.assign(state.player, { x: saved.player.x, y: saved.player.y, angle: Number(saved.player.angle) || 0, hp: clamp(Number(saved.player.hp) || 100, 1, 100) });
    state.job = saved.job;
    state.cash = saved.cash;
    if (saved.coupe && traversable(state.world, saved.coupe.x, saved.coupe.y, 12)) Object.assign(state.world.cars[0], saved.coupe, { id: 0, special: true, traffic: false });
    if (saved.car && traversable(state.world, saved.car.x, saved.car.y, 12)) {
      const car = state.world.cars.find(c => c.id === saved.car.id);
      if (car) {
        Object.assign(car, saved.car, { speed: 0, traffic: false, hp: clamp(Number(saved.car.hp) || 100, 1, 100) });
        state.car = car;
        Object.assign(state.player, { x: car.x, y: car.y });
      }
    }
    state.drones = Array.isArray(saved.drones) ? saved.drones.filter(d => Number.isFinite(d.hp) && d.hp > 0 && traversable(state.world, d.x, d.y, 1)).map(d => ({ ...d, cooldown: 2 })) : [];
    if (state.job === 3 && !Array.isArray(saved.drones)) return null;
    state.deliveries = Math.max(0, Math.floor(Number(saved.deliveries) || 0));
    state.delivery = saved.delivery && traversable(state.world, saved.delivery.x, saved.delivery.y, 7) ? saved.delivery : null;
    state.collected = Array.isArray(saved.collected) ? [...new Set(saved.collected.filter(i => Number.isInteger(i) && i >= 0 && i < 5))] : [];
    if (saved.stats) Object.keys(state.stats).forEach(key => { state.stats[key] = Math.max(0, Number(saved.stats[key]) || 0); });
    return state;
  }

  return { SIZE, GRID, ROAD, clamp, distance, angleDelta, jobs, services, createWorld, createState, traversable, sight, announce, prompt, interact, firePulse, step, saveData, restore };
})();
