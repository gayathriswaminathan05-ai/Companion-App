// Landing page VERSION B (Tolan-style): trailer card + use-case cards, plain
// manual scroll. Shares SITE settings, doodles and the growth demo with A.
const SITE = {
  appName: "Companion", // the final app name drops in here
  downloadUrl: "", // link to the .dmg once it's uploaded (e.g. Cloudflare R2)
  feedbackUrl: "", // link to the feedback form
};

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
document.documentElement.classList.add("js");

// ---------- doodles, names, links ----------
$$("[data-doodle]").forEach((el) => (el.innerHTML = window.DOODLES?.[el.dataset.doodle] ?? ""));
$$("[data-app-name]").forEach((el) => (el.textContent = SITE.appName));
document.title = `${SITE.appName} · a little desk plant for your Mac`;

const downloadBtn = $("#downloadBtn");
if (SITE.downloadUrl) {
  downloadBtn.href = SITE.downloadUrl;
} else {
  downloadBtn.setAttribute("aria-disabled", "true");
  downloadBtn.addEventListener("click", (e) => e.preventDefault());
  $("#downloadNote").textContent = "The download opens with the beta · Mac with an Apple chip · macOS 12 or later";
}
const feedbackBtn = $("#feedbackBtn");
if (SITE.feedbackUrl) {
  Object.assign(feedbackBtn, { href: SITE.feedbackUrl, target: "_blank", rel: "noopener" });
} else {
  feedbackBtn.setAttribute("aria-disabled", "true");
  feedbackBtn.textContent = "Form coming soon";
  feedbackBtn.addEventListener("click", (e) => e.preventDefault());
}
const shareBtn = $("#shareBtn");
if (matchMedia("(pointer: coarse) and (max-width: 860px)").matches) {
  shareBtn.hidden = false;
  shareBtn.addEventListener("click", async () => {
    const data = { title: SITE.appName, text: "Open this on your Mac to get your desk plant", url: location.href };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(location.href);
      shareBtn.lastChild.textContent = " Link copied";
    } catch {
      /* closed the share sheet */
    }
  });
}

// ---------- header ----------
const header = $("#top");
let headerTick = 0;
addEventListener(
  "scroll",
  () =>
    (headerTick ||= requestAnimationFrame(() => {
      headerTick = 0;
      header.classList.toggle("solid", scrollY > 24);
    })),
  { passive: true },
);

// ---------- little sounds (the app's chirps) ----------
let ac = null;
function note(f0, f1, t0, dur, peak = 0.12, type = "triangle") {
  ac ||= new AudioContext();
  const o = ac.createOscillator();
  const g = ac.createGain();
  const t = ac.currentTime + t0;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
const chirp = {
  pop: () => (note(600, 750, 0, 0.08, 0.1), note(750, 700, 0.09, 0.1, 0.07)),
  grow: () => (note(520, 660, 0, 0.12), note(660, 880, 0.13, 0.16)),
  celebrate: () => {
    note(523, 540, 0, 0.09);
    note(659, 680, 0.09, 0.09);
    note(784, 810, 0.18, 0.14, 0.14);
    note(1046, 1080, 0.3, 0.18, 0.1, "sine");
  },
  giggle: () => {
    note(700, 900, 0, 0.07, 0.09);
    note(900, 700, 0.08, 0.07, 0.09);
    note(750, 950, 0.16, 0.07, 0.09);
    note(950, 750, 0.24, 0.09, 0.08);
  },
};
// Only ever after a click (these all come from buttons), so no autoplay issues.
const play = (name) => {
  try {
    chirp[name]();
  } catch {
    /* no audio */
  }
};

// ---------- plant animations: still first, animate when on screen ----------
if (reduceMotion) {
  $$(".perch[data-still], .bye-plant[data-still]").forEach((img) => (img.src = img.dataset.still));
}
const animIO = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const img = e.target;
      animIO.unobserve(img);
      if (reduceMotion) return;
      const pre = new Image();
      pre.onload = () => (img.src = img.dataset.anim);
      pre.src = img.dataset.anim;
    }),
  { rootMargin: "200px 0px" },
);
$$("img[data-anim]").forEach((img) => animIO.observe(img));

