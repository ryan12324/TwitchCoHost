# VTuber CoHost - AI-Powered Stream Assistant

An intelligent AI cohost for VTuber streams that uses Claude AI, Whisper CPP for speech recognition, and integrates with OBS and Twitch chat.

## Features

- **AI Responses**: Powered by Claude AI (Anthropic) for natural, contextual conversations
- **Speech Recognition**: Whisper CPP integration for transcribing voice input
- **Chat Integration**: Read and respond to Twitch chat messages
- **OBS Control**: Control OBS scenes, sources, and streaming/recording via WebSocket
- **Conversation Memory**: Persistent memory system to track conversation history and context
- **Text-to-Speech**: Multiple TTS options (browser, system, ElevenLabs)
- **Event Handling**: React to subscriptions, cheers, raids, and other Twitch events

## Architecture

```
TwitchCoHost/
├── src/
│   ├── services/
│   │   ├── claude.ts       # Claude AI integration
│   │   ├── memory.ts       # Conversation memory management
│   │   ├── whisper.ts      # Whisper CPP speech-to-text
│   │   ├── tts.ts          # Text-to-speech engines
│   │   ├── obs.ts          # OBS WebSocket controller
│   │   └── twitch.ts       # Twitch chat integration
│   ├── types.ts            # TypeScript type definitions
│   ├── config.ts           # Configuration loader
│   ├── cohost.ts           # Main CoHost orchestrator
│   └── index.ts            # Application entry point
├── .env                    # Your configuration (not in git)
├── .env.example            # Example configuration
└── package.json
```

## Prerequisites

### Required

