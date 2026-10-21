"""Compose the release video's 8-bit track: pulse waves and a triangle bass, no noise, no drums.

Three parts the renderer relies on: a loud hook (3 bars), a calm bed (16 bars, a 4-bar loop)
that plays under the whole video, and a small ending of two soft bars that opens the outro slide: never a loud finale. Usage: python3 compose-music.py <out.wav>
Needs numpy. Turn the wav into the track with: ffmpeg -i <out.wav> -b:a 128k music.mp3
"""
import sys
import numpy as np, wave
SR=44100; BPM=120; BEAT=60/BPM; BAR=4*BEAT; S16=BEAT/4
HOOK_BARS, BED_BARS, END_BARS = 3, 16, 2
total_s=(HOOK_BARS+BED_BARS+END_BARS)*BAR            # the ending is the last 4 s: it opens the outro
N=int(total_s*SR)+SR//2                          # half a second of true silence after the music, so its end is exact
def hz(name):
    n={"C":0,"D":2,"E":4,"F":5,"G":7,"A":9,"B":11}[name[0]]; o=int(name[-1])
    return 440*2**((n+12*(o+1)-69)/12)
def pulse(f,dur,duty):
    n=int(dur*SR); ph=(np.arange(n)*f/SR)%1.0
    return np.where(ph<duty,1.0,-1.0)
def tri(f,dur):
    n=int(dur*SR); ph=(np.arange(n)*f/SR)%1.0
    return 4*np.abs(ph-0.5)-1
def env(n,decay):
    t=np.arange(n)/SR; e=np.exp(-t*decay); e[:40]*=np.linspace(0,1,40); e[-80:]*=np.linspace(1,0,80); return e
M=np.zeros(N)
def put(sig,start):
    i=int(start*SR); n=min(len(sig),N-i)
    if n>0: M[i:i+n]+=sig[:n]
CH=[("A2",["A4","C5","E5"]),("F2",["A4","C5","F5"]),("C3",["G4","C5","E5"]),("G2",["G4","B4","D5"])]
def bar(b,chord,lead,bass,arp,jump=False):
    root,notes=chord; s=b*BAR
    if bass>0:                                   # triangle bass, eighth notes
        for i in range(8):
            put(tri(hz(root)*(2 if i%4==3 else 1),BEAT/2)*env(int(BEAT/2*SR),3)*bass,s+i*BEAT/2)
    if arp>0:                                    # fast pulse arpeggio, sixteenth notes
        pat=[0,1,2,1]*4 if not jump else [0,1,2,1,0,2,1,2]*2
        for i,k in enumerate(pat):
            f=hz(notes[k])*(2 if jump and i%4==3 else 1)
            put(pulse(f,S16*1.6,0.25)*env(int(S16*1.6*SR),9)*arp,s+i*S16)
    if lead>0:                                   # simple tune on the 50% pulse, quarter notes
        tune=[notes[2],notes[1],notes[2],notes[0]]
        for i,nm in enumerate(tune):
            put(pulse(hz(nm)/2*2,BEAT*0.9,0.5)*env(int(BEAT*0.9*SR),2.5)*lead,s+i*BEAT)
b=0
for i in range(HOOK_BARS): bar(b,CH[i%4],0.22,0.30,0.20); b+=1
for i in range(BED_BARS): bar(b,CH[i%4],0.0,0.12,0.07); b+=1
# the ending, as long as the outro slide: four rising notes the moment it opens, then A minor held
# and left to die away
for i,nm in enumerate(["A4","C5","E5","A5"]):
    put(pulse(hz(nm),S16*3,0.25)*env(int(S16*3*SR),6)*0.13,b*BAR+i*S16*2)
for nm in ("A3","E4"):
    put(tri(hz(nm),BAR*1.8)*env(int(BAR*1.8*SR),1.6)*0.16,b*BAR+S16*8)
b+=END_BARS
end=N-SR//2; r=int(1.2*SR); fade=np.ones(N); fade[end-r:end]=np.linspace(1,0,r); fade[end:]=0; M*=fade
M/=np.abs(M).max()
M=np.round(M*31)/31                              # 5-bit steps: the 8-bit grain
rms=lambda a,b: 20*np.log10(np.sqrt(np.mean(M[int(a*SR):int(b*SR)]**2))+1e-9)
he=HOOK_BARS*BAR; be=he+BED_BARS*BAR
print("seconds",round(total_s,1),"hook",round(rms(0,he),1),"bed",round(rms(he+2,be-1),1),"ending",round(rms(be,be+2*BAR),1))
pcm=(np.stack([M,M],1)*0.89*32767).astype(np.int16)
with wave.open(sys.argv[1],"wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
