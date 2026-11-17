const test = require('node:test');
const assert = require('node:assert/strict');
const {
  solveBallisticPendulum,
  stepPendulumRK4,
  solveRampCollisionSlide,
  stepRampRK4,
  solveUnknownCatcherMass,
  solveUnknownBallMass,
} = require('../src/js/physics.js');

test('Ballistic Pendulum: default classroom problem (63 g at 4 m/s into 116 g catcher)', () => {
  const res = solveBallisticPendulum({
    ballMassKg: 0.063,
    catcherMassKg: 0.116,
    initialVelocity: 4.0,
    armLength: 1.0,
    g: 9.8,
  });

  // p_i = 0.063 * 4 = 0.252 kg*m/s
  assert.ok(Math.abs(res.initialMomentum - 0.252) < 1e-9);
  // v' = 0.252 / 0.179 ≈ 1.407821 m/s
  assert.ok(Math.abs(res.postCollisionVelocity - 0.252 / 0.179) < 1e-9);
  // h = v'^2 / (2 * 9.8) ≈ 0.101120 m (10.11 cm)
  const expectedH = Math.pow(0.252 / 0.179, 2) / (2 * 9.8);
  assert.ok(Math.abs(res.maxHeight - expectedH) < 1e-9);
  assert.ok(Math.abs(res.maxHeightCm - expectedH * 100) < 1e-7);
  // Energy is NOT conserved in collision: KE_i = 0.504 J, KE_after ≈ 0.177385 J
  assert.ok(Math.abs(res.initialKE - 0.504) < 1e-9);
  assert.ok(res.collisionEnergyLoss > 0.32 && res.collisionEnergyLoss < 0.33);
  assert.equal(res.loopsOverTop, false);
});

test('Ballistic Pendulum: zero initial velocity gives zero height', () => {
  const res = solveBallisticPendulum({
    ballMassKg: 0.05,
    catcherMassKg: 0.2,
    initialVelocity: 0,
    armLength: 1.0,
  });
  assert.equal(res.postCollisionVelocity, 0);
  assert.equal(res.maxHeight, 0);
  assert.equal(res.maxAngleDeg, 0);
});

test('Ballistic Pendulum: RK4 swing conserves mechanical energy and reaches expected peak', () => {
  const armLength = 1.0;
  const g = 9.8;
  const vAfter = 0.252 / 0.179;
  const expectedMaxTheta = Math.acos(1 - (vAfter * vAfter) / (2 * g * armLength));

  let theta = 0;
  let omega = vAfter / armLength;
  let maxThetaSeen = 0;
  const dt = 0.001;

  for (let i = 0; i < 2000; i++) {
    const next = stepPendulumRK4(theta, omega, armLength, g, dt);
    theta = next.theta;
    omega = next.omega;
    if (theta > maxThetaSeen) maxThetaSeen = theta;
    if (omega <= 0) break;
  }

  assert.ok(Math.abs(maxThetaSeen - expectedMaxTheta) < 1e-4);
});

test('Ramp + Collision + Friction Slide: default classroom problem (12 kg, R=1m, 8 kg, mu=0.2)', () => {
  const res = solveRampCollisionSlide({
    m1Kg: 12,
    m2Kg: 8,
    radius: 1.0,
    mu: 0.2,
    g: 9.8,
  });

  // v1 = sqrt(2 * 9.8 * 1) = sqrt(19.6) ≈ 4.427189 m/s
  assert.ok(Math.abs(res.speedBeforeCollision - Math.sqrt(19.6)) < 1e-9);
  // v2 = (12 / 20) * sqrt(19.6) ≈ 2.656313 m/s
  assert.ok(Math.abs(res.postCollisionVelocity - 0.6 * Math.sqrt(19.6)) < 1e-9);
  // d = v2^2 / (2 * mu * g) = (0.36 * 19.6) / (2 * 0.2 * 9.8) = 1.80 m exact!
  assert.ok(Math.abs(res.stoppingDistance - 1.8) < 1e-9);
  // W_f = -f_k * d = -0.2 * 20 * 9.8 * 1.8 = -70.56 J
  assert.ok(Math.abs(res.workByFriction - (-70.56)) < 1e-9);
  // Initial PE = 12 * 9.8 * 1 = 117.6 J; 40% lost in collision = 47.04 J
  assert.ok(Math.abs(res.initialPE - 117.6) < 1e-9);
  assert.ok(Math.abs(res.collisionEnergyLoss - 47.04) < 1e-9);
});

test('Ramp RK4 reaches bottom with expected speed sqrt(2gR)', () => {
  const radius = 1.0;
  const g = 9.8;
  let phi = 0;
  let omega = 0;
  const dt = 0.0005;

  while (phi < Math.PI / 2) {
    const next = stepRampRK4(phi, omega, radius, g, dt);
    phi = next.phi;
    omega = next.omega;
  }

  const speed = omega * radius;
  const expected = Math.sqrt(2 * g * radius);
  assert.ok(Math.abs(speed - expected) < 0.01);
});

test('Physics validators reject non-positive masses or lengths', () => {
  assert.throws(() =>
    solveBallisticPendulum({
      ballMassKg: 0,
      catcherMassKg: 0.1,
      initialVelocity: 4,
      armLength: 1,
    })
  );
  assert.throws(() =>
    solveRampCollisionSlide({
      m1Kg: 12,
      m2Kg: 8,
      radius: 1,
      mu: 0,
    })
  );
});

test('Inverse Ballistic Pendulum: recover unknown catcher mass and ball mass from measured height', () => {
  const forward = solveBallisticPendulum({
    ballMassKg: 0.063,
    catcherMassKg: 0.116,
    initialVelocity: 4.0,
    armLength: 1.0,
    g: 9.8,
  });

  const invCatcher = solveUnknownCatcherMass({
    ballMassKg: 0.063,
    initialVelocity: 4.0,
    measuredHeight: forward.maxHeight,
    g: 9.8,
  });
  assert.ok(Math.abs(invCatcher.catcherMassKg - 0.116) < 1e-9);

  const invBall = solveUnknownBallMass({
    catcherMassKg: 0.116,
    initialVelocity: 4.0,
    measuredHeight: forward.maxHeight,
    g: 9.8,
  });
  assert.ok(Math.abs(invBall.ballMassKg - 0.063) < 1e-9);
});
