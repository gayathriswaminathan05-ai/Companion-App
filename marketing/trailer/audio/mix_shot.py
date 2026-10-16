"""Sound for one trailer shot: room tone + small foley + the app's real
chirps (same synthesis as src/sounds.ts) + the plant's real voice line.

  python mix_shot.py out.wav --dur 6.64 --pop 0.3 --vo vo-stretch.wav 0.55 \
      --clicks 0.15 0.55 --rustle 1.0 --giggle 5.0 [--music track.wav]
"""

import argparse
import os
import subprocess
import wave

import numpy as np

SR = 48000
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
FF = subprocess.check_output(["node", "-p", "require('ffmpeg-static')"], cwd=ROOT, text=True).strip()
rng = np.random.default_rng(7)


def db(x):
    return 10 ** (x / 20)


def fast_lowpass(x, cutoff):
    # FFT brick-ish lowpass with a soft knee (fast for long noise beds)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def highpass(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (cutoff / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X, len(x))


def note(f0, f1, dur, peak, kind="triangle"):
    """Mirror of src/sounds.ts note(): exp pitch slide, 20 ms attack, exp decay."""
    n = int((dur + 0.05) * SR)
    t = np.arange(n) / SR
    k = np.clip(t / dur, 0, 1)
    freq = f0 * (max(40, f1) / f0) ** k
    phase = 2 * np.pi * np.cumsum(freq) / SR
    if kind == "sine":
        osc = np.sin(phase)
    else:
        osc = 2 / np.pi * np.arcsin(np.sin(phase))
    env = np.where(t < 0.02, 0.0001 * (peak / 0.0001) ** (t / 0.02),
                   peak * (0.0001 / peak) ** np.clip((t - 0.02) / max(1e-3, dur - 0.02), 0, 1))
    return osc * env


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def read_wav(path):
    """Decode any audio file (float WAV from Kokoro, mp3 music, ...) to mono float at SR."""
    raw = subprocess.run([FF, "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--pop", type=float, nargs="*", default=[])
    ap.add_argument("--vo", nargs=2, action="append", default=[], metavar=("WAV", "AT"))
    ap.add_argument("--clicks", type=float, nargs="*", default=[])
    ap.add_argument("--rustle", type=float, nargs="*", default=[])
    ap.add_argument("--giggle", type=float, nargs="*", default=[])
    ap.add_argument("--msg", type=float, nargs="*", default=[], help="src/sounds.ts 'msg' blips (chat notifications)")
    ap.add_argument("--chime", type=float, nargs="*", default=[], help="src/sounds.ts 'celebrate' arpeggio")
    ap.add_argument("--bell", type=float, nargs="*", default=[], help="src/sounds.ts 'bell' chimes")
    ap.add_argument("--sleepy", type=float, nargs="*", default=[], help="src/sounds.ts 'sleepy' yawn tones")
    ap.add_argument("--typing", type=float, nargs=2, action="append", default=[], metavar=("FROM", "TO"))
    ap.add_argument("--room", type=float, default=-40, help="room tone level dB")
    ap.add_argument("--music", default=None)
    args = ap.parse_args()

    n = int(args.dur * SR)
    mix = np.zeros(n)

    # Room tone: soft pink-ish noise + a distant low city rumble that breathes.
    white = rng.standard_normal(n)
    room = fast_lowpass(white, 900) * db(-46)
    city = fast_lowpass(rng.standard_normal(n), 220)
    city *= (1 + 0.35 * np.sin(2 * np.pi * 0.11 * np.arange(n) / SR)) * db(-44)
    bed = room + city
    fade = np.clip(np.arange(n) / (0.3 * SR), 0, 1) * np.clip((n - np.arange(n)) / (0.4 * SR), 0, 1)
    mix += bed / max(1e-9, np.abs(bed).max()) * db(args.room) * fade

    def click():
        m = int(0.012 * SR)
        c = highpass(rng.standard_normal(m), 2500) * np.exp(-np.arange(m) / (0.0016 * SR))
        return c / np.abs(c).max()

    for a, b in args.typing:  # mechanical keyboard, irregular rhythm
        t = a
        while t < b:
            place(mix, click(), t, db(-34 + rng.uniform(-4, 2)))
            t += rng.uniform(0.07, 0.19)

    def seq(notes):
        out = np.zeros(int(2.0 * SR))
        for f0, f1, at, d, p, *kind in notes:
            x = note(f0, f1, d, p, *(kind or ["triangle"]))
            i = int(at * SR)
            out[i:i + len(x)] += x[: len(out) - i]
        return out

    for t in args.msg:
        place(mix, seq([(520, 580, 0, 0.07, 0.05)]), t, db(-6))
    for t in args.chime:
        place(mix, seq([(523, 540, 0, .09, .12), (659, 680, .09, .09, .12), (784, 810, .18, .14, .14), (1046, 1080, .3, .18, .1, "sine")]), t, db(-6))
    for t in args.sleepy:
        place(mix, seq([(500, 380, 0, .28, .08), (380, 260, .32, .4, .07)]), t, db(-6))
    for t in args.bell:  # 4 church-bell ding-dongs (sine partials, like sounds.ts)
        out = np.zeros(int(3.2 * SR))
        for k in range(4):
            fund, peak = (262, 0.13) if k % 2 == 0 else (196, 0.15)
            for mult, amp, decay in [(1, 1, 1.2), (2.0, .45, 1.0), (2.76, .28, .85), (3.71, .16, .7), (5.0, .08, .5)]:
                n2 = int((decay + .04) * SR)
                tt = np.arange(n2) / SR
                att = 1e-4 * (peak * amp / 1e-4) ** np.minimum(tt / .012, 1)
                dec = peak * amp * (1e-4 / (peak * amp)) ** np.clip((tt - .012) / (decay - .012), 0, 1)
                env = np.where(tt < .012, att, dec)
                x = np.sin(2 * np.pi * fund * mult * tt) * env
                i = int(k * 0.38 * SR)
                out[i:i + n2] += x[: len(out) - i]
        place(mix, out, t, db(-4))

    for t in args.clicks:  # mouse clicks
        c = highpass(rng.standard_normal(int(0.012 * SR)), 2500) * np.exp(-np.arange(int(0.012 * SR)) / (0.0016 * SR))
        place(mix, c / np.abs(c).max(), t, db(-30))
        place(mix, c[::-1][:200] / np.abs(c).max(), t + 0.07, db(-36))

    for t in args.rustle:  # t-shirt / chair rustle during the stretch
        m = int(0.9 * SR)
        r = highpass(fast_lowpass(rng.standard_normal(m), 4200), 500)
        env = np.sin(np.linspace(0, np.pi, m)) ** 2 * (0.6 + 0.4 * np.abs(np.sin(np.linspace(0, 9, m))))
        place(mix, r / np.abs(r).max() * env, t, db(-33))

    for t in args.pop:  # src/sounds.ts "pop"
        s = np.zeros(int(0.3 * SR))
        a, b = note(600, 750, 0.08, 0.1), note(750, 700, 0.1, 0.07)
        s[: len(a)] += a
        s[int(0.09 * SR): int(0.09 * SR) + len(b)] += b[: len(s) - int(0.09 * SR)]
        place(mix, s, t, db(-6))

    for t in args.giggle:  # src/sounds.ts "giggle"
        s = np.zeros(int(0.5 * SR))
        for f0, f1, at, d, p in [(700, 900, 0, .07, .09), (900, 700, .08, .07, .09), (750, 950, .16, .07, .09), (950, 750, .24, .09, .08)]:
            x = note(f0, f1, d, p)
            i = int(at * SR)
            s[i:i + len(x)] += x[: len(s) - i]
        place(mix, s, t, db(-6))

    for path, at in args.vo:  # plant voice, as if from the laptop speakers in the room
        v = highpass(read_wav(path), 160)
        v = v / max(1e-9, np.abs(v).max()) * db(-9)
        ir = rng.standard_normal(int(0.22 * SR)) * np.exp(-np.arange(int(0.22 * SR)) / (0.05 * SR))
        wet = np.convolve(v, ir)[: len(v) + len(ir)]
        wet = wet / max(1e-9, np.abs(wet).max()) * db(-24)
        place(mix, wet, float(at))
        place(mix, v, float(at))

    if args.music:
        m = read_wav(args.music)[:n]
        mf = np.clip(np.arange(len(m)) / (0.8 * SR), 0, 1) * np.clip((len(m) - np.arange(len(m))) / (1.0 * SR), 0, 1)
        place(mix, m / max(1e-9, np.abs(m).max()) * mf, 0, db(-20))

    peak = np.abs(mix).max()
    if peak > db(-1):
        mix *= db(-1) / peak
    st = np.repeat((mix * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(args.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(st.tobytes())
    print("WROTE", args.out, f"{args.dur:.2f}s")


if __name__ == "__main__":
    main()