// ---------- trailer: small card in the corner → expands into the full trailer ----------
const miniWrap = $("#miniWrap");
const miniVideo = $("#miniTrailer video");
const modal = $("#trailerModal");
const trailer = $("#trailerVideo");
let lastFocus = null;
let miniDismissed = false;
try {
  miniDismissed = sessionStorage.getItem("miniTrailerHidden") === "1";
} catch {
  /* storage blocked: just show it */
}
const showMini = () => {
  if (miniDismissed || !miniWrap.classList.contains("hide")) return;
  miniWrap.classList.remove("hide");
  if (!reduceMotion) miniVideo.play().catch(() => {});
};
if (innerWidth >= 900) {
  setTimeout(showMini, 1400); // wide screens: the corner is free
} else {
  // phones: wait until the hero buttons are scrolled away, so it never covers them
  new IntersectionObserver((entries) => entries.forEach((e) => !e.isIntersecting && showMini())).observe($(".b-ctas"));
}
$("#miniClose").addEventListener("click", () => {
  miniWrap.classList.add("hide");
  miniVideo.pause();
  try {
    sessionStorage.setItem("miniTrailerHidden", "1");
  } catch {
    /* fine */
  }
});

function openTrailer() {
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  miniVideo.pause();
  trailer.currentTime = 0;
  trailer.muted = false;
  trailer.play().catch(() => {});
  modal.querySelector(".modal-close").focus();
}
function closeTrailer() {
  if (modal.hidden) return;
  trailer.pause();
  modal.hidden = true;
  document.body.style.overflow = "";
  if (!miniWrap.classList.contains("hide") && !reduceMotion) miniVideo.play().catch(() => {});
  lastFocus?.focus?.();
}
$("#miniTrailer").addEventListener("click", openTrailer);
$("#watchTrailer").addEventListener("click", openTrailer);
modal.addEventListener("click", (e) => e.target.closest("[data-close]") && closeTrailer());
addEventListener("keydown", (e) => e.key === "Escape" && closeTrailer());
trailer.addEventListener("ended", () => setTimeout(closeTrailer, 900));

// ---------- growth demo ----------
const LABELS = ["tiny sprouts", "little leaves", "filling out", "looking lush", "flower bud", "pink bloom", "full bloom"];
const GLOW = [
  "rgb(46 160 100 / 0.22)",
  "rgb(46 160 100 / 0.28)",
  "rgb(70 184 106 / 0.32)",
  "rgb(90 200 120 / 0.36)",
  "rgb(242 162 189 / 0.3)",
  "rgb(242 162 189 / 0.38)",
  "rgb(255 182 210 / 0.46)",
];
const stageFor = (p) => (p >= 12 ? 7 : p >= 10 ? 6 : p >= 8 ? 5 : p >= 6 ? 4 : p >= 4 ? 3 : p >= 2 ? 2 : 1);
const growPlant = $("#growPlant");
const growStage = $("#growStage");
const chips = $$(".grow-buttons .chip");
let points = 0;
let stage = 1;
let growVisible = false;

function showPlant(n, pop) {
  const anim = `assets/plant/stage-${n}.webp`;
  growPlant.alt = `The plant at stage ${n}: ${LABELS[n - 1]}`;
  growPlant.src = `assets/plant/stage-${n}-still.webp`;
  if (!reduceMotion && growVisible) {
    const img = new Image();
    img.onload = () => stage === n && (growPlant.src = anim);
    img.src = anim;
  }
  if (pop && !reduceMotion) {
    growPlant.classList.remove("pop");
    void growPlant.offsetWidth;
    growPlant.classList.add("pop");
  }
}
function renderGrow(levelUp) {
  $("#growFill").style.width = `${(points / 12) * 100}%`;
  $("#growMeter").setAttribute("aria-valuenow", String(points));
  growStage.style.setProperty("--glow", GLOW[stage - 1]);
  $("#growLabel").textContent = `Stage ${stage} · ${LABELS[stage - 1]}`;
  $$("#journey li").forEach((li) => {
    const n = Number(li.dataset.stage);
    li.classList.toggle("now", n === stage);
    li.classList.toggle("ahead", n > stage);
  });
  if (levelUp) showPlant(stage, true);
  const full = stage === 7;
  chips.forEach((c) => (c.disabled = full));
  $("#growReset").hidden = points === 0;
  $("#growNote").textContent = full
    ? "In full bloom! What a day. Tomorrow I start small again: no streaks, no guilt."
    : "Tomorrow I start small again. No streaks to break, no guilt.";
}
chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    const before = stage;
    points = Math.min(12, points + Number(chip.dataset.points));
    stage = stageFor(points);
    const up = stage > before;
    renderGrow(up);
    if (stage === 7 && up) {
      play("celebrate");
      confetti();
    } else play(up ? "grow" : "pop");
  }),
);
$("#growReset").addEventListener("click", () => {
  points = 0;
  stage = 1;
  renderGrow(true);
  play("pop");
});
new IntersectionObserver(
  (entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    growVisible = true;
    showPlant(stage, false);
    io.disconnect();
  },
  { rootMargin: "300px 0px" },
).observe(growStage);
renderGrow(false);

