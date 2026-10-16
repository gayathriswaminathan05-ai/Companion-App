// Beta landing page behaviour. Everything you may want to change lives in SITE.
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

// ---------- desk doodles (site/doodles.js) ----------
$$("[data-doodle]").forEach((el) => (el.innerHTML = window.DOODLES?.[el.dataset.doodle] ?? ""));

// ---------- names, links ----------
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
  feedbackBtn.href = SITE.feedbackUrl;
  feedbackBtn.target = "_blank";
  feedbackBtn.rel = "noopener";
} else {
  feedbackBtn.setAttribute("aria-disabled", "true");
  feedbackBtn.textContent = "Form coming soon";
  feedbackBtn.addEventListener("click", (e) => e.preventDefault());
}

// On a phone: offer to send the page to their Mac instead.
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

// ---------- header: clear over the hero, frosted white after ----------
const header = $("#top");
let headerTick = 0;
function updateHeader() {
  headerTick = 0;
  header.classList.toggle("solid", scrollY > 24);
}
addEventListener("scroll", () => (headerTick ||= requestAnimationFrame(updateHeader)), { passive: true });
updateHeader();

// ---------- simple sounds (same chirps as the app, made with WebAudio) ----------
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
  step: () => note(300 + Math.random() * 60, 240, 0, 0.06, 0.035, "sine"),
  giggle: () => {
    note(700, 900, 0, 0.07, 0.09);
    note(900, 700, 0.08, 0.07, 0.09);
    note(750, 950, 0.16, 0.07, 0.09);
    note(950, 750, 0.24, 0.09, 0.08);
  },
  grow: () => (note(520, 660, 0, 0.12), note(660, 880, 0.13, 0.16)),
  celebrate: () => {
    note(523, 540, 0, 0.09);
    note(659, 680, 0.09, 0.09);
    note(784, 810, 0.18, 0.14, 0.14);
    note(1046, 1080, 0.3, 0.18, 0.1, "sine");
  },
};
const play = (name) => {
  if (!soundOn) return; // the corner switch governs every sound
  try {
    chirp[name]();
  } catch {
    /* no audio */
  }
};

// ---------- one sound switch for the whole page ----------
// Off by default (browsers block sound until you click). Saying hi turns it on.
// When on: the plant's voice plays, and the story video on screen speaks.
const soundBtn = $("#soundToggle");
let soundOn = false;
const soundListeners = [];
function setSound(on) {
  soundOn = on;
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.classList.remove("attn");
  $("#soundLabel").textContent = on ? "Sound on" : "Sound off";
  soundBtn.querySelector("use").setAttribute("href", `assets/icons.svg#${on ? "speaker-on" : "speaker-off"}`);
  soundListeners.forEach((fn) => fn(on));
}
soundBtn.addEventListener("click", () => setSound(!soundOn));

// ---------- hero: walk in → talk → wait for "hi" → story ----------
const heroPlant = $("#heroPlant");
const byePlant = $(".bye-plant");
const walker = $("#walker");
const waddle = $("#waddle");
const bubble = $("#heroBubble");
const bubbleHi = $("#bubbleHi");
const bubbleSub = $("#bubbleSub");
const actions = $(".hero-actions");
const sayHi = $("#sayHi");
const voices = { intro: $("#vIntro"), nudge: $("#vNudge"), reply: $("#vReply"), listen: $("#vListen"), deaf: $("#vDeaf") };
let saidHi = false;
let introHeard = false;
let nudgeTimer = 0;

if (reduceMotion) {
  heroPlant.src = heroPlant.dataset.still;
  byePlant.src = byePlant.dataset.still;
}

