let t = 0.0;
let vel = 0.02;
let num;
let paletteSelected;
let paletteSelected1;
let paletteSelected2;

// 新增：側邊選單相關變數
let sideMenuDiv;
let menuWidth = 320;
let menuX = 0;
let menuTargetX = 0;
let menuHiddenX = 0; // 會在 setup 設定為 -menuWidth
let menuVisibleX = 0;
let realMenu = null;
let cnv = null;

// 新增：iframe 相關變數
let iframeOverlay = null;
let iframeInner = null;
let iframeURL = 'https://rogerkuo940307-lgtm.github.io/20251020/';

// 預先計算的點陣，避免每幀重建
let prePoints = [];
let maxPointTarget = 700; // 可根據需求調整（越大越慢）
let needsRecompute = true;

// 新增：背景動畫參數
let bgAnim = 0;

function setup() {
    // 降低 pixel density 以改善效能（可改回 2 若需要高解析）
    pixelDensity(1);
    createCanvas(windowWidth, windowHeight);
    cnv = select('canvas');
    angleMode(DEGREES);
    num = random(100000);
    paletteSelected = random(palettes);
    paletteSelected1 = random(palettes);
    paletteSelected2 = random(palettes);

    // 讓 canvas 在背景，選單能覆蓋在上方
    if (cnv) {
      cnv.style('display','block');
      cnv.style('position','fixed');
      cnv.style('left','0px');
      cnv.style('top','0px');
      cnv.style('z-index','0');
    }

    // 設定選單位置參數
    menuHiddenX = -menuWidth;
    menuVisibleX = 0;
    menuX = menuHiddenX;
    menuTargetX = menuHiddenX;

    // 建立 CSS（含 hover 顏色、字型大小）
    let style = createElement('style',
      `.side-menu{
         position:fixed;
         top:0;
         left:0;
         width:${menuWidth}px;
         height:100vh;
         background:rgba(20,20,30,0.92);
         box-shadow:2px 0 10px rgba(0,0,0,0.6);
         padding-top:80px;
         z-index:9999;
         transform:translateX(${menuHiddenX}px);
         transition:none;
         font-family:Arial, Helvetica, sans-serif;
      }
      .side-menu .menu-item{
         color:#ffffff;
         font-size:32px;
         padding:18px 28px;
         user-select:none;
         cursor:pointer;
         transition:color 180ms ease;
      }
      .side-menu .menu-item:hover{
         color:#ffd166;
      }
      /* 小提示：當滑鼠在選單上時不要把滑鼠事件傳給 canvas */
      .side-menu { pointer-events:auto; }`
    );
    style.parent(document.head);

    // 建立選單 HTML
    sideMenuDiv = createDiv(`
      <div class="side-menu" id="sideMenu">
        <div class="menu-item" id="item1">第一單元作品</div>
        <div class="menu-item" id="item2">第一單元講義</div>
        <div class="menu-item" id="item3">測驗系統</div>
        <div class="menu-item" id="item4">回首頁</div>
      </div>
    `);
    // parent 到 body（預設），並移除額外包層，直接取得實際 menu 元素
    sideMenuDiv.child(sideMenuDiv.elt.firstElementChild).attribute('id','sideMenuWrapper');
    // 直接選取真正的 .side-menu 元素
    realMenu = select('#sideMenu');
    if (realMenu) {
      realMenu.style('position','fixed');
      realMenu.style('top','0px');
      realMenu.style('left','0px');
      realMenu.style('width', menuWidth + 'px');
      realMenu.style('height','100vh');
      realMenu.style('z-index','9999');
      // 初始放到隱藏位置（我們會用 JS 動畫）
      realMenu.style('transform', `translateX(${menuHiddenX}px)`);
      realMenu.elt.style.pointerEvents = 'auto';
      // 監聽點擊（已修改：item2 以 iframe 顯示 HackMD）
      select('#item1').mousePressed(()=>{ showIframe(); });
      select('#item2').mousePressed(()=>{
        iframeURL = 'https://hackmd.io/@XLpu1BirQ4C3KLRLl7X1Tg/Bk9xwQRigg';
        showIframe();
      });
      // 已修改：點擊「測驗系統」會以 iframe 開啟指定網址
      select('#item3').mousePressed(()=>{
        iframeURL = 'https://rogerkuo940307-lgtm.github.io/20251103/';
        showIframe();
      });
     // 點選「回首頁」恢復到最一開始的狀態
     select('#item4').mousePressed(()=>{
       resetToInitial();
     });
    }
    
    // 預先計算點陣（setup 時）
    recomputePoints();
    // 新增：在右上角加入姓名與大頭照徽章
    createHeaderBadge();
}

