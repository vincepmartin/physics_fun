window.onload = () => {
  console.log("Window loaded...");

  const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;
  const charWidth = 30;

  const worldState = {
    cursor: {
      x: charWidth,
      y: window.innerHeight - charWidth,
      increment: (onHitEnd) => {
        worldState.cursor.x =
          worldState.cursor.x + charWidth <= window.innerWidth - charWidth
            ? worldState.cursor.x + charWidth
            : onHitEnd();
      },
      newLine: () => {
        while (
          worldState.cursor.x <= window.innerWidth - charWidth &&
          worldState.cursor.x >= charWidth
        ) {
          let newBody = Bodies.rectangle(
            worldState.cursor.x,
            worldState.cursor.y,
            charWidth,
            charWidth,
            { render: { strokeStyle: "black", fillStyle: "black" } },
          );
          newBody.character = " ";
          console.log("Adding new body...");
          console.log(newBody);
          bodyBox.push(newBody);
          Composite.add(engine.world, newBody);
          worldState.cursor.increment(() => worldState.cursor.x + charWidth);
        }
        worldState.cursor.carriageReturn();
      },
      carriageReturn: () => {
        worldState.cursor.x = charWidth;
      },
      backSpace: () => {
        worldState.cursor.x =
          worldState.cursor.x - charWidth >= 0
            ? worldState.cursor.x - charWidth
            : charWidth;
      },
    },
  };

  // create the box that contains our world.
  const createSandBox = () => {
    return [
      {
        x: window.innerWidth / 2,
        y: 0,
        w: window.innerWidth,
        l: 20,
        options: { isStatic: true },
      },
      {
        x: 0,
        y: window.innerHeight / 2,
        w: 20,
        l: window.innerHeight,
        options: { isStatic: true },
      },
      {
        x: window.innerWidth / 2,
        y: window.innerHeight,
        w: window.innerWidth,
        l: 20,
        options: { isStatic: true },
      },
      {
        x: window.innerWidth,
        y: window.innerHeight / 2,
        w: 20,
        l: window.innerHeight,
        options: { isStatic: true },
      },
    ].map((i) => new Bodies.rectangle(i.x, i.y, i.w, i.l, i.options));
  };

  // create an engine
  var engine = Engine.create({
    gravity: { x: 0.0, y: -1.5 },
  });

  // create a renderer
  var render = Render.create({
    element: document.querySelector(".game"),
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "black",
    },
  });

  // Custom render function to put character in box.
  Events.on(render, "afterRender", () => {
    const context = render.context;
    context.fillStyle = "white";
    context.font = "bold 28px sans-serif";
    for (const body of engine.world.bodies) {
      if (body.character) {
        context.save();
        context.translate(body.position.x, body.position.y);
        context.rotate(body.angle);
        context.fillText(body.character, -10, 10);
        context.restore();
      }
    }
  });

  // Keep track of objects in the world.
  const bodyBox = [];

  Composite.add(engine.world, [...bodyBox, ...createSandBox()]);

  // run the renderer
  Render.run(render);

  // create runner
  var runner = Runner.create();

  // run the engine
  Runner.run(runner, engine);

  // Attach my key listeners...
  document.addEventListener("keydown", (event) => {
    event.preventDefault();

    if (event.key === "Backspace") {
      const oldBody = bodyBox.pop();
      Composite.remove(engine.world, oldBody);
      worldState.cursor.backSpace();
      return;
    } else if (event.key === "Enter") {
      worldState.cursor.newLine();
      return;
    } else if (event.key !== "Shift") {
      const newBody = Bodies.rectangle(
        worldState.cursor.x,
        worldState.cursor.y,
        charWidth,
        charWidth,
        { render: { strokeStyle: "black", fillStyle: "black" } },
      );
      newBody.character = event.key;
      bodyBox.push(newBody);
      Composite.add(engine.world, newBody);
      worldState.cursor.increment(() => charWidth);
    }
  });
};
