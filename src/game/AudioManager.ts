import { gameAudio, releaseAudio } from './audioUnlock'

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private windSource: AudioBufferSourceNode | null = null
  private rainSource: AudioBufferSourceNode | null = null
  private heartbeatInterval: number | null = null
  private muted = false

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = gameAudio()
      this.masterGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.ambienceGain = this.ctx.createGain()

      this.masterGain.connect(this.ctx.destination)
      this.sfxGain.connect(this.masterGain)
      this.ambienceGain.connect(this.masterGain)

      this.masterGain.gain.value = 0.8
      this.sfxGain.gain.value = 0.8
      this.ambienceGain.gain.value = 0.6
    }
    return this.ctx
  }

  private resume() {
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  }

  private createNoise(duration: number): AudioBuffer {
    const ctx = this.getCtx()
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  playWind(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const buffer = this.createNoise(2)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 0.5

      const gain = ctx.createGain()
      gain.gain.value = 0.15

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.ambienceGain!)

      // Modulate gain for gusting effect
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 0.1
      lfoGain.gain.value = 0.05
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)
      lfo.start()

      source.start()
      this.windSource = source
    } catch {
      // audio not available
    }
  }

  stopWind(): void {
    try {
      this.windSource?.stop()
      this.windSource = null
    } catch {
      // ignore
    }
  }

  playRain(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const buffer = this.createNoise(2)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1200

      const filter2 = ctx.createBiquadFilter()
      filter2.type = 'lowpass'
      filter2.frequency.value = 4000

      const gain = ctx.createGain()
      gain.gain.value = 0.1

      source.connect(filter)
      filter.connect(filter2)
      filter2.connect(gain)
      gain.connect(this.ambienceGain!)

      source.start()
      this.rainSource = source
    } catch {
      // audio not available
    }
  }

  stopRain(): void {
    try {
      this.rainSource?.stop()
      this.rainSource = null
    } catch {
      // ignore
    }
  }

  playThunder(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const t0 = ctx.currentTime

      // Master bus for the whole thunderclap, routed through reverb for the big
      // outdoor "rolling across the sky" tail.
      const out = ctx.createGain()
      out.gain.value = 1.0
      const reverb = ctx.createConvolver()
      reverb.buffer = this.createReverb(4)
      const wet = ctx.createGain(); wet.gain.value = 0.55
      const dry = ctx.createGain(); dry.gain.value = 0.9
      out.connect(dry); out.connect(reverb); reverb.connect(wet)
      dry.connect(this.sfxGain!); wet.connect(this.sfxGain!)

      // 1) The initial CRACK — bright, short burst of filtered noise
      const crack = ctx.createBufferSource()
      crack.buffer = this.createNoise(0.5)
      const crackHP = ctx.createBiquadFilter()
      crackHP.type = 'highpass'; crackHP.frequency.value = 900
      const crackGain = ctx.createGain()
      crackGain.gain.setValueAtTime(0.0, t0)
      crackGain.gain.linearRampToValueAtTime(0.9, t0 + 0.01)
      crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35)
      crack.connect(crackHP); crackHP.connect(crackGain); crackGain.connect(out)
      crack.start(t0)
      crack.stop(t0 + 0.5)

      // 2) Deep BOOM body — low noise swelling in, sweeping the lowpass down
      const body = ctx.createBufferSource()
      body.buffer = this.createNoise(4)
      const bodyLP = ctx.createBiquadFilter()
      bodyLP.type = 'lowpass'
      bodyLP.frequency.setValueAtTime(400, t0)
      bodyLP.frequency.exponentialRampToValueAtTime(70, t0 + 3.5)
      const bodyGain = ctx.createGain()
      bodyGain.gain.setValueAtTime(0, t0)
      bodyGain.gain.linearRampToValueAtTime(0.85, t0 + 0.08)
      bodyGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 3.8)
      body.connect(bodyLP); bodyLP.connect(bodyGain); bodyGain.connect(out)
      body.start(t0)
      body.stop(t0 + 4)

      // 3) Rolling rumble — two slow amplitude waves that make the tail "tumble"
      const rumble = ctx.createBufferSource()
      rumble.buffer = this.createNoise(4)
      const rumbleLP = ctx.createBiquadFilter()
      rumbleLP.type = 'lowpass'; rumbleLP.frequency.value = 120
      const rumbleGain = ctx.createGain()
      rumbleGain.gain.setValueAtTime(0.0, t0 + 0.3)
      rumbleGain.gain.linearRampToValueAtTime(0.5, t0 + 0.9)
      rumbleGain.gain.linearRampToValueAtTime(0.2, t0 + 1.8)
      rumbleGain.gain.linearRampToValueAtTime(0.4, t0 + 2.6)
      rumbleGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 4)
      rumble.connect(rumbleLP); rumbleLP.connect(rumbleGain); rumbleGain.connect(out)
      rumble.start(t0 + 0.3)
      rumble.stop(t0 + 4)
    } catch {
      // audio not available
    }
  }

  playLightning(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const buffer = this.createNoise(0.1)
      const source = ctx.createBufferSource()
      source.buffer = buffer

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.5, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

      source.connect(gain)
      gain.connect(this.sfxGain!)
      source.start()
    } catch {
      // audio not available
    }
  }

  playFootstep(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const buffer = this.createNoise(0.05)
      const source = ctx.createBufferSource()
      source.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 800

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfxGain!)
      source.start()
    } catch {
      // audio not available
    }
  }

  playCreak(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(80, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.7)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 120
      filter.Q.value = 2

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfxGain!)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    } catch {
      // audio not available
    }
  }

  playGhostMoan(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(120, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 1.0)
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 2.5)

      // Vibrato
      const vibratoOsc = ctx.createOscillator()
      vibratoOsc.frequency.value = 5
      const vibratoGain = ctx.createGain()
      vibratoGain.gain.value = 8
      vibratoOsc.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5)
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 2.0)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5)

      const reverb = ctx.createConvolver()
      const reverbBuffer = this.createReverb(2)
      reverb.buffer = reverbBuffer

      osc.connect(gain)
      gain.connect(reverb)
      reverb.connect(this.sfxGain!)
      vibratoOsc.start()
      osc.start()
      osc.stop(ctx.currentTime + 2.5)
      vibratoOsc.stop(ctx.currentTime + 2.5)
    } catch {
      // audio not available
    }
  }

  private createReverb(duration: number): AudioBuffer {
    const ctx = this.getCtx()
    const length = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
      }
    }
    return buffer
  }

  playPuzzleSuccess(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const notes = [261.63, 329.63, 392.0, 523.25] // C major chord
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq

        const gain = ctx.createGain()
        const t = ctx.currentTime + i * 0.12
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.12, t + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8)

        osc.connect(gain)
        gain.connect(this.sfxGain!)
        osc.start(t)
        osc.stop(t + 0.8)
      })
    } catch {
      // audio not available
    }
  }

  playPuzzleError(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const notes = [220, 185, 160]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = freq

        const gain = ctx.createGain()
        const t = ctx.currentTime + i * 0.1
        gain.gain.setValueAtTime(0.08, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)

        osc.connect(gain)
        gain.connect(this.sfxGain!)
        osc.start(t)
        osc.stop(t + 0.3)
      })
    } catch {
      // audio not available
    }
  }

  playCandleFlicker(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const buffer = this.createNoise(0.05)
      const source = ctx.createBufferSource()
      source.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 300

      const gain = ctx.createGain()
      gain.gain.value = 0.02

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfxGain!)
      source.start()
    } catch {
      // audio not available
    }
  }

  playHeartbeat(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const beat = () => {
        // Lub
        const osc1 = ctx.createOscillator()
        osc1.frequency.value = 60
        const g1 = ctx.createGain()
        g1.gain.setValueAtTime(0.3, ctx.currentTime)
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc1.connect(g1)
        g1.connect(this.sfxGain!)
        osc1.start()
        osc1.stop(ctx.currentTime + 0.15)

        // Dub
        setTimeout(() => {
          const osc2 = ctx.createOscillator()
          osc2.frequency.value = 50
          const g2 = ctx.createGain()
          g2.gain.setValueAtTime(0.25, ctx.currentTime)
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
          osc2.connect(g2)
          g2.connect(this.sfxGain!)
          osc2.start()
          osc2.stop(ctx.currentTime + 0.12)
        }, 150)
      }

      beat()
      this.heartbeatInterval = window.setInterval(beat, 900)
    } catch {
      // audio not available
    }
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  playDoorCreak(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(200, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 1.5)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.0)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)

      osc.connect(gain)
      gain.connect(this.sfxGain!)
      osc.start()
      osc.stop(ctx.currentTime + 1.5)
    } catch {
      // audio not available
    }
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = v
  }

  setSfxVolume(v: number): void {
    if (this.sfxGain) this.sfxGain.gain.value = v
  }

  setAmbienceVolume(v: number): void {
    if (this.ambienceGain) this.ambienceGain.gain.value = v
  }

  mute(): void {
    this.muted = true
    if (this.masterGain) this.masterGain.gain.value = 0
  }

  unmute(): void {
    this.muted = false
  }

  playWolfHowl(): void {
    this.resume()
    const ctx = this.getCtx()
    try {
      const t0 = ctx.currentTime
      const dur = 3.4

      // A real howl is a near-pure tone with gentle vibrato that rises, holds a
      // long note, then slides down. Detuned sine/triangle carriers give a
      // living, breathy timbre; vocal-tract formant bandpasses make it read as
      // an animal rather than a buzzy synth. Pitch sits in the ~300–620 Hz
      // howl range.
      const makeCarrier = (detune: number, type: OscillatorType, level: number) => {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.detune.value = detune
        osc.frequency.setValueAtTime(330, t0)
        osc.frequency.linearRampToValueAtTime(560, t0 + 0.6)
        osc.frequency.linearRampToValueAtTime(600, t0 + 1.1)
        osc.frequency.setValueAtTime(600, t0 + 2.0)
        osc.frequency.linearRampToValueAtTime(470, t0 + 2.8)
        osc.frequency.linearRampToValueAtTime(300, t0 + dur)
        const g = ctx.createGain()
        g.gain.value = level
        osc.connect(g)
        osc.start(t0); osc.stop(t0 + dur + 0.1)
        return g
      }

      const mix = ctx.createGain()
      makeCarrier(0, 'sine', 0.6).connect(mix)
      makeCarrier(8, 'triangle', 0.22).connect(mix)
      makeCarrier(-6, 'sine', 0.3).connect(mix)

      // Formant filters — two bandpass peaks approximate a canine vocal tract
      const f1 = ctx.createBiquadFilter()
      f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 3
      const f2 = ctx.createBiquadFilter()
      f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 4
      const formantMix = ctx.createGain()
      mix.connect(f1); mix.connect(f2)
      f1.connect(formantMix); f2.connect(formantMix)

      // Amplitude envelope — breathy onset, long sustain, slow release.
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.5, t0 + 0.45)
      env.gain.setValueAtTime(0.5, t0 + 2.0)
      env.gain.linearRampToValueAtTime(0.35, t0 + 2.8)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.2)

      // ~5 Hz tremolo for the wavering tail of the howl
      const trem = ctx.createOscillator()
      trem.frequency.value = 5
      const tremGain = ctx.createGain()
      tremGain.gain.value = 0.06
      trem.connect(tremGain); tremGain.connect(env.gain)
      trem.start(t0); trem.stop(t0 + dur + 0.2)

      formantMix.connect(env)

      // Distant forest echo: mostly wet reverb with a touch of dry, at a
      // moderate level so the howl is clearly audible above wind/rain.
      const reverb = ctx.createConvolver()
      reverb.buffer = this.createReverb(3.5)
      const wet = ctx.createGain(); wet.gain.value = 0.7
      const dry = ctx.createGain(); dry.gain.value = 0.55
      env.connect(dry); env.connect(reverb); reverb.connect(wet)
      dry.connect(this.sfxGain!); wet.connect(this.sfxGain!)
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.stopWind()
    this.stopRain()
    this.stopHeartbeat()
    releaseAudio(this.ctx, this.masterGain ? [this.masterGain] : [])
    this.ctx = null
  }
}

export const audioManager = new AudioManager()