function draw() {
  // 動態背景（漸層會隨時間移動）
  animatedBackground();

  // 每幀使用已預計算的點陣進行繪製
  randomSeed(num);
  stroke("#355070");

  // 側邊選單滑出/收起邏輯（平滑動畫）
  let edgeThreshold = 24; // 當滑鼠靠近左側邊緣時觸發
  let menuHoverBuffer = menuWidth + 8; // 當滑鼠移到選單範圍外多少時收回
  if (mouseX <= edgeThreshold) {
    menuTargetX = menuVisibleX;
  } else if (mouseX > menuHoverBuffer) {
    menuTargetX = menuHiddenX;
  }
  // lerp 平滑移動
  menuX = lerp(menuX, menuTargetX, 0.14);
  // 套用到實際 DOM 元素（已快取）
  if (realMenu) {
    realMenu.style('transform', `translateX(${menuX}px)`);
  }

  // 繪製預計算點
  push();
  translate(width / 2, height / 2);
  // 限制繪製數量（可選：用於性能調整）
  let drawCount = prePoints.length;
  for (let i = 0; i < drawCount; i++) {
    let p = prePoints[i];
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    if (p.overlay) blendMode(OVERLAY);
    // 建立 linear gradient（雖然每個 shape 都建立，但總量已大幅減少）
    gradientFillFor(p.r, p.col1, p.col2);
    shapeFast(0, 0, p.r, p.fillColor);
    if (p.overlay) blendMode(BLEND);
    pop();
  }
  pop();
}

