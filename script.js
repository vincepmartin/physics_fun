window.onload = () => {
  console.log("Window loaded...");

  // create the box that contains our world.
  const createSandBox = () => {
    return [
      {
        x: window.innerWidth / 2,
        y: 0,
        w: window.innerWidth,
        l: 10,
        options: { isStatic: true },
      },
      {
        x: 0,
        y: window.innerHeight / 2,
        w: 10,
        l: window.innerHeight,
        options: { isStatic: true },
      },
      {
        x: window.innerWidth / 2,
        y: window.innerHeight,
        w: window.innerWidth,
        l: 10,
        options: { isStatic: true },
      },
      {
        x: window.innerWidth,
        y: window.innerHeight / 2,
        w: 10,
        l: window.innerHeight,
        options: { isStatic: true },
      },
    ].map((i) => new Bodies.rectangle(i.x, i.y, i.w, i.l, i.options));
  };

  // module aliases
  var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events;

  // create an engine
  var engine = Engine.create({
    gravity: { x: 0.0, y: 0.5 },
  });

  // create a renderer
  var render = Render.create({
    element: document.querySelector(".game"),
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });

  Events.on(render, "afterRender", (event) => {
    console.log("*** afterEvent ***");
    console.log(render.context);
    console.log(event);
    const context = render.context;

    for (const body of world.bodies) {
      if (body.character) {
        context.save();
        context.translate(body.position.x, body.position.y);
        context.rotate(body.angle);
        context.fillText(body.character, 0, 0);
        context.restore();
      }
    }
  });

  // Keep track of objects in the world.
  const bodyBox = [
    Bodies.polygon(400, 300, 3, 35, { velocity: { x: 1, y: 1 } }),
  ];

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
    console.log("Key hit: ");
    console.log(event.key);
    console.log(bodyBox);

    if (event.key === "Backspace") {
      console.log("Removing an item...");
      const oldBody = bodyBox.pop();
      Composite.remove(engine.world, oldBody);
      return;
    } else {
      console.log("Adding a new item...");
      const newBody = Bodies.rectangle(400, 200, 80, 80);
      newBody.character = event.key;
      bodyBox.push(newBody);
      Composite.add(engine.world, newBody);
    }
    console.log("*** done ***");
    console.log(bodyBox);
  });
};
