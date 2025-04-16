// flow field
let params = {
  oiliness: 0.4,
  soupLevel: 0.8,
  salt: 0.8,
  sweet: 0.2,
  acidity: 0.5,
  spice: 0.9,
  temperature: 0.7,
  numLines: 100,
  lineLength: 2000,
  stepSize: 6,
  resolution: 0.001,
  showGrid: false,
  bgColor: "#FFFFFF"
};

let grid = [];
let baseSpacing = 10;
let spacing = baseSpacing;
let cols, rows;
let occupiedPoints = new Set();

function preload() {
  brush.preload();
}

function setup() {
  const canvasContainer = document.getElementById('canvas-container');
  const canvas = createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, WEBGL);
  canvas.parent('canvas-container');

  colorMode(HSB, 360, 100, 100, 100);

  brush.load();
  createCustomBrushes();

  connectSliders();

  createField();
  drawFlowField();

  noLoop();
}

function createCustomBrushes() {
  brush.add("flowBrush", {
    type: "standard",
    weight: 1,
    vibration: 0.5,
    definition: 0.85,
    quality: 2.5,
    opacity: 200,
    spacing: 0.5,
    blend: false,
    pressure: {
      type: "standard",
      min_max: [0.8, 1.2],
      curve: [0.35, 0.25]
    },
    rotate: "natural"
  });
}

function createField() {
  spacing = baseSpacing;

  cols = floor(width / spacing) + 1;
  rows = floor(height / spacing) + 1;

  grid = [];
  occupiedPoints = new Set();

  // grid generation
  let xOffset = 0;
  for (let col = 0; col < cols; col++) {
    let colArray = [];
    let yOffset = 0;

    for (let row = 0; row < rows; row++) {
      // base angle with noise
      let angle = (noise(xOffset, yOffset) > 0.5) ? 0 : PI;

      // grid point - WEBGL
      colArray.push({
        x: (col * spacing) - width / 2,
        y: (row * spacing) - height / 2,
        angle: angle
      });

      yOffset += params.resolution;
    }

    grid.push(colArray);
    xOffset += params.resolution;
  }
}

function drawFlowField() {
  const bgColorRGB = color(params.bgColor);
  const bgH = hue(bgColorRGB);
  const bgS = saturation(bgColorRGB);
  const bgB = brightness(bgColorRGB);
  background(bgH, bgS, bgB);

  if (params.showGrid) {
    displayGrid();
  }

  drawAllFlowElements();

  brush.reDraw();
}

function displayGrid() {
  stroke(0, 150);
  strokeWeight(2);

  for (let col = 0; col < grid.length; col++) {
    for (let row = 0; row < grid[col].length; row++) {
      const point = grid[col][row];
      push();
      translate(point.x, point.y);
      rotate(point.angle);
      line(0, 0, spacing * 0.75, 0);
      pop();
    }
  }
}

function getAngleAt(x, y) {
  // convert from WebGL coordinates to grid indices
  const col = constrain(floor((x + width / 2) / spacing), 0, cols - 1);
  const row = constrain(floor((y + height / 2) / spacing), 0, rows - 1);

  if (grid[col] && grid[col][row]) {
    return grid[col][row].angle;
  }
  return 0;
}

function isPointOccupied(x, y, minDistance = 8) {
  const key = `${floor(x / minDistance)},${floor(y / minDistance)}`;
  return occupiedPoints.has(key);
}

function markPointOccupied(x, y, minDistance = 8) {
  const key = `${floor(x / minDistance)},${floor(y / minDistance)}`;
  occupiedPoints.add(key);
}

// all flow elements 
function drawAllFlowElements() {

  const minDistanceBetweenElements = 40;

  const numElementsToDraw = params.numLines;

  const startingPoints = [];
  const maxAttempts = numElementsToDraw * 3;
  let attempts = 0;
  let elementsDrawn = 0;

  // draw the requested number of elements
  while (elementsDrawn < numElementsToDraw && attempts < maxAttempts) {
    attempts++;

    // random starting point in WebGL coordinates
    const startX = random(-width / 2, width / 2);
    const startY = random(-height / 2, height / 2);

    // skip if close to existing starting points
    let tooClose = false;
    for (const point of startingPoints) {
      if (dist(startX, startY, point.x, point.y) < minDistanceBetweenElements) {
        tooClose = true;
        break;
      }
    }

    if (tooClose || isPointOccupied(startX, startY)) continue;

    // Choose color based on parameters using HSB
    let hue, saturation, brightness, alpha;

    hue = map(params.spice, 0, 1, 240, 0);

    // acidity affects hue variation
    const hueVariance = map(params.acidity, 0, 1, 15, 30);
    hue = (hue + random(-hueVariance, hueVariance)) % 360;

    // temperature affects brightness and alpha
    saturation = map(params.temperature, 0, 1, 20, 80);
    brightness = map(params.temperature, 0, 1, 100, 95);
    alpha = 85;

    // draw a flow element
    const lineColor = color(hue, saturation, brightness, alpha);
    const elementDrawn = drawFlowElement(startX, startY, lineColor);

    if (elementDrawn) {
      startingPoints.push({ x: startX, y: startY });
      elementsDrawn++;
    }
  }

  console.log(`Drew ${elementsDrawn} elements after ${attempts} attempts`);
}

