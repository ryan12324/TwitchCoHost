# Real-Time VAD Integration

This project uses **@ericedouard/vad-node-realtime** for voice activity detection, which is specifically designed for real-time audio processing in Node.js environments.

## Why Real-Time VAD?

The `@ericedouard/vad-node-realtime` package offers several advantages for live streaming applications:

### 1. **Designed for Real-Time Processing**
- Optimized for continuous audio stream processing
- Lower latency compared to the original `@ricky0123/vad-node`
- Better suited for live streaming scenarios

### 2. **More Control Over Audio Pipeline**
- We capture audio from the microphone using `node-record-lpcm16`
- Audio chunks are processed in real-time by the VAD
- Allows for custom audio processing before/after VAD

### 3. **Better Performance**
- Efficient processing for server environments
- Optimized for Node.js (not browser-focused)
- Works completely offline

## How It Works

### Audio Pipeline

```
Microphone
    ↓
node-record-lpcm16 (captures raw PCM audio)
    ↓
Convert Int16 PCM → Float32Array
    ↓
RealTimeVAD.processAudio() (voice activity detection)
    ↓
onSpeechStart / onSpeechEnd callbacks
    ↓
Save to WAV file → Whisper CPP → Transcription
```

### Implementation Details

**1. Microphone Capture**
```typescript
this.micStream = recorder.record({
  sampleRate: 16000,  // 16kHz for Whisper
  channels: 1,        // Mono audio
  audioType: 'raw',   // Raw PCM data
  recorder: 'sox',    // Audio backend
  silence: '0',       // VAD handles silence detection
}).stream();
```

**2. Real-Time VAD Processing**
```typescript
this.vad = await RealTimeVAD.new({
  sampleRate: 16000,
  positiveSpeechThreshold: 0.6,  // Detect speech
  negativeSpeechThreshold: 0.4,  // Detect silence
  minSpeechFrames: 4,             // Minimum frames for speech

  onSpeechStart: () => {
    // User started speaking
  },

  onSpeechEnd: (audio: Float32Array) => {
    // User stopped speaking, process audio
  },
});
```

**3. Audio Conversion**
```typescript
// Microphone gives us Int16 PCM
const buffer = micStream.read();

// Convert to Float32Array for VAD
const float32Audio = int16ToFloat32(buffer);

// Process through VAD
await vad.processAudio(float32Audio);
```

## Configuration Options

### VAD Sensitivity

Adjust these parameters in `src/services/audio-capture.ts`:

```typescript
positiveSpeechThreshold: 0.6  // Higher = less sensitive (fewer false positives)
negativeSpeechThreshold: 0.4  // Lower = more aggressive silence detection
minSpeechFrames: 4            // Minimum frames to consider as speech
```

**Tuning Tips:**
- **Too many false detections?** → Increase `positiveSpeechThreshold` to 0.7-0.8
- **Missing speech?** → Lower `positiveSpeechThreshold` to 0.5
- **Cutting off words?** → Lower `negativeSpeechThreshold` to 0.3
- **Too much background noise captured?** → Increase `minSpeechFrames` to 6-8

### Sample Rate

The system uses **16kHz** (16000 Hz) which is optimal for:
- ✅ Whisper CPP transcription
- ✅ Real-time processing performance
- ✅ Reduced file sizes
- ✅ Voice clarity (human speech is mostly < 8kHz)

**Don't change this unless you have a specific reason!**

## Audio Recorder Setup

### Windows
The system uses `sox` for audio recording. Install it:

```powershell
# Using Chocolatey
choco install sox

# Or download from http://sox.sourceforge.net/
```

### Mac
```bash
brew install sox
```

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install sox libsox-fmt-all

# Fedora/RHEL
sudo dnf install sox
```

## Troubleshooting

### No audio detected

**Check microphone permissions:**
- Windows: Settings → Privacy → Microphone
- Mac: System Preferences → Security & Privacy → Microphone
- Linux: Check ALSA/PulseAudio settings

**Verify sox is installed:**
```bash
sox --version
```

**Test microphone with sox:**
```bash
# Record 5 seconds of audio
sox -d test.wav trim 0 5