function stopVoices() {
  Object.values(voices).forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
}
/** Play one of the plant's lines; resolves when it ends (or right away if it can't play). */
function speakLine(name) {
  stopVoices();
  const a = voices[name];
  return a.play().then(
    () => new Promise((done) => (a.onended = done)),
    () => Promise.reject(new Error("blocked")),
  );
}
function animate(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function showWave(ms) {
  if (reduceMotion) return;
  heroPlant.src = heroPlant.dataset.wave;
  setTimeout(() => !saidHi && (heroPlant.src = heroPlant.dataset.idle), ms);
}

// Typed text for the eyes; screen readers get the whole sentence at once.
async function typeInto(el, html) {
  if (reduceMotion) return void (el.innerHTML = html);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const plain = tmp.textContent;
  el.innerHTML = "";
  const sr = Object.assign(document.createElement("span"), { className: "sr-only", textContent: plain });
  const tw = document.createElement("span");
  tw.setAttribute("aria-hidden", "true");
  el.append(sr, tw);
  tw.classList.add("typing");
  for (let i = 1; i <= plain.length; i++) {
    tw.textContent = plain.slice(0, i);
    await sleep(i < 5 ? 55 : 24);
  }
  tw.classList.remove("typing");
  tw.innerHTML = html; // keep the highlight once typed
}

const INTRO_HI = bubbleHi.innerHTML;
const INTRO_SUB = bubbleSub.innerHTML;

async function intro() {
  if (reduceMotion) return startWaiting(false);
  bubble.classList.add("pending");
  actions.classList.add("pending");
  walker.classList.add("offstage");
  await sleep(500);
  // Little footsteps if the browser lets us make sound already.
  const steps = setInterval(() => play("step"), 440);
  walker.classList.add("walking");
  walker.classList.remove("offstage");
  await sleep(3100);
  clearInterval(steps);
  walker.classList.remove("walking");
  animate(waddle, "land");
  await sleep(420);
  bubble.classList.remove("pending");
  // Talk: try the voice (works if the browser allows sound), type along either way.
  stopVoices();
  // Some browsers refuse sound outright, some just never start it: if the voice
  // isn't playing within ~1s, treat it as muted and point at the sound switch.
  const talking = new Promise((done) => {
    const a = voices.intro;
    let started = false;
    const muted = () => {
      if (started) return;
      soundBtn.classList.add("attn");
      done();
    };
    a.addEventListener(
      "playing",
      () => {
        started = true;
        introHeard = true;
        setSound(true); // it's talking out loud, so the switch shows sound on
      },
      { once: true },
    );
    a.onended = done;
    a.play().catch(muted);
    setTimeout(muted, 1200);
  });
  await typeInto(bubbleHi, INTRO_HI);
  setTimeout(() => actions.classList.remove("pending"), 300);
  await typeInto(bubbleSub, INTRO_SUB);
  showWave(2600);
  // Count the 2.5s from when it has finished asking (voice end, or text end if muted).
  await Promise.race([talking, sleep(9000)]);
  startWaiting(true);
}

// The plant asked for a hi. No hi within ~2.5s → the button jitters and the
// plant says "I'm waiting for your hi!". After that, just a quiet jitter every
// few seconds (no more talking, so it never nags).
function startWaiting(animated) {
  actions.classList.remove("pending");
  bubble.classList.remove("pending");
  let asks = 0;
  const ask = () => {
    if (saidHi || asks >= 4) return;
    if (listening) return void (nudgeTimer = setTimeout(ask, 6000));
    asks++;
    animate(sayHi, "jitter");
    if (asks === 1) {
      bubble.classList.add("swap");
      bubbleSub.innerHTML = "Hellooo? <mark>I'm waiting for your hi!</mark>";
      setTimeout(() => bubble.classList.remove("swap"), 450);
      if (animated) {
        animate(waddle, "hop");
        showWave(2400);
      }
      if (soundOn) speakLine("nudge").catch(() => {});
    }
    nudgeTimer = setTimeout(ask, 6000);
  };
  nudgeTimer = setTimeout(ask, 2500);
}

// Turning sound on in the hero before saying hi: let them hear the intro.
soundListeners.push((on) => {
  if (!on) return stopVoices();
  if (!saidHi && !introHeard && scrollY < innerHeight * 0.5) {
    introHeard = true;
    speakLine("intro").catch(() => {});
  }
});

// The hi: they actually say it out loud. The mic only measures loudness in the
// browser (no recording, no speech service): a short burst of voice = "hi".
// No mic / denied / they'd rather not → "Wave instead" counts too.
let listening = false;
let micStream = null;
function setHiText(t) {
  $("#sayHiText").textContent = t;
}
function bubbleSay(hi, sub) {
  bubble.classList.add("swap");
  if (hi !== null) bubbleHi.textContent = hi;
  bubbleSub.innerHTML = sub;
  setTimeout(() => bubble.classList.remove("swap"), 450);
}
function stopMic() {
  listening = false;
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  sayHi.classList.remove("listening");
}
const bars = $$(".btn-hi .levels i");

async function listenForHi() {
  if (listening || saidHi) return;
  clearTimeout(nudgeTimer);
  setSound(true); // a tap is permission to talk back
  if (!navigator.mediaDevices?.getUserMedia) return noMic();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return noMic();
  }
  listening = true;
  sayHi.classList.add("listening");
  setHiText("Listening… say hi!");
  bubbleSay(null, "<mark>I'm listening!</mark> Say hi!");
  // Say "I'm listening" first, then start measuring (so I don't hear myself).
  await Promise.race([speakLine("listen").catch(() => {}), sleep(2600)]);
  if (!listening) return;
  ac ||= new AudioContext();
  await ac.resume();
  const an = ac.createAnalyser();
  an.fftSize = 1024;
  ac.createMediaStreamSource(micStream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let last = t0;
  let floor = 0.006;
  let voiced = 0;
  const tick = (t) => {
    if (!listening) return;
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const dt = t - last;
    last = t;
    if (t - t0 < 350) floor = Math.max(floor, rms); // room noise
    const thr = Math.max(0.025, floor * 2.6);
    const lvl = Math.min(1, rms / (thr * 1.6));
    bars.forEach((b, i) => (b.style.height = `${6 + lvl * (10 + ((i * 7) % 11))}px`));
    voiced = rms > thr ? voiced + dt : Math.max(0, voiced - dt * 0.6);
    if (voiced > 170) {
      stopMic();
      return heardHi();
    }
    if (t - t0 > 9000) {
      stopMic();
      setHiText("Say hi back");
      bubbleSay(null, "Hmm, I can't hear you. <mark>Try again, or just wave!</mark>");
      speakLine("deaf").catch(() => {});
      animate(sayHi, "jitter");
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function noMic() {
  stopMic();
  setHiText("Wave hi");
  sayHi.querySelector(".hi-icon use").setAttribute("href", "assets/icons.svg#wave");
  sayHi.dataset.mode = "wave";
  bubbleSay(null, "No mic? No problem. <mark>Just wave at me!</mark>");
  animate(sayHi, "jitter");
}

async function heardHi() {
  if (saidHi) return;
  saidHi = true;
  clearTimeout(nudgeTimer);
  stopMic();
  setSound(true); // they're engaging: the plant answers out loud, the story speaks
  play("pop");
  sayHi.classList.add("done");
  sayHi.querySelector(".hi-icon use").setAttribute("href", "assets/icons.svg#wave");
  setHiText("You said hi!");
  sayHi.setAttribute("aria-disabled", "true");
  bubbleSay("Yaaay, hi!", "Okay, come with me. <mark>Let me show you our day together!</mark>");
  if (!reduceMotion) {
    heroPlant.src = heroPlant.dataset.wave;
    animate(waddle, "hop");
  }
  await Promise.race([speakLine("reply").catch(() => sleep(2200)), sleep(5200)]);
  if (!reduceMotion) heroPlant.src = heroPlant.dataset.idle;
  // The story starts now: the plant walks them through the day.
  if (scrollY < innerHeight * 0.6) runTour(0);
}

sayHi.addEventListener("click", () => {
  if (saidHi) return;
  if (sayHi.dataset.mode === "wave") return void heardHi();
  listenForHi();
});
$("#waveInstead").addEventListener("click", () => heardHi());

intro();

// ---------- story videos: load near view, play in view, sound follows the switch ----------
const videos = $$(".clip video");
let current = null; // the video that has the screen right now
const load = (v) => {
  if (!v.getAttribute("src")) v.src = v.dataset.src;
};
function giveVoice(v) {
  if (touring) return void videos.forEach((o) => (o.muted = true)); // the plant is narrating
  videos.forEach((o) => (o.muted = o !== v || !soundOn));
  if (v && soundOn) {
    stopVoices();
    v.currentTime = 0; // its line is at the start
  }
}
soundListeners.push((on) => {
  videos.forEach((o) => (o.muted = true));
  if (on && current) giveVoice(current);
});
const nearby = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      load(e.target);
      nearby.unobserve(e.target);
    }),
  { rootMargin: "700px 0px" },
);
const inView = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        load(v);
        if (current !== v) {
          current = v;
          giveVoice(v);
        }
        if (!reduceMotion) v.play().catch(() => {});
      } else {
        if (!v.paused) v.pause();
        if (current === v) current = null;
      }
    }),
  { threshold: [0, 0.5] },
);
videos.forEach((v) => {
  if (reduceMotion) v.controls = true;
  nearby.observe(v);
  inView.observe(v);
});
// Leaving the hero hushes the plant's voice lines.
new IntersectionObserver((entries) => entries.forEach((e) => !e.isIntersecting && stopVoices()), { threshold: 0 }).observe(
  $("#hello"),
);

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
  const still = `assets/plant/stage-${n}-still.webp`;
  growPlant.alt = `The plant at stage ${n}: ${LABELS[n - 1]}`;
  if (reduceMotion || !growVisible) {
    growPlant.src = still;
  } else {
    // Show the still instantly, swap to the breathing loop once it's loaded.
    growPlant.src = still;
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
  const pct = (points / 12) * 100;
  $("#growFill").style.width = `${pct}%`;
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
    } else {
      play(up ? "grow" : "pop");
    }
  }),
);
$("#growReset").addEventListener("click", () => {
  points = 0;
  stage = 1;
  renderGrow(true);
  play("pop");
});

new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting) && !growVisible) {
      growVisible = true;
      showPlant(stage, false);
    }
  },
  { rootMargin: "300px 0px" },
).observe(growStage);
renderGrow(false);

// Little burst of clay leaves and petals at full bloom.
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

// ---------- chill: chat plays out, jokes, hammock ----------
const chatMsgs = $$("#chat .msg");
const typingDots = $("#chat .typing-dots");
let chatPlayed = false;
async function playChat() {
  if (chatPlayed) return;
  chatPlayed = true;
  for (const m of chatMsgs) {
    if (m.classList.contains("plant") && !reduceMotion) {
      m.before(typingDots); // the plant "types" right where its reply will land
      typingDots.classList.add("on");
      await sleep(900);
      typingDots.classList.remove("on");
    }
    m.classList.add("in");
    if (m.classList.contains("plant")) play("pop");
    await sleep(reduceMotion ? 0 : 650);
  }
}
if (reduceMotion) chatMsgs.forEach((m) => m.classList.add("in"));

// A few from the app's joke book (src/jokes.ts).
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
const jokeQ = $("#jokeQ");
const jokeA = $("#jokeA");
const jokeWhat = $("#jokeWhat");
const jokeNext = $("#jokeNext");
function revealJoke() {
  jokeFlip.classList.add("flipped"); // the sticky note flips to the punchline
  jokeWhat.hidden = true;
  jokeNext.hidden = false;
  play("giggle");
}
jokeWhat.addEventListener("click", revealJoke);
jokeNext.addEventListener("click", async () => {
  jokeIdx = (jokeIdx + 1) % JOKES.length;
  jokeFlip.classList.remove("flipped");
  jokeNext.hidden = true;
  jokeWhat.hidden = false;
  play("pop");
  jokeQ.textContent = JOKES[jokeIdx][0];
  await sleep(reduceMotion ? 0 : 380); // swap the punchline while it's facing away
  jokeA.textContent = JOKES[jokeIdx][1];
});

const hammock = $(".hammock");
new IntersectionObserver(
  (entries, io) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      if (!reduceMotion) hammock.src = hammock.dataset.anim;
      playChat();
      io.disconnect();
    }),
  { threshold: 0.35 },
).observe($(".chill-grid"));

// ---------- the story tour: after "hi", the plant narrates the page ----------
// Scrolls itself section by section; the plant says a line for each (with a
// caption, so it works with sound off). Any scroll/swipe/key by the visitor
// pauses it; "Continue the story" picks up from wherever they are.
const STEPS = [...$$("#story > section"), $("#download")];
const TOUR_TEXT = [
  "This is you at nine. Chai, big plans… and by noon? A stiff neck and a full inbox.",
  "And then, I pop up! I live right in the corner of your screen.",
  "Every hour or so, I ask: stretch with me? We stretch together, and I grow a little.",
  "Water break! I water myself, so you remember to sip yours too.",
  "New email? I tell you who it's from, so you can stop checking your inbox.",
  "Need to call mom at six? I ring my little bell, right on time.",
  "Finished the big task? Pop! We celebrate every win.",
  "And look! Every stretch, every sip, every task helps me grow… all the way to full bloom!",
  "Or just chill with me! Tell me about your day, ask me anything, or let me tell you a silly joke. And when it's quiet… I swing in my hammock.",
  "At bedtime, I get sleepy, and remind you to rest too. Goodnight!",
  "That's our day together! Bring me to your Mac, and you'll never be alone at your desk.",
];
// The narrator's little avatar grows through the day, like the real plant.
const TOUR_STAGE = [1, 1, 2, 3, 3, 4, 5, 7, 7, 7, 7];
const narrator = $("#narrator");
const narratorText = $("#narratorText");
const narratorPlant = $("#narratorPlant");
const tourBtn = $("#tourBtn");
const tourAudio = new Audio();
tourAudio.preload = "auto";
let touring = false;
let tourRun = 0;
let cutLine = null; // finishes the current line early (sound switched off, paused)

function setTourBtn(state) {
  // state: "playing" | "paused" | "hidden"
  tourBtn.hidden = state === "hidden";
  $("#tourLabel").textContent = state === "playing" ? "Pause the story" : "Continue the story";
  tourBtn.querySelector("use").setAttribute("href", `assets/icons.svg#${state === "playing" ? "pause" : "play"}`);
}

function narrate(i, run) {
  narratorPlant.src = `assets/icons/stage-${TOUR_STAGE[i]}.png`;
  narratorText.textContent = TOUR_TEXT[i];
  narrator.classList.remove("hide");
  animate(narrator, "swap");
  narrator.classList.add("speaking");
  const words = TOUR_TEXT[i].split(/\s+/).length;
  const readMs = Math.max(3200, words * 330);
  return new Promise((done) => {
    const finish = () => {
      cutLine = null;
      narrator.classList.remove("speaking");
      done();
    };
    cutLine = finish;
    if (soundOn && run === tourRun) {
      tourAudio.src = `assets/audio/tour-${i + 1}.m4a`;
      tourAudio.onended = finish;
      tourAudio.play().catch(() => setTimeout(finish, readMs));
    } else {
      setTimeout(finish, readMs);
    }
  });
}

/** Which step is on screen now (to resume from there). */
function currentStep() {
  const mid = innerHeight * 0.45;
  const i = STEPS.findIndex((el) => el.getBoundingClientRect().bottom > mid);
  return i < 0 ? STEPS.length - 1 : i;
}

async function runTour(from) {
  if (reduceMotion) return void $("#story").scrollIntoView();
  const run = ++tourRun;
  touring = true;
  setTourBtn("playing");
  videos.forEach((o) => (o.muted = true)); // the plant narrates over the scenes
  for (let i = from; i < STEPS.length; i++) {
    if (run !== tourRun) return;
    const el = STEPS[i];
    // Chapters and the growth card sit centred; the download section from its top.
    const target = el.id === "grow" ? $(".grow-card") : el.id === "chill" ? $(".chill-grid") : el;
    target.scrollIntoView({ behavior: "smooth", block: el.id === "download" ? "start" : "center" });
    await sleep(1150);
    if (run !== tourRun) return;
    if (el.id === "grow") autoGrow(run);
    if (el.id === "chill") {
      playChat();
      setTimeout(() => run === tourRun && !jokeWhat.hidden && revealJoke(), 4200);
    }
    await narrate(i, run);
    if (run !== tourRun) return;
    await sleep(i === STEPS.length - 1 ? 2200 : 800);
  }
  if (run !== tourRun) return;
  touring = false;
  narrator.classList.add("hide");
  setTourBtn("hidden");
  if (soundOn && current) giveVoice(current);
}

function pauseTour() {
  if (!touring) return;
  tourRun++;
  touring = false;
  tourAudio.pause();
  cutLine?.();
  narrator.classList.add("hide");
  setTourBtn("paused");
}

tourBtn.addEventListener("click", () => (touring ? pauseTour() : runTour(currentStep())));
// The visitor takes the wheel: pause politely.
for (const ev of ["wheel", "touchmove"]) addEventListener(ev, pauseTour, { passive: true });
addEventListener("keydown", (e) => {
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(e.key)) pauseTour();
});
document.addEventListener("click", (e) => {
  if (e.target.closest('a[href^="#"]')) pauseTour();
});
// Sound switched off mid-line: finish the line by caption timing instead.
soundListeners.push((on) => {
  if (!on && touring) {
    tourAudio.pause();
    const cut = cutLine;
    if (cut) setTimeout(cut, 1800);
  }
});

// At the growth section the plant grows itself to full bloom as it talks.
async function autoGrow(run) {
  points = 0;
  stage = 1;
  renderGrow(true);
  const order = [0, 1, 0, 1, 0, 1]; // stretch, water, … (+2 each) → 12 = full bloom
  for (const k of order) {
    await sleep(720);
    if (run !== tourRun || stage === 7) return;
    chips[k].click();
  }
}

// ---------- gentle reveal on scroll ----------
const reveal = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      reveal.unobserve(e.target);
    }),
  { rootMargin: "0px 0px -12% 0px" },
);
$$(".words, .clip, .growth-head, .grow-card, .card, .download h2").forEach((el) => {
  el.classList.add("reveal");
  reveal.observe(el);
});