// simplified waveform generator
function generateWaveform(phase, roughness) {
  // base waveforms
  const sineValue = sin(phase);
  const triangleValue = (2 / PI) * asin(sin(phase));

  // direct linear interpolation between sine and triangle based on roughness
  return lerp(sineValue, triangleValue, roughness);
}

// main function
function drawFlowElement(startX, startY, lineColor) {
  // generate path following the flow field with dashed lines for oiliness
  const pathPoints = generateBasePath(startX, startY);

  if (pathPoints.length < 3) {
    return false;
  }

  const lineWeight = map(params.temperature, 0, 1, 1, 2)

  // dryness based on soup level (higher soup = less dry)
  const dryness = map(params.soupLevel, 0, 1, 0.8, 0);

  // Pprocess the path based on oiliness parameter (oiliness now controls dashing)
  let processedPath = pathPoints;

  // apply oiliness for dash effect - less oiliness = more dashed
  if (params.oiliness < 0.7) {
    // create dashed version of the path
    let dashedPath = [];
    const dashLength = floor(map(params.oiliness, 0, 0.7, 5, 20)); // shorter dashes when less oily
    const gapLength = floor(map(params.oiliness, 0, 0.7, 3, 0));  // bigger gaps when less oily

    let drawingDash = true;
    let dashCounter = 0;

    for (let i = 0; i < pathPoints.length; i++) {
      if (drawingDash) {
        dashedPath.push(pathPoints[i]);
        dashCounter++;

        if (dashCounter >= dashLength) {
          drawingDash = false;
          dashCounter = 0;
        }
      } else {
        dashCounter++;
        if (dashCounter >= gapLength) {
          drawingDash = true;
          dashCounter = 0;
        }
      }
    }

    processedPath = dashedPath;
  }

  // create oscillated path if sweet is significant
  let oscillatedPath = processedPath;
  if (params.sweet > 0.1) {
    // calculate oscillation parameters
    const intensity = map(params.sweet, 0, 1, 0, 3);
    const frequency = map(params.sweet, 0, 1, 0.5, 3);
    const roughness = params.salt; // Controls wave shape

    oscillatedPath = [];

    // process each point in the path
    for (let i = 0; i < processedPath.length; i++) {
      // calculate position along the path (normalized 0-1)
      const t = i / (processedPath.length - 1);

      // current point
      const point = processedPath[i];

      // calculate path direction at this point
      const prevIndex = constrain(i - 1, 0, processedPath.length - 1);
      const nextIndex = constrain(i + 1, 0, processedPath.length - 1);

      // find direction vector along the path
      const dx = processedPath[nextIndex].x - processedPath[prevIndex].x;
      const dy = processedPath[nextIndex].y - processedPath[prevIndex].y;

      // calculate perpendicular angle to the path
      const pathAngle = atan2(dy, dx) + PI / 2;

      // calculate the wave phase based on position along the path
      const phase = t * TWO_PI * frequency;

      // generate oscillation using our simplified waveform function
      const oscillation = generateWaveform(phase, roughness);

      // scale the oscillation by the intensity and lineWeight
      const magnitude = 4 * intensity;
      const scaledOscillation = oscillation * magnitude;

      // calculate the new point position with oscillation applied perpendicular to path
      const newX = point.x + cos(pathAngle) * scaledOscillation;
      const newY = point.y + sin(pathAngle) * scaledOscillation;

      // add to our oscillated path
      oscillatedPath.push({ x: newX, y: newY });
    }
  }


  // Apply dryness effect for soup level - selectively thin out the path for dry brush look
  let finalPath = oscillatedPath;

  // convert the final path to spline format for p5.brush
  const splinePoints = finalPath.map(pt => [pt.x, pt.y]);

  if (splinePoints.length >= 2) {

    // configure brush based on all parameters
    brush.add("flowBrush", {
      type: params.salt > 0.4 ? "custom" : "standard",
      weight: 10 * lineWeight,
      vibration: map(dryness, 0, 0.8, 0.5, 2.5),
      pressure: {
        type: "standard",
        min_max: [0.8, 1],
        curve: [
          map(params.salt, 0, 1, 0.35, 3),
          map(params.salt, 0, 1, 0.25, 0.5)
        ]
      },

      definition: map(params.soupLevel, 0, 1, 0.25, 0.85),
      quality: map(params.soupLevel, 0, 1, 0.5, 2.5),
      opacity: map(params.soupLevel, 0, 1, 50, 220),
      spacing: 0.5,
      blend: false,

      rotate: params.salt > 0.5 ? "none" : "natural",

      tip: params.salt > 0.4 ? (_m) => {
        const ratio = map(params.salt, 0.4, 1, 0.5, 1.5);
        if (ratio < 0.3) {
          // ++circular
          const size = map(params.salt, 0.4, 1, 2, 1);
          _m.ellipse(0, 0, size + ratio, size + 3 * ratio);
        } else {
          // ++rectangular
          const aspectRatio = map(ratio, 0.3, 1, 1, 30);
          _m.rect(-1, -aspectRatio / 2, 2, aspectRatio);
        }
      } : undefined
    });


    // draw connected segments
    let currentSegment = [];
    let hasGap = false;

    for (let i = 0; i < splinePoints.length; i++) {
      const point = splinePoints[i];

      // check if there's a large gap
      const isGap = i > 0 && dist(splinePoints[i - 1][0], splinePoints[i - 1][1], point[0], point[1]) > 10;

      if (isGap && currentSegment.length >= 2) {
        // draw the current segment
        brush.pick("flowBrush");
        brush.stroke(lineColor);
        brush.spline(currentSegment, 0.4);

        // start a new segment
        currentSegment = [];
        hasGap = true;
      }

      // add point to current segment
      currentSegment.push(point);
    }

    // draw the last segment
    if (currentSegment.length >= 2) {
      brush.pick("flowBrush");
      brush.stroke(lineColor);
      brush.spline(currentSegment, 0.4);
    }

    return true;
  }

  return false;
}