# Play it back
sox test.wav -d
```

### Too many false detections

Lower the sensitivity:
```typescript
positiveSpeechThreshold: 0.75  // Was 0.6
negativeSpeechThreshold: 0.5   // Was 0.4
minSpeechFrames: 6             // Was 4
```

### Missing words at start/end

The VAD might be cutting off too early. Adjust:
```typescript
negativeSpeechThreshold: 0.3  // More patient before declaring silence
```

### Audio level always 0

Check that the microphone is:
1. Set as **Default Recording Device**
2. **Not muted** in system settings
3. **Allowed** for this application

## Performance Optimization

### CPU Usage

The Real-Time VAD is efficient, but you can optimize further:

**1. Adjust frame processing:**
```typescript
// Process fewer frames = lower CPU, but less accurate
minSpeechFrames: 6  // Higher = less processing
```

**2. Use a faster Whisper model:**
```env
# In .env - use 'tiny' instead of 'base'
WHISPER_MODEL_PATH=C:\whisper.cpp\models\ggml-tiny.en.bin
```

### Memory Usage

The system buffers audio in memory during speech. To reduce memory:

**1. Set shorter max speech duration (edit audio-capture.ts):**
```typescript
// Add timeout for very long speech
const MAX_SPEECH_DURATION_MS = 30000; // 30 seconds max
```

**2. Run cleanup more frequently:**
```typescript
// In cohost.ts, clean up audio files every 10 minutes
setInterval(() => audioCapture.cleanup(10), 10 * 60 * 1000);
```

## Advanced Usage

### Custom Audio Processing

You can add custom processing before VAD:

```typescript
// In audio-capture.ts, modify the data handler:
this.micStream.on('data', async (chunk: Buffer) => {
  const float32Audio = this.int16ToFloat32(chunk);

  // Add noise reduction
  const cleanedAudio = applyNoiseReduction(float32Audio);

  // Add gain/volume boost
  const amplifiedAudio = applyGain(cleanedAudio, 1.5);

  // Feed to VAD
  await this.vad.processAudio(amplifiedAudio);
});
```

### Integration with Other Audio Sources

The Real-Time VAD can process audio from any source:

```typescript
// Example: Process audio from a WebSocket stream
websocket.on('audio', async (audioData) => {
  // Convert your audio format to Float32Array at 16kHz
  const float32Audio = convertToFloat32(audioData);

  // Process through VAD
  await vad.processAudio(float32Audio);
});
```

## API Reference

### RealTimeVAD Methods

**`RealTimeVAD.new(options)`**
Create a new Real-Time VAD instance

**`start()`**
Start processing audio

**`pause()`**
Pause processing audio

**`processAudio(audioData: Float32Array)`**
Process a chunk of audio data

**`flush()`**
Process any remaining audio and trigger final callbacks

**`reset()`**
Reset the VAD state

**`destroy()`**
Clean up resources

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sampleRate` | number | 16000 | Sample rate of input audio |
| `positiveSpeechThreshold` | number | 0.6 | Threshold for detecting speech (0-1) |
| `negativeSpeechThreshold` | number | 0.4 | Threshold for detecting silence (0-1) |
| `minSpeechFrames` | number | 4 | Minimum frames to consider as speech |
| `onSpeechStart` | function | - | Callback when speech starts |
| `onSpeechEnd` | function | - | Callback when speech ends |
| `onVADMisfire` | function | - | Callback when speech was too short |
| `onFrameProcessed` | function | - | Callback after each frame |

## Comparison with Old VAD

| Feature | @ricky0123/vad-node | @ericedouard/vad-node-realtime |
|---------|---------------------|--------------------------------|
| **Focus** | Browser + Node | Node.js only |
| **Real-time** | Limited | Optimized |
| **Microphone Handling** | Built-in (MicVAD) | Manual (more flexible) |
| **Performance** | Good | Better for servers |
| **Control** | Less | More |
| **Use Case** | General purpose | Live streaming, real-time apps |

## Migration from Old VAD

If you have code using the old `@ricky0123/vad-node`:

**Before:**
```typescript
const vad = await MicVAD.new({
  positiveSpeechThreshold: 0.8,
  onSpeechEnd: (audio) => { ... }
});
// Automatic microphone capture
```

**After:**
```typescript
// 1. Create VAD
const vad = await RealTimeVAD.new({
  positiveSpeechThreshold: 0.6,
  onSpeechEnd: (audio) => { ... }
});

// 2. Capture microphone manually
const mic = recorder.record({ sampleRate: 16000 }).stream();

// 3. Feed audio to VAD
mic.on('data', async (chunk) => {
  const float32 = int16ToFloat32(chunk);
  await vad.processAudio(float32);
});
```

## Credits

- **@ericedouard/vad-node-realtime** - Eric Edouard's optimized fork
- **Silero VAD** - Underlying voice activity detection model
- **@ricky0123/vad** - Original VAD implementation

## Support

For issues with the Real-Time VAD:
- Check the [npm package page](https://www.npmjs.com/package/@ericedouard/vad-node-realtime)
- Review the [original VAD repo](https://github.com/ricky0123/vad)
- Open an issue in this project's GitHub

---

**Real-Time Voice Detection for Real-Time Streaming!** 🎤⚡