// 預先計算點陣（只在 setup 或 resize 時呼叫）
function recomputePoints() {
  prePoints = [];
  // 根據畫面大小自適應點數，避免太多導致卡
  let base = constrain(int((width * height) / 12000), 300, maxPointTarget);
  let count = base;
  randomSeed(num);
  let attempts = 0;
  while (prePoints.length < count && attempts < count * 6) {
    attempts++;
    let a = random(360);
    let d = random(width * 0.35);
    let s = random(60, 220);
    let x = cos(a) * (d - s / 2);
    let y = sin(a) * (d - s / 2);
    let ok = true;
    // 使用簡化的碰撞檢查（物件陣列、數值運算，比 createVector 快）
    for (let j = 0; j < prePoints.length; j++) {
      let p = prePoints[j];
      let dx = x - p.x;
      let dy = y - p.y;
      if (dx * dx + dy * dy < ((s + p.r) * 0.6) * ((s + p.r) * 0.6)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      // 為每個點預先決定顏色與旋轉（避免每 frame 隨機）
      let col1 = color(random(paletteSelected1));
      let col2 = color(random(paletteSelected2));
      prePoints.push({
        x: x,
        y: y,
        r: s - 5,
        rot: random(360),
        col1: col1,
        col2: col2,
        overlay: random() < 0.3 // 部分使用 overlay
      });
    }
  }
  needsRecompute = false;
}

function circlePacking() {
  // 已被替換為 recomputePoints + draw loop；保留空殼以防被外部呼叫
  // 若你仍想使用舊邏輯，請把內容移至 recomputePoints
  return;
}

// 更快的 shape 繪製：減少 createVector、減少動態物件
function shapeFast(x, y, r, fillColor) {
  push();
  noStroke();
  translate(x, y);
  let radius = r;
  let nums = 8;
  // 先填色（gradientFillFor 已經設定 drawingContext.fillStyle）
  // call beginShape variant drawing distorted circle many times
  for (let i = 0; i < 360; i += 360 / nums) {
    let ex = radius * sin(i);
    let ey = radius * cos(i);
    push();
    translate(ex, ey);
    rotate(atan2(ey, ex));
    distortedCircleFast(0, 0, r);
    pop();
    stroke(randomColFast());
    strokeWeight(0.5);
    line(0, 0, ex, ey);
    ellipse(ex, ey, 2);
  }
  pop();
}

// 簡化版 distortedCircle（用純數值代替 createVector）
function distortedCircleFast(x, y, r) {
  push();
  translate(x, y);
  // anchor offsets
  let val = 0.3;
  let ra = random(-r * val, r * val);
  let rb = random(-r * val, r * val);
  let rc = random(-r * val, r * val);
  let rd = random(-r * val, r * val);
  let lenA = r * random(0.2, 0.5);
  let lenB = r * random(0.2, 0.5);

  // points
  let p1x = 0, p1y = -r / 2;
  let p2x = r / 2, p2y = 0;
  let p3x = 0, p3y = r / 2;
  let p4x = -r / 2, p4y = 0;

  // anchors (數值)
  let a1x = lenA, a1y = -r / 2 + ra;
  let a2x = r / 2 + rb, a2y = -lenB;
  let a3x = r / 2 - rb, a3y = lenA;
  let a4x = lenB, a4y = r / 2 + rc;
  let a5x = -lenA, a5y = r / 2 - rc;
  let a6x = -r / 2 + rd, a6y = lenB;
  let a7x = -r / 2 - rd, a7y = -lenA;
  let a8x = -lenB, a8y = -r / 2 - ra;

  beginShape();
  vertex(p1x, p1y);
  bezierVertex(a1x, a1y, a2x, a2y, p2x, p2y);
  bezierVertex(a3x, a3y, a4x, a4y, p3x, p3y);
  bezierVertex(a5x, a5y, a6x, a6y, p4x, p4y);
  bezierVertex(a7x, a7y, a8x, a8y, p1x, p1y);
  endShape();
  pop();
}

function mouseClicked() {
  shuffle(paletteSelected, true);
  shuffle(bgpalette, true);
  // 點擊後可以要求重建點陣（視需求開關）
  needsRecompute = true;
  recomputePoints();
}

// 更快的顏色取法：直接從已挑選的 palette 取，不在每幀做太多 random 呼叫
function randomColFast(){
  let idx = int(random(0, paletteSelected.length));
  return color(paletteSelected[idx]);
}
function bgCol(){
  let randoms = int(random(0,bgpalette.length));
  return color(bgpalette[randoms]);
}

// 建立並設定 linear gradient（外部單一函式，較易管理）
function gradientFillFor(r, c1, c2) {
  // c1, c2 已是 color 物件（在 recomputePoints 時建立）
  noStroke();
  let g = drawingContext.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, color(c1));
  g.addColorStop(1, color(c2));
  drawingContext.fillStyle = g;
}

// 動態背景函式（使用 canvas drawingContext 的 linearGradient，成本低且效果平滑）
function colorToRGBAString(colInput) {
  // 支援字串或 p5 color
  let c = (typeof colInput === 'string') ? color(colInput) : colInput;
  let r = floor(red(c));
  let g = floor(green(c));
  let b = floor(blue(c));
  let a = (alpha(c) / 255).toFixed(2);
  return `rgba(${r},${g},${b},${a})`;
}
function animatedBackground() {
  // 每幀推進動畫計數
  bgAnim += 1.0;

  let len = bgpalette.length;
  if (len < 2) {
    // fallback
    drawingContext.fillStyle = colorToRGBAString(bgpalette[0] || "#000000");
    drawingContext.fillRect(0, 0, width, height);
    return;
  }

  // 以浮點索引在 palette 上循環，frac 用來做平滑插值
  let cycleSpeed = 0.008; // 調整此值可改變變色速度（越大越快）
  let pos = (bgAnim * cycleSpeed) % len;
  let i = floor(pos);
  let frac = pos - i;

  // 取兩組顏色 pair，並以 frac 做平滑插值（避免突跳）
  let a1 = color(bgpalette[i]);
  let a2 = color(bgpalette[(i + 1) % len]);
  let b1 = color(bgpalette[(i + 2) % len]);
  let b2 = color(bgpalette[(i + 3) % len]);

  let topColor = lerpColor(a1, a2, frac);
  let botColor = lerpColor(b1, b2, frac);

  // 漸層方向略為擺動，增加視覺動態但成本低
  let gx = width * (0.4 + 0.2 * sin(bgAnim * 0.006));
  let gy = height * (0.6 + 0.2 * cos(bgAnim * 0.005));

  let g = drawingContext.createLinearGradient(0, 0, gx, gy);
  g.addColorStop(0, colorToRGBAString(topColor));
  g.addColorStop(0.5, colorToRGBAString(lerpColor(topColor, botColor, 0.5)));
  g.addColorStop(1, colorToRGBAString(botColor));

  push();
  noStroke();
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);
  pop();
}