function confetti() {
  if (reduceMotion) return;
  const canvas = $("#confetti");
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const colours = ["#2ea064", "#7fd38a", "#f2a2bd", "#ffc78e", "#b9aeff", "#ff8fb1"];
  const bits = Array.from({ length: 70 }, () => ({
    x: r.width / 2 + (Math.random() - 0.5) * 60,
    y: r.height * 0.45,
    vx: (Math.random() - 0.5) * 9,
    vy: -6 - Math.random() * 7,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 7,
    h: 4 + Math.random() * 5,
    c: colours[(Math.random() * colours.length) | 0],
    leaf: Math.random() < 0.6,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const life = (t - t0) / 1600;
    g.clearRect(0, 0, r.width, r.height);
    for (const b of bits) {
      b.vy += 0.28;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vr;
      g.save();
      g.globalAlpha = Math.max(0, 1 - life * life);
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      g.fillStyle = b.c;
      g.beginPath();
      if (b.leaf) g.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      else g.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 2);
      g.fill();
      g.restore();
    }
    if (life < 1) requestAnimationFrame(frame);
    else g.clearRect(0, 0, r.width, r.height);
  })(t0);
}

// ---------- hangs out: chat plays out, jokes flip ----------
const chatMsgs = $$("#chat .msg");
const typingDots = $("#chat .typing-dots");
let chatPlayed = false;
async function playChat() {
  if (chatPlayed) return;
  chatPlayed = true;
  for (const m of chatMsgs) {
    if (m.classList.contains("plant") && !reduceMotion) {
      m.before(typingDots);
      typingDots.classList.add("on");
      await sleep(900);
      typingDots.classList.remove("on");
    }
    m.classList.add("in");
    await sleep(reduceMotion ? 0 : 650);
  }
}
if (reduceMotion) chatMsgs.forEach((m) => m.classList.add("in"));
new IntersectionObserver(
  (entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    playChat();
    io.disconnect();
  },
  { threshold: 0.4 },
).observe($("#chat"));

const JOKES = [
  ["What do you call a fake noodle?", "An impasta!"],
  ["Why do programmers prefer dark mode?", "Because light attracts bugs!"],
  ["Why was the computer cold?", "It left its windows open!"],
  ["What do you call cheese that isn't yours?", "Nacho cheese!"],
  ["Why did the coffee file a police report?", "It got mugged!"],
  ["Why do plants hate math?", "It gives them square roots!"],
  ["What do you call a sleeping bull?", "A bulldozer!"],
  ["Why did the scarecrow win an award?", "He was outstanding in his field!"],
  ["What's a tree's favourite drink?", "Root beer!"],
  ["What do you call a belt made of watches?", "A waist of time!"],
];
let jokeIdx = 0;
const jokeFlip = $("#jokeFlip");
const jokeWhat = $("#jokeWhat");
const jokeNext = $("#jokeNext");
jokeWhat.addEventListener("click", () => {
  jokeFlip.classList.add("flipped");
  jokeWhat.hidden = true;
  jokeNext.hidden = false;
  play("giggle");
});
jokeNext.addEventListener("click", async () => {
  jokeIdx = (jokeIdx + 1) % JOKES.length;
  jokeFlip.classList.remove("flipped");
  jokeNext.hidden = true;
  jokeWhat.hidden = false;
  play("pop");
  $("#jokeQ").textContent = JOKES[jokeIdx][0];
  await sleep(reduceMotion ? 0 : 380);
  $("#jokeA").textContent = JOKES[jokeIdx][1];
});

// ---------- gentle reveal on scroll ----------
const reveal = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      reveal.unobserve(e.target);
    }),
  { rootMargin: "0px 0px -10% 0px" },
);
$$(".b-head, .feat, .chill-card, .privacy-grid li, .card, .download h2").forEach((el) => {
  el.classList.add("reveal");
  reveal.observe(el);
});
