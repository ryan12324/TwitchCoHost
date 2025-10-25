# Windows Setup Guide for TwitchCoHost

This guide provides Windows-specific instructions for setting up the VTuber CoHost system.

## Prerequisites for Windows

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **Git for Windows** - [Download](https://git-scm.com/download/win)
3. **Visual Studio** (Community Edition is free) OR **CMake + MinGW**
   - Visual Studio: [Download](https://visualstudio.microsoft.com/downloads/)
   - CMake: [Download](https://cmake.org/download/)

## Step-by-Step Windows Installation

### 1. Install Node.js and Git

Download and install both Node.js and Git for Windows from the links above. Accept default options during installation.

### 2. Clone the Repository

Open **Command Prompt** or **PowerShell**:

```powershell
# Navigate to your desired directory
cd C:\Users\YourUsername\Documents

# Clone the repository
git clone https://github.com/yourusername/TwitchCoHost.git
cd TwitchCoHost

# Install dependencies
npm install
```

### 3. Set Up Whisper.cpp on Windows

#### Option A: Build from Source (Recommended)

**Using CMake and Visual Studio:**

```powershell
# Clone whisper.cpp
cd C:\
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Create build directory
mkdir build
cd build

# Generate Visual Studio project files
cmake ..

# Build the project (this will take a few minutes)
cmake --build . --config Release

# Download the model
cd ..
cd models
.\download-ggml-model.cmd base.en
```

Your executable will be at: `C:\whisper.cpp\build\bin\Release\main.exe`

#### Option B: Download Pre-built Binary

1. Visit [Whisper.cpp Releases](https://github.com/ggerganov/whisper.cpp/releases)
2. Download the latest Windows binary (e.g., `whisper-bin-x64.zip`)
3. Extract to `C:\whisper.cpp\`
4. Download a model:
   ```powershell
   cd C:\whisper.cpp\models
   .\download-ggml-model.cmd base.en
   ```

### 4. Configure Environment Variables

Copy the example environment file:

```powershell
copy .env.example .env
```

Edit `.env` file with **Notepad** or **VS Code**:

```env
# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Twitch
TWITCH_CHANNEL=your_channel_name
TWITCH_BOT_USERNAME=your_bot_name
TWITCH_OAUTH_TOKEN=oauth:your_token_here

# OBS WebSocket
OBS_WEBSOCKET_URL=ws://localhost:4455
OBS_WEBSOCKET_PASSWORD=your_obs_password

# Whisper CPP (IMPORTANT: Use backslashes for Windows paths)
WHISPER_CPP_PATH=C:\whisper.cpp\build\bin\Release\main.exe
WHISPER_MODEL_PATH=C:\whisper.cpp\models\ggml-base.en.bin

# TTS Engine
TTS_ENGINE=browser

# Memory Settings
MEMORY_MAX_MESSAGES=50
MEMORY_CONTEXT_WINDOW=20

# CoHost Settings
COHOST_NAME=CoHost
COHOST_PERSONALITY=friendly and helpful AI assistant
RESPONSE_COOLDOWN_MS=3000

# Wake Word Configuration
WAKE_WORD=hey cohost
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=true

# VTube Studio (optional)
VTUBE_STUDIO_ENABLED=true
VTUBE_STUDIO_URL=ws://localhost:8001
```

**Important Notes:**
- Use backslashes `\` in Windows paths, NOT forward slashes `/`
- Make sure to point to `main.exe`, not just `main`
- The paths are case-insensitive on Windows

### 5. Set Up OBS WebSocket

1. Download and install [OBS Studio](https://obsproject.com/)
2. Open OBS Studio
3. Go to **Tools** → **WebSocket Server Settings**
4. Click **Enable WebSocket server**
5. Set a password (or leave blank for none)
6. Note the port (default: `4455`)
7. Click **OK**

### 6. Get Twitch OAuth Token

1. Visit [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/)
2. Click **Connect**
3. Authorize with your **bot account** (not your main account)
4. Copy the OAuth token (it starts with `oauth:`)
5. Paste it into your `.env` file

### 7. Install VTube Studio (Optional)

1. Purchase [VTube Studio on Steam](https://store.steampowered.com/app/1325860/VTube_Studio/) ($15)
2. Install and launch VTube Studio
3. Go to **Settings** (gear icon)
4. Click **General**
5. Enable **"Allow 3rd party apps to connect"**
6. Keep VTube Studio running

### 8. Build and Run

Open **Command Prompt** or **PowerShell** in the TwitchCoHost directory:

```powershell
# Build the TypeScript code
npm run build

# Run with web dashboard (recommended!)
npm run gui

# OR run with CLI only
npm start
```

Open your browser to: **http://localhost:3000**

## Testing Whisper.cpp on Windows

Before running the full application, test that Whisper.cpp works:

```powershell
# Create a test audio file (or use an existing one)
# Test Whisper manually
C:\whisper.cpp\build\bin\Release\main.exe -m C:\whisper.cpp\models\ggml-base.en.bin -f test.wav
```

If this works, you should see transcription output!

## Common Windows Issues

### Issue: "Cannot find module" errors

**Solution:**
```powershell
# Delete node_modules and reinstall
rmdir /s node_modules
del package-lock.json
npm install
```

### Issue: Whisper.cpp build fails with CMake

**Solution:**
- Make sure Visual Studio is installed with "Desktop development with C++" workload
- Try using **x64 Native Tools Command Prompt** (comes with Visual Studio)
- Alternative: Install [MinGW-w64](https://www.mingw-w64.org/) and use `make` instead

### Issue: "Access denied" when running main.exe

**Solution:**
- Right-click `main.exe` → Properties → Unblock
- Run Command Prompt/PowerShell as Administrator
- Check Windows Defender hasn't quarantined the file

### Issue: Path with spaces causes errors

**Solution:**
```env
# If your path has spaces, use quotes in the .env file
WHISPER_CPP_PATH="C:\Program Files\whisper.cpp\main.exe"
```

### Issue: Audio capture not working

**Solution:**
- Make sure your microphone is set as the **Default Recording Device**
- Right-click volume icon → **Sounds** → **Recording** tab
- Check microphone permissions in **Windows Settings** → **Privacy** → **Microphone**

### Issue: OBS WebSocket won't connect

**Solution:**
- Ensure OBS is running **before** starting CoHost
- Check Windows Firewall isn't blocking port 4455
- Try disabling the password temporarily for testing

## Performance Tips for Windows

1. **Use SSD Storage** - Store the project and Whisper models on an SSD for faster loading
2. **Close Background Apps** - Free up RAM for better AI performance
3. **Use Hardware Acceleration** - If you have an NVIDIA GPU, Whisper.cpp can use CUDA:
   ```powershell
   # Build with CUDA support
   cmake .. -DWHISPER_CUDA=ON
   cmake --build . --config Release
   ```
4. **Antivirus Exclusions** - Add the project folder to Windows Defender exclusions for faster file I/O

## Running as a Windows Service (Advanced)

To run CoHost automatically on Windows startup:

1. Install [NSSM](https://nssm.cc/download) (Non-Sucking Service Manager)
2. Open Command Prompt as Administrator:
   ```powershell
   nssm install TwitchCoHost "C:\Program Files\nodejs\node.exe"
   ```
3. In the NSSM GUI:
   - Path: `C:\Program Files\nodejs\node.exe`
   - Startup directory: `C:\Users\YourUsername\Documents\TwitchCoHost`
   - Arguments: `dist/index.js --gui`
   - Click **Install service**

## Next Steps

1. ✅ Follow the main [README.md](README.md) for configuration details
2. ✅ Read [VTUBE_STUDIO_SETUP.md](VTUBE_STUDIO_SETUP.md) for avatar integration
3. ✅ Check [WAKE_WORD_GUIDE.md](WAKE_WORD_GUIDE.md) for voice activation setup

## Support

If you encounter Windows-specific issues:
1. Check this guide's troubleshooting section
2. Verify all paths use backslashes `\`
3. Make sure all services (OBS, VTube Studio) are running
4. Test Whisper.cpp independently first
5. Open an issue on GitHub with your error message

---

**Happy Streaming on Windows!** 🎮🪟
