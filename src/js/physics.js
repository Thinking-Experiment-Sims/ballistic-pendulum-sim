(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BallisticPhysics = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_G = 9.8;

  /**
   * Compute all analytical quantities for the Ballistic Pendulum scenario.
   * All inputs in SI units (kg, m/s, m, m/s^2).
   *
   * @param {Object} params
   * @param {number} params.ballMassKg - Mass of projectile ball (kg), > 0
   * @param {number} params.catcherMassKg - Mass of pendulum catcher (kg), > 0
   * @param {number} params.initialVelocity - Initial horizontal velocity of ball (m/s), >= 0
   * @param {number} params.armLength - Length of massless pendulum arm (m), > 0
   * @param {number} [params.g=9.8] - Gravitational acceleration (m/s^2), > 0
   */
  function solveBallisticPendulum({
    ballMassKg,
    catcherMassKg,
    initialVelocity,
    armLength,
    g = DEFAULT_G,
  }) {
    if (ballMassKg <= 0 || catcherMassKg <= 0 || armLength <= 0 || g <= 0) {
      throw new Error('Masses, armLength, and g must be positive.');
    }
    if (initialVelocity < 0) {
      throw new Error('initialVelocity must be non-negative.');
    }

    const totalMass = ballMassKg + catcherMassKg;
    const initialMomentum = ballMassKg * initialVelocity;
    const postCollisionVelocity = initialMomentum / totalMass;

    const initialKE = 0.5 * ballMassKg * initialVelocity * initialVelocity;
    const postCollisionKE = 0.5 * totalMass * postCollisionVelocity * postCollisionVelocity;
    const collisionEnergyLoss = initialKE - postCollisionKE;
    const collisionLossFraction = initialKE > 0 ? collisionEnergyLoss / initialKE : 0;

    // Mechanical energy conservation during swing: (1/2) M v'^2 = M g h
    const idealMaxHeight = (postCollisionVelocity * postCollisionVelocity) / (2 * g);
    const loopsOverTop = idealMaxHeight > 2 * armLength;
    const maxHeight = Math.min(idealMaxHeight, 2 * armLength);

    // cos(theta) = 1 - h / L
    const cosTheta = Math.max(-1, Math.min(1, 1 - maxHeight / armLength));
    const maxAngleRad = Math.acos(cosTheta);
    const maxAngleDeg = (maxAngleRad * 180) / Math.PI;
    const finalPE = totalMass * g * maxHeight;

    return {
      ballMassKg,
      catcherMassKg,
      totalMass,
      initialVelocity,
      armLength,
      g,
      initialMomentum,
      postCollisionVelocity,
      initialKE,
      postCollisionKE,
      collisionEnergyLoss,
      collisionLossFraction,
      idealMaxHeight,
      maxHeight,
      maxHeightCm: maxHeight * 100,
      maxAngleRad,
      maxAngleDeg,
      finalPE,
      loopsOverTop,
    };
  }

  /**
   * Advance pendulum state (theta, omega) by dt using 4th-order Runge-Kutta (RK4)
   * for d^2(theta)/dt^2 = -(g / L) * sin(theta).
   *
   * @param {number} theta - Current angle from downward vertical (rad)
   * @param {number} omega - Current angular velocity (rad/s)
   * @param {number} armLength - Pendulum arm length (m)
   * @param {number} g - Gravitational acceleration (m/s^2)
   * @param {number} dt - Time step (s)
   * @returns {{ theta: number, omega: number }}
   */
  function stepPendulumRK4(theta, omega, armLength, g, dt) {
    const accel = (th) => -(g / armLength) * Math.sin(th);

    const k1Theta = omega;
    const k1Omega = accel(theta);

    const k2Theta = omega + 0.5 * dt * k1Omega;
    const k2Omega = accel(theta + 0.5 * dt * k1Theta);

    const k3Theta = omega + 0.5 * dt * k2Omega;
    const k3Omega = accel(theta + 0.5 * dt * k2Theta);

    const k4Theta = omega + dt * k3Omega;
    const k4Omega = accel(theta + dt * k3Theta);

    return {
      theta: theta + (dt / 6) * (k1Theta + 2 * k2Theta + 2 * k3Theta + k4Theta),
      omega: omega + (dt / 6) * (k1Omega + 2 * k2Omega + 2 * k3Omega + k4Omega),
    };
  }

  /**
   * Compute all analytical quantities for the Circular Ramp + Inelastic Collision + Friction Slide scenario.
   *
   * @param {Object} params
   * @param {number} params.m1Kg - Mass of object 1 dropped from top of ramp (kg), > 0
   * @param {number} params.m2Kg - Mass of stationary object 2 at bottom of ramp (kg), > 0
   * @param {number} params.radius - Radius of frictionless circular ramp (m), > 0
   * @param {number} params.mu - Coefficient of kinetic friction on flat surface, > 0
   * @param {number} [params.g=9.8] - Gravitational acceleration (m/s^2), > 0
   */
  function solveRampCollisionSlide({
    m1Kg,
    m2Kg,
    radius,
    mu,
    g = DEFAULT_G,
  }) {
    if (m1Kg <= 0 || m2Kg <= 0 || radius <= 0 || mu <= 0 || g <= 0) {
      throw new Error('Masses, radius, mu, and g must be positive.');
    }

    const totalMass = m1Kg + m2Kg;
    const initialPE = m1Kg * g * radius;

    // Stage 1: Frictionless circular ramp drop from height h = R
    const speedBeforeCollision = Math.sqrt(2 * g * radius);
    const keBeforeCollision = 0.5 * m1Kg * speedBeforeCollision * speedBeforeCollision;
    const momentumBeforeCollision = m1Kg * speedBeforeCollision;

    // Stage 2: Perfectly inelastic collision at bottom
    const postCollisionVelocity = momentumBeforeCollision / totalMass;
    const postCollisionKE = 0.5 * totalMass * postCollisionVelocity * postCollisionVelocity;
    const collisionEnergyLoss = keBeforeCollision - postCollisionKE;
    const collisionLossFraction = keBeforeCollision > 0 ? collisionEnergyLoss / keBeforeCollision : 0;

    // Stage 3: Friction slide to a stop
    const frictionForce = mu * totalMass * g;
    const deceleration = mu * g;
    const stoppingDistance = (postCollisionVelocity * postCollisionVelocity) / (2 * deceleration);
    const slideTime = postCollisionVelocity / deceleration;
    const workByFriction = -frictionForce * stoppingDistance; // Equals -postCollisionKE
    const thermalEnergyFriction = -workByFriction;

    return {
      m1Kg,
      m2Kg,
      totalMass,
      radius,
      mu,
      g,
      initialPE,
      speedBeforeCollision,
      keBeforeCollision,
      momentumBeforeCollision,
      postCollisionVelocity,
      postCollisionKE,
      collisionEnergyLoss,
      collisionLossFraction,
      frictionForce,
      deceleration,
      stoppingDistance,
      slideTime,
      workByFriction,
      thermalEnergyFriction,
    };
  }

  /**
   * Advance object m1 sliding down the quarter-circle frictionless ramp by dt using RK4.
   * Angle phi is measured from the top of the ramp (phi = 0 at top, phi = pi/2 at bottom).
   * d^2(phi)/dt^2 = (g / R) * cos(phi).
   *
   * @param {number} phi - Current ramp angle (rad), 0 <= phi <= pi/2
   * @param {number} omega - Current angular speed d(phi)/dt (rad/s)
   * @param {number} radius - Ramp radius (m)
   * @param {number} g - Gravitational acceleration (m/s^2)
   * @param {number} dt - Time step (s)
   * @returns {{ phi: number, omega: number }}
   */
  function stepRampRK4(phi, omega, radius, g, dt) {
    const accel = (p) => (g / radius) * Math.cos(p);

    const k1Phi = omega;
    const k1Omega = accel(phi);

    const k2Phi = omega + 0.5 * dt * k1Omega;
    const k2Omega = accel(phi + 0.5 * dt * k1Phi);

    const k3Phi = omega + 0.5 * dt * k2Omega;
    const k3Omega = accel(phi + 0.5 * dt * k2Phi);

    const k4Phi = omega + dt * k3Omega;
    const k4Omega = accel(phi + dt * k3Phi);

    return {
      phi: phi + (dt / 6) * (k1Phi + 2 * k2Phi + 2 * k3Phi + k4Phi),
      omega: omega + (dt / 6) * (k1Omega + 2 * k2Omega + 2 * k3Omega + k4Omega),
    };
  }

  return {
    DEFAULT_G,
    solveBallisticPendulum,
    stepPendulumRK4,
    solveRampCollisionSlide,
    stepRampRK4,
  };
});
