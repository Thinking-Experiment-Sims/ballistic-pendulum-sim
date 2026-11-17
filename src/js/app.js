(function () {
  'use strict';

  const P = window.BallisticPhysics;

  // Color tokens matching sim.css (light mode only)
  const COLORS = {
    bg: '#e9f4fb',
    grid: 'rgba(15, 126, 155, 0.10)',
    teal: '#0f7e9b',
    tealDark: '#095f76',
    amber: '#d67b19',
    amberDark: '#b4620d',
    ink: '#123140',
    muted: '#4b6570',
    border: '#9bb8c4',
    white: '#ffffff',
  };

  // =========================================================================
  // 1. Accessible Tabs (selection follows focus + beforematch)
  // =========================================================================
  const tabButtons = Array.from(document.querySelectorAll('.tablist [role="tab"]'));
  const tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function selectTab(selectedTab, moveFocus = false) {
    tabButtons.forEach((btn) => {
      const isSelected = btn === selectedTab;
      btn.setAttribute('aria-selected', String(isSelected));
      btn.tabIndex = isSelected ? 0 : -1;
    });

    tabPanels.forEach((panel) => {
      const isMatch = panel.getAttribute('aria-labelledby') === selectedTab.id;
      if (isMatch) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', 'until-found');
      }
    });

    selectedTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (moveFocus) {
      selectedTab.focus();
    }

    // Re-render active canvas cleanly on tab switch
    if (selectedTab.id === 'tab-pendulum') {
      drawPendulumScene();
    } else if (selectedTab.id === 'tab-ramp') {
      drawRampScene();
    } else if (selectedTab.id === 'tab-mystery') {
      drawMysteryScene();
    }
  }

  tabButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => selectTab(btn, false));
    btn.addEventListener('keydown', (e) => {
      let nextIdx = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabButtons.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = tabButtons.length - 1;

      if (nextIdx !== null) {
        e.preventDefault();
        selectTab(tabButtons[nextIdx], true);
      }
    });
  });

  tabPanels.forEach((panel) => {
    panel.addEventListener('beforematch', () => {
      const ownerTab = document.getElementById(panel.getAttribute('aria-labelledby'));
      if (ownerTab) selectTab(ownerTab, false);
    });
  });

  // =========================================================================
  // 2. Slider Sync Helper (per modern-web-guidance slider guide)
  // =========================================================================
  function syncSlider(slider, formattedText) {
    slider.style.setProperty('--attr-min', slider.min || 0);
    slider.style.setProperty('--attr-max', slider.max || 100);
    slider.style.setProperty('--control-value', slider.value);
    slider.setAttribute('aria-valuetext', formattedText);
  }

  function setupHiDPICanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalW = 760;
    const logicalH = 400;
    if (canvas.width !== logicalW * dpr || canvas.height !== logicalH * dpr) {
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: logicalW, h: logicalH };
  }

  function drawBlueprintGrid(ctx, w, h) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, label) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 6) return;

    const headLen = 9;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      const labelX = (x1 + x2) / 2 + (dx > 0 ? 6 : dx < 0 ? -6 : 0);
      ctx.fillText(label, labelX, y1 - 11);
    }
    ctx.restore();
  }

  // =========================================================================
  // 3. TAB 1: BALLISTIC PENDULUM
  // =========================================================================
  const pEl = {
    ballMass: document.getElementById('p-ball-mass'),
    ballMassVal: document.getElementById('p-ball-mass-val'),
    ballVel: document.getElementById('p-ball-vel'),
    ballVelVal: document.getElementById('p-ball-vel-val'),
    catcherMass: document.getElementById('p-catcher-mass'),
    catcherMassVal: document.getElementById('p-catcher-mass-val'),
    armLength: document.getElementById('p-arm-length'),
    armLengthVal: document.getElementById('p-arm-length-val'),
    pausePeak: document.getElementById('p-pause-peak'),
    slowMo: document.getElementById('p-slow-mo'),
    showAnswer: document.getElementById('p-show-answer'),
    fireBtn: document.getElementById('p-fire-btn'),
    pauseBtn: document.getElementById('p-pause-btn'),
    resetBtn: document.getElementById('p-reset-btn'),
    recordBtn: document.getElementById('p-record-btn'),
    clearTrialsBtn: document.getElementById('p-clear-trials'),
    status: document.getElementById('p-status'),
    phaseBadge: document.getElementById('p-phase-badge'),
    canvas: document.getElementById('p-canvas'),
    outMomentum: document.getElementById('p-out-momentum'),
    outVprime: document.getElementById('p-out-vprime'),
    outHeight: document.getElementById('p-out-height'),
    outAngle: document.getElementById('p-out-angle'),
    outLoss: document.getElementById('p-out-loss'),
    barKE: document.getElementById('p-bar-ke'),
    barPE: document.getElementById('p-bar-pe'),
    barTH: document.getElementById('p-bar-th'),
    numKE: document.getElementById('p-num-ke'),
    numPE: document.getElementById('p-num-pe'),
    numTH: document.getElementById('p-num-th'),
    solutionSteps: document.getElementById('p-solution-steps'),
    trialsBody: document.getElementById('p-trials-body'),
  };

  let pState = {
    phase: 'ready', // 'ready' | 'approach' | 'swing' | 'peak-paused'
    running: false,
    ballX: -0.9, // meters relative to catcher at x = 0
    theta: 0,
    omega: 0,
    impactFlash: 0,
    peakReached: false,
    trials: [],
    rafId: null,
    lastTs: null,
  };

  function getPendulumParams() {
    const ballMassG = parseFloat(pEl.ballMass.value);
    const catcherMassG = parseFloat(pEl.catcherMass.value);
    const initialVelocity = parseFloat(pEl.ballVel.value);
    const armLength = parseFloat(pEl.armLength.value);
    return {
      ballMassG,
      catcherMassG,
      ballMassKg: ballMassG / 1000,
      catcherMassKg: catcherMassG / 1000,
      initialVelocity,
      armLength,
    };
  }

  function updatePendulumUI() {
    const params = getPendulumParams();
    const res = P.solveBallisticPendulum(params);

    const mbText = `${params.ballMassG} g (${params.ballMassKg.toFixed(3)} kg)`;
    const v0Text = `${params.initialVelocity.toFixed(1)} m/s`;
    const mcText = `${params.catcherMassG} g (${params.catcherMassKg.toFixed(3)} kg)`;
    const lText = `${params.armLength.toFixed(2)} m`;

    pEl.ballMassVal.textContent = mbText;
    pEl.ballVelVal.textContent = v0Text;
    pEl.catcherMassVal.textContent = mcText;
    pEl.armLengthVal.textContent = lText;

    syncSlider(pEl.ballMass, mbText);
    syncSlider(pEl.ballVel, v0Text);
    syncSlider(pEl.catcherMass, mcText);
    syncSlider(pEl.armLength, lText);

    const show = pEl.showAnswer.checked;
    pEl.outMomentum.textContent = show ? `${res.initialMomentum.toFixed(3)} kg·m/s` : 'Hidden';
    pEl.outVprime.textContent = show ? `${res.postCollisionVelocity.toFixed(2)} m/s` : 'Hidden';
    pEl.outHeight.textContent = show
      ? `${res.maxHeight.toFixed(3)} m (${res.maxHeightCm.toFixed(1)} cm)`
      : 'Hidden';
    pEl.outAngle.textContent = show ? `${res.maxAngleDeg.toFixed(1)}°` : 'Hidden';
    pEl.outLoss.textContent = show
      ? `${res.collisionEnergyLoss.toFixed(3)} J (${(res.collisionLossFraction * 100).toFixed(1)}%)`
      : 'Hidden';

    renderPendulumSteps(params, res, show);
    updatePendulumEnergyBars(params, res);
  }

  function renderPendulumSteps(params, res, show) {
    if (!show) {
      pEl.solutionSteps.innerHTML = `
        <div class="step-card">
          <h4>Numerical Answers Hidden</h4>
          <p>Toggle <strong>Show numerical answers &amp; derivation</strong> on the left when you are ready to check your work.</p>
        </div>`;
      return;
    }

    pEl.solutionSteps.innerHTML = `
      <div class="step-card">
        <h4>Stage 1: Inelastic Collision (Momentum Conserved)</h4>
        <p>External horizontal impulse is zero during impact:</p>
        <span class="eq">m<sub>b</sub> v₀ = (m<sub>b</sub> + m<sub>c</sub>) v′</span>
        <span class="eq">v′ = (${params.ballMassKg.toFixed(3)} × ${params.initialVelocity.toFixed(1)}) / ${(params.ballMassKg + params.catcherMassKg).toFixed(3)} = <strong>${res.postCollisionVelocity.toFixed(3)} m/s</strong></span>
      </div>
      <div class="step-card">
        <h4>Stage 2: Upward Swing (Mechanical Energy Conserved)</h4>
        <p>After capture, gravity is the only work-doing force:</p>
        <span class="eq">½ (m<sub>b</sub> + m<sub>c</sub>) v′² = (m<sub>b</sub> + m<sub>c</sub>) g h</span>
        <span class="eq">h = v′² / (2g) = ${res.postCollisionVelocity.toFixed(3)}² / (2 × 9.8) = <strong>${res.maxHeight.toFixed(4)} m</strong> (${res.maxHeightCm.toFixed(2)} cm)</span>
      </div>
      <div class="step-card">
        <h4>Energy Check (Why KE<sub>i</sub> ≠ PE<sub>f</sub>)</h4>
        <p>Initial KE: <strong>${res.initialKE.toFixed(3)} J</strong> → Post-collision KE: <strong>${res.postCollisionKE.toFixed(3)} J</strong></p>
        <p>Thermal energy dissipated in collision: <strong>${res.collisionEnergyLoss.toFixed(3)} J</strong> (${(res.collisionLossFraction * 100).toFixed(1)}%).</p>
      </div>
    `;
  }

  function updatePendulumEnergyBars(params, res) {
    const maxE = Math.max(res.initialKE, 0.001);
    let ke = 0;
    let pe = 0;
    let th = 0;

    if (pState.phase === 'ready' || pState.phase === 'approach') {
      ke = res.initialKE;
    } else {
      const hCurrent = params.armLength * (1 - Math.cos(pState.theta));
      const vCurrent = pState.omega * params.armLength;
      pe = res.totalMass * P.DEFAULT_G * hCurrent;
      ke = 0.5 * res.totalMass * vCurrent * vCurrent;
      th = res.collisionEnergyLoss;
    }

    pEl.barKE.style.width = `${Math.min(100, (ke / maxE) * 100)}%`;
    pEl.barPE.style.width = `${Math.min(100, (pe / maxE) * 100)}%`;
    pEl.barTH.style.width = `${Math.min(100, (th / maxE) * 100)}%`;
    pEl.numKE.textContent = `${ke.toFixed(3)} J`;
    pEl.numPE.textContent = `${pe.toFixed(3)} J`;
    pEl.numTH.textContent = `${th.toFixed(3)} J`;
  }

  function drawPendulumScene() {
    const { ctx, w, h } = setupHiDPICanvas(pEl.canvas);
    drawBlueprintGrid(ctx, w, h);

    const params = getPendulumParams();
    const res = P.solveBallisticPendulum(params);

    // Coordinate mapping: pivot at (pivotX, pivotY), scale pixels per meter
    const pxPerMeter = Math.min(200, 240 / params.armLength);
    const pivotX = 340;
    const pivotY = 58;
    const armPx = params.armLength * pxPerMeter;
    const restBobY = pivotY + armPx;

    // Ceiling beam
    ctx.fillStyle = COLORS.tealDark;
    ctx.fillRect(pivotX - 90, pivotY - 14, 180, 14);

    // Reference y = 0 dashed line
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, restBobY);
    ctx.lineTo(w - 30, restBobY);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('y = 0 (rest level)', w - 34, restBobY + 18);
    ctx.restore();

    // Dashed arc of possible swing
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(15, 126, 155, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, armPx, Math.PI / 2 - 1.3, Math.PI / 2 + 0.35);
    ctx.stroke();
    ctx.restore();

    // Bob position
    const bobX = pivotX + armPx * Math.sin(pState.theta);
    const bobY = pivotY + armPx * Math.cos(pState.theta);

    // If peak reached or paused at peak, draw max height marker
    const currentH = params.armLength * (1 - Math.cos(pState.theta));
    if (pState.phase === 'swing' || pState.phase === 'peak-paused') {
      const maxBobY = restBobY - res.maxHeight * pxPerMeter;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pivotX + 20, maxBobY);
      ctx.lineTo(w - 75, maxBobY);
      ctx.stroke();

      // Height bracket
      const rx = w - 85;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(rx, restBobY);
      ctx.lineTo(rx, maxBobY);
      ctx.stroke();
      ctx.fillStyle = COLORS.amberDark;
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      const hLabel = pEl.showAnswer.checked ? `h = ${res.maxHeight.toFixed(3)} m` : 'h_max';
      ctx.fillText(hLabel, rx + 8, (restBobY + maxBobY) / 2 + 4);
      ctx.restore();
    }

    // Pendulum arm
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Pivot pin
    ctx.fillStyle = COLORS.teal;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Catcher block (rotated by theta)
    ctx.save();
    ctx.translate(bobX, bobY);
    ctx.rotate(-pState.theta);
    ctx.fillStyle = COLORS.teal;
    ctx.strokeStyle = COLORS.tealDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-24, -18, 48, 36, 6);
    ctx.fill();
    ctx.stroke();

    // Embedded ball inside catcher after collision
    if (pState.phase !== 'ready' && pState.phase !== 'approach') {
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(-6, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Catcher mass label
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`m_c = ${params.catcherMassG} g`, bobX, bobY + 34);

    // Approaching ball
    if (pState.phase === 'ready' || pState.phase === 'approach') {
      const ballPxX = pivotX + pState.ballX * pxPerMeter;
      const ballPxY = restBobY;

      // Launcher barrel hint on far left
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(28, restBobY - 12, 34, 24);

      ctx.fillStyle = COLORS.amber;
      ctx.strokeStyle = COLORS.amberDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ballPxX, ballPxY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.ink;
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`m_b = ${params.ballMassG} g`, ballPxX, ballPxY + 26);

      // Velocity arrow
      const arrowLen = Math.min(75, Math.max(25, params.initialVelocity * 8));
      drawArrow(ctx, ballPxX + 14, ballPxY, ballPxX + 14 + arrowLen, ballPxY, COLORS.amberDark, `v₀ = ${params.initialVelocity.toFixed(1)} m/s`);
    }

    // Impact flash
    if (pState.impactFlash > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(214, 123, 25, ${pState.impactFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bobX, bobY, 32 + (1 - pState.impactFlash) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Live height badge in top-left of canvas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(14, 14, 195, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.tealDark;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Current height: ${currentH.toFixed(3)} m`, 24, 35);
    const deg = (pState.theta * 180) / Math.PI;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Angle: ${deg.toFixed(1)}°`, 24, 54);
  }

  function stepPendulumAnimation(ts) {
    if (!pState.running) return;
    if (pState.lastTs === null) pState.lastTs = ts;
    const rawDt = Math.min(0.033, (ts - pState.lastTs) / 1000);
    pState.lastTs = ts;

    const dt = rawDt * (pEl.slowMo.checked ? 0.5 : 1.0);
    const params = getPendulumParams();
    const res = P.solveBallisticPendulum(params);

    if (pState.impactFlash > 0) {
      pState.impactFlash = Math.max(0, pState.impactFlash - rawDt * 3);
    }

    if (pState.phase === 'approach') {
      pState.ballX += params.initialVelocity * dt;
      if (pState.ballX >= 0) {
        pState.ballX = 0;
        pState.phase = 'swing';
        pState.theta = 0;
        pState.omega = res.postCollisionVelocity / params.armLength;
        pState.impactFlash = 1;
        pEl.phaseBadge.textContent = '2. Collision → 3. Swing';
        pEl.status.innerHTML = 'Impact! Momentum conserved (<strong>v′ = ' +
          res.postCollisionVelocity.toFixed(2) + ' m/s</strong>). Swinging upward...';
      }
    } else if (pState.phase === 'swing') {
      const subSteps = 4;
      const subDt = dt / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const prevOmega = pState.omega;
        const next = P.stepPendulumRK4(pState.theta, pState.omega, params.armLength, P.DEFAULT_G, subDt);
        pState.theta = next.theta;
        pState.omega = next.omega;

        if (!pState.peakReached && prevOmega > 0 && pState.omega <= 0) {
          pState.peakReached = true;
          if (pEl.pausePeak.checked) {
            pState.phase = 'peak-paused';
            pState.running = false;
            pState.omega = 0;
            pEl.phaseBadge.textContent = 'Peak Height Reached';
            pEl.pauseBtn.textContent = 'Resume';
            pEl.status.innerHTML = `Reached peak height <strong>h = ${res.maxHeight.toFixed(3)} m</strong> (${res.maxHeightCm.toFixed(1)} cm).`;
            break;
          }
        }
      }
    }

    updatePendulumEnergyBars(params, res);
    drawPendulumScene();

    if (pState.running) {
      pState.rafId = requestAnimationFrame(stepPendulumAnimation);
    }
  }

  function resetPendulum() {
    if (pState.rafId) cancelAnimationFrame(pState.rafId);
    pState.phase = 'ready';
    pState.running = false;
    pState.ballX = -0.9;
    pState.theta = 0;
    pState.omega = 0;
    pState.impactFlash = 0;
    pState.peakReached = false;
    pState.lastTs = null;
    pEl.pauseBtn.textContent = 'Pause';
    pEl.phaseBadge.textContent = 'Ready';
    const params = getPendulumParams();
    pEl.status.innerHTML = `Ready. Press <strong>Fire Ball</strong> to launch the ${params.ballMassG} g ball at ${params.initialVelocity.toFixed(1)} m/s.`;
    updatePendulumUI();
    drawPendulumScene();
  }

  function firePendulum() {
    resetPendulum();
    pState.phase = 'approach';
    pState.running = true;
    pEl.phaseBadge.textContent = '1. Ball Approaching';
    pEl.status.textContent = 'Ball fired! Approaching catcher at constant velocity...';
    pState.rafId = requestAnimationFrame(stepPendulumAnimation);
  }

  [pEl.ballMass, pEl.ballVel, pEl.catcherMass, pEl.armLength].forEach((input) => {
    input.addEventListener('input', () => {
      if (pState.phase !== 'ready') resetPendulum();
      else {
        updatePendulumUI();
        drawPendulumScene();
      }
    });
  });

  pEl.showAnswer.addEventListener('change', () => {
    updatePendulumUI();
    drawPendulumScene();
  });

  pEl.fireBtn.addEventListener('click', firePendulum);
  pEl.resetBtn.addEventListener('click', resetPendulum);
  pEl.pauseBtn.addEventListener('click', () => {
    if (pState.phase === 'ready') return;
    if (pState.running) {
      pState.running = false;
      pEl.pauseBtn.textContent = 'Resume';
    } else {
      if (pState.phase === 'peak-paused') pState.phase = 'swing';
      pState.running = true;
      pState.lastTs = null;
      pEl.pauseBtn.textContent = 'Pause';
      pState.rafId = requestAnimationFrame(stepPendulumAnimation);
    }
  });

  pEl.recordBtn.addEventListener('click', () => {
    const params = getPendulumParams();
    const res = P.solveBallisticPendulum(params);
    pState.trials.push({
      n: pState.trials.length + 1,
      mb: params.ballMassG,
      v0: params.initialVelocity.toFixed(1),
      mc: params.catcherMassG,
      vp: res.postCollisionVelocity.toFixed(2),
      h: res.maxHeight.toFixed(3),
      deg: res.maxAngleDeg.toFixed(1),
    });
    pEl.trialsBody.innerHTML = pState.trials
      .map(
        (t) => `<tr>
          <td>${t.n}</td><td>${t.mb}</td><td>${t.v0}</td><td>${t.mc}</td>
          <td>${t.vp}</td><td><strong>${t.h}</strong></td><td>${t.deg}</td>
        </tr>`
      )
      .join('');
  });

  pEl.clearTrialsBtn.addEventListener('click', () => {
    pState.trials = [];
    pEl.trialsBody.innerHTML =
      '<tr class="empty-row"><td colspan="7">No trials recorded yet. Click <strong>Record Trial</strong> after running a shot.</td></tr>';
  });

  document.querySelectorAll('[data-p-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-p-preset');
      if (key === 'classroom') {
        pEl.ballMass.value = 63;
        pEl.ballVel.value = 4.0;
        pEl.catcherMass.value = 116;
        pEl.armLength.value = 1.0;
      } else if (key === 'fast') {
        pEl.ballMass.value = 50;
        pEl.ballVel.value = 8.0;
        pEl.catcherMass.value = 200;
        pEl.armLength.value = 1.2;
      }
      resetPendulum();
    });
  });

  // =========================================================================
  // 4. TAB 2: CIRCULAR RAMP + INELASTIC COLLISION + FRICTION SLIDE
  // =========================================================================
  const rEl = {
    m1: document.getElementById('r-m1'),
    m1Val: document.getElementById('r-m1-val'),
    radius: document.getElementById('r-radius'),
    radiusVal: document.getElementById('r-radius-val'),
    m2: document.getElementById('r-m2'),
    m2Val: document.getElementById('r-m2-val'),
    mu: document.getElementById('r-mu'),
    muVal: document.getElementById('r-mu-val'),
    slowMo: document.getElementById('r-slow-mo'),
    showAnswer: document.getElementById('r-show-answer'),
    dropBtn: document.getElementById('r-drop-btn'),
    pauseBtn: document.getElementById('r-pause-btn'),
    resetBtn: document.getElementById('r-reset-btn'),
    recordBtn: document.getElementById('r-record-btn'),
    clearTrialsBtn: document.getElementById('r-clear-trials'),
    status: document.getElementById('r-status'),
    phaseBadge: document.getElementById('r-phase-badge'),
    canvas: document.getElementById('r-canvas'),
    outV1: document.getElementById('r-out-v1'),
    outV2: document.getElementById('r-out-v2'),
    outDist: document.getElementById('r-out-dist'),
    outWork: document.getElementById('r-out-work'),
    outFk: document.getElementById('r-out-fk'),
    barPE: document.getElementById('r-bar-pe'),
    barKE: document.getElementById('r-bar-ke'),
    barThColl: document.getElementById('r-bar-th-coll'),
    barThFric: document.getElementById('r-bar-th-fric'),
    numPE: document.getElementById('r-num-pe'),
    numKE: document.getElementById('r-num-ke'),
    numThColl: document.getElementById('r-num-th-coll'),
    numThFric: document.getElementById('r-num-th-fric'),
    solutionSteps: document.getElementById('r-solution-steps'),
    trialsBody: document.getElementById('r-trials-body'),
  };

  let rState = {
    phase: 'ready', // 'ready' | 'ramp' | 'slide' | 'stopped'
    running: false,
    phi: 0, // 0 at top of ramp, pi/2 at bottom
    omega: 0,
    slideX: 0,
    slideV: 0,
    impactFlash: 0,
    trials: [],
    rafId: null,
    lastTs: null,
  };

  function getRampParams() {
    return {
      m1Kg: parseFloat(rEl.m1.value),
      radius: parseFloat(rEl.radius.value),
      m2Kg: parseFloat(rEl.m2.value),
      mu: parseFloat(rEl.mu.value),
    };
  }

  function updateRampUI() {
    const params = getRampParams();
    const res = P.solveRampCollisionSlide(params);

    const m1T = `${params.m1Kg.toFixed(1)} kg`;
    const rT = `${params.radius.toFixed(2)} m`;
    const m2T = `${params.m2Kg.toFixed(1)} kg`;
    const muT = `${params.mu.toFixed(2)}`;

    rEl.m1Val.textContent = m1T;
    rEl.radiusVal.textContent = rT;
    rEl.m2Val.textContent = m2T;
    rEl.muVal.textContent = muT;

    syncSlider(rEl.m1, m1T);
    syncSlider(rEl.radius, rT);
    syncSlider(rEl.m2, m2T);
    syncSlider(rEl.mu, muT);

    const show = rEl.showAnswer.checked;
    rEl.outV1.textContent = show ? `${res.speedBeforeCollision.toFixed(2)} m/s` : 'Hidden';
    rEl.outV2.textContent = show ? `${res.postCollisionVelocity.toFixed(2)} m/s` : 'Hidden';
    rEl.outDist.textContent = show ? `${res.stoppingDistance.toFixed(2)} m` : 'Hidden';
    rEl.outWork.textContent = show ? `${res.workByFriction.toFixed(1)} J` : 'Hidden';
    rEl.outFk.textContent = show ? `${res.frictionForce.toFixed(1)} N` : 'Hidden';

    renderRampSteps(params, res, show);
    updateRampEnergyBars(params, res);
  }

  function renderRampSteps(params, res, show) {
    if (!show) {
      rEl.solutionSteps.innerHTML = `
        <div class="step-card">
          <h4>Numerical Answers Hidden</h4>
          <p>Toggle <strong>Show numerical answers &amp; derivation</strong> on the left when you are ready to check your work.</p>
        </div>`;
      return;
    }

    rEl.solutionSteps.innerHTML = `
      <div class="step-card">
        <h4>Stage 1: Frictionless Ramp (Energy Conserved)</h4>
        <p>m₁ drops height R = ${params.radius.toFixed(2)} m from rest:</p>
        <span class="eq">m₁ g R = ½ m₁ v₁² ⇒ v₁ = √(2gR)</span>
        <span class="eq">v₁ = √(2 × 9.8 × ${params.radius.toFixed(2)}) = <strong>${res.speedBeforeCollision.toFixed(3)} m/s</strong></span>
      </div>
      <div class="step-card">
        <h4>Stage 2: Inelastic Collision (Momentum Conserved)</h4>
        <p>m₁ sticks to m₂ at the bottom of the ramp:</p>
        <span class="eq">m₁ v₁ = (m₁ + m₂) v₂</span>
        <span class="eq">v₂ = (${params.m1Kg.toFixed(1)} × ${res.speedBeforeCollision.toFixed(3)}) / ${res.totalMass.toFixed(1)} = <strong>${res.postCollisionVelocity.toFixed(3)} m/s</strong></span>
      </div>
      <div class="step-card">
        <h4>Stage 3: Friction Slide (Work-Energy Theorem)</h4>
        <p>(a) Stopping distance with f<sub>k</sub> = μ(m₁ + m₂)g = ${res.frictionForce.toFixed(1)} N:</p>
        <span class="eq">d = v₂² / (2 μ g) = <strong>${res.stoppingDistance.toFixed(3)} m</strong></span>
        <p>(b) Work done by friction:</p>
        <span class="eq">W<sub>f</sub> = −f<sub>k</sub> d = ΔKE = <strong>${res.workByFriction.toFixed(2)} J</strong></span>
      </div>
    `;
  }

  function updateRampEnergyBars(params, res) {
    const maxE = Math.max(res.initialPE, 0.001);
    let pe = 0;
    let ke = 0;
    let thColl = 0;
    let thFric = 0;

    if (rState.phase === 'ready') {
      pe = res.initialPE;
    } else if (rState.phase === 'ramp') {
      const hCurrent = params.radius * (1 - Math.sin(rState.phi));
      const vCurrent = rState.omega * params.radius;
      pe = params.m1Kg * P.DEFAULT_G * hCurrent;
      ke = 0.5 * params.m1Kg * vCurrent * vCurrent;
    } else {
      ke = 0.5 * res.totalMass * rState.slideV * rState.slideV;
      thColl = res.collisionEnergyLoss;
      thFric = res.frictionForce * rState.slideX;
    }

    rEl.barPE.style.width = `${Math.min(100, (pe / maxE) * 100)}%`;
    rEl.barKE.style.width = `${Math.min(100, (ke / maxE) * 100)}%`;
    rEl.barThColl.style.width = `${Math.min(100, (thColl / maxE) * 100)}%`;
    rEl.barThFric.style.width = `${Math.min(100, (thFric / maxE) * 100)}%`;

    rEl.numPE.textContent = `${pe.toFixed(1)} J`;
    rEl.numKE.textContent = `${ke.toFixed(1)} J`;
    rEl.numThColl.textContent = `${thColl.toFixed(1)} J`;
    rEl.numThFric.textContent = `${thFric.toFixed(1)} J`;
  }

  function drawRampScene() {
    const { ctx, w, h } = setupHiDPICanvas(rEl.canvas);
    drawBlueprintGrid(ctx, w, h);

    const params = getRampParams();
    const res = P.solveRampCollisionSlide(params);

    const floorY = 335;
    // Scale so both ramp radius and stopping distance fit comfortably
    const maxTrackMeters = Math.max(res.stoppingDistance + 0.8, 3.2);
    const pxPerMeterX = (w - 230) / maxTrackMeters;
    const pxPerMeterR = Math.min(160, 230 / params.radius, pxPerMeterX);
    const pxPerMeter = Math.min(pxPerMeterX, pxPerMeterR) < 55 ? 65 : Math.min(115, (w - 220) / (params.radius + maxTrackMeters));
    const scale = Math.max(42, Math.min(145, pxPerMeter));

    const rampBottomX = 60 + params.radius * scale;
    const rampCenterX = rampBottomX;
    const rampCenterY = floorY - params.radius * scale;
    const rampRadiusPx = params.radius * scale;

    // Draw quarter-circle ramp structure
    ctx.save();
    ctx.fillStyle = '#dcebf2';
    ctx.strokeStyle = COLORS.tealDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rampBottomX - rampRadiusPx, floorY);
    ctx.lineTo(rampBottomX - rampRadiusPx, rampCenterY);
    // Arc from left (pi) down to bottom (pi/2)
    ctx.arc(rampCenterX, rampCenterY, rampRadiusPx, Math.PI, Math.PI / 2, true);
    ctx.lineTo(rampBottomX, floorY);
    ctx.closePath();
    ctx.fill();

    // Ramp track curve highlight
    ctx.beginPath();
    ctx.arc(rampCenterX, rampCenterY, rampRadiusPx, Math.PI, Math.PI / 2, true);
    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Draw flat surface with friction hatch marks
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(35, floorY);
    ctx.lineTo(w - 25, floorY);
    ctx.stroke();

    // Hatch marks for friction zone (x >= 0)
    ctx.strokeStyle = COLORS.amberDark;
    ctx.lineWidth = 1.5;
    for (let hx = rampBottomX; hx < w - 30; hx += 14) {
      ctx.beginPath();
      ctx.moveTo(hx, floorY);
      ctx.lineTo(hx - 6, floorY + 8);
      ctx.stroke();
    }

    // Labels for frictionless ramp vs friction surface (guaranteed non-overlapping)
    ctx.fillStyle = COLORS.tealDark;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    const rampLabel = `Frictionless Ramp (R = ${params.radius.toFixed(2)} m)`;
    ctx.fillText(rampLabel, 38, floorY + 24);
    const rampLabelWidth = ctx.measureText(rampLabel).width;
    const roughLabelX = Math.max(rampBottomX + 14, 38 + rampLabelWidth + 24);
    ctx.fillStyle = COLORS.amberDark;
    ctx.fillText(`Rough Surface (μ = ${params.mu.toFixed(2)})`, roughLabelX, floorY + 24);

    // Radius / Height indicator on ramp
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rampCenterX - rampRadiusPx, rampCenterY);
    ctx.lineTo(rampCenterX, rampCenterY);
    ctx.lineTo(rampCenterX, floorY);
    ctx.stroke();
    ctx.restore();

    // Draw blocks
    const boxW = 34;
    const boxH = 26;

    if (rState.phase === 'ready' || rState.phase === 'ramp') {
      // m2 sitting at bottom (x = 0)
      const m2X = rampBottomX;
      ctx.fillStyle = COLORS.teal;
      ctx.strokeStyle = COLORS.tealDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(m2X, floorY - boxH, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('m₂', m2X + boxW / 2, floorY - boxH / 2 + 4);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(`${params.m2Kg} kg`, m2X + boxW / 2, floorY - boxH - 8);

      // m1 on ramp at angle phi (0 = top, pi/2 = bottom)
      const thetaArc = Math.PI - rState.phi;
      const m1X = rampCenterX + rampRadiusPx * Math.cos(thetaArc);
      const m1Y = rampCenterY + rampRadiusPx * Math.sin(thetaArc);

      ctx.save();
      ctx.translate(m1X, m1Y);
      ctx.rotate(Math.PI / 2 - rState.phi);
      ctx.fillStyle = COLORS.amber;
      ctx.strokeStyle = COLORS.amberDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('m₁', 0, -boxH / 2 + 4);
      ctx.restore();
    } else {
      // Combined mass (m1 + m2) sliding along x >= 0
      const posPx = rampBottomX + rState.slideX * scale;
      ctx.fillStyle = COLORS.amber;
      ctx.strokeStyle = COLORS.amberDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(posPx - boxW / 2, floorY - boxH, boxW / 2, boxH, [4, 0, 0, 4]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.teal;
      ctx.strokeStyle = COLORS.tealDark;
      ctx.beginPath();
      ctx.roundRect(posPx, floorY - boxH, boxW / 2 + 8, boxH, [0, 4, 4, 0]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('m₁+m₂', posPx + 4, floorY - boxH / 2 + 4);

      if (rState.slideV > 0.05) {
        drawArrow(ctx, posPx + 26, floorY - boxH / 2, posPx + 26 + Math.min(70, rState.slideV * 18), floorY - boxH / 2, COLORS.tealDark, `v = ${rState.slideV.toFixed(2)} m/s`);
        drawArrow(ctx, posPx - 20, floorY - 8, posPx - 58, floorY - 8, COLORS.amberDark, 'f_k');
      }

      // Distance marker from x = 0 to current/final x
      if (rState.slideX > 0.05) {
        const yMark = floorY + 42;
        ctx.strokeStyle = COLORS.tealDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rampBottomX, yMark - 5);
        ctx.lineTo(rampBottomX, yMark + 5);
        ctx.moveTo(rampBottomX, yMark);
        ctx.lineTo(posPx, yMark);
        ctx.moveTo(posPx, yMark - 5);
        ctx.lineTo(posPx, yMark + 5);
        ctx.stroke();
        ctx.fillStyle = COLORS.tealDark;
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        const dText = rEl.showAnswer.checked ? `d = ${rState.slideX.toFixed(2)} m` : 'd';
        ctx.fillText(dText, (rampBottomX + posPx) / 2, yMark + 16);
      }
    }

    // Impact flash
    if (rState.impactFlash > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(214, 123, 25, ${rState.impactFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rampBottomX, floorY - boxH / 2, 26 + (1 - rState.impactFlash) * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Top-right status box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w - 220, 14, 206, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.tealDark;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    const curSpeed = rState.phase === 'ramp' ? rState.omega * params.radius : rState.slideV;
    ctx.fillText(`Speed: ${curSpeed.toFixed(2)} m/s`, w - 208, 35);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Slide distance: ${rState.slideX.toFixed(2)} m`, w - 208, 54);
  }

  function stepRampAnimation(ts) {
    if (!rState.running) return;
    if (rState.lastTs === null) rState.lastTs = ts;
    const rawDt = Math.min(0.033, (ts - rState.lastTs) / 1000);
    rState.lastTs = ts;

    const dt = rawDt * (rEl.slowMo.checked ? 0.5 : 1.0);
    const params = getRampParams();
    const res = P.solveRampCollisionSlide(params);

    if (rState.impactFlash > 0) {
      rState.impactFlash = Math.max(0, rState.impactFlash - rawDt * 3);
    }

    if (rState.phase === 'ramp') {
      const subSteps = 4;
      const subDt = dt / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const next = P.stepRampRK4(rState.phi, rState.omega, params.radius, P.DEFAULT_G, subDt);
        rState.phi = next.phi;
        rState.omega = next.omega;
        if (rState.phi >= Math.PI / 2) {
          rState.phi = Math.PI / 2;
          rState.phase = 'slide';
          rState.slideX = 0;
          rState.slideV = res.postCollisionVelocity;
          rState.impactFlash = 1;
          rEl.phaseBadge.textContent = '2. Collision → 3. Friction Slide';
          rEl.status.innerHTML = `Collision at bottom! Combined mass moves at <strong>v₂ = ${res.postCollisionVelocity.toFixed(2)} m/s</strong>.`;
          break;
        }
      }
    } else if (rState.phase === 'slide') {
      const nextV = rState.slideV - res.deceleration * dt;
      if (nextV <= 0) {
        rState.slideX = res.stoppingDistance;
        rState.slideV = 0;
        rState.phase = 'stopped';
        rState.running = false;
        rEl.phaseBadge.textContent = 'Stopped';
        rEl.status.innerHTML = `Stopped at <strong>d = ${res.stoppingDistance.toFixed(2)} m</strong>. Work by friction: <strong>${res.workByFriction.toFixed(1)} J</strong>.`;
      } else {
        rState.slideX += 0.5 * (rState.slideV + nextV) * dt;
        rState.slideV = nextV;
      }
    }

    updateRampEnergyBars(params, res);
    drawRampScene();

    if (rState.running) {
      rState.rafId = requestAnimationFrame(stepRampAnimation);
    }
  }

  function resetRamp() {
    if (rState.rafId) cancelAnimationFrame(rState.rafId);
    rState.phase = 'ready';
    rState.running = false;
    rState.phi = 0;
    rState.omega = 0;
    rState.slideX = 0;
    rState.slideV = 0;
    rState.impactFlash = 0;
    rState.lastTs = null;
    rEl.pauseBtn.textContent = 'Pause';
    rEl.phaseBadge.textContent = 'Ready';
    const params = getRampParams();
    rEl.status.innerHTML = `Ready. Press <strong>Drop Mass m₁</strong> to release ${params.m1Kg.toFixed(1)} kg from rest at height R = ${params.radius.toFixed(2)} m.`;
    updateRampUI();
    drawRampScene();
  }

  function dropRamp() {
    resetRamp();
    rState.phase = 'ramp';
    rState.running = true;
    rEl.phaseBadge.textContent = '1. Sliding Down Ramp';
    rEl.status.textContent = 'm₁ released from rest! Accelerating down the frictionless circular ramp...';
    rState.rafId = requestAnimationFrame(stepRampAnimation);
  }

  [rEl.m1, rEl.radius, rEl.m2, rEl.mu].forEach((input) => {
    input.addEventListener('input', () => {
      if (rState.phase !== 'ready') resetRamp();
      else {
        updateRampUI();
        drawRampScene();
      }
    });
  });

  rEl.showAnswer.addEventListener('change', () => {
    updateRampUI();
    drawRampScene();
  });

  rEl.dropBtn.addEventListener('click', dropRamp);
  rEl.resetBtn.addEventListener('click', resetRamp);
  rEl.pauseBtn.addEventListener('click', () => {
    if (rState.phase === 'ready' || rState.phase === 'stopped') return;
    if (rState.running) {
      rState.running = false;
      rEl.pauseBtn.textContent = 'Resume';
    } else {
      rState.running = true;
      rState.lastTs = null;
      rEl.pauseBtn.textContent = 'Pause';
      rState.rafId = requestAnimationFrame(stepRampAnimation);
    }
  });

  rEl.recordBtn.addEventListener('click', () => {
    const params = getRampParams();
    const res = P.solveRampCollisionSlide(params);
    rState.trials.push({
      n: rState.trials.length + 1,
      m1: params.m1Kg.toFixed(1),
      r: params.radius.toFixed(2),
      m2: params.m2Kg.toFixed(1),
      mu: params.mu.toFixed(2),
      d: res.stoppingDistance.toFixed(2),
      wf: res.workByFriction.toFixed(1),
    });
    rEl.trialsBody.innerHTML = rState.trials
      .map(
        (t) => `<tr>
          <td>${t.n}</td><td>${t.m1}</td><td>${t.r}</td><td>${t.m2}</td>
          <td>${t.mu}</td><td><strong>${t.d}</strong></td><td><strong>${t.wf}</strong></td>
        </tr>`
      )
      .join('');
  });

  rEl.clearTrialsBtn.addEventListener('click', () => {
    rState.trials = [];
    rEl.trialsBody.innerHTML =
      '<tr class="empty-row"><td colspan="7">No trials recorded yet. Click <strong>Record Trial</strong> after running a drop.</td></tr>';
  });

  document.querySelectorAll('[data-r-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-r-preset');
      if (key === 'classroom') {
        rEl.m1.value = 12;
        rEl.radius.value = 1.0;
        rEl.m2.value = 8;
        rEl.mu.value = 0.2;
      } else if (key === 'icy') {
        rEl.m1.value = 10;
        rEl.radius.value = 1.5;
        rEl.m2.value = 5;
        rEl.mu.value = 0.08;
      }
      resetRamp();
    });
  });

  // =========================================================================
  // 5. TAB 3: MYSTERY MASS LAB (MEASURE HEIGHT, FIND MASSES)
  // =========================================================================
  const MYSTERY_SAMPLES = {
    A: { catcherG: 116, ballG: 63 },
    B: { catcherG: 185, ballG: 80 },
    C: { catcherG: 92, ballG: 48 },
  };

  const mEl = {
    mode: document.getElementById('m-mode'),
    knownMass: document.getElementById('m-known-mass'),
    knownMassLabel: document.getElementById('m-known-mass-label'),
    knownMassVal: document.getElementById('m-known-mass-val'),
    vel: document.getElementById('m-vel'),
    velVal: document.getElementById('m-vel-val'),
    caliper: document.getElementById('m-caliper'),
    caliperVal: document.getElementById('m-caliper-val'),
    pausePeak: document.getElementById('m-pause-peak'),
    fireBtn: document.getElementById('m-fire-btn'),
    resetBtn: document.getElementById('m-reset-btn'),
    recordBtn: document.getElementById('m-record-btn'),
    randomBtn: document.getElementById('m-random-btn'),
    status: document.getElementById('m-status'),
    phaseBadge: document.getElementById('m-phase-badge'),
    canvas: document.getElementById('m-canvas'),
    outV0: document.getElementById('m-out-v0'),
    outKnownDt: document.getElementById('m-out-known-dt'),
    outKnown: document.getElementById('m-out-known'),
    outCaliper: document.getElementById('m-out-caliper'),
    outVprime: document.getElementById('m-out-vprime'),
    guessLabel: document.getElementById('m-guess-label'),
    guessInput: document.getElementById('m-guess-input'),
    checkBtn: document.getElementById('m-check-btn'),
    revealBtn: document.getElementById('m-reveal-btn'),
    feedback: document.getElementById('m-feedback'),
    trialsBody: document.getElementById('m-trials-body'),
    clearTrialsBtn: document.getElementById('m-clear-trials'),
  };

  const M_ARM_LENGTH = 1.0;

  let mState = {
    sampleName: 'Sample A',
    secretMassG: 116,
    revealed: false,
    phase: 'ready', // 'ready' | 'approach' | 'swing' | 'peak-paused'
    running: false,
    ballX: -0.9,
    theta: 0,
    omega: 0,
    impactFlash: 0,
    peakReached: false,
    peakTheta: null,
    draggingCaliper: false,
    trials: [],
    rafId: null,
    lastTs: null,
  };

  function getMysteryParams() {
    const mode = mEl.mode.value; // 'catcher' | 'ball'
    const knownG = parseFloat(mEl.knownMass.value);
    const v0 = parseFloat(mEl.vel.value);
    const ballMassG = mode === 'catcher' ? knownG : mState.secretMassG;
    const catcherMassG = mode === 'catcher' ? mState.secretMassG : knownG;
    return {
      mode,
      knownG,
      ballMassG,
      catcherMassG,
      ballMassKg: ballMassG / 1000,
      catcherMassKg: catcherMassG / 1000,
      initialVelocity: v0,
      armLength: M_ARM_LENGTH,
    };
  }

  function updateMysteryUI() {
    const mode = mEl.mode.value;
    const knownG = parseFloat(mEl.knownMass.value);
    const v0 = parseFloat(mEl.vel.value);
    const calH = parseFloat(mEl.caliper.value);

    const knownText = `${knownG} g (${(knownG / 1000).toFixed(3)} kg)`;
    const v0Text = `${v0.toFixed(1)} m/s`;
    const calText = `${calH.toFixed(3)} m (${(calH * 100).toFixed(1)} cm)`;

    if (mode === 'catcher') {
      mEl.knownMassLabel.innerHTML = 'Known Ball Mass (m<sub>b</sub>)';
      mEl.outKnownDt.innerHTML = 'Known Mass (m<sub>b</sub>)';
      mEl.guessLabel.textContent = 'Your Calculated Catcher Mass (g):';
    } else {
      mEl.knownMassLabel.innerHTML = 'Known Catcher Mass (m<sub>c</sub>)';
      mEl.outKnownDt.innerHTML = 'Known Mass (m<sub>c</sub>)';
      mEl.guessLabel.textContent = 'Your Calculated Ball Mass (g):';
    }

    mEl.knownMassVal.textContent = knownText;
    mEl.velVal.textContent = v0Text;
    mEl.caliperVal.textContent = calText;

    syncSlider(mEl.knownMass, knownText);
    syncSlider(mEl.vel, v0Text);
    syncSlider(mEl.caliper, calText);

    mEl.outV0.textContent = v0Text;
    mEl.outKnown.textContent = `${knownG} g`;
    mEl.outCaliper.textContent = calText;

    const impliedVprime = Math.sqrt(2 * P.DEFAULT_G * calH);
    mEl.outVprime.textContent = `${impliedVprime.toFixed(3)} m/s`;
  }

  function getMysteryGeometry() {
    const pxPerMeter = 220;
    const pivotX = 335;
    const pivotY = 58;
    const armPx = M_ARM_LENGTH * pxPerMeter;
    const restBobY = pivotY + armPx;
    return { pxPerMeter, pivotX, pivotY, armPx, restBobY };
  }

  function drawMysteryScene() {
    const { ctx, w, h } = setupHiDPICanvas(mEl.canvas);
    drawBlueprintGrid(ctx, w, h);

    const params = getMysteryParams();
    const { pxPerMeter, pivotX, pivotY, armPx, restBobY } = getMysteryGeometry();

    // Ceiling beam
    ctx.fillStyle = COLORS.tealDark;
    ctx.fillRect(pivotX - 90, pivotY - 14, 180, 14);

    // Reference y = 0 line
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, restBobY);
    ctx.lineTo(w - 30, restBobY);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('h = 0.00 m (rest center)', pivotX + 125, restBobY + 18);
    ctx.restore();

    // Vertical Ruler on right side (from h = 0 up to 0.60 m)
    const rulerX = w - 142;
    const rulerW = 54;
    const maxRulerH = 0.60;
    const topRulerY = restBobY - maxRulerH * pxPerMeter;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = COLORS.tealDark;
    ctx.lineWidth = 1.5;
    ctx.fillRect(rulerX, topRulerY - 10, rulerW, maxRulerH * pxPerMeter + 20);
    ctx.strokeRect(rulerX, topRulerY - 10, rulerW, maxRulerH * pxPerMeter + 20);

    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    for (let cm = 0; cm <= 60; cm += 2) {
      const yTick = restBobY - (cm / 100) * pxPerMeter;
      const isMajor = cm % 10 === 0;
      const isMid = cm % 5 === 0;
      const tickLen = isMajor ? 14 : isMid ? 9 : 5;
      ctx.strokeStyle = isMajor ? COLORS.tealDark : COLORS.muted;
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(rulerX, yTick);
      ctx.lineTo(rulerX + tickLen, yTick);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(`${cm} cm`, rulerX + 16, yTick + 3);
      }
    }

    // Peak Ghost Marker if peak was reached
    if (mState.peakTheta !== null) {
      const ghostX = pivotX + armPx * Math.sin(mState.peakTheta);
      const ghostY = pivotY + armPx * Math.cos(mState.peakTheta);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.teal;
      ctx.fill();
      ctx.restore();
    }

    // Bob position
    const bobX = pivotX + armPx * Math.sin(mState.theta);
    const bobY = pivotY + armPx * Math.cos(mState.theta);

    // Pendulum arm & pivot
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    ctx.fillStyle = COLORS.teal;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Catcher block
    ctx.save();
    ctx.translate(bobX, bobY);
    ctx.rotate(-mState.theta);
    ctx.fillStyle = COLORS.teal;
    ctx.strokeStyle = COLORS.tealDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-24, -18, 48, 36, 6);
    ctx.fill();
    ctx.stroke();

    if (mState.phase !== 'ready' && mState.phase !== 'approach') {
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(-6, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Catcher label
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const catcherLabel =
      params.mode === 'catcher' && !mState.revealed
        ? 'm_c = ? g'
        : `m_c = ${params.catcherMassG} g`;
    ctx.fillText(catcherLabel, bobX, bobY + 34);

    // Approaching ball
    if (mState.phase === 'ready' || mState.phase === 'approach') {
      const ballPxX = pivotX + mState.ballX * pxPerMeter;
      const ballPxY = restBobY;

      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(28, restBobY - 12, 34, 24);

      ctx.fillStyle = COLORS.amber;
      ctx.strokeStyle = COLORS.amberDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ballPxX, ballPxY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.ink;
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      const ballLabel =
        params.mode === 'ball' && !mState.revealed
          ? 'm_b = ? g'
          : `m_b = ${params.ballMassG} g`;
      ctx.fillText(ballLabel, ballPxX, ballPxY + 26);

      const arrowLen = Math.min(75, Math.max(25, params.initialVelocity * 8));
      drawArrow(ctx, ballPxX + 14, ballPxY, ballPxX + 14 + arrowLen, ballPxY, COLORS.amberDark, `v₀ = ${params.initialVelocity.toFixed(1)} m/s`);
    }

    // Impact flash
    if (mState.impactFlash > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(214, 123, 25, ${mState.impactFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bobX, bobY, 32 + (1 - mState.impactFlash) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draggable Height Caliper Line
    const calH = parseFloat(mEl.caliper.value);
    const calY = restBobY - calH * pxPerMeter;

    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX - 40, calY);
    ctx.lineTo(rulerX + rulerW, calY);
    ctx.stroke();

    // Caliper handle pill
    ctx.fillStyle = COLORS.amber;
    ctx.beginPath();
    ctx.roundRect(rulerX + rulerW + 6, calY - 12, 68, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${(calH * 100).toFixed(1)} cm`, rulerX + rulerW + 40, calY + 4);
    ctx.restore();

    // Top-left sample badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(14, 14, 210, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.tealDark;
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${mState.sampleName} · L = 1.00 m`, 24, 35);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('Drag amber line to measure h', 24, 54);
  }

  function stepMysteryAnimation(ts) {
    if (!mState.running) return;
    if (mState.lastTs === null) mState.lastTs = ts;
    const dt = Math.min(0.033, (ts - mState.lastTs) / 1000);
    mState.lastTs = ts;

    const params = getMysteryParams();
    const res = P.solveBallisticPendulum(params);

    if (mState.impactFlash > 0) {
      mState.impactFlash = Math.max(0, mState.impactFlash - dt * 3);
    }

    if (mState.phase === 'approach') {
      mState.ballX += params.initialVelocity * dt;
      if (mState.ballX >= 0) {
        mState.ballX = 0;
        mState.phase = 'swing';
        mState.theta = 0;
        mState.omega = res.postCollisionVelocity / M_ARM_LENGTH;
        mState.impactFlash = 1;
        mEl.phaseBadge.textContent = '2. Collision → 3. Swing';
        mEl.status.textContent = 'Captured! Watch for the peak height...';
      }
    } else if (mState.phase === 'swing') {
      const subSteps = 4;
      const subDt = dt / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const prevOmega = mState.omega;
        const next = P.stepPendulumRK4(mState.theta, mState.omega, M_ARM_LENGTH, P.DEFAULT_G, subDt);
        mState.theta = next.theta;
        mState.omega = next.omega;

        if (!mState.peakReached && prevOmega > 0 && mState.omega <= 0) {
          mState.peakReached = true;
          mState.peakTheta = mState.theta;
          if (mEl.pausePeak.checked) {
            mState.phase = 'peak-paused';
            mState.running = false;
            mState.omega = 0;
            mEl.phaseBadge.textContent = 'Paused at Peak — Measure h';
            mEl.status.innerHTML = 'Paused at peak! Drag the <strong>amber caliper line</strong> to the center of the catcher to measure <strong>h</strong>.';
            break;
          }
        }
      }
    }

    drawMysteryScene();
    if (mState.running) {
      mState.rafId = requestAnimationFrame(stepMysteryAnimation);
    }
  }

  function resetMystery() {
    if (mState.rafId) cancelAnimationFrame(mState.rafId);
    mState.phase = 'ready';
    mState.running = false;
    mState.ballX = -0.9;
    mState.theta = 0;
    mState.omega = 0;
    mState.impactFlash = 0;
    mState.peakReached = false;
    mState.peakTheta = null;
    mState.lastTs = null;
    mEl.phaseBadge.textContent = 'Ready';
    mEl.status.innerHTML = `${mState.sampleName} ready. Press <strong>Fire Ball</strong>, then measure peak height <strong>h</strong>.`;
    updateMysteryUI();
    drawMysteryScene();
  }

  function fireMystery() {
    resetMystery();
    mState.phase = 'approach';
    mState.running = true;
    mEl.phaseBadge.textContent = '1. Ball Approaching';
    mEl.status.textContent = 'Ball fired at given velocity v₀...';
    mState.rafId = requestAnimationFrame(stepMysteryAnimation);
  }

  // Pointer dragging for the height caliper on #m-canvas
  function updateCaliperFromPointer(e) {
    const rect = mEl.canvas.getBoundingClientRect();
    const scaleY = 400 / rect.height;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const { pxPerMeter, restBobY } = getMysteryGeometry();
    const hMeters = Math.max(0, Math.min(0.60, (restBobY - canvasY) / pxPerMeter));
    mEl.caliper.value = hMeters.toFixed(3);
    updateMysteryUI();
    drawMysteryScene();
  }

  mEl.canvas.addEventListener('pointerdown', (e) => {
    mState.draggingCaliper = true;
    mEl.canvas.setPointerCapture(e.pointerId);
    updateCaliperFromPointer(e);
  });

  mEl.canvas.addEventListener('pointermove', (e) => {
    if (!mState.draggingCaliper) return;
    updateCaliperFromPointer(e);
  });

  mEl.canvas.addEventListener('pointerup', (e) => {
    mState.draggingCaliper = false;
    if (mEl.canvas.hasPointerCapture(e.pointerId)) {
      mEl.canvas.releasePointerCapture(e.pointerId);
    }
  });

  [mEl.knownMass, mEl.vel].forEach((input) => {
    input.addEventListener('input', () => {
      resetMystery();
    });
  });

  mEl.caliper.addEventListener('input', () => {
    updateMysteryUI();
    drawMysteryScene();
  });

  mEl.mode.addEventListener('change', () => {
    mState.revealed = false;
    mEl.guessInput.value = '';
    mEl.feedback.className = 'check-feedback';
    mEl.feedback.textContent = 'Measure h at the peak, calculate v′ = √(2gh), then use momentum conservation to find the unknown mass.';
    if (mEl.mode.value === 'catcher') {
      mEl.knownMass.value = 63;
      mState.secretMassG = MYSTERY_SAMPLES.A.catcherG;
    } else {
      mEl.knownMass.value = 116;
      mState.secretMassG = MYSTERY_SAMPLES.A.ballG;
    }
    mState.sampleName = 'Sample A';
    resetMystery();
  });

  document.querySelectorAll('[data-m-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-m-sample');
      const sample = MYSTERY_SAMPLES[key];
      mState.sampleName = `Sample ${key}`;
      mState.revealed = false;
      mEl.guessInput.value = '';
      mEl.feedback.className = 'check-feedback';
      mEl.feedback.textContent = `${mState.sampleName} loaded. Fire the ball and measure h!`;
      if (mEl.mode.value === 'catcher') {
        mEl.knownMass.value = sample.ballG;
        mState.secretMassG = sample.catcherG;
      } else {
        mEl.knownMass.value = sample.catcherG;
        mState.secretMassG = sample.ballG;
      }
      resetMystery();
    });
  });

  mEl.randomBtn.addEventListener('click', () => {
    mState.sampleName = 'Random Mystery';
    mState.revealed = false;
    mEl.guessInput.value = '';
    mEl.feedback.className = 'check-feedback';
    mEl.feedback.textContent = 'New random mystery mass generated! Fire the ball and measure h.';
    if (mEl.mode.value === 'catcher') {
      mState.secretMassG = Math.floor(65 + Math.random() * 180);
    } else {
      mState.secretMassG = Math.floor(30 + Math.random() * 90);
    }
    resetMystery();
  });

  mEl.fireBtn.addEventListener('click', fireMystery);
  mEl.resetBtn.addEventListener('click', resetMystery);

  mEl.checkBtn.addEventListener('click', () => {
    const guess = parseFloat(mEl.guessInput.value);
    if (!Number.isFinite(guess) || guess <= 0) {
      mEl.feedback.className = 'check-feedback warn';
      mEl.feedback.textContent = 'Please enter a positive mass in grams.';
      return;
    }
    const actual = mState.secretMassG;
    const pctError = Math.abs(guess - actual) / actual;
    if (pctError <= 0.03) {
      mState.revealed = true;
      mEl.feedback.className = 'check-feedback ok';
      mEl.feedback.textContent = `Correct! Your calculated mass (${guess.toFixed(1)} g) matches the actual mass (${actual} g) within ±3%.`;
      drawMysteryScene();
    } else {
      mEl.feedback.className = 'check-feedback warn';
      mEl.feedback.textContent = `Not quite (${guess.toFixed(1)} g). Double-check: (1) align the caliper with the peak center, (2) v′ = √(2gh), and (3) m_b v₀ = (m_b + m_c) v′.`;
    }
  });

  mEl.revealBtn.addEventListener('click', () => {
    mState.revealed = true;
    const label = mEl.mode.value === 'catcher' ? 'catcher mass m_c' : 'ball mass m_b';
    mEl.feedback.className = 'check-feedback ok';
    mEl.feedback.textContent = `Revealed: The ${mState.sampleName} ${label} is ${mState.secretMassG} g.`;
    drawMysteryScene();
  });

  mEl.recordBtn.addEventListener('click', () => {
    const v0 = parseFloat(mEl.vel.value);
    const calH = parseFloat(mEl.caliper.value);
    const vPrime = Math.sqrt(2 * P.DEFAULT_G * calH);
    const ratio = vPrime > 0 && vPrime < v0 ? (v0 / vPrime - 1).toFixed(2) : '—';

    mState.trials.push({
      n: mState.trials.length + 1,
      sample: mState.sampleName,
      v0: v0.toFixed(1),
      h: calH.toFixed(3),
      vp: vPrime.toFixed(2),
      ratio,
    });
    mEl.trialsBody.innerHTML = mState.trials
      .map(
        (t) => `<tr>
          <td>${t.n}</td><td>${t.sample}</td><td>${t.v0}</td>
          <td><strong>${t.h}</strong></td><td>${t.vp}</td><td>${t.ratio}</td>
        </tr>`
      )
      .join('');
  });

  mEl.clearTrialsBtn.addEventListener('click', () => {
    mState.trials = [];
    mEl.trialsBody.innerHTML =
      '<tr class="empty-row"><td colspan="6">No measurements recorded yet. Fire a shot, align the caliper, and click <strong>Record Measurement</strong>.</td></tr>';
  });

  // Initial render
  updatePendulumUI();
  drawPendulumScene();
  updateRampUI();
  drawRampScene();
  updateMysteryUI();
  drawMysteryScene();
})();
