// Matter.js 모듈 별칭
const { Engine, World, Bodies, Body, Composite } = Matter;

let engine;
let world;

let obstacles = [];
let windmills = [];
let dynamicShapes = [];

let hasDropped = false;
let startTime;

// --- 색상 테마 정의 ---
const COLOR_BG = '#FFFFFF';          // 배경: 흰색
const COLOR_GRAY = '#4A505A';        // 벽 및 슬림 장애물: 모던 그레이
const COLOR_PINK = '#FF4B82';        // 윈드밀 & 원형 장애물: 포인트 핑크
const COLOR_PINK_ACCENT = '#FF85A8'; // 원형 장애물 내부 코어 디테일용 소프트 핑크

// 60개의 도형을 풍성하게 채워줄 파스텔 무지개 팔레트
const PASTEL_RAINBOW = [
  '#FF9AA2', // 소프트 로즈
  '#FFB7B2', // 파스텔 살구
  '#FFDAC1', // 피치 크림
  '#FFEAA7', // 버터 레몬
  '#B5EAD7', // 민트 셔벗
  '#97E5D5', // 파스텔 터콰이즈
  '#A0C4FF', // 베이비 블루
  '#BDB2FF', // 라벤더 블루
  '#D7BCE8', // 파스텔 오키드
  '#FFC6FF'  // 캔디 핑크
];

function setup() {
  createCanvas(600, 800);
  rectMode(CENTER);
  ellipseMode(RADIUS);

  // 1. 물리 엔진 초기화
  engine = Engine.create();
  world = engine.world;
  world.gravity.y = 1.0;

  // 2. 큰 도형 60개에 최적화된 핀볼 필드 생성
  buildLargeShapePinballBoard();

  // 3. 커진 윈드밀 배치 (간격 250px, 날개길이: 125, 두께: 8, 회전속도: ±0.045)
  windmills.push(createWindmill(175, 410, 125, 8, 0.045));
  windmills.push(createWindmill(425, 410, 125, 8, -0.045));

  startTime = millis();
}

function draw() {
  background(COLOR_BG);

  // 물리 엔진 업데이트
  Engine.update(engine);

  // 1.2초 후 60개의 커진 도형들이 순차 낙하
  if (!hasDropped && millis() - startTime > 1200) {
    dropLargeShapes(60);
    hasDropped = true;
  }

  // 윈드밀 회전 업데이트
  updateWindmills();

  // 렌더링
  drawObstacles();
  drawWindmills();
  drawDynamicShapes();
}

// 사각 바디 헬퍼 함수
function createBar(x, y, w, h, angle, options = {}) {
  const bar = Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    angle: angle,
    friction: 0.03,     // 큰 도형이 레일 위에서 미끄러져 빠져나가도록 마찰 최소화
    restitution: 0.5,   // 튕겨나가지 않고 안정적으로 굴러가도록 반발계수 조절
    ...options
  });
  bar.barW = w;
  bar.barH = h;
  return bar;
}

// --- 큰 도형 전용 필드 및 걸림 방지 구조 ---
function buildLargeShapePinballBoard() {
  const bouncierOpt = { isStatic: true, friction: 0.02, restitution: 0.75 };

  // 1. 좌우 외곽 벽 (도형이 위로 튀어도 탈출하지 않도록 상단 밖까지 연장)
  obstacles.push(createBar(5, 350, 10, 1000, 0));
  obstacles.push(createBar(595, 350, 10, 1000, 0));

  // 2. 상단 범퍼 핀 (큰 도형이 걸리지 않도록 간격을 넓히고 2단으로만 심플하게 배치)
  const pinRows = [
    { y: 110, xs: [220, 380] },
    { y: 175, xs: [150, 300, 450] }
  ];
  pinRows.forEach(row => {
    row.xs.forEach(x => {
      let pin = Bodies.circle(x, row.y, 11, bouncierOpt);
      pin.isPin = true;
      obstacles.push(pin);
    });
  });

  // 3. 상단 슬라이드 경사로 (폭을 넉넉히 주어 윈드밀 상단 중앙으로 유도)
  obstacles.push(createBar(70, 260, 160, 8, 0.55));
  obstacles.push(createBar(530, 260, 160, 8, -0.55));

  // 4. 윈드밀 외곽 끼임 방지 가이드 레일 (윈드밀과의 간격을 벌려 큰 도형 통과 유도)
  obstacles.push(createBar(60, 420, 120, 8, 0.75));
  obstacles.push(createBar(540, 420, 120, 8, -0.75));

  // 5. 하단 센터 범퍼 (윈드밀에서 빠져나온 도형을 양옆으로 부드럽게 분산)
  let centerBumper = Bodies.polygon(300, 560, 3, 26, { ...bouncierOpt, angle: -PI / 2 });
  centerBumper.isCenterBumper = true;
  obstacles.push(centerBumper);

  // 6. 하단 수렴 깔때기 (바스켓으로 원활하게 흘러가도록 급경사 배치)
  obstacles.push(createBar(105, 660, 190, 8, 0.65));
  obstacles.push(createBar(495, 660, 190, 8, -0.65));

  // 7. 대형 집결 바스켓 (60개의 큰 도형을 모두 담는 넓고 깊은 용기)
  obstacles.push(createBar(300, 788, 300, 10, 0, { friction: 0.9 })); // 바닥 너비 300px
  obstacles.push(createBar(145, 715, 10, 140, 0, { friction: 0.4 })); // 좌측 벽 높이 140px
  obstacles.push(createBar(455, 715, 10, 140, 0, { friction: 0.4 })); // 우측 벽 높이 140px

  World.add(world, obstacles);
}

