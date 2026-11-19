/* Costa Luz: isometric city renderer and HUD painter. */
const CostaRender = (() => {
  'use strict';

  function createRenderer(canvas) {
    const sim = CostaSim;
    const ctx = canvas.getContext('2d', { alpha: false });
    const camera = { x: 326, y: 326, zoom: 1.05 };
    let width = 1280;
    let height = 720;
    let quality = 1;
    let lastResize = 0;

    function resize() {
      width = Math.max(640, innerWidth);
      height = Math.max(400, innerHeight);
      const dpr = Math.min(devicePixelRatio || 1, 2) * quality;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      lastResize = performance.now();
    }
    resize();
    addEventListener('resize', resize);

    function project(x, y, z = 0) {
      return {
        x: width / 2 + (x - camera.x - (y - camera.y)) * .88 * camera.zoom,
        y: height * .53 + ((x - camera.x + y - camera.y) * .46 - z) * camera.zoom
      };
    }
    function unproject(x, y) {
      const px = (x - width / 2) / (.88 * camera.zoom);
      const py = (y - height * .53) / (.46 * camera.zoom);
      return { x: camera.x + (px + py) / 2, y: camera.y + (py - px) / 2 };
    }
    const shade = (hex, factor) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${Math.min(255, Math.round((n >> 16) * factor))},${Math.min(255, Math.round((n >> 8 & 255) * factor))},${Math.min(255, Math.round((n & 255) * factor))})`;
    };
    function polygon(points, fill, stroke) {
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .7; ctx.stroke(); }
    }
    function ground(x, y, w, d, fill, z = 0) {
      polygon([project(x, y, z), project(x + w, y, z), project(x + w, y + d, z), project(x, y + d, z)], fill);
    }
    function line(x1, y1, x2, y2, color, thickness = 1, z = 0) {
      const a = project(x1, y1, z), b = project(x2, y2, z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(.6, thickness * camera.zoom); ctx.stroke();
    }
    function ellipse(x, y, rx, ry, fill) {
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), 0, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
    }
    function box(x, y, w, d, h, color, roof) {
      const a = project(x, y), b = project(x + w, y), c = project(x + w, y + d), e = project(x, y + d);
      const A = project(x, y, h), B = project(x + w, y, h), C = project(x + w, y + d, h), E = project(x, y + d, h);
      polygon([b, c, C, B], shade(color, .76));
      polygon([e, c, C, E], color);
      polygon([A, B, C, E], roof ?? shade(color, 1.16), '#ffffff22');
      return { A, B, C, E, a, b, c, e };
    }
    function visible(x, y, margin = 180) {
      const p = project(x, y);
      return p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin + 220;
    }
    const bounds = { x0: 0, y0: 0, x1: sim.SIZE, y1: sim.SIZE };
    function viewBounds() {
      const corners = [unproject(0, 0), unproject(width, 0), unproject(0, height), unproject(width, height)];
      bounds.x0 = Math.min(...corners.map(c => c.x)) - 90;
      bounds.y0 = Math.min(...corners.map(c => c.y)) - 30;
      bounds.x1 = Math.max(...corners.map(c => c.x)) + 90;
      bounds.y1 = Math.max(...corners.map(c => c.y)) + 120;
    }
    let vignette = null;
    let vignetteSize = '';
    function paintVignette() {
      const key = Math.round(width) + 'x' + Math.round(height);
      if (vignette && vignetteSize === key) return vignette;
      vignette = ctx.createRadialGradient(width / 2, height / 2, width * .24, width / 2, height / 2, width * .74);
      vignette.addColorStop(0, '#18323b00');
      vignette.addColorStop(1, '#0e213066');
      vignetteSize = key;
      return vignette;
    }

    /* ---------------------------------------------------------------- ground */
    function drawGround(state) {
      const { world } = state;
      ctx.fillStyle = '#2e93a6';
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 22; i++) line(-200, sim.SIZE + 30 + i * 40, sim.SIZE + 700, sim.SIZE + 30 + i * 40, '#8fded43a', 4);
      ground(-60, -60, sim.SIZE + 40, sim.SIZE + 160, '#e6cf99');
      ground(0, 0, sim.SIZE - 120, sim.SIZE, '#a9aca4');
      ground(-6, -6, sim.SIZE - 108, sim.SIZE + 12, '#c6b79a');

      const road = sim.ROAD;
      const grid = sim.GRID;
      ctx.save();
      ctx.strokeStyle = '#e0c684';
      ctx.lineWidth = 2 * camera.zoom;
      ctx.setLineDash([12 * camera.zoom, 22 * camera.zoom]);
      for (let i = 0; i < 9; i++) {
        ground(i * grid, 0, road, sim.SIZE, '#3f5059');
        ground(0, i * grid, sim.SIZE - 120, road, '#3f5059');
        const a1 = project(i * grid + road / 2, 0), b1 = project(i * grid + road / 2, sim.SIZE);
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
        const a2 = project(0, i * grid + road / 2), b2 = project(sim.SIZE - 120, i * grid + road / 2);
        ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#cfd6ca';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          const x = i * grid + (i === 0 ? 4 : road - 2);
          const y = j * grid + (j === 0 ? 4 : road - 2);
          if (y < bounds.y0 - 20 || y > bounds.y1 || x < bounds.x0 - 20 || x > bounds.x1) continue;
          for (let k = 0; k < 5; k++) {
            for (const [ax, ay, aw, ad] of [[x + k * 15, y, 9, 12], [x, y + k * 15, 12, 9]]) {
              const a = project(ax, ay), b = project(ax + aw, ay), c = project(ax + aw, ay + ad), d = project(ax, ay + ad);
              ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
            }
          }
        }
      }
      ctx.fill();
      for (const park of world.parks) {
        ground(park.x - 12, park.y - 12, 176, 176, park.yard ? '#b7aa99' : '#7dab84');
        if (park.yard) {
          for (let i = 0; i < 4; i++) box(park.x + 8 + i % 2 * 74, park.y + 8 + Math.floor(i / 2) * 70, 56, 32, 16, i % 2 ? '#c07a55' : '#538d9c', '#b3c6bd');
          for (let i = 0; i < 3; i++) ground(park.x + 100, park.y + 20 + i * 46, 62, 22, '#cbbca5');
        } else {
          ground(park.x + 64, park.y, 14, 152, '#e0caa0');
          ground(park.x + 8, park.y + 118, 140, 18, '#d7c299');
        }
      }
      ground(sim.SIZE - 120, 0, 66, sim.SIZE, '#e8cf99');
      for (let i = 0; i < 9; i++) {
        ground(sim.SIZE - 58, i * grid + 36, 170, 22, '#9b8f77');
        box(sim.SIZE + 30, i * grid + 20, 26, 12, 7, '#f6eddc');
      }
      for (let i = 0; i < 5; i++) {
        const rock = { x: sim.SIZE + 4, y: 260 + i * 430 };
        if (visible(rock.x, rock.y)) {
          const p = project(rock.x, rock.y);
          ellipse(p.x, p.y, 26 * camera.zoom, 17 * camera.zoom, '#b98f5f');
          ellipse(p.x - 4 * camera.zoom, p.y - 6 * camera.zoom, 16 * camera.zoom, 9 * camera.zoom, '#caa475');
        }
      }
    }

    /* -------------------------------------------------------------- buildings */
    function drawBuilding(b) {
      if (!visible(b.x + b.w / 2, b.y + b.d / 2, 220)) return;
      const shadow = [project(b.x, b.y + b.d), project(b.x + b.w, b.y + b.d), project(b.x + b.w + b.h * .55, b.y + b.d + b.h * .26), project(b.x + b.h * .55, b.y + b.d + b.h * .26)];
      polygon(shadow, '#1b364830');
      box(b.x, b.y, b.w, b.d, b.h, b.wall, b.roof);
      const right = [], front = [];
      for (let z = 12; z < b.h - 6; z += 15) {
        for (let x = b.x + 8; x < b.x + b.w - 7; x += 15) {
          front.push([project(x, b.y + b.d + .3, z), project(x + 7, b.y + b.d + .3, z), project(x + 7, b.y + b.d + .3, z + 7), project(x, b.y + b.d + .3, z + 7)]);
        }
        for (let y = b.y + 8; y < b.y + b.d - 7; y += 15) {
          right.push([project(b.x + b.w + .3, y, z), project(b.x + b.w + .3, y + 7, z), project(b.x + b.w + .3, y + 7, z + 7), project(b.x + b.w + .3, y, z + 7)]);
        }
      }
      ctx.beginPath();
      for (const poly of front) { poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
      ctx.fillStyle = b.id % 3 === 0 ? '#3d6670' : '#3a5f6a'; ctx.fill();
      ctx.beginPath();
      for (const poly of right) { poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
      ctx.fillStyle = b.id % 4 === 0 ? '#5d94a4' : '#4a7d8d'; ctx.fill();
      const awn = project(b.x + 6, b.y + b.d + 1, 9);
      ellipse(awn.x, awn.y + 2, 9 * camera.zoom, 3 * camera.zoom, '#e8b37c');
      box(b.x + 12, b.y + 10, 14, 18, 7, '#9db3b1', '#d8e7d9');
      if (b.h > 76) {
        box(b.x + b.w * .55, b.y + b.d * .55, 12, 12, 9, '#b7a999', '#efe9d6');
        const p = project(b.x + b.w * .55 + 6, b.y + b.d * .55 + 6, b.h + 9);
        ellipse(p.x, p.y - 6, 5 * camera.zoom, 2 * camera.zoom, '#f7f0dc');
      }
      if (b.id % 9 === 0) {
        const s = project(b.x + b.w / 2, b.y + b.d + 1, 13);
        ctx.textAlign = 'center';
        ctx.font = `800 ${Math.max(8, 9 * camera.zoom)}px "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = '#fff4d2';
        ctx.fillText(['CAFÉ LUZ', 'FARMÁCIA', 'RÁDIO MARÉ', 'MERCADO', 'HOTEL SOL', 'ADUANA'][b.id % 6], s.x, s.y);
      }
    }

    /* ------------------------------------------------------------- vegetation */
    function drawPalm(tree, time) {
      if (!visible(tree.x, tree.y, 100)) return;
      const p = project(tree.x, tree.y);
      ellipse(p.x + 12, p.y + 4, 21 * camera.zoom, 6 * camera.zoom, '#203f4438');
      const top = project(tree.x - 5, tree.y, 58);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x - 11 * camera.zoom, top.y + 20 * camera.zoom, top.x, top.y);
      ctx.lineWidth = 4.5 * camera.zoom; ctx.strokeStyle = '#977353'; ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const angle = k / 7 * Math.PI * 2 + tree.seed;
        const dx = Math.cos(angle) * 31 * camera.zoom;
        const dy = Math.sin(angle) * 13 * camera.zoom;
        const sway = Math.sin(time * 1.3 + k) * 2.2 * camera.zoom;
        polygon([top, { x: top.x + dx * .62, y: top.y + dy - 10 * camera.zoom }, { x: top.x + dx + sway, y: top.y + dy + 9 * camera.zoom }, { x: top.x + dx * .32, y: top.y + dy + 1 }], k % 2 ? '#348568' : '#4c9f6b');
      }
    }

    /* ---------------------------------------------------------------- agents */
    function drawCar(c, time, occupied) {
      if (!visible(c.x, c.y, 90)) return;
      const pos = project(c.x, c.y);
      const local = (x, y, z = 0) => project(
        c.x + Math.cos(c.angle) * x - Math.sin(c.angle) * y,
        c.y + Math.sin(c.angle) * x + Math.cos(c.angle) * y, z);
      const rect = (x, y, w, d, z, fill) => polygon([local(x, y, z), local(x + w, y, z), local(x + w, y + d, z), local(x, y + d, z)], fill);
      ellipse(pos.x + 5, pos.y + 6, 26 * camera.zoom, 11 * camera.zoom, '#0e253555');
      rect(-19, -10, 38, 20, 3, '#1a303c');
      rect(-16, -12, 8, 3, 3, '#141c26'); rect(8, -12, 8, 3, 3, '#141c26');
      rect(-16, 9, 8, 3, 3, '#141c26'); rect(8, 9, 8, 3, 3, '#141c26');
      rect(-20, -9, 40, 18, 8, c.police ? '#e8e9d8' : c.color);
      rect(-8, -8, 17, 16, 15, c.police ? '#123749' : shade(c.color, .84));
      rect(8, -7, 5, 14, 11, '#659aa8');
      rect(-14, -8, 5, 16, 10, '#2f5f70');
      rect(18, -8, 3, 5, 8, '#ffefbe'); rect(18, 3, 3, 5, 8, '#ffefbe');
      rect(-21, -8, 2, 5, 7, '#fd6155'); rect(-21, 3, 2, 5, 7, '#fd6155');
      if (c.special) {
        rect(-9, -1, 18, 2, 16, '#ffe9a8');
      }
      if (c.police) {
        const flash = Math.sin(time * 15) > 0;
        rect(-2, -7, 4, 7, 17, flash ? '#ff6f70' : '#6abef8');
        rect(-2, 0, 4, 7, 17, flash ? '#6abef8' : '#ff6f70');
        const light = local(0, 0, 18);
        ellipse(light.x, light.y, 22 * camera.zoom, 9 * camera.zoom, flash ? '#ff6c6c2e' : '#54c8ff2e');
      }
      if (occupied) {
        const dot = local(0, 0, 26);
        ctx.fillStyle = '#9dffe2'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('▼', dot.x, dot.y);
      }
    }

    function drawPerson(person, time, player = false) {
      if (!visible(person.x, person.y, 40)) return;
      const p = project(person.x, person.y);
      const head = project(person.x, person.y, 19);
      ellipse(p.x + 3, p.y + 2, 7.5 * camera.zoom, 3.2 * camera.zoom, '#18364655');
      const gait = Math.sin(time * (player ? 11 : 8) + (person.phase ?? 0)) * 3 * camera.zoom;
      ctx.strokeStyle = '#263c4b'; ctx.lineWidth = 3 * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(p.x - 2 * camera.zoom, p.y - 7 * camera.zoom); ctx.lineTo(p.x - 3 * camera.zoom + gait, p.y);
      ctx.moveTo(p.x + 2 * camera.zoom, p.y - 7 * camera.zoom); ctx.lineTo(p.x + 3 * camera.zoom - gait, p.y);
      ctx.stroke();
      ctx.fillStyle = player ? '#f7ead0' : (person.panic > 0 ? '#f3d6b4' : person.color);
      ctx.fillRect(p.x - 4.2 * camera.zoom, head.y + 2 * camera.zoom, 8.4 * camera.zoom, 10 * camera.zoom);
      ellipse(head.x, head.y, 4.2 * camera.zoom, 5 * camera.zoom, player ? '#bd7c5e' : '#b98a6a');
      if (player) {
        ellipse(head.x, head.y - 3.4 * camera.zoom, 4.4 * camera.zoom, 2.2 * camera.zoom, '#263a45');
        line(person.x, person.y, person.x + Math.cos(person.angle) * 13, person.y + Math.sin(person.angle) * 13, '#1e3f4f', 3, 11);
        const hand = project(person.x + Math.cos(person.angle) * 13, person.y + Math.sin(person.angle) * 13, 12);
        ctx.fillStyle = '#a8ffe0'; ctx.fillRect(hand.x - 1.5, hand.y - 1.5, 3.4, 3.4);
        const marker = project(person.x, person.y, 37);
        ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#a8ffe0';
        ctx.fillText('▼', marker.x, marker.y);
      }
    }

    function drawDrone(drone, time) {
      const pos = project(drone.x, drone.y, 20 + Math.sin(time * 4 + drone.phase) * 4);
      ellipse(pos.x, pos.y + 22, 9 * camera.zoom, 3.5 * camera.zoom, '#14313c55');
      box(drone.x - 5, drone.y - 5, 10, 10, 14, '#e35f59', '#ffb166');
      ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pos.x - 15, pos.y); ctx.lineTo(pos.x + 15, pos.y); ctx.stroke();
      ellipse(pos.x, pos.y, 2.5, 2.5, '#ff4d4d');
    }

    function drawMarkers(state) {
      const job = sim.jobs[state.job];
      if (job) {
        const p = project(job.x, job.y);
        const pulse = Math.sin(state.time * 3);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (28 + pulse * 4) * camera.zoom, 14 * camera.zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcf7038'; ctx.fill();
        ctx.strokeStyle = '#ffe29c'; ctx.lineWidth = 2; ctx.stroke();
        const top = project(job.x, job.y, 66 + pulse * 5);
        polygon([{ x: top.x, y: top.y - 12 }, { x: top.x + 9, y: top.y }, { x: top.x, y: top.y + 12 }, { x: top.x - 9, y: top.y }], '#ffdf87', '#fff2b8');
        ctx.textAlign = 'center'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#10222a';
        ctx.fillText(String(state.job + 1), top.x, top.y + 3.5);
      }
      for (const service of sim.services) {
        const p = project(service.x, service.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, 7 * camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = service.color; ctx.fill();
        ctx.strokeStyle = '#0f2a33'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#10222a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(service.kind === 'repair' ? '+' : service.kind === 'paint' ? 'C' : '$', p.x, p.y + 3);
      }
      if (state.delivery) {
        const p = project(state.delivery.x, state.delivery.y);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 22 * camera.zoom, 11 * camera.zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6fd6ff30'; ctx.fill(); ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = 2; ctx.stroke();
        const top = project(state.delivery.x, state.delivery.y, 48);
        polygon([{ x: top.x, y: top.y - 9 }, { x: top.x + 7, y: top.y }, { x: top.x, y: top.y + 9 }, { x: top.x - 7, y: top.y }], '#8ce7ff');
      }
      state.world.packages.forEach((item, index) => {
        if (state.collected.includes(index)) return;
        const p = project(item.x, item.y, 16 + Math.sin(state.time * 2.4 + index) * 4);
        ellipse(p.x + 4, p.y + 22, 8 * camera.zoom, 3 * camera.zoom, '#13303a55');
        box(item.x - 5, item.y - 5, 10, 10, 10, '#e8b45c', '#fff0b8');
        ellipse(p.x, p.y, 12 * camera.zoom, 6 * camera.zoom, '#ffd67a22');
      });
    }

    /* --------------------------------------------------------------- minimap */
    function drawMinimap(state) {
      const map = document.getElementById('map');
      if (!map) return;
      const c = map.getContext('2d');
      const size = map.width;
      const scale = size / sim.SIZE;
      c.clearRect(0, 0, size, size);
      c.fillStyle = '#1f7b8d'; c.fillRect(0, 0, size, size);
      c.fillStyle = '#7d907f'; c.fillRect(0, 0, (sim.SIZE - 120) * scale, size);
      for (const park of state.world.parks) {
        c.fillStyle = park.yard ? '#a3917f' : '#6f9c78';
        c.fillRect(park.x * scale, park.y * scale, 176 * scale, 176 * scale);
      }
      c.fillStyle = '#2a414c';
      for (let i = 0; i < 9; i++) {
        c.fillRect(i * sim.GRID * scale, 0, sim.ROAD * scale, size);
        c.fillRect(0, i * sim.GRID * scale, (sim.SIZE - 120) * scale, sim.ROAD * scale);
      }
      c.fillStyle = '#b9ad96';
      for (const b of state.world.buildings) c.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.d * scale));
      const dot = (x, y, color, radius) => {
        c.fillStyle = color; c.beginPath(); c.arc(x * scale, y * scale, radius, 0, Math.PI * 2); c.fill();
      };
      for (const service of sim.services) dot(service.x, service.y, service.color, 2.4);
      if (state.delivery) dot(state.delivery.x, state.delivery.y, '#7fe0ff', 3);
      state.world.packages.forEach((item, i) => { if (!state.collected.includes(i)) dot(item.x, item.y, '#ffd274', 2); });
      if (sim.jobs[state.job]) dot(sim.jobs[state.job].x, sim.jobs[state.job].y, '#ffe08a', 4.2);
      state.cops.forEach(cop => dot(cop.x, cop.y, '#ff8a8c', 2.8));
      dot(state.player.x, state.player.y, '#b3ffe0', 3.4);
      c.strokeStyle = '#f2fffb'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(state.player.x * scale, state.player.y * scale, 6, 0, 6.29); c.stroke();
      c.strokeStyle = '#ffffff40'; c.lineWidth = 1;
      c.strokeRect(.5, .5, size - 1, size - 1);
    }

    /* ------------------------------------------------------------------ frame */
    function updateHud(state) {
      const p = state.player;
      const job = sim.jobs[state.job];
      const set = (id, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.textContent !== text) el.textContent = text;
      };
      const district = p.x > 2000 && p.y > 1100 ? 'Marina do Sol'
        : p.x > 1380 && p.y > 900 && p.y < 1300 ? 'Porto Sete'
        : p.y > 1900 ? 'Waterfront Sul'
        : p.x > 1000 && p.y < 900 ? 'Centro Luz'
        : p.y < 620 ? 'Mercado Velho' : 'Costa Luz';
      set('district', district);
      set('objective-count', `THE HARBOR LEDGER · ${Math.min(state.job + 1, 6)} / 6`);
      set('objective-title', job ? job.name : 'The City Is Yours');
      set('objective-text', job ? `${job.goal} · ${Math.round(sim.distance(p, job))} m` : `Explore freely. ${state.collected.length}/5 caches found.`);
      set('cash', '$' + state.cash.toLocaleString('en-US'));
      set('heat', '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted));
      document.getElementById('health').querySelector('i').style.width = `${Math.max(0, Math.min(100, p.hp))}%`;
      set('speed', state.car
        ? `${Math.round(Math.abs(state.car.speed) * .72)} km/h · ${state.car.model}`
        : state.spotted ? 'SPOTTED · BREAK LINE OF SIGHT' : 'ON FOOT · PULSE PISTOL');
      const radio = document.getElementById('radio');
      const show = state.time < state.messageUntil && state.message;
      radio.hidden = !show;
      if (show && radio.textContent !== state.message) radio.textContent = state.message;
      const prompt = sim.prompt(state);
      const promptEl = document.getElementById('prompt');
      promptEl.hidden = !prompt;
      if (prompt && promptEl.textContent !== prompt) promptEl.textContent = prompt;
      const status = document.getElementById('wanted-status');
      if (status) {
        status.classList.toggle('active', state.wanted > 0);
        status.dataset.level = String(state.wanted);
      }
      document.getElementById('map-wrap').classList.toggle('expanded', state.showMap);
    }

    function render(state, dt) {
      const p = state.player;
      const targetZoom = state.mode === 'title' ? .82 : state.car ? .9 : 1.2;
      const orbit = state.mode === 'title';
      const follow = orbit
        ? { x: 1120 + Math.sin(state.time * .07) * 420, y: 1080 + Math.cos(state.time * .06) * 420 }
        : p;
      camera.x += (follow.x - camera.x) * Math.min(1, dt * (state.mode === 'title' ? 1.2 : 5));
      camera.y += (follow.y - camera.y) * Math.min(1, dt * (state.mode === 'title' ? 1.2 : 5));
      camera.zoom += (targetZoom - camera.zoom) * Math.min(1, dt * 2.4);
      const halfW = (width / 2) / (.88 * camera.zoom) * .82;
      const halfH = (height / 2) / (.46 * camera.zoom) * .9;
      camera.x = sim.clamp(camera.x, halfW - 180, sim.SIZE - 120 - halfW + 180);
      camera.y = sim.clamp(camera.y, halfH - 260, sim.SIZE - halfH + 220);

      const dpr = Math.min(devicePixelRatio || 1, 2) * quality;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewBounds();
      drawGround(state);

      const objects = [];
      for (const b of state.world.buildings) {
        const sx = b.x + b.y + b.w + b.d;
        objects.push({ sort: sx, draw: () => drawBuilding(b) });
      }
      for (const t of state.world.trees) objects.push({ sort: t.x + t.y + 8, draw: () => drawPalm(t, state.time) });
      for (const c of state.world.cars) objects.push({ sort: c.x + c.y + 10, draw: () => drawCar(c, state.time, state.car === c) });
      for (const c of state.cops) objects.push({ sort: c.x + c.y + 10, draw: () => drawCar(c, state.time) });
      for (const n of state.world.people) objects.push({ sort: n.x + n.y + 4, draw: () => drawPerson(n, state.time) });
      if (!state.car) objects.push({ sort: p.x + p.y + 4, draw: () => drawPerson(p, state.time, true) });
      for (const d of state.drones) objects.push({ sort: d.x + d.y, draw: () => drawDrone(d, state.time) });
      objects.sort((a, b) => a.sort - b.sort);
      for (const item of objects) item.draw();

      drawMarkers(state);
      for (const mark of state.skidmarks) {
        const a = project(mark.x, mark.y);
        ellipse(a.x, a.y, 7 * camera.zoom, 3 * camera.zoom, '#20343c4d');
      }
      for (const shot of state.shots) {
        const a = project(shot.x, shot.y, 13);
        ellipse(a.x, a.y, 4.4 * camera.zoom, 4.4 * camera.zoom, '#ffd06a');
        ellipse(a.x, a.y, 8 * camera.zoom, 8 * camera.zoom, '#ffb34726');
      }
      for (const e of state.effects) {
        line(e.fromX, e.fromY, e.x, e.y, e.hit ? '#ffe9a0' : '#aaffdf', e.hit ? 3.4 : 2.2, 13);
        const a = project(e.x, e.y, 14);
        ellipse(a.x, a.y, 9 * camera.zoom, 9 * camera.zoom, e.hit ? '#ffd98a' : '#fff2a9');
      }

      if (state.mode !== 'title') {
        ctx.fillStyle = paintVignette();
        ctx.fillRect(0, 0, width, height);
      }
      drawMinimap(state);
      updateHud(state);

      const since = performance.now() - lastResize;
      if (since > 2500) {
        if (dt > .045 && quality > .62) { quality = Math.max(.62, quality - .12); resize(); }
        else if (dt < .019 && quality < 1) { quality = Math.min(1, quality + .08); resize(); }
        lastResize = performance.now();
      }
    }

    return { render, project, unproject, camera, resize };
  }

  return { createRenderer };
})();
