(function () {
  'use strict';
  var root = document.documentElement;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 首页展示的游戏：增删改都在这里
  var GAMES = [
    { img: 'song',    zh: '大宋百商图',     en: 'A Dream of Splendor in Song Dynasty', age: 8,  ppl: '2–4', min: 50, more: true },
    { img: 'shanhe',  zh: '山河旅人',       en: 'Journey to the Horizon',              age: 7,  ppl: '2–4', min: 45, more: true },
    { img: 'qin',     zh: '天下归秦',       en: 'Unify Qin',                           age: 14, ppl: '2–6', min: 30, more: true },
    { img: 'sanguo',  zh: '三国群英录',     en: 'Three Kingdoms',                      age: 9,  ppl: '2–4', min: 45, more: true },
    { img: 'silk',    zh: '千年丝路 Ⅱ',     en: 'Silk Road II',                        age: 7,  ppl: '2–4', min: 20, more: true },
    { img: 'tang',    zh: '大梦归唐',       en: 'Dream of Tang',                       age: 10, ppl: '2–4', min: 45, more: true },
    { img: 'wenming', zh: '文明源记',       en: 'Roots of Civilization',               age: 8,  ppl: '2–4', min: 60, more: false },
    { img: 'modern',  zh: '现代艺术 · 华夏', en: 'Modern Art: Huaxia',                  age: 9,  ppl: '3–5', min: 45, more: true }
  ];

  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function rng(seed) { return function () { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(a, b, v) { v = clamp((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); }

  // ---------- 云：沿一条缓弧密密盖上柔边椭圆，两头收细，像一缕被风拉长的云 ----------
  function stamp(ctx, x, y, rx, ry, rgb, alpha) {
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 在 (x0, yMid) 起画一缕长 len、粗 thick 的云；先铺淡蓝云底，再盖白色云身，两遍抖动一致
  function wisp(ctx, x0, yMid, len, thick, alpha, seed) {
    var r = rng(seed), tilt = (r() - .5) * .1, ph = r() * 6, steps = Math.ceil(len / 5);
    [['1,120,190', .22, .45], ['255,255,255', 1, 0]].forEach(function (pass) {
      var j = rng(seed + 7);
      for (var s = 0; s <= steps; s++) {
        var u = s / steps, env = Math.pow(Math.sin(Math.PI * u), .8) * (1 - .45 * u);
        var rx = thick * env * (1.4 + j() * 1.2), ry = rx * (.28 + j() * .2);
        var y = yMid + tilt * (u - .5) * len + Math.sin(u * 6.3 + ph) * thick * .35 + (j() - .5) * thick * .4;
        if (rx > 1) stamp(ctx, x0 + u * len, y + ry * pass[2], rx, ry, pass[0], alpha * env * pass[1]);
      }
    });
  }

  // 品牌故事与页脚的流云带：data-clouds="种子,缕数,粗细,浓淡,纵向起点,纵向终点"
  function paintClouds(cv) {
    var a = cv.getAttribute('data-clouds').split(',').map(Number);
    var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d'), r = rng(a[0]), k = Math.min(1.3, Math.max(.6, w / 1440));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < a[1]; i++) {
      var len = w * (.22 + r() * .4), x0 = r() * (w + len * .6) - len * .6, y0 = h * (a[4] + r() * (a[5] - a[4]));
      wisp(ctx, x0, y0, len, (12 + r() * 30) * a[2] * k, a[3], a[0] * 31 + i);
    }
  }
  var canvases = [].slice.call(document.querySelectorAll('canvas[data-clouds]'));

  // ---------- 首屏：天空与仙山（静止背景）----------
  var hero = document.getElementById('top'), pin = hero.querySelector('.pin');
  var sceneCv = document.getElementById('scene'), veil = document.getElementById('veil');
  var copyBits = [].slice.call(document.querySelectorAll('.copy .reveal')), hint = document.getElementById('hint');
  var HW = 0, HH = 0, DPR = 1;
  function mist(ctx, y, h, a) {
    var g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, 'rgba(245,250,253,0)'); g.addColorStop(.5, 'rgba(245,250,253,' + a + ')'); g.addColorStop(1, 'rgba(245,250,253,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y - h, HW, h * 2);
  }
  // 石峰：陡峭的两侧、圆钝的峰顶，边缘带一点起伏；颜色自峰顶向山脚褪进雾里
  function peak(ctx, r, cx, base, w, h, rgb, a) {
    var k = 2.4 + r() * 1.6, lean = (r() - .5) * .35, ph = r() * 9;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base + 20);
    for (var i = 0; i <= 48; i++) {
      var u = i / 24 - 1, prof = 1 - Math.pow(Math.abs(u), k);
      var jag = (Math.sin(u * 11 + ph) * .035 + Math.sin(u * 27 + ph * 2) * .015) * prof;
      ctx.lineTo(cx + u * w / 2 + lean * prof * w * .5, base - h * (prof + jag));
    }
    ctx.lineTo(cx + w / 2, base + 20);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(.55, 'rgba(' + rgb + ',' + a * .75 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.fill();
  }
  function paintScene() {
    sceneCv.width = Math.round(HW * DPR); sceneCv.height = Math.round(HH * DPR);
    var ctx = sceneCv.getContext('2d'), r = rng(11), W = HW, H = HH, U = Math.max(W, H * 1.1), i; // U：竖屏时峰宽按高度算，免得山变成细针
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#74CDF7'); g.addColorStop(.38, '#A6DFF9'); g.addColorStop(.7, '#D7F0FB'); g.addColorStop(1, '#F5FAFD');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var sun = ctx.createRadialGradient(W * .78, H * .2, 0, W * .78, H * .2, H * .42);
    sun.addColorStop(0, 'rgba(255,255,255,.95)'); sun.addColorStop(.25, 'rgba(255,255,255,.5)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 8; i++) peak(ctx, r, W * (.08 + i * .12 + r() * .05), H * .8, U * (.05 + r() * .06), H * (.28 + r() * .22), '168,205,226', .8);
    mist(ctx, H * .72, H * .12, .8);
    for (i = 0; i < 5; i++) peak(ctx, r, W * (.3 + i * .16 + r() * .04), H * .92, U * (.07 + r() * .06), H * (.3 + r() * .28), '124,175,205', .9);
    mist(ctx, H * .86, H * .12, .85);
    peak(ctx, r, W * .02, H * 1.04, U * .2, H * .78, '88,145,182', .95);
    peak(ctx, r, W * .96, H * 1.04, U * .18, H * .7, '88,145,182', .95);
    mist(ctx, H, H * .14, .95);
  }

  // ---------- 首屏：遮住仙山的云，每缕预先画成贴图（半分辨率，云本来就软），散开时只做位移、拉伸与淡出 ----------
  var sprites = [];
  function buildVeil() {
    veil.width = Math.round(HW * DPR); veil.height = Math.round(HH * DPR);
    var r = rng(9), U = Math.max(HW, HH * .9), k = clamp(U / 1200, .6, 1.2); // 按长边定尺寸，竖屏也盖得住
    sprites = [];
    for (var i = 0; i < 52; i++) {
      var z = r(), len = U * (.3 + r() * .4), thick = (22 + r() * 30) * k * (.7 + z * .6), pad = thick * 3;
      var c = document.createElement('canvas'), w = len + pad * 2, h = thick * 6;
      c.width = Math.ceil(w / 2); c.height = Math.ceil(h / 2);
      var ctx = c.getContext('2d');
      ctx.scale(.5, .5);
      wisp(ctx, pad, h / 2, len, thick, .13 + r() * .06, 100 + i);
      var x = HW * (-.1 + r() * 1.2);
      sprites.push({ c: c, w: w, h: h, x: x, y: HH * (.02 + r() * .96), z: z, side: x < HW / 2 ? -1 : 1 });
    }
    sprites.sort(function (a, b) { return a.z - b.z; });
  }
  // 云开两侧：左半的云往左、右半的往右，越近的走得越远，边走边拉长、淡去；一滚就动，先快后慢
  function easeOut(v) { return 1 - Math.pow(1 - v, 2.2); }
  function drawVeil(p) {
    var ctx = veil.getContext('2d'), e = easeOut(p);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, HW, HH);
    sprites.forEach(function (s) {
      var a = 1 - smooth(.05 + s.z * .15, .8, p);
      if (a <= .01) return;
      var sx = 1 + e * .9, x = s.x + s.side * e * HW * (.55 + .5 * s.z), y = s.y - e * HH * .06 * s.z;
      ctx.globalAlpha = a;
      ctx.drawImage(s.c, x - s.w * sx / 2, y - s.h / 2, s.w * sx, s.h);
    });
    ctx.globalAlpha = 1;
  }

  // ---------- 丝带：起伏与翻转画在形状里，只随滚动画出；起伏的相位也由滚动推着走，自己不会动 ----------
  var N = 140;
  function sample(path) {
    var L = path.getTotalLength(), pts = [];
    for (var i = 0; i <= N; i++) {
      var at = L * i / N, a = path.getPointAtLength(at);
      var b = path.getPointAtLength(Math.min(L, at + 1)), c = path.getPointAtLength(Math.max(0, at - 1));
      var dx = b.x - c.x, dy = b.y - c.y, len = Math.hypot(dx, dy) || 1;
      pts.push([a.x, a.y, -dy / len, dx / len]); // 点与法线
    }
    return pts;
  }
  function makeRibbon(svg) {
    var band = svg.querySelector('.band'), strand = svg.querySelector('.strand'), bp, sp, unit = 1;
    return {
      shape: function (box, bandD, strandD) {
        svg.setAttribute('viewBox', box);
        band.setAttribute('d', bandD); strand.setAttribute('d', strandD);
        bp = sample(band); sp = sample(strand);
        unit = Math.max(.7, Math.sqrt(svg.viewBox.baseVal.width / 1440)); // 窄的画布上起伏与宽度相应收小
      },
      draw: function (grow, phase) {
        var to = Math.floor(grow * N), top = '', bot = '', line = '';
        for (var i = 0; i <= to; i++) {
          var s = i / N, p = bp[i], q = sp[i], env = Math.sin(Math.PI * s);
          var sway = 16 * unit * env * Math.sin(s * 7 - phase), sway2 = 16 * unit * env * Math.sin(s * 7 - phase - .6);
          var half = 9 * unit * Math.sqrt(env) * (.15 + .85 * Math.abs(Math.cos(s * 5 - phase * .6))); // |cos| 让丝带看起来在翻转
          var x = p[0] + p[2] * sway, y = p[1] + p[3] * sway, cmd = i ? 'L' : 'M';
          top += cmd + (x + p[2] * half).toFixed(1) + ' ' + (y + p[3] * half).toFixed(1);
          bot = 'L' + (x - p[2] * half).toFixed(1) + ' ' + (y - p[3] * half).toFixed(1) + bot;
          line += cmd + (q[0] + q[2] * sway2).toFixed(1) + ' ' + (q[1] + q[3] * sway2).toFixed(1);
        }
        band.setAttribute('d', to > 1 ? top + bot + 'Z' : '');
        strand.setAttribute('d', to > 1 ? line : '');
      }
    };
  }
  // 首屏：横屏托在文案下方再扬向右上；竖屏文案靠上，丝带改走下半屏
  var HERO_RIBBON = {
    wide: ['0 0 1440 900', 'M-60 720C200 640 420 720 660 640C860 570 900 400 1080 340C1240 290 1350 320 1500 240',
           'M-60 750C220 670 440 750 680 670C880 600 930 430 1100 370C1260 320 1360 350 1500 280'],
    tall: ['0 0 400 860', 'M-30 610C60 550 150 630 240 570C310 525 340 480 430 450',
           'M-30 632C70 572 160 652 250 594C320 550 350 506 430 478']
  };
  var heroRibbon = makeRibbon(document.querySelector('.hero .ribbon'));
  function shapeRibbon() { heroRibbon.shape.apply(null, HW < HH * .9 ? HERO_RIBBON.tall : HERO_RIBBON.wide); }
  function drawRibbon(grow, phase) { heroRibbon.draw(grow, phase); }

  // 品牌故事：丝带随滚动从右边画进来（CSS 按 --p 推 stroke-dashoffset）。
  // 横屏用原来的画法；竖屏区块又窄又高，按区块实际像素重排一条，免得只露出一小截
  var storySec = document.getElementById('story'), storySvg = storySec.querySelector('.story-ribbon'), storySilk = storySvg.querySelector('.silk');
  var STORY_WIDE = ['0 0 1440 700', storySilk.getAttribute('d')];
  var STORY_TALL = [1.1, .84, .8, .78, .7, .96, .45, .92, .25, .89, .1, .82, -.15, .9]; // 按区块宽高比例写的三次曲线
  function layoutStory() {
    var W = storySec.clientWidth, H = storySec.clientHeight;
    if (W >= H * .9) { storySvg.setAttribute('viewBox', STORY_WIDE[0]); storySilk.setAttribute('d', STORY_WIDE[1]); return; }
    var d = 'M' + (STORY_TALL[0] * W).toFixed(1) + ' ' + (STORY_TALL[1] * H).toFixed(1);
    for (var i = 2; i < STORY_TALL.length; i += 6) {
      d += 'C' + [0, 2, 4].map(function (j) { return (STORY_TALL[i + j] * W).toFixed(1) + ' ' + (STORY_TALL[i + j + 1] * H).toFixed(1); }).join(' ');
    }
    storySvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    storySilk.setAttribute('d', d);
  }

  // 首屏第一段：画面停住，云散、背景微微推近、丝带画出、文案浮现
  var lastA = -1;
  function heroStep(a) {
    if (a === lastA) return;
    lastA = a;
    drawVeil(a);
    drawRibbon(smooth(.2, .85, a), a * 3);
    sceneCv.style.transform = 'scale(' + (1.06 - .06 * easeOut(a)).toFixed(4) + ')';
    copyBits.forEach(function (el, i) {
      var o = smooth(.25 + i * .1, .6 + i * .1, a);
      el.style.setProperty('--reveal', o.toFixed(3));
      el.style.setProperty('--shown', o > .02 ? 'visible' : 'hidden');
    });
    hint.style.opacity = (1 - smooth(0, .1, a)).toFixed(3);
    mark.style.opacity = smooth(.05, .4, a).toFixed(3); // 字标随云散而浮现
  }

  function layoutHero() {
    HW = pin.clientWidth; HH = pin.clientHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
    paintScene(); buildVeil(); shapeRibbon(); lastA = -1;
  }

  // ---------- 海浪：两段相同的浪首尾相接，横移一半即无缝循环 ----------
  // data-wave="浪高,波长,相位"，波长需整除 1440
  [].forEach.call(document.querySelectorAll('[data-wave]'), function (svg) {
    var a = svg.getAttribute('data-wave').split(',').map(Number), W = 2880, H = 100, line = '';
    for (var x = 0; x <= W; x += 12) {
      var t = 2 * Math.PI * x / a[1];
      line += (x ? 'L' : 'M') + x + ' ' + (30 + a[0] * Math.sin(t + a[2]) + a[0] * .35 * Math.sin(2 * t + a[2] * 2)).toFixed(1);
    }
    [['body', line + 'L' + W + ' ' + H + 'L0 ' + H + 'Z'], ['crest', line]].forEach(function (p) {
      var n = document.createElementNS(SVGNS, 'path');
      n.setAttribute('class', p[0]); n.setAttribute('d', p[1]);
      svg.appendChild(n);
    });
  });

  // ---------- 跃鱼：一条抛物线跃出再落回浪里；空中点一下能再续跳一小截，每跳只续一次 ----------
  var leap = document.getElementById('leap'), sea = document.querySelector('.sea');
  var fish = null, seaVisible = false, seaSeen = false, leapTimer = 0;
  function jump() {
    var fw = leap.offsetWidth, fh = leap.offsetHeight, T = .8; // T：升到最高点用时
    var rise = fh * 2.4, g = 2 * rise / (T * T);
    fish = { x: sea.clientWidth * (.06 + Math.random() * .58), y: fh * 1.3, y0: fh * 1.3, vx: fw * 2.3 / (2 * T), vy: -g * T, g: g, boosted: false, last: performance.now() };
    leap.classList.add('go');
    requestAnimationFrame(fly);
  }
  function fly(now) {
    if (!fish) return;
    var dt = Math.min(.05, (now - fish.last) / 1000);
    fish.last = now;
    fish.vy += fish.g * dt; fish.x += fish.vx * dt; fish.y += fish.vy * dt;
    if (fish.vy > 0 && fish.y >= fish.y0) {
      fish = null;
      leap.classList.remove('go');
      queueJump(6000 + Math.random() * 14000);
      return;
    }
    var angle = Math.atan2(fish.vy, fish.vx) * 180 / Math.PI * .8;
    leap.style.transform = 'translate3d(' + fish.x.toFixed(1) + 'px,' + fish.y.toFixed(1) + 'px,0) rotate(' + angle.toFixed(1) + 'deg)';
    requestAnimationFrame(fly);
  }
  function queueJump(ms) {
    clearTimeout(leapTimer);
    leapTimer = setTimeout(function () { if (seaVisible) jump(); else leapTimer = 0; }, ms);
  }
  leap.addEventListener('pointerdown', function () {
    if (!fish || fish.boosted) return;
    fish.boosted = true;
    fish.vy = Math.min(fish.vy, 0) - fish.g * .42;
  });
  if (!still && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      seaVisible = entries[0].isIntersecting;
      if (!seaVisible) return;
      if (!seaSeen) { seaSeen = true; queueJump(500); } // 第一次看到海，半秒后就跳
      else if (!leapTimer && !fish) queueJump(1500 + Math.random() * 4000);
    }, { threshold: .6 }).observe(sea);
  }

  // ---------- 游戏方格 ----------
  var grid = document.getElementById('gameGrid');
  function renderGames(en) {
    grid.innerHTML = GAMES.map(function (g) {
      var plus = g.more ? '+' : '', name = en ? g.en : g.zh;
      var spec = en
        ? ['Ages ' + g.age + '+', g.ppl + ' players', g.min + plus + ' min']
        : [g.age + '+ 岁', g.ppl + ' 人', g.min + ' 分钟' + plus];
      return '<article class="tile" tabindex="0">' +
        '<span class="box"><img src="assets/games/' + g.img + '.webp" alt="' + name + '" loading="lazy"></span>' +
        '<div class="info"><h3>' + name + '</h3><p class="alt">' + (en ? g.zh : g.en) + '</p>' +
        '<p class="spec"><span>' + spec.join('</span><span>') + '</span></p></div></article>';
    }).join('');
  }

  // ---------- 中 / EN ----------
  var texts = [].slice.call(document.querySelectorAll('[data-en]'));
  var alts = [].slice.call(document.querySelectorAll('[data-en-alt]'));
  texts.forEach(function (n) { n.dataset.zh = n.innerHTML; });
  alts.forEach(function (n) { n.dataset.zhAlt = n.alt; });
  var langBtn = document.getElementById('lang');
  function setLang(lang) {
    var en = lang === 'en';
    root.lang = en ? 'en' : 'zh-CN';
    texts.forEach(function (n) { n.innerHTML = en ? n.dataset.en : n.dataset.zh; });
    alts.forEach(function (n) { n.alt = en ? n.dataset.enAlt : n.dataset.zhAlt; });
    langBtn.textContent = en ? '中' : 'EN';
    langBtn.setAttribute('aria-label', en ? '切换到中文' : 'Switch to English');
    renderGames(en);
  }
  langBtn.addEventListener('click', function () {
    var next = root.lang === 'en' ? 'zh' : 'en';
    setLang(next); store('yaofish-lang', next);
  });
  setLang(load('yaofish-lang') || 'zh');

  // ---------- 字标：首屏散云阶段停在大字位置，之后随页面卷动 0.4 屏缩进顶栏 ----------
  var mark = document.getElementById('mark'), slot = document.getElementById('slot'), dock = document.querySelector('.dock');
  function placeMark(q) {
    var s = slot.getBoundingClientRect(), d = dock.getBoundingClientRect();
    q = q * q * (3 - 2 * q);
    var k = (s.width + (d.width - s.width) * q) / d.width;
    mark.style.transform = 'translate3d(' + (s.left + (d.left - s.left) * q).toFixed(1) + 'px,' +
      (s.top + (d.top - s.top) * q).toFixed(1) + 'px,0) scale(' + k.toFixed(4) + ')';
  }

  // ---------- 滚动 ----------
  // 首屏先占用一段滚动距离散云（pin 粘住不动），之后页面正常下卷；
  // 品牌故事与页脚各自写入 --p（0→1），图层在 CSS 里按自己的速度取用
  var scenes = [].slice.call(document.querySelectorAll('[data-scene]'));
  var bar = document.getElementById('bar');
  var ticking = false;
  if (still) hero.classList.add('still');
  function update() {
    ticking = false;
    var vh = window.innerHeight, y = window.scrollY, hold = hero.offsetHeight - pin.offsetHeight;
    heroStep(still ? 1 : clamp(y / Math.max(1, hold), 0, 1));
    placeMark(clamp((y - hold) / (vh * .4), 0, 1));
    bar.classList.toggle('solid', y > hold + 40);
    if (still) return;
    scenes.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      el.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(4));
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  // 手机地址栏伸缩只改高度，宽度不变时不重画
  var paintedWidth = 0, repaint;
  function paintAll() {
    if (window.innerWidth !== paintedWidth) {
      paintedWidth = window.innerWidth;
      canvases.forEach(paintClouds);
      layoutHero();
      layoutStory();
    }
    update();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { clearTimeout(repaint); repaint = setTimeout(paintAll, 200); onScroll(); });
  paintAll();
})();
