# Physics Reference — Ballistic Pendulum & Ramp Collision Lab

This simulation models two classic two-stage and three-stage AP Physics 1 mechanics problems that combine **conservation of linear momentum** (during a perfectly inelastic collision) with **conservation of mechanical energy** and the **work-energy theorem**.

---

## Scenario 1: Ballistic Pendulum

### Stage 1 — Perfectly Inelastic Collision
A projectile ball of mass $m_b$ moving horizontally at speed $v_0$ embeds into a stationary pendulum catcher of mass $m_c$. Because the collision is brief and external horizontal forces are negligible, linear momentum is conserved:
$$m_b v_0 = (m_b + m_c) v' \implies v' = \frac{m_b v_0}{m_b + m_c}$$

Mechanical energy is **not** conserved during this impact; the kinetic energy dissipated into thermal and sound energy is:
$$\Delta E_{\text{th}} = \frac{1}{2} m_b v_0^2 - \frac{1}{2}(m_b + m_c) v'^2$$

### Stage 2 — Pendulum Swing
After capture, only gravity does work (tension is always perpendicular to velocity). Mechanical energy is conserved from the bottom ($y = 0$) to the maximum height $h$:
$$\frac{1}{2}(m_b + m_c)v'^2 = (m_b + m_c) g h \implies h = \frac{v'^2}{2g}$$

The maximum swing angle $\theta_{\max}$ for a massless pendulum arm of length $L$ satisfies:
$$h = L(1 - \cos\theta_{\max}) \implies \theta_{\max} = \arccos\!\left(1 - \frac{h}{L}\right)$$

### Default Classroom Example
- $m_b = 63\text{ g} = 0.063\text{ kg}$, $v_0 = 4.0\text{ m/s}$, $m_c = 116\text{ g} = 0.116\text{ kg}$, $g = 9.8\text{ m/s}^2$:
  - $v' = \frac{0.063 \times 4.0}{0.063 + 0.116} \approx 1.408\text{ m/s}$
  - $h = \frac{1.4078^2}{2 \times 9.8} \approx 0.1011\text{ m} \approx 10.1\text{ cm}$

---

## Scenario 2: Circular Ramp + Inelastic Collision + Friction Slide

### Stage 1 — Frictionless Circular Ramp
Mass $m_1$ is released from rest at the top of a frictionless quarter-circle ramp of radius $R$ (height $h_0 = R$):
$$m_1 g R = \frac{1}{2} m_1 v_1^2 \implies v_1 = \sqrt{2 g R}$$

### Stage 2 — Perfectly Inelastic Collision
At the bottom of the ramp, $m_1$ collides and sticks to stationary mass $m_2$:
$$m_1 v_1 = (m_1 + m_2) v_2 \implies v_2 = \frac{m_1}{m_1 + m_2} v_1$$

### Stage 3 — Sliding with Kinetic Friction
The combined mass $(m_1 + m_2)$ slides across a horizontal surface with kinetic friction coefficient $\mu$:
- Friction force: $f_k = \mu (m_1 + m_2) g$
- Work-Energy Theorem:
  $$W_f = -f_k d = \Delta KE = 0 - \frac{1}{2}(m_1 + m_2) v_2^2$$
- Stopping distance:
  $$d = \frac{v_2^2}{2 \mu g} = \frac{R}{\mu}\left(\frac{m_1}{m_1 + m_2}\right)^2$$

### Default Classroom Example
- $m_1 = 12\text{ kg}$, $R = 1.0\text{ m}$, $m_2 = 8\text{ kg}$, $\mu = 0.20$, $g = 9.8\text{ m/s}^2$:
  - $v_1 = \sqrt{2 \times 9.8 \times 1.0} \approx 4.427\text{ m/s}$
  - $v_2 = \frac{12}{20} v_1 \approx 2.656\text{ m/s}$
  - **(a) Stopping distance:** $d = \frac{1.0}{0.20} (0.6)^2 = 1.80\text{ m}$
  - **(b) Work by friction:** $W_f = -0.20 \times 20 \times 9.8 \times 1.80 = -70.56\text{ J}$

---

## Common Student Misconception
Students often attempt to skip the collision stage and set initial energy equal to final energy ($KE_i = PE_f$ in Tab 1, or $m_1 g R = f_k d$ in Tab 2). The **Live Energy Distribution** bar chart makes the missing thermal energy from the inelastic collision immediately visible.