// 保持原有 palettes（未變更）
let bgpalette =   ["#488a50",  "#bf5513", "#3b6fb6", "#4f3224", "#9a7f6e","#1c3560", '#4a4e69',"#333","#413e49","#5da4a9"]
let  palettes = [
  ["#e9dbce", "#ea526f", "#fceade", "#e2c290", "#6b2d5c", "#25ced1"],
  ["#e9dbce", "#d77a61", "#223843", "#eff1f3", "#dbd3d8", "#d8b4a0"],
  ["#e29578", "#006d77", "#83c5be", "#ffddd2", "#edf6f9"],
  ["#e9dbce", "#cc3528", "#028090", "#00a896", "#f8c522"],
  ["#e9dbce", "#92accc", "#f8f7c1", "#f46902", "#da506a", "#fae402"],
  ["#e42268", "#fb8075", "#761871", "#5b7d9c", "#a38cb4", "#476590"],
  ['#f9b4ab', '#679186', '#fdebd3', '#264e70', '#bbd4ce'],
  ['#1f306e', '#c7417b', '#553772', '#8f3b76', '#f5487f'],
  ['#e0f0ea', '#95adbe', '#574f7d', '#503a65', '#3c2a4d'],
  ['#413e4a', '#b38184', '#73626e', '#f0b49e', '#f7e4be'],
  ['#ff4e50', '#fc913a', '#f9d423', '#ede574', '#e1f5c4'],
  ['#99b898', '#fecea8', '#ff847c', '#e84a5f', '#2a363b'],
  ['#69d2e7', '#a7dbd8', '#e0e4cc', '#f38630', '#fa6900'],
  ['#fe4365', '#fc9d9a', '#f9cdad', '#c8c8a9', '#83af9b'],
  ['#ecd078', '#d95b43', '#c02942', '#542437', '#53777a'],
  ['#556270', '#4ecdc4', '#c7f464', '#ff6b6b', '#c44d58'],
  ['#774f38', '#e08e79', '#f1d4af', '#ece5ce', '#c5e0dc'],
  ['#e8ddcb', '#cdb380', '#036564', '#033649', '#031634'],
  ['#490a3d', '#bd1550', '#e97f02', '#f8ca00', '#8a9b0f'],
  ['#594f4f', '#9de0ad', '#547980', '#45ada8', '#e5fcc2'],
  ['#00a0b0', '#cc333f', '#6a4a3c', '#eb6841', '#edc951'],
  ['#5bc0eb', '#fde74c', '#9bc53d', '#e55934', '#fa7921'],
  ['#ed6a5a', '#9bc1bc', '#f4f1bb', '#5ca4a9', '#e6ebe0'],
  ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c'],
  ['#22223b', '#c9ada7', '#4a4e69', '#9a8c98', '#f2e9e4'],
  ['#114b5f', '#1a936f', '#88d498', '#c6dabf', '#f3e9d2'],
  ['#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d', '#293241'],
  ['#06aed5', '#f0c808', '#086788', '#fff1d0', '#dd1c1a'],
  ['#540d6e', '#ee4266', '#ffd23f', '#3bceac', '#0ead69'],
  ['#c9cba3', '#e26d5c', '#ffe1a8', '#723d46', '#472d30'],
  ["#3c4cad", "#5FB49C", "#e8a49c"],
  ["#1c3560", "#ff6343", "#f2efdb", "#fea985"],
  ["#e0d7c5", "#488a50", "#b59a55", "#bf5513", "#3b6fb6", "#4f3224", "#9a7f6e"], //o-ball
  ["#DEEFB7", "#5FB49C", "#ed6a5a"],
  ["#2B2B2B", "#91B3E1", "#2F5FB3", "#3D4B89", "#AE99E8", "#DBE2EC"], //clipper_tea.snore&peace.
  ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec", "#3a86ff"],
  ["#A8C25D", "#5B7243", "#FFA088", "#FFFB42", "#a9cff0", "#2D6EA6"], //2025/07/08
  ["#F9F9F1",  "#191A18","#E15521", "#3391CF", "#E4901C", "#F5B2B1", "#009472"]//reference :: @posterlad :: https://x.com/posterlad/status/1963188864446566493
];

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    // canvas 位置固定，選單寬度仍然使用 menuWidth（若需在 resize 時調整可在此處更新）
    if (realMenu) realMenu.style('height', windowHeight + 'px');

    // 若 iframe 有顯示，更新尺寸
    if (iframeInner) {
      let w = int(windowWidth * 0.7);
      let h = int(windowHeight * 0.85);
      iframeInner.style('width', w + 'px');
      iframeInner.style('height', h + 'px');
    }

    // 畫面大小變更後重新計算點陣以避免過度重繪
    needsRecompute = true;
    recomputePoints();
}

// 顯示 iframe 覆蓋層（修正版）
function showIframe() {
  if (iframeOverlay) return; // 已顯示就跳過

  // 建立遮罩容器
  iframeOverlay = createDiv();
  iframeOverlay.id('iframeOverlay');
  iframeOverlay.parent(document.body);
  iframeOverlay.style('position','fixed');
  iframeOverlay.style('left','0px');
  iframeOverlay.style('top','0px');
  iframeOverlay.style('width','100%');
  iframeOverlay.style('height','100%');
  iframeOverlay.style('display','flex');
  iframeOverlay.style('align-items','center');
  iframeOverlay.style('justify-content','center');
  iframeOverlay.style('background','rgba(0,0,0,0.6)');
  iframeOverlay.style('z-index','10001');

  // 內框（白底）及 iframe
  iframeInner = createDiv();
  iframeInner.parent(iframeOverlay);
  iframeInner.style('position','relative');
  iframeInner.style('background','#ffffff');
  iframeInner.style('box-shadow','0 10px 40px rgba(0,0,0,0.6)');
  iframeInner.style('border-radius','6px');
  iframeInner.style('overflow','hidden');

  // 設定尺寸（70% 寬，85% 高）
  let w = int(windowWidth * 0.7);
  let h = int(windowHeight * 0.85);
  iframeInner.style('width', w + 'px');
  iframeInner.style('height', h + 'px');

  // 建立 iframe 元素
  let ifr = createElement('iframe');
  ifr.attribute('src', iframeURL);
  ifr.attribute('frameborder', '0');
  ifr.attribute('allowfullscreen', '');
  ifr.style('width','100%');
  ifr.style('height','100%');
  ifr.style('display','block');
  ifr.parent(iframeInner);

  // 關閉按鈕
  let closeBtn = createButton('✕');
  closeBtn.parent(iframeInner);
  closeBtn.style('position','absolute');
  closeBtn.style('right','8px');
  closeBtn.style('top','8px');
  closeBtn.style('z-index','10002');
  closeBtn.style('background','rgba(0,0,0,0.5)');
  closeBtn.style('color','#fff');
  closeBtn.style('border','none');
  closeBtn.style('padding','6px 10px');
  closeBtn.style('font-size','18px');
  closeBtn.style('border-radius','4px');
  closeBtn.mousePressed(() => { hideIframe(); });

  // 當點擊遮罩（但非內框）時也關閉
  iframeOverlay.elt.addEventListener('click', (e) => {
    if (!iframeInner) return;
    if (!iframeInner.elt.contains(e.target)) {
      hideIframe();
    }
  });

  // 防止內框點擊冒泡（可選）
  iframeInner.elt.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // 將 canvas z-index 調低，確保遮罩顯示在最上層
  if (cnv) cnv.style('z-index','0');
}

// 隱藏並移除 iframe 覆蓋層（修正版）
function hideIframe() {
  if (!iframeOverlay) return;
  iframeOverlay.remove();
  iframeOverlay = null;
  iframeInner = null;
  // 還原 canvas z-index（如需要）
  if (cnv) cnv.style('z-index','0');
}

