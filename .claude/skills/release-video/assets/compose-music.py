"""Compose the release video's track: felt piano and soft pads over a gentle pulse, in stereo.

Three parts the renderer relies on: a hook as long as the intro (6.5 s, 13 beats), a bed of 8 bars that
loops under the scenes, and an ending of 4 s that opens the outro. A four-note motif opens the hook and
the ending: it is the signature. Usage: python3 compose-music.py <out.wav>
Needs numpy. Turn the wav into the track with: ffmpeg -i <out.wav> -b:a 160k music.mp3
"""
import sys
import wave
import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
HOOK = 13 * BEAT                       # the intro with tags: three bars and the pickup beat of the next
BED = 8 * BAR
ENDING = 4.0
TOTAL = HOOK + BED + ENDING
N = int((TOTAL + 0.5) * SR)            # half a second of true silence after the music
BED_STEP_DB = -4.0                     # the bed sits a little under the hook, never a drop
MOTIF = ["A4", "C5", "E5", "A5"]
# A minor, D, E minor, D: the notes of each chord and its root
CHORDS = [(["A4", "C5", "E5"], "A1"), (["A4", "D5", "F#5"], "D2"), (["G4", "B4", "E5"], "E2"), (["A4", "D5", "F#5"], "D2")]
BASS = [1, 0, 1, 1, 1, 0, 1, 2]        # eighth notes: rest, root, or the octave above
LINE = [(0.0, 2), (1.5, 1), (2.5, 3), (3.0, 2)]   # beat and chord tone of the felt piano
rng = np.random.default_rng(11)


def hz(name):
    n = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]]
    return 440 * 2 ** ((n + (name[1] == "#") + 12 * (int(name[-1]) + 1) - 69) / 12)


def times(seconds):
    return np.arange(int(seconds * SR)) / SR


def lowpass(x, cutoff, order=2):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / (1 + (f / cutoff) ** (2 * order)), len(x))


def bandpass(x, low, high):
    return lowpass(x, high) - lowpass(x, low, 1)


def envelope(n, attack, decay, release=0.03):
    t = np.arange(n) / SR
    e = np.exp(-t * decay)
    k = max(1, int(attack * SR))
    e[:k] *= np.linspace(0, 1, k)
    r = min(n, int(release * SR))
    e[-r:] *= np.linspace(1, 0, r)
    return e


def put(bus, sound, start, pan=0.0):
    i = int(round(start * SR))
    if i >= bus.shape[1] or i + len(sound) <= 0:
        return
    if i < 0:
        sound, i = sound[-i:], 0
    n = min(len(sound), bus.shape[1] - i)
    angle = (pan + 1) * np.pi / 4
    bus[0, i:i + n] += sound[:n] * np.cos(angle)
    bus[1, i:i + n] += sound[:n] * np.sin(angle)


def felt_piano(freq, seconds, velocity=1.0):
    t = times(seconds)
    tone = sum(
        (1 / n ** 1.15) * np.sin(2 * np.pi * freq * n * np.sqrt(1 + 0.0004 * n * n) * t + n) * np.exp(-t * (1.4 + 0.9 * n))
        for n in range(1, 9) if freq * n < 9000
    )
    hammer = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 90) * 0.35
    return lowpass((tone + hammer) * velocity, 2600 + 2500 * velocity, 1) * envelope(len(t), 0.003, 0.0, 0.08)


def pad(freq, seconds, cutoff):
    """Seven saws a few cents apart, odd ones left and even ones right."""
    t = times(seconds)
    sides = [np.zeros_like(t), np.zeros_like(t)]
    for v in range(7):
        sides[v % 2] += 2 * (((t * freq * (1 + (v - 3) * 0.0035)) + rng.random()) % 1.0) - 1
    e = envelope(len(t), 0.5, 0.0, 0.9)
    return [lowpass(side / 7 * 2, cutoff) * e for side in sides]


def sub(freq, seconds):
    t = times(seconds)
    return np.tanh(1.6 * np.sin(2 * np.pi * freq * t)) * 0.8 * envelope(len(t), 0.008, 3.2, 0.04)


def kick():
    t = times(0.32)
    sweep = 46 + 95 * np.exp(-t * 32)
    return np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-t * 9.5) + 0.12 * lowpass(rng.standard_normal(len(t)), 1800) * np.exp(-t * 80)


def shaker():
    t = times(0.07)
    return bandpass(rng.standard_normal(len(t)), 5500, 12000) * np.exp(-t * 55) * np.minimum(1, t * 600)


