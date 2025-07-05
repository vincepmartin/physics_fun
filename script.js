window.onload = () => {
  console.log("Window loaded...");
  console.log("🌟 TIP: You can drag the sun portal around with your mouse!");
  alert(
    "Welcome! You can drag the bright sun portal around with your mouse to move where new letters spawn from.",
  );

  const { Engine, Render, Runner, Body, Bodies, Composite, Events } = Matter;
  const charWidth = 30;
  const lineHeight = 40;
  const leftMargin = 50;
  const topMargin = 50;

  // Text editor state
  let textContent = "";
  let cursorPosition = 0;
  let cursorX = leftMargin;
  let cursorY = topMargin;
  const maxLineWidth = window.innerWidth - leftMargin * 2;
  const charsPerLine = Math.floor(maxLineWidth / charWidth);

  // WebGL setup for jet flame effects
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "10";
  document.querySelector(".game").appendChild(canvas);

  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  // Vertex shader for jet flame particles
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute float a_size;
    attribute float a_alpha;
    uniform vec2 u_resolution;
    varying float v_alpha;
    
    void main() {
      vec2 zeroToOne = a_position / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      gl_PointSize = a_size;
      v_alpha = a_alpha;
    }
  `;

  // Fragment shader for vibrant jet flame effect
  const fragmentShaderSource = `
    precision mediump float;
    varying float v_alpha;
    
    void main() {
      vec2 coord = gl_PointCoord - 0.5;
      float dist = length(coord);
      float alpha = smoothstep(0.5, 0.0, dist) * v_alpha;
      
      // Create vibrant jet flame effect with hot colors
      vec3 innerColor = vec3(1.0, 0.8, 0.2); // Hot yellow/orange
      vec3 outerColor = vec3(1.0, 0.2, 0.1); // Hot red
      vec3 tipColor = vec3(0.2, 0.4, 1.0);   // Blue flame tip
      
      vec3 color = mix(innerColor, outerColor, dist);
      color = mix(color, tipColor, dist * dist);
      
      gl_FragColor = vec4(color, alpha);
    }
  `;

  // Compile shader
  function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  // Create WebGL program
  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    fragmentShaderSource,
    gl.FRAGMENT_SHADER,
  );
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // Get attribute and uniform locations
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const sizeAttributeLocation = gl.getAttribLocation(program, "a_size");
  const alphaAttributeLocation = gl.getAttribLocation(program, "a_alpha");
  const resolutionUniformLocation = gl.getUniformLocation(
    program,
    "u_resolution",
  );

  // Create buffers
  const positionBuffer = gl.createBuffer();
  const sizeBuffer = gl.createBuffer();
  const alphaBuffer = gl.createBuffer();

  // Jet flame particle system
  const jetFlames = new Map(); // Map body ID to flame particles
  const maxFlameLength = 30;

  class FlameParticle {
    constructor(x, y, velocityX, velocityY) {
      this.x = x;
      this.y = y;
      this.velocityX = velocityX * -0.5; // Flames go opposite to movement
      this.velocityY = velocityY * -0.5;
      this.age = 0;
      this.maxAge = 45; // frames
      this.size = Math.random() * 12 + 8;
    }

    update() {
      this.x += this.velocityX;
      this.y += this.velocityY;
      this.velocityX *= 0.98; // Slow down
      this.velocityY *= 0.98;
      this.age++;
      return this.age < this.maxAge;
    }

    getAlpha() {
      return (1 - this.age / this.maxAge) * 0.9;
    }
  }

  function updateJetFlames() {
    // Update existing flames
    for (const [bodyId, flames] of jetFlames.entries()) {
      for (let i = flames.length - 1; i >= 0; i--) {
        if (!flames[i].update()) {
          flames.splice(i, 1);
        }
      }
      if (flames.length === 0) {
        jetFlames.delete(bodyId);
      }
    }

    // Add new flame particles for each moving body
    for (const body of engine.world.bodies) {
      if (body.character && body.character !== " ") {
        const speed = Math.sqrt(
          body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y,
        );

        if (speed > 0.1) {
          // Only create flames if moving
          if (!jetFlames.has(body.id)) {
            jetFlames.set(body.id, []);
          }
          const flames = jetFlames.get(body.id);

          // Add multiple flame particles for more vibrant effect
          for (let i = 0; i < 3; i++) {
            const offsetX = (Math.random() - 0.5) * 8;
            const offsetY = charWidth / 2 + Math.random() * 5;
            flames.push(
              new FlameParticle(
                body.position.x + offsetX,
                body.position.y + offsetY,
                body.velocity.x,
                body.velocity.y,
              ),
            );
          }

          // Limit flame length
          if (flames.length > maxFlameLength) {
            flames.splice(0, flames.length - maxFlameLength);
          }
        }
      }
    }
  }

  function renderJetFlames() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(program);
    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);

    // Collect all flame particles
    const positions = [];
    const sizes = [];
    const alphas = [];

    for (const flames of jetFlames.values()) {
      for (const particle of flames) {
        positions.push(particle.x, particle.y);
        sizes.push(particle.size);
        alphas.push(particle.getAlpha());
      }
    }

    if (positions.length > 0) {
      // Update position buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.DYNAMIC_DRAW,
      );
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(
        positionAttributeLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      // Update size buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(sizeAttributeLocation);
      gl.vertexAttribPointer(sizeAttributeLocation, 1, gl.FLOAT, false, 0, 0);

      // Update alpha buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphas), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(alphaAttributeLocation);
      gl.vertexAttribPointer(alphaAttributeLocation, 1, gl.FLOAT, false, 0, 0);

      // Draw particles
      gl.drawArrays(gl.POINTS, 0, positions.length / 2);
    }
  }

  // Center sun portal
  const sunPortal = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    radius: 50,
    rotation: 0,
    pulsePhase: 0,
  };

  // Mouse interaction for dragging the sun portal
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function isMouseOverPortal(mouseX, mouseY) {
    const dx = mouseX - sunPortal.x;
    const dy = mouseY - sunPortal.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= sunPortal.radius * 2; // Larger hit area for easier dragging
  }

  document.addEventListener("mousedown", (event) => {
    const rect = document.querySelector(".game").getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isMouseOverPortal(mouseX, mouseY)) {
      isDragging = true;
      dragOffset.x = mouseX - sunPortal.x;
      dragOffset.y = mouseY - sunPortal.y;
      document.body.style.cursor = "grabbing";
    }
  });

  document.addEventListener("mousemove", (event) => {
    const rect = document.querySelector(".game").getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isDragging) {
      sunPortal.x = mouseX - dragOffset.x;
      sunPortal.y = mouseY - dragOffset.y;
    } else if (isMouseOverPortal(mouseX, mouseY)) {
      document.body.style.cursor = "grab";
    } else {
      document.body.style.cursor = "default";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.cursor = "default";
  });

  // Cursor portal (smaller, green)
  const cursorPortal = {
    x: cursorX,
    y: cursorY,
    radius: 20,
    rotation: 0,
    pulsePhase: 0,
  };

  // Sun orbital objects
  class SunOrbital {
    constructor(distance, speed, size, color) {
      this.distance = distance;
      this.speed = speed;
      this.size = size;
      this.color = color;
      this.angle = Math.random() * Math.PI * 2;
    }

    update() {
      this.angle += this.speed;
    }

    getPosition() {
      return {
        x: sunPortal.x + Math.cos(this.angle) * this.distance,
        y: sunPortal.y + Math.sin(this.angle) * this.distance,
      };
    }
  }

  // Create orbital objects around the sun
  const sunOrbitals = [
    new SunOrbital(70, 0.02, 4, "#ff6b00"),
    new SunOrbital(75, -0.015, 3, "#ffaa00"),
    new SunOrbital(80, 0.025, 5, "#ff8800"),
    new SunOrbital(85, -0.018, 3, "#ffdd00"),
    new SunOrbital(90, 0.012, 4, "#ff9900"),
    new SunOrbital(95, -0.022, 2, "#ffbb00"),
    new SunOrbital(100, 0.016, 3, "#ff7700"),
    new SunOrbital(105, -0.019, 4, "#ffcc00"),
  ];

  // Portal particle system
  class PortalParticle {
    constructor(x, y, angle, distance) {
      this.baseX = x;
      this.baseY = y;
      this.angle = angle;
      this.distance = distance;
      this.life = Math.random() * 60 + 30;
      this.maxLife = this.life;
      this.speed = Math.random() * 0.02 + 0.01;
    }

    update() {
      this.angle += this.speed;
      this.life--;
      return this.life > 0;
    }

    getPosition() {
      return {
        x: this.baseX + Math.cos(this.angle) * this.distance,
        y: this.baseY + Math.sin(this.angle) * this.distance,
      };
    }

    getAlpha() {
      return (this.life / this.maxLife) * 0.7;
    }
  }

  const portalParticles = [];
  const cursorParticles = [];

  function updatePortalParticles() {
    // Update existing particles
    for (let i = portalParticles.length - 1; i >= 0; i--) {
      if (!portalParticles[i].update()) {
        portalParticles.splice(i, 1);
      }
    }

    // Add new particles for sun rays
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 35 + Math.random() * 20;
      portalParticles.push(
        new PortalParticle(sunPortal.x, sunPortal.y, angle, distance),
      );
    }

    // Update cursor particles
    for (let i = cursorParticles.length - 1; i >= 0; i--) {
      if (!cursorParticles[i].update()) {
        cursorParticles.splice(i, 1);
      }
    }

    // Add new cursor particles
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 10;
      cursorParticles.push(
        new PortalParticle(cursorPortal.x, cursorPortal.y, angle, distance),
      );
    }
  }

  // Text layout functions
  function getCharacterPosition(index) {
    const line = Math.floor(index / charsPerLine);
    const column = index % charsPerLine;
    return {
      x: leftMargin + column * charWidth,
      y: topMargin + line * lineHeight,
    };
  }

  function updateCursorPosition() {
    const pos = getCharacterPosition(cursorPosition);
    cursorPortal.x = pos.x;
    cursorPortal.y = pos.y;
  }

  // Function to recalculate all text indices based on current text content
  function recalculateTextIndices() {
    // Create a map of characters to their positions in the text
    const charPositions = [];
    for (let i = 0; i < textContent.length; i++) {
      charPositions.push({
        char: textContent[i],
        index: i,
        assigned: false,
      });
    }

    // Reset all body text indices
    for (const body of bodyBox) {
      body.textIndex = -1; // Mark as unassigned
    }

    // Assign text indices to bodies based on their characters
    for (const body of bodyBox) {
      if (body.character) {
        // Find the first unassigned position for this character
        for (let i = 0; i < charPositions.length; i++) {
          if (
            !charPositions[i].assigned &&
            charPositions[i].char === body.character
          ) {
            body.textIndex = charPositions[i].index;
            charPositions[i].assigned = true;
            break;
          }
        }
      }
    }

    // Remove bodies that don't have a corresponding character in the text
    for (let i = bodyBox.length - 1; i >= 0; i--) {
      if (bodyBox[i].textIndex === -1) {
        const oldBody = bodyBox[i];
        jetFlames.delete(oldBody.id);
        Composite.remove(engine.world, oldBody);
        bodyBox.splice(i, 1);
      }
    }
  }

  // Enhanced magnetic attraction system (with reduced forces)
  function applyMagneticForces() {
    for (let i = 0; i < bodyBox.length; i++) {
      const body = bodyBox[i];
      if (!body.character || body.textIndex === -1) continue;

      // Keep letters upright
      Body.setAngle(body, 0);
      Body.setAngularVelocity(body, 0);

      const targetPos = getCharacterPosition(body.textIndex);
      const dx = targetPos.x - body.position.x;
      const dy = targetPos.y - body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Teleport letters back if they go too far off screen
      const maxDistance = Math.max(window.innerWidth, window.innerHeight) * 1.5;
      if (distance > maxDistance) {
        // Teleport closer to target with some random offset
        const newX = targetPos.x + (Math.random() - 0.5) * 200;
        const newY = targetPos.y + (Math.random() - 0.5) * 200;
        Body.setPosition(body, { x: newX, y: newY });
        Body.setVelocity(body, { x: 0, y: 0 });
        return;
      }

      if (distance > 5) {
        // Reduced magnetic force that scales with distance
        let forceStrength;
        if (distance < 100) {
          forceStrength = Math.min(distance * 0.0003, 0.02); // Reduced from 0.0008 and 0.05
        } else if (distance < 500) {
          forceStrength = Math.min(distance * 0.0006, 0.04); // Reduced from 0.0015 and 0.1
        } else {
          // Reduced very strong force for very distant letters
          forceStrength = Math.min(distance * 0.001, 0.08); // Reduced from 0.003 and 0.3
        }

        const forceX = (dx / distance) * forceStrength;
        const forceY = (dy / distance) * forceStrength;

        Body.applyForce(body, body.position, { x: forceX, y: forceY });

        // Stronger damping when close to target
        if (distance < 50) {
          Body.setVelocity(body, {
            x: body.velocity.x * 0.7, // Increased damping from 0.85
            y: body.velocity.y * 0.7,
          });
        }
      }
    }
  }

  // create the boundary walls (larger space)
  const createSpaceBoundaries = () => {
    const thickness = 20;
    const padding = 100;
    return [
      // Top wall
      Bodies.rectangle(
        window.innerWidth / 2,
        -padding,
        window.innerWidth + padding * 2,
        thickness,
        { isStatic: true, render: { fillStyle: "#333" } },
      ),
      // Bottom wall
      Bodies.rectangle(
        window.innerWidth / 2,
        window.innerHeight + padding,
        window.innerWidth + padding * 2,
        thickness,
        { isStatic: true, render: { fillStyle: "#333" } },
      ),
      // Left wall
      Bodies.rectangle(
        -padding,
        window.innerHeight / 2,
        thickness,
        window.innerHeight + padding * 2,
        { isStatic: true, render: { fillStyle: "#333" } },
      ),
      // Right wall
      Bodies.rectangle(
        window.innerWidth + padding,
        window.innerHeight / 2,
        thickness,
        window.innerHeight + padding * 2,
        { isStatic: true, render: { fillStyle: "#333" } },
      ),
    ];
  };

  // create an engine with zero gravity (space-like)
  var engine = Engine.create({
    gravity: { x: 0, y: 0 }, // Zero gravity for space effect
  });

  // create a renderer
  var render = Render.create({
    element: document.querySelector(".game"),
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "#000011", // Deep space color
    },
  });

  Events.on(render, "afterRender", () => {
    const context = render.context;

    // Apply magnetic forces
    applyMagneticForces();

    // Update portal animations
    sunPortal.rotation += 0.01;
    sunPortal.pulsePhase += 0.08;
    cursorPortal.rotation += 0.03;
    cursorPortal.pulsePhase += 0.12;

    // Update orbital objects
    sunOrbitals.forEach((orbital) => orbital.update());

    const sunPulse = Math.sin(sunPortal.pulsePhase) * 0.2 + 0.8;
    const cursorPulse = Math.sin(cursorPortal.pulsePhase) * 0.3 + 0.7;

    // Draw bright sun portal
    context.save();
    context.translate(sunPortal.x, sunPortal.y);

    // Outer bright glow (largest)
    const outerGlow = context.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      sunPortal.radius * 3,
    );
    outerGlow.addColorStop(0, `rgba(255, 255, 100, ${0.4 * sunPulse})`);
    outerGlow.addColorStop(0.3, `rgba(255, 200, 0, ${0.2 * sunPulse})`);
    outerGlow.addColorStop(0.6, `rgba(255, 100, 0, ${0.1 * sunPulse})`);
    outerGlow.addColorStop(1, "rgba(255, 50, 0, 0)");
    context.fillStyle = outerGlow;
    context.fillRect(
      -sunPortal.radius * 3,
      -sunPortal.radius * 3,
      sunPortal.radius * 6,
      sunPortal.radius * 6,
    );

    // Middle bright glow
    const middleGlow = context.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      sunPortal.radius * 1.5,
    );
    middleGlow.addColorStop(0, `rgba(255, 255, 200, ${0.8 * sunPulse})`);
    middleGlow.addColorStop(0.5, `rgba(255, 220, 50, ${0.6 * sunPulse})`);
    middleGlow.addColorStop(1, `rgba(255, 150, 0, ${0.2 * sunPulse})`);
    context.fillStyle = middleGlow;
    context.beginPath();
    context.arc(0, 0, sunPortal.radius * 1.5, 0, Math.PI * 2);
    context.fill();

    // Sun rays (rotating)
    context.save();
    context.rotate(sunPortal.rotation);
    context.strokeStyle = `rgba(255, 255, 150, ${0.6 * sunPulse})`;
    context.lineWidth = 3;
    context.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x1 = Math.cos(angle) * (sunPortal.radius * 0.8);
      const y1 = Math.sin(angle) * (sunPortal.radius * 0.8);
      const x2 = Math.cos(angle) * (sunPortal.radius * 2.2);
      const y2 = Math.sin(angle) * (sunPortal.radius * 2.2);
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
    }
    context.stroke();
    context.restore();

    // Shorter rays (opposite rotation)
    context.save();
    context.rotate(-sunPortal.rotation * 0.7);
    context.strokeStyle = `rgba(255, 200, 100, ${0.4 * sunPulse})`;
    context.lineWidth = 2;
    context.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(angle) * (sunPortal.radius * 0.6);
      const y1 = Math.sin(angle) * (sunPortal.radius * 0.6);
      const x2 = Math.cos(angle) * (sunPortal.radius * 1.5);
      const y2 = Math.sin(angle) * (sunPortal.radius * 1.5);
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
    }
    context.stroke();
    context.restore();

    // Bright core
    const coreGradient = context.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      sunPortal.radius * 0.6,
    );
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * sunPulse})`);
    coreGradient.addColorStop(0.4, `rgba(255, 255, 100, ${0.8 * sunPulse})`);
    coreGradient.addColorStop(0.8, `rgba(255, 200, 0, ${0.6 * sunPulse})`);
    coreGradient.addColorStop(1, `rgba(255, 100, 0, ${0.3 * sunPulse})`);
    context.fillStyle = coreGradient;
    context.beginPath();
    context.arc(0, 0, sunPortal.radius * 0.6, 0, Math.PI * 2);
    context.fill();

    context.restore();

    // Draw orbital objects around the sun
    sunOrbitals.forEach((orbital) => {
      const pos = orbital.getPosition();
      context.save();
      context.fillStyle = orbital.color;
      context.shadowColor = orbital.color;
      context.shadowBlur = 8;
      context.beginPath();
      context.arc(pos.x, pos.y, orbital.size, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    // Draw cursor portal with green glow effect
    context.save();
    context.translate(cursorPortal.x, cursorPortal.y);

    // Outer glow
    const cursorOuterGlow = context.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      cursorPortal.radius * 2,
    );
    cursorOuterGlow.addColorStop(0, `rgba(0, 255, 100, ${0.3 * cursorPulse})`);
    cursorOuterGlow.addColorStop(
      0.5,
      `rgba(0, 200, 100, ${0.1 * cursorPulse})`,
    );
    cursorOuterGlow.addColorStop(1, "rgba(0, 150, 50, 0)");
    context.fillStyle = cursorOuterGlow;
    context.fillRect(
      -cursorPortal.radius * 2,
      -cursorPortal.radius * 2,
      cursorPortal.radius * 4,
      cursorPortal.radius * 4,
    );

    // Rotating outer ring
    context.rotate(cursorPortal.rotation);
    context.strokeStyle = `rgba(0, 255, 150, ${0.8 * cursorPulse})`;
    context.lineWidth = 2;
    context.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x1 = Math.cos(angle) * (cursorPortal.radius - 3);
      const y1 = Math.sin(angle) * (cursorPortal.radius - 3);
      const x2 = Math.cos(angle) * (cursorPortal.radius + 3);
      const y2 = Math.sin(angle) * (cursorPortal.radius + 3);
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
    }
    context.stroke();

    // Inner rotating ring (opposite direction)
    context.rotate(-cursorPortal.rotation * 1.5);
    context.strokeStyle = `rgba(100, 255, 150, ${0.9 * cursorPulse})`;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, cursorPortal.radius * 0.6, 0, Math.PI * 2);
    context.stroke();

    // Portal center with energy effect
    const cursorCenterGradient = context.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      cursorPortal.radius * 0.4,
    );
    cursorCenterGradient.addColorStop(
      0,
      `rgba(200, 255, 200, ${0.2 * cursorPulse})`,
    );
    cursorCenterGradient.addColorStop(
      0.7,
      `rgba(0, 255, 100, ${0.4 * cursorPulse})`,
    );
    cursorCenterGradient.addColorStop(
      1,
      `rgba(0, 200, 50, ${0.1 * cursorPulse})`,
    );
    context.fillStyle = cursorCenterGradient;
    context.beginPath();
    context.arc(0, 0, cursorPortal.radius * 0.4, 0, Math.PI * 2);
    context.fill();

    context.restore();

    // Update and draw portal particles
    updatePortalParticles();

    // Draw sun portal particles (bright golden)
    for (const particle of portalParticles) {
      const pos = particle.getPosition();
      context.save();
      context.globalAlpha = particle.getAlpha();
      context.fillStyle = "#ffdd00";
      context.shadowColor = "#ffdd00";
      context.shadowBlur = 4;
      context.beginPath();
      context.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // Draw cursor portal particles
    for (const particle of cursorParticles) {
      const pos = particle.getPosition();
      context.save();
      context.globalAlpha = particle.getAlpha();
      context.fillStyle = "#00ff66";
      context.beginPath();
      context.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // Draw letters
    context.fillStyle = "white";
    context.font = "bold 28px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Custom render function to put character in box.
    for (const body of engine.world.bodies) {
      if (body.character) {
        context.save();
        context.translate(body.position.x, body.position.y);
        // Don't rotate the context since we want letters to stay upright
        context.fillText(body.character, 0, 0);
        context.restore();
      }
    }

    // Update and render jet flames
    updateJetFlames();
    renderJetFlames();
  });

  // Keep track of objects in the world.
  const bodyBox = [];

  Composite.add(engine.world, [...bodyBox, ...createSpaceBoundaries()]);

  // run the renderer
  Render.run(render);

  // create runner
  var runner = Runner.create();

  // run the engine
  Runner.run(runner, engine);

  // Function to spawn letter from center (with reduced initial force)
  function spawnLetter(character) {
    const angle = Math.random() * Math.PI * 2;
    const force = 0.08 + Math.random() * 0.12; // Significantly reduced from 0.3 + 0.5
    const velocityX = Math.cos(angle) * force;
    const velocityY = Math.sin(angle) * force;

    const newBody = Bodies.rectangle(
      sunPortal.x + (Math.random() - 0.5) * 20,
      sunPortal.y + (Math.random() - 0.5) * 20,
      charWidth,
      charWidth,
      {
        render: { strokeStyle: "white", fillStyle: "transparent" },
        restitution: 0.8,
        frictionAir: 0.03, // Increased air friction from 0.01 to help slow down
        density: 0.001,
        inertia: Infinity, // Prevent rotation
      },
    );

    newBody.character = character;

    // Apply initial velocity
    Body.setVelocity(newBody, { x: velocityX, y: velocityY });

    bodyBox.push(newBody);
    Composite.add(engine.world, newBody);

    // Update text content and cursor position
    textContent =
      textContent.substring(0, cursorPosition) +
      character +
      textContent.substring(cursorPosition);
    cursorPosition++;

    // Immediately assign text index to the new body
    newBody.textIndex = cursorPosition - 1;

    // Recalculate all text indices to ensure proper positioning
    recalculateTextIndices();
    updateCursorPosition();
  }

  // Attach key listeners for spawning letters
  document.addEventListener("keydown", (event) => {
    event.preventDefault();

    if (event.key === "Backspace") {
      if (cursorPosition > 0) {
        // Update text content and cursor position
        textContent =
          textContent.substring(0, cursorPosition - 1) +
          textContent.substring(cursorPosition);
        cursorPosition--;

        // Recalculate all text indices after text change
        recalculateTextIndices();
        updateCursorPosition();
      }
      return;
    } else if (event.key === "Enter") {
      spawnLetter("\n");
      return;
    } else if (event.key === " ") {
      spawnLetter(" ");
      return;
    } else if (event.key === "ArrowLeft") {
      if (cursorPosition > 0) {
        cursorPosition--;
        updateCursorPosition();
      }
      return;
    } else if (event.key === "ArrowRight") {
      if (cursorPosition < textContent.length) {
        cursorPosition++;
        updateCursorPosition();
      }
      return;
    } else if (event.key.length === 1) {
      // Only single characters
      spawnLetter(event.key);
    }
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Update sun portal position if it's off screen
    if (sunPortal.x > window.innerWidth || sunPortal.y > window.innerHeight) {
      sunPortal.x = window.innerWidth / 2;
      sunPortal.y = window.innerHeight / 2;
    }

    // Update cursor position
    updateCursorPosition();
  });

  // Initialize cursor position
  updateCursorPosition();
};
