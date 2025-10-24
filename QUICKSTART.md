# Quick Start Guide

Get your VTuber CoHost up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js v18+ installed
- [ ] Anthropic API key
- [ ] Whisper CPP compiled and model downloaded
- [ ] Twitch account for the bot
- [ ] OBS Studio with WebSocket enabled

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
ANTHROPIC_API_KEY=your_key_here
TWITCH_CHANNEL=your_channel
TWITCH_BOT_USERNAME=your_bot_name
TWITCH_OAUTH_TOKEN=oauth:your_token
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=your_obs_password
WHISPER_CPP_PATH=/path/to/whisper.cpp/main
WHISPER_MODEL_PATH=/path/to/models/ggml-base.en.bin
```

### 3. Build and Run

```bash
npm run build
npm start
```

## Getting Your Credentials

### Anthropic API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new key

### Twitch OAuth Token
1. Go to https://twitchapps.com/tmi/
2. Log in with your bot account
3. Authorize the app
4. Copy the token (starts with `oauth:`)

### OBS WebSocket Password
1. Open OBS Studio
2. Tools → WebSocket Server Settings
3. Enable and set a password
4. Note the port (default: 4455)

### Whisper CPP Setup
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make
bash ./models/download-ggml-model.sh base.en
```

## First Test

Once running, type in the terminal:

```
Hello, can you hear me?
```

The CoHost should respond! You can also use:

```
/help      - See all commands
/stats     - View statistics
/search    - Semantic search (e.g., /search what did we talk about?)
/scenes    - List OBS scenes
```

## Next Steps

1. Test Twitch chat integration by sending messages in your channel
2. Try OBS commands: "switch to gameplay scene"
3. Try semantic search: `/search gaming topics`
4. Configure your TTS engine in `.env`
5. Set up voice input for full VTuber integration

## New: Semantic Memory

The CoHost now uses **LanceDB** for intelligent memory:
- Remembers conversations by meaning, not just recency
- Search past conversations with natural language
- Automatically downloads AI models on first run (may take a minute)
- All data stored locally for privacy

## Common Issues

**"Missing required environment variables"**
- Check your `.env` file exists and has all required fields

**"Failed to connect to OBS"**
- Ensure OBS is running
- Check WebSocket is enabled in OBS settings
- Verify the password and port

**"Failed to connect to Twitch"**
- Verify your OAuth token is valid
- Check the channel name is correct
- Make sure the bot account exists

**"Whisper CPP not found"**
- Verify the paths in `.env` point to the correct locations
- Test whisper manually: `./main -m model.bin -f test.wav`

## Need Help?

- Check the full [README.md](README.md) for detailed documentation
- Review the troubleshooting section
- Open an issue on GitHub

Happy streaming! 🎮