// alt step size
function generateBasePath(startX, startY) {
  const pathPoints = [];
  let x = startX;
  let y = startY;

  // maximum steps to take
  const maxSteps = params.lineLength / params.stepSize;

  // base step size
  const baseStepSize = params.stepSize;
  // reduced step size (1/4 of the original)
  const reducedStepSize = baseStepSize * 0.25;

  // current step size (will alternate)
  let currentStepSize = baseStepSize;

  // counter for when to switch step sizes
  let stepCounter = 0;
  let switchInterval = floor(random(3, 8)); // Random interval for switching

  // generate points following the flow field
  for (let i = 0; i < maxSteps; i++) {
    // add the current point (already in WEBGL coordinates)
    pathPoints.push({ x: x, y: y });
    markPointOccupied(x, y);

    // get angle from the field
    const angle = getAngleAt(x, y);

    // increment counter and check if we should switch step sizes
    stepCounter++;
    if (stepCounter >= switchInterval) {
      // switch between base and reduced step size
      currentStepSize = (currentStepSize === baseStepSize) ? reducedStepSize : baseStepSize;
      // reset counter and generate a new random interval
      stepCounter = 0;
      switchInterval = floor(random(3, 8));
    }

    // take a step in that direction with the current step size
    x += cos(angle) * currentStepSize;
    y += sin(angle) * currentStepSize;

    // check bounds - using WEBGL coordinates
    if (x < -width / 2 || x >= width / 2 || y < -height / 2 || y >= height / 2) {
      break;
    }

    // check for collision with existing elements (with some randomness)
    if (i > 20 && isPointOccupied(x, y) && random() > 0.4) {
      break;
    }
  }

  return pathPoints;
}

// connect sliders checkboxes buttons

function connectSliders() {
  connectSlider('oiliness');
  connectSlider('soupLevel');
  connectSlider('salt');
  connectSlider('sweet');
  connectSlider('acidity');
  connectSlider('spice');
  connectSlider('temperature');
  connectSlider('numLines');
  connectSlider('lineLength');
  connectSlider('stepSize');
  connectSlider('resolution');

  const gridCheckbox = document.getElementById('showGrid');
  if (gridCheckbox) {
    gridCheckbox.checked = params.showGrid;
    gridCheckbox.addEventListener('change', function () {
      params.showGrid = this.checked;
      createField();
      drawFlowField();
    });
  }

  const resetButton = document.getElementById('resetButton');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      createField();
      drawFlowField();
    });
  }

  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', function () {
      saveCanvas('flow-field', 'png');
    });
  }
}

function connectSlider(paramName) {
  const slider = document.getElementById(paramName);
  if (!slider) return;

  // set initial slider value
  slider.value = params[paramName];

  // update display value
  const valueDisplay = slider.nextElementSibling;
  if (valueDisplay) valueDisplay.textContent = params[paramName];

  // add change event
  slider.addEventListener('input', function () {
    const newValue = parseFloat(this.value);
    params[paramName] = newValue;

    if (valueDisplay) valueDisplay.textContent = newValue;

    // force redraw
    console.log(`Parameter ${paramName} changed to ${newValue}`);
    createField();
    drawFlowField();
  });
}

// fix resize issues
function windowResized() {
  const canvasContainer = document.getElementById('canvas-container');
  resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
  createField();
  drawFlowField();
}