def clap():
    t = times(0.25)
    return bandpass(rng.standard_normal(len(t)), 900, 3800) * np.exp(-t * 18) * np.minimum(1, t * 400)


def room(bus, mix, seconds=1.9):
    """A reverb: the bus through a decaying burst of noise, a different one for each ear."""
    n = bus.shape[1] + int(seconds * SR)
    size = 1 << (n - 1).bit_length()
    out = np.zeros_like(bus)
    for ear in (0, 1):
        t = np.arange(int(seconds * SR)) / SR
        tail = np.random.default_rng(40 + ear).standard_normal(len(t)) * np.exp(-t * (6.9 / seconds))
        tail = lowpass(tail, 5200, 1) * 0.5 + lowpass(tail, 1400, 1) * 0.3
        tail[:int(0.018 * SR)] *= np.linspace(0, 1, int(0.018 * SR))
        tail /= np.sqrt((tail ** 2).sum())
        out[ear] = np.fft.irfft(np.fft.rfft(bus[ear], size) * np.fft.rfft(tail, size), size)[:bus.shape[1]]
    return bus * (1 - mix * 0.25) + out * mix


def compose():
    ducked, drums, voice = (np.zeros((2, N)) for _ in range(3))
    kicks = []
    bars = int(np.ceil((HOOK + BED) / BAR))
    for b in range(bars):
        s = b * BAR
        hook = s < HOOK - 0.01
        notes, root = CHORDS[b % 4]
        for name in notes:
            left, right = pad(hz(name) / 2, BAR + 0.9, 2200)
            put(ducked, left * 0.075, s, -1)
            put(ducked, right * 0.075, s, 1)
        for i, step in enumerate(BASS):
            if step:
                put(ducked, sub(hz(root) * (2 if step == 2 else 1), BEAT * 0.45) * 0.30, s + i * BEAT / 2)
        for k in range(4):
            put(drums, kick() * 0.55, s + k * BEAT)
            kicks.append(s + k * BEAT)
        for k in (1, 3):
            put(drums, clap() * (0.22 if hook else 0.16), s + k * BEAT, 0.1)
        for k in range(8):
            put(drums, shaker() * (0.10 if hook else 0.06), s + k * BEAT / 2 + BEAT / 4, -0.2 if k % 2 else 0.2)
        for i, (beat, tone) in enumerate(LINE):
            if hook or i % 2 == 0:
                put(voice, felt_piano(hz(notes[tone % 3]) * (2 if tone >= 3 else 1), 1.6, 0.8) * 0.30, s + beat * BEAT, 0.15 * (1 if i % 2 else -1))
    # the pads and the bass breathe with the kick
    duck = np.ones(N)
    for k in kicks:
        i = int(k * SR)
        n = min(int(0.8 * SR), N - i)
        if n > 0:
            duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR / 0.2))
    # the motif: the signature, in the hook and again in the ending
    ending = HOOK + BED
    for i, name in enumerate(MOTIF):
        put(voice, felt_piano(hz(name), 1.8, 1.0) * 0.30, 0.15 + i * 0.28, -0.1)
        put(voice, felt_piano(hz(name), 2.2, 0.9) * 0.20, ending + i * 0.22)
    for name in CHORDS[0][0]:
        left, right = pad(hz(name) / 2, ENDING + 1.5, 1100)
        put(ducked, left * 0.08, ending + 0.5, -1)
        put(ducked, right * 0.08, ending + 0.5, 1)
    mix = room(ducked * duck + drums + voice, 0.4)
    t = np.arange(N) / SR
    mix *= 10 ** (np.interp(t, [HOOK, HOOK, TOTAL], [0, BED_STEP_DB, BED_STEP_DB]) / 20)
    mix *= np.interp(t, [0, 0.3, TOTAL - 1.6, TOTAL], [0, 1, 1, 0])
    return mix / np.abs(mix).max()


if __name__ == "__main__":
    music = compose()
    rms = lambda a, b: round(20 * np.log10(np.sqrt(np.mean(music[:, int(a * SR):int(b * SR)] ** 2)) + 1e-9), 1)
    print("seconds", round(TOTAL, 1), "hook", rms(0.5, HOOK - 0.3), "bed", rms(HOOK + 2, HOOK + BED - 1), "ending", rms(HOOK + BED, TOTAL - 1))
    pcm = (music.T * 0.89 * 32767).astype(np.int16)
    with wave.open(sys.argv[1], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