1. **Node.js** (v18 or higher)
2. **Anthropic API Key** - Get one at [https://console.anthropic.com/](https://console.anthropic.com/)
3. **Whisper CPP** - Download and compile from [https://github.com/ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp)
4. **Twitch Account** - For the bot to connect to chat
5. **OBS Studio** with WebSocket plugin (v5.0+)

### Optional

- **ElevenLabs API Key** - For high-quality text-to-speech

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd TwitchCoHost
npm install
```

### 2. Set Up Whisper CPP

```bash
# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Compile
make

# Download a model (base.en is recommended for English)
bash ./models/download-ggml-model.sh base.en

# Note the paths:
# - Binary: /path/to/whisper.cpp/main
# - Model: /path/to/whisper.cpp/models/ggml-base.en.bin
```

### 3. Set Up OBS WebSocket

1. Open OBS Studio
2. Go to **Tools** → **WebSocket Server Settings**
3. Enable the WebSocket server
4. Set a password (optional but recommended)
5. Note the port (default: 4455)

### 4. Get Twitch OAuth Token

```bash
# Visit https://twitchapps.com/tmi/
# Login with your bot account
# Copy the OAuth token (starts with "oauth:")
```

### 5. Configure Environment Variables

```bash
# Copy the example config
cp .env.example .env

# Edit .env with your settings
nano .env
```

Example `.env`:

```env
# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Twitch
TWITCH_CHANNEL=your_channel_name
TWITCH_BOT_USERNAME=your_bot_name
TWITCH_OAUTH_TOKEN=oauth:your_token_here

# OBS
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=your_password

# Whisper CPP
WHISPER_CPP_PATH=/path/to/whisper.cpp/main
WHISPER_MODEL_PATH=/path/to/whisper.cpp/models/ggml-base.en.bin

# TTS (options: browser, system, elevenlabs)
TTS_ENGINE=browser

# Optional: ElevenLabs
# ELEVENLABS_API_KEY=your_key
# ELEVENLABS_VOICE_ID=your_voice_id

# Memory
MEMORY_MAX_MESSAGES=50
MEMORY_CONTEXT_WINDOW=20

# CoHost
COHOST_NAME=CoHost
COHOST_PERSONALITY=friendly and helpful AI assistant
RESPONSE_COOLDOWN_MS=3000
```

### 6. Build and Run

```bash
# Build TypeScript
npm run build

# Run the application
npm start

# Or for development with auto-reload
npm run dev
```

## Usage

### Basic Operation

Once started, the CoHost will:

1. **Connect to OBS** - Control scenes and sources
2. **Connect to Twitch** - Monitor chat and respond to messages
3. **Process Chat Messages** - Respond to questions and mentions
4. **Handle Special Events** - React to subs, cheers, raids
5. **Accept Voice Input** - Transcribe and respond to voice (when implemented)

### CLI Commands

While running, you can use these commands in the terminal:

```
/help                 - Show available commands
/stats                - Display memory statistics
/scenes               - List all OBS scenes
/scene                - Show current OBS scene
/quit or /exit        - Exit the application
```

### Chat Interaction

The CoHost will respond to:

- Questions (messages containing "?")
- Direct mentions (containing the bot's name or "@botname")
- Messages containing "cohost"

### OBS Control

The AI can control OBS by mentioning scenes in its responses:

- "Let me switch to the gameplay scene"
- "Let's show the camera source"
- "I'll hide the overlay"

Supported commands:
- Switch scenes
- Show/hide sources
- Toggle sources
- Start/stop streaming
- Start/stop recording

## Advanced Features

### Speech Recognition Integration

To use speech recognition (e.g., from a VTuber app):

```typescript
// In your VTuber app, send audio files to CoHost
cohost.processVoiceInput('/path/to/audio.wav');
```

### Custom TTS Engines

The system supports multiple TTS engines:

1. **Browser** - For web-based TTS (default)
2. **System** - Uses `say` (macOS) or `espeak` (Linux)
3. **ElevenLabs** - High-quality AI voices (requires API key)

### Memory Management

The CoHost maintains conversation history:

- Stores up to `MEMORY_MAX_MESSAGES` messages
- Uses last `MEMORY_CONTEXT_WINDOW` messages for context
- Persists to disk in `memory/conversation.json`
- Tracks message sources (chat, voice, system)

## Integration with VTuber Software

### VTube Studio / VSeeFace

To integrate with VTuber software:

1. **Audio Routing**: Use virtual audio cables to route microphone audio
2. **Voice Processing**: Save audio chunks and send to CoHost's Whisper integration
3. **Response Output**: Use TTS to play responses through speakers

### Example Integration Flow

```
User speaks → Mic → VTuber Software → Audio File
                                          ↓
                                    Whisper CPP
                                          ↓
                                    Claude AI
                                          ↓
                                    TTS Engine → Speakers
                                          ↓
                                    Twitch Chat (optional)
```

## Troubleshooting

### OBS Connection Issues

```bash
# Check OBS WebSocket is enabled
# Verify the port and password
# Ensure OBS is running before starting CoHost
```

### Whisper CPP Not Found

```bash
# Verify paths in .env
# Test whisper manually:
/path/to/whisper.cpp/main -m /path/to/model.bin -f audio.wav
```

### Twitch Connection Fails

```bash
# Verify OAuth token is valid
# Check channel name matches exactly
# Ensure bot account exists
```

### Memory Issues

```bash
# Clear memory:
rm -rf memory/

# Adjust memory limits in .env:
MEMORY_MAX_MESSAGES=30
MEMORY_CONTEXT_WINDOW=10
```

## Development

### Project Structure

- **services/** - Individual service modules (Claude, OBS, Twitch, etc.)
- **types.ts** - TypeScript interfaces and types
- **config.ts** - Configuration management
- **cohost.ts** - Main orchestration logic
- **index.ts** - CLI entry point

### Adding New Features

1. Create a new service in `src/services/`
2. Add configuration to `config.ts` and `.env.example`
3. Integrate with `CoHost` class in `cohost.ts`
4. Update types in `types.ts`

### Building

```bash
npm run build        # Compile TypeScript
npm run watch        # Watch mode for development
```

## API Reference

### CoHost Class

```typescript
class CoHost {
  async start(): Promise<void>
  async stop(): Promise<void>
  async processInput(input: string, source?: 'chat' | 'voice' | 'system', username?: string): Promise<void>
  async processVoiceInput(audioFilePath: string): Promise<void>
  getMemoryStats(): Object
  async listOBSScenes(): Promise<string[]>
  async getCurrentOBSScene(): Promise<string>
}
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

- **Claude AI** by Anthropic
- **Whisper CPP** by Georgi Gerganov
- **OBS WebSocket** by the OBS Project
- **TMI.js** for Twitch chat

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Roadmap

- [ ] Web dashboard for monitoring
- [ ] Voice activity detection (VAD) for automatic transcription
- [ ] Multiple language support
- [ ] Plugin system for extensions
- [ ] Emotion detection from voice
- [ ] Automated clip creation
- [ ] Stream analytics integration
- [ ] Multi-platform support (YouTube, Discord)

---

**Happy Streaming!** 🎮🎙️🤖
