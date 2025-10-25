# WebRTC VAD Implementation Guide

This project uses **webrtcvad** - a reliable, cross-platform Voice Activity Detection library based on Google's WebRTC VAD algorithm.

## Why WebRTC VAD?

✅ **Windows 10+ Support** - Explicitly tested and working
✅ **Reliable Algorithm** - Battle-tested Google WebRTC VAD
✅ **Simple API** - Easy to use and configure
✅ **Native Performance** - Fast C++ implementation
✅ **No ONNX Runtime** - Avoids complex dependencies

## How It Works

### Audio Pipeline

```
Microphone (16kHz, mono)
    ↓
node-record-lpcm16 (captures raw PCM)
    ↓
Buffer into 30ms frames (960 bytes)
    ↓
WebRTC VAD (speech detection)
    ↓
Accumulate speech frames
    ↓
Detect silence → Save to WAV → Whisper CPP
```

### Frame Processing

- **Sample Rate**: 16kHz (optimal for Whisper)
- **Frame Duration**: 30ms (480 samples, 960 bytes)
- **VAD Mode**: 3 (most aggressive, least false positives)

### Speech Detection Logic

```typescript
Speech Start:
- Requires 3 consecutive speech frames (90ms of speech)
- Starts buffering audio

Speech End:
- Requires 10 consecutive silence frames (300ms of silence)
- Saves buffered audio to WAV file
- Sends to Whisper for transcription
```

## Configuration

### VAD Sensitivity

Edit `src/services/audio-capture.ts`:

```typescript
private readonly SPEECH_START_FRAMES = 3;  // Frames to start (default: 3 = 90ms)
private readonly SILENCE_END_FRAMES = 10;  // Frames to end (default: 10 = 300ms)
private readonly VAD_MODE = 3;              // 0-3 sensitivity (default: 3)
```

**VAD Modes:**
- **0** - Least aggressive (more false positives, catches more speech)
- **1** - Slightly aggressive
- **2** - Moderately aggressive
- **3** - Most aggressive (fewer false positives, may miss quiet speech)

### Tuning Tips

**Too many false detections?**
```typescript
private readonly VAD_MODE = 3;              // Keep at 3
private readonly SPEECH_START_FRAMES = 5;  // Increase to 5
```

**Missing speech?**
```typescript
private readonly VAD_MODE = 1;              // Lower to 1 or 2
private readonly SPEECH_START_FRAMES = 2;  // Lower to 2
```

**Cutting off end of words?**
```typescript
private readonly SILENCE_END_FRAMES = 15;  // Increase to 15 (450ms)
```

**Too much silence captured?**
```typescript
private readonly SILENCE_END_FRAMES = 7;   // Decrease to 7 (210ms)
```

## Windows Installation

### Prerequisites

1. **Node.js** (v18+)
2. **Visual Studio Build Tools** OR **windows-build-tools**
3. **sox** (for microphone capture)

### Installation Steps

```powershell
# 1. Install sox
choco install sox

# Or download from: http://sox.sourceforge.net/

# 2. Install Visual C++ Build Tools (if not already installed)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# OR use npm:
npm install --global windows-build-tools

# 3. Clone and install project
git pull
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install

# 4. Build
npm run build

# 5. Run
npm run gui
```

## Testing

### Verify sox is working:

```powershell
# Test recording
sox -d test.wav trim 0 5

# Play it back
sox test.wav -d
```

### Test microphone in Windows:

1. Right-click volume icon → **Sounds**
2. **Recording** tab
3. Select your microphone
4. Click **Properties**
5. **Levels** tab → Ensure it's not muted and volume is 70-100%
6. **Advanced** tab → Check **16 bit, 16000 Hz (DVD Quality)**

## Troubleshooting

### Issue: "webrtcvad" module not found

**Solution:**
```powershell
# Rebuild native modules
npm rebuild webrtcvad

# If that fails, clean install:
Remove-Item -Recurse -Force node_modules
npm install
```

### Issue: No speech detected

**Possible causes:**
1. Microphone not set as default recording device
2. Microphone muted or volume too low
3. VAD mode too aggressive
4. Speech too quiet

**Solutions:**
- Check Windows sound settings (see "Test microphone" above)
- Lower VAD_MODE to 1 or 2
- Increase microphone boost in Windows
- Test with sox first to verify mic works

### Issue: Too many false detections

**Solutions:**
- Keep VAD_MODE at 3 (most aggressive)
- Increase SPEECH_START_FRAMES to 5
- Reduce background noise (use noise-canceling mic)

### Issue: Compilation errors on Windows