// 新增：建立右上角徽章並產生小型 SVG 大頭照（男大學生風格）
function createHeaderBadge() {
  // 若已存在就跳過
  if (select('#headerBadge')) return;

  let badge = createDiv();
  badge.id('headerBadge');
  badge.parent(document.body);
  badge.style('position','fixed');
  badge.style('right','12px');
  badge.style('top','12px');
  badge.style('display','flex');
  badge.style('align-items','center');
  badge.style('gap','8px');
  badge.style('padding','6px 10px');
  badge.style('background','rgba(255,255,255,0.92)');
  badge.style('border-radius','10px');
  badge.style('box-shadow','0 6px 18px rgba(0,0,0,0.12)');
  badge.style('z-index','10003');
  badge.style('font-family','Arial, Helvetica, sans-serif');

  // avatar 圖片（尺寸小）
  let size = 48;
  let img = createImg(generateAvatarSVG(size, size), 'avatar');
  img.parent(badge);
  img.style('width', size + 'px');
  img.style('height', size + 'px');
  img.style('border-radius','8px');
  img.style('display','block');
  img.attribute('decoding','async');

  // 文字
  let txt = createDiv('412730730 郭睿濬');
  txt.parent(badge);
  txt.style('font-size','13px');
  txt.style('color','#111');
  txt.style('font-weight','600');
  txt.style('line-height','1');
}

// 產生簡潔的 SVG 大頭照（程式化、輕量）
function generateAvatarSVG(w, h) {
  let face = '#f1c6a6';
  let hair = '#2e2a26';
  let shirt = '#2b6ea3';
  let bg = '#ffffff00'; // 透明背景
  // 建構 SVG 字串（簡單男大學生樣式）
  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="100%" height="100%" fill="${bg}" rx="8"/>` +
      // 頭部
      `<g transform="translate(${w/2}, ${h/2 - 2})">` +
        `<circle cx="0" cy="-2" r="${Math.round(w*0.25)}" fill="${face}" />` +
        // 頭髮（簡單弧形）
        `<path d="M${-w*0.25},${-w*0.25} q${w*0.25},${-w*0.22} ${w*0.5},0 q${-w*0.08},${w*0.06} ${-w*0.5},${w*0.02} Z" fill="${hair}" />` +
        // 眼睛
        `<circle cx="-${Math.round(w*0.07)}" cy="-3" r="${Math.round(w*0.03)}" fill="#222" />` +
        `<circle cx="${Math.round(w*0.07)}" cy="-3" r="${Math.round(w*0.03)}" fill="#222" />` +
        // 微笑嘴巴
        `<path d="M${-Math.round(w*0.06)},${Math.round(w*0.06)} q${Math.round(w*0.06)},${Math.round(w*0.05)} ${Math.round(w*0.12)},0" stroke="#6b3b2a" stroke-width="${Math.max(1, w*0.02)}" fill="none" stroke-linecap="round"/>` +
      `</g>` +
      // 衣領 / 衣服
      `<g transform="translate(${w/2}, ${h*0.75})">` +
        `<path d="M${-w*0.28},0 L${w*0.28},0 L${w*0.18},${h*0.18} L${-w*0.18},${h*0.18} Z" fill="${shirt}" />` +
      `</g>` +
    `</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// 新增：重置至最初狀態的函式（放在任一適合位置，例如在 showIframe/hideIframe 之後）
function resetToInitial() {
  // 關閉可能開啟的 iframe 覆蓋層
  hideIframe();

  // 重置背景動畫與隨機種子
  bgAnim = 0;
  num = random(100000);

  // 重新選 palette（回到初始樣貌）
  paletteSelected = random(palettes);
  paletteSelected1 = random(palettes);
  paletteSelected2 = random(palettes);

  // 把選單收回到隱藏位置
  menuTargetX = menuHiddenX;
  menuX = menuHiddenX;
  if (realMenu) realMenu.style('transform', `translateX(${menuHiddenX}px)`);

  // 重建點陣（清空並重新計算）
  prePoints = [];
  recomputePoints();
}