// --- 십자 윈드밀 ---
function createWindmill(x, y, length, thickness, speed) {
  const opt = { isStatic: true };
  const barH = Bodies.rectangle(x, y, length, thickness, opt);
  const barV = Bodies.rectangle(x, y, thickness, length, opt);

  World.add(world, [barH, barV]);

  return {
    x: x,
    y: y,
    length: length,
    thickness: thickness,
    parts: [barH, barV],
    angle: 0,
    speed: speed
  };
}

function updateWindmills() {
  for (let wm of windmills) {
    wm.angle += wm.speed;
    Body.setAngle(wm.parts[0], wm.angle);
    Body.setAngle(wm.parts[1], wm.angle + HALF_PI);
  }
}

// --- 60개의 큼직한 파스텔 도형 순차 낙하 ---
function dropLargeShapes(totalCount) {
  for (let i = 0; i < totalCount; i++) {
    setTimeout(() => {
      // 상단에서 좌우로 부드럽게 흩뿌리며 투하
      let x = 300 + random(-70, 70);
      let y = -50 - random(0, 30);
      let body;
      let shapeKind = i % 3;

      const physOptions = {
        restitution: random(0.45, 0.65), // 과도한 튕김 방지
        friction: 0.03,                  // 장애물 위를 잘 타고 넘어가도록
        frictionAir: 0.006,
        density: random(0.003, 0.005)    // 묵직한 무게감 부여
      };

      if (shapeKind === 0) {
        // 1. 큼직한 원형 구슬 (지름 34 ~ 46px)
        let r = random(17, 23);
        body = Bodies.circle(x, y, r, physOptions);
        body.shapeType = 'circle';
        body.radius = r;
      } else if (shapeKind === 1) {
        // 2. 도톰한 둥근 캡슐 (가로 44~56px, 세로 22~28px)
        let w = random(44, 56);
        let h = random(22, 28);
        body = Bodies.rectangle(x, y, w, h, { ...physOptions, chamfer: { radius: h / 2 } });
        body.shapeType = 'capsule';
        body.w = w;
        body.h = h;
      } else {
        // 3. 완만한 둥근 다각형 (반경 22 ~ 28px)
        let r = random(22, 28);
        body = Bodies.polygon(x, y, 6, r, physOptions);
        body.shapeType = 'polygon';
        body.radius = r;
      }

      body.renderColor = PASTEL_RAINBOW[i % PASTEL_RAINBOW.length];
      dynamicShapes.push(body);
      World.add(world, body);
    }, i * 130); // 0.13초 간격으로 연속 투하
  }
}

// --- 렌더링 루틴 ---
function drawObstacles() {
  noStroke();

  for (let b of obstacles) {
    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);

    if (b.isPin) {
      fill(COLOR_PINK);
      circle(0, 0, b.circleRadius);
      fill(COLOR_PINK_ACCENT);
      circle(0, 0, b.circleRadius * 0.45);
    } else if (b.isCenterBumper) {
      fill(COLOR_GRAY);
      beginShape();
      for (let v of b.vertices) {
        vertex(v.x - b.position.x, v.y - b.position.y);
      }
      endShape(CLOSE);
    } else {
      fill(COLOR_GRAY);
      rect(0, 0, b.barW, b.barH, 3);
    }
    pop();
  }
}

function drawWindmills() {
  for (let wm of windmills) {
    push();
    noStroke();
    
    // 핑크 윈드밀 날개
    fill(COLOR_PINK);
    for (let part of wm.parts) {
      push();
      translate(part.position.x, part.position.y);
      rotate(part.angle);
      rect(0, 0, wm.length, wm.thickness, 4);
      pop();
    }
    
    // 중심 피벗 화이트 핀
    fill(255);
    circle(wm.x, wm.y, 5);
    pop();
  }
}

function drawDynamicShapes() {
  // 선명하고 부드러운 라인 스트로크
  stroke(50, 55, 65, 200);
  strokeWeight(1.8);

  for (let b of dynamicShapes) {
    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);
    fill(b.renderColor);

    if (b.shapeType === 'circle') {
      circle(0, 0, b.radius);
      // 회전 디테일 라인
      stroke(50, 55, 65, 100);
      line(0, 0, b.radius * 0.7, 0);
    } else if (b.shapeType === 'capsule') {
      rect(0, 0, b.w, b.h, b.h / 2);
    } else if (b.shapeType === 'polygon') {
      beginShape();
      for (let v of b.vertices) {
        vertex(v.x - b.position.x, v.y - b.position.y);
      }
      endShape(CLOSE);
    }
    pop();
  }
}