**Error:** `Can't find Python executable`

**Solution:**
```powershell
# Install Python
choco install python

# Or set Python path
npm config set python "C:\Python39\python.exe"
```

**Error:** `MSBuild.exe not found`

**Solution:**
```powershell
# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"
```

### Issue: "sox not found"

**Solution:**
```powershell
# Install sox
choco install sox

# Or download and add to PATH:
# 1. Download from http://sox.sourceforge.net/
# 2. Extract to C:\sox
# 3. Add C:\sox to system PATH
# 4. Restart terminal
```

## Performance

### CPU Usage

WebRTC VAD is very efficient:
- **CPU**: ~1-2% on modern CPUs
- **Memory**: ~10MB for VAD processing
- **Latency**: <5ms per frame

### Memory Optimization

Audio is buffered during speech. To limit memory:

```typescript
// Add max speech duration limit
private readonly MAX_SPEECH_DURATION_MS = 30000; // 30 seconds max

// In handleSpeechEnd():
const duration = Date.now() - this.recordingStartTime.getTime();
if (duration > this.MAX_SPEECH_DURATION_MS) {
  console.warn('[AudioCapture] Speech too long, truncating...');
  // Handle long speech
}
```

## Advanced Usage

### Custom Frame Duration

You can use 10ms, 20ms, or 30ms frames:

```typescript
// For 20ms frames:
private readonly FRAME_DURATION_MS = 20;
private readonly FRAME_SIZE = (this.SAMPLE_RATE * 20) / 1000; // 320 samples
private readonly FRAME_SIZE_BYTES = 320 * 2; // 640 bytes
```

**Trade-offs:**
- **10ms**: More responsive, more CPU usage
- **20ms**: Balanced
- **30ms**: Less responsive, less CPU usage (default)

### Audio Format Requirements

WebRTC VAD requires:
- **Channels**: 1 (mono)
- **Sample Rate**: 8kHz, 16kHz, 32kHz, or 48kHz
- **Format**: 16-bit signed integer PCM
- **Frame Duration**: 10ms, 20ms, or 30ms

### Integration with Other Audio Sources

```typescript
// Example: Process audio from a file
const fs = require('fs');
const audioData = fs.readFileSync('audio.raw'); // Raw 16-bit PCM

// Process in frames
for (let i = 0; i < audioData.length; i += FRAME_SIZE_BYTES) {
  const frame = audioData.subarray(i, i + FRAME_SIZE_BYTES);
  const isSpeech = vad.process(frame);
  console.log(isSpeech ? 'SPEECH' : 'SILENCE');
}
```

## API Reference

### AudioCaptureService Methods

**`start()`**
Start microphone capture and VAD

**`stop()`**
Stop microphone capture

**`getAudioLevel()`**
Get current audio level (0-100)

**`isCurrentlySpeaking()`**
Check if speech is currently being detected

**`isActive()`**
Check if recording is active

**`cleanup(olderThanMinutes)`**
Clean up old audio files

### Events

**`started`**
Emitted when microphone capture starts

**`stopped`**
Emitted when microphone capture stops

**`speechStart`**
Emitted when speech is detected

**`speechEnd`**
Emitted when speech ends
```typescript
{
  filePath: string,    // Path to saved WAV file
  duration: number,    // Duration in milliseconds
  timestamp: Date      // When speech started
}
```

**`error`**
Emitted on errors

## Comparison with Other VADs

| Feature | webrtcvad | @ricky0123/vad | @ericedouard/vad |
|---------|-----------|----------------|------------------|
| Windows Support | ✅ Excellent | ❌ Deprecated | ❌ Native issues |
| Algorithm | WebRTC VAD | Silero VAD | Silero VAD |
| Dependencies | Simple | onnxruntime | onnxruntime |
| CPU Usage | Very low | Low-Medium | Low-Medium |
| Accuracy | Very good | Excellent | Excellent |
| Ease of Use | Excellent | Good | Good |
| **Recommendation** | **✅ Best for Windows** | ⚠️ Being deprecated | ❌ Windows issues |

## Credits

- **webrtcvad** by Serenade AI - Node.js bindings for WebRTC VAD
- **Google WebRTC** - Original VAD algorithm
- **sox** - Audio recording backend

## Support

For issues with webrtcvad:
- GitHub: https://github.com/serenadeai/webrtcvad
- npm: https://www.npmjs.com/package/webrtcvad

For TwitchCoHost issues:
- Check this guide first
- Review Windows setup instructions
- Open an issue on the project GitHub

---

**Reliable Voice Detection for Windows!** 🎤✅
