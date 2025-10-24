# VTube Studio Integration Guide

Complete guide for setting up VTube Studio with your AI CoHost.

## Prerequisites

1. **VTube Studio** - Download from [Steam](https://store.steampowered.com/app/1325860/VTube_Studio/) ($15) or use free trial
2. **iPhone/iPad** (recommended) - For ARKit face tracking ($15 for iOS app)
   - Or use webcam tracking (free, less accurate)
3. **Live2D Model** - Your VTuber avatar

## Step 1: Enable VTube Studio API

1. Open VTube Studio on your PC
2. Click the **Settings** icon (gear)
3. Go to **General Settings**
4. Enable **"Allow 3rd party apps to connect"**
5. Note the port (default: `8001`)

## Step 2: Configure CoHost

Edit your `.env` file:

```env
# Enable VTube Studio integration
VTUBE_STUDIO_ENABLED=true
VTUBE_STUDIO_URL=ws://localhost:8001
```

## Step 3: First Connection

1. Start VTube Studio first
2. Load your avatar model
3. Run the CoHost:
   ```bash
   npm start
   ```

4. **IMPORTANT**: When CoHost first connects, VTube Studio will show a permission dialog
   - Click **"Allow"** to authorize "TwitchCoHost"
   - This only happens once

## How It Works

### Automatic Emotion Detection

The CoHost analyzes AI responses and automatically changes your avatar's expression:

```
User: "That's amazing!"
AI: "I know right! This is so exciting!"
   ↓
Avatar: Changes to "happy" expression and waves
```

### Supported Emotions

The system detects these emotions and maps them to your model's expressions:

- **Happy** → `happy`, `smile`, `joy`, `excited` expressions
- **Sad** → `sad`, `cry`, `tears` expressions
- **Surprised** → `surprised`, `shock`, `amazed` expressions
- **Confused** → `confused`, `thinking` expressions
- **Angry** → `angry`, `mad` expressions
- **Love** → `love`, `heart`, `blush` expressions
- **Neutral** → `default`, `idle` expressions

### Automatic Animations

Based on emotion, the system can trigger animations:

- **Happy** → wave, clap, celebrate
- **Sad** → sigh, head_down
- **Surprised** → gasp, jump
- **Confused** → think, tilt_head
- **Angry** → shake_head, cross_arms
- **Love** → heart, blush

## Setting Up Your Model

### Expression Setup

For best results, create expressions in VTube Studio with these names:

**Basic emotions:**
- `happy` or `smile`
- `sad` or `cry`
- `surprised` or `shock`
- `angry` or `mad`
- `neutral` or `default`

**Advanced emotions:**
- `love` or `heart`
- `confused` or `thinking`
- `excited`
- `scared`

### Hotkey Setup

Create hotkeys in VTube Studio for animations:

1. Go to **Settings** → **Hotkeys**
2. Create hotkeys with these names:
   - `wave` - Waving animation
   - `clap` - Clapping
   - `celebrate` - Celebration animation
   - `think` - Thinking pose
   - `gasp` - Surprised reaction
   - `sigh` - Sad reaction

The CoHost will automatically trigger these when appropriate!

## Testing

### Test Expressions

In the CoHost terminal, try these:

```bash
> I'm so happy to be streaming!
# Avatar should show happy expression

> Oh no, that's unfortunate
# Avatar should show sad expression

> Wow! That's incredible!
# Avatar should show surprised expression
```

### Check Available Expressions

The CoHost logs what expressions it finds:

```
[VTubeStudio] Activated expression: happy.exp3.json
[CoHost] Detected emotion: happy (confidence: 80%)
```

## Troubleshooting

### "Failed to connect to VTube Studio"

**Solution:**
1. Make sure VTube Studio is running
2. Check **Settings** → **General** → **"Allow 3rd party apps"** is enabled
3. Verify the port is `8001` (default)
4. Check firewall isn't blocking WebSocket connections

### "Authentication failed"

**Solution:**
1. In VTube Studio: **Settings** → **Plugins**
2. Remove "TwitchCoHost" from the list
3. Restart CoHost - it will request permission again

### Expressions not working

**Solution:**
1. Check your model has expressions with matching names
2. In VTube Studio: **Settings** → **Expressions**
3. Ensure expressions are enabled
4. The CoHost tries to match partial names (e.g., "happy" matches "happy.exp3.json")

### Animations not triggering

**Solution:**
1. Check you have hotkeys set up with matching names
2. In VTube Studio: **Settings** → **Hotkeys**
3. The CoHost lists available hotkeys on connection
4. Check logs for: `[VTubeStudio] No hotkey found for animation: xyz`

## Advanced Usage

### Custom Emotion Mappings

You can customize emotion detection in `src/services/claude.ts`:

```typescript
{
  emotion: 'happy',
  keywords: ['happy', 'excited', 'great', 'awesome'],
  animations: ['wave', 'clap', 'celebrate'],
}
```

Add your own keywords and animation triggers!

### Manual Control

You can trigger expressions programmatically:

```typescript
// In your custom code
await cohost.vtubeStudio.setEmotion('happy');
await cohost.vtubeStudio.triggerAnimation('wave');
```

## Best Practices

1. **Keep expressions subtle** - Frequent changes can be distracting
2. **Test with real streams** - See what feels natural
3. **Adjust cooldowns** - Modify `RESPONSE_COOLDOWN_MS` if needed
4. **Use animation sparingly** - Let emotions drive most changes
5. **Name hotkeys clearly** - Use simple, descriptive names

## Example Workflow

```
1. User in chat: "What's your favorite game?"
   ↓
2. AI generates: "Oh, that's a great question! I love RPGs..."
   ↓
3. CoHost detects: emotion="happy", confidence=75%
   ↓
4. VTube Studio: Activates "happy" expression
   ↓
5. VTube Studio: Triggers "think" animation (from suggestions)
   ↓
6. TTS: Speaks the response
   ↓
7. Twitch Chat: Sends the message
```

## Performance Tips

- **Face Tracking**: iPhone ARKit > Webcam for accuracy
- **Model Complexity**: Simpler models = better performance
- **Expression Count**: 5-10 expressions is optimal
- **Animation Length**: Keep animations under 2 seconds

## Getting More Models

### Free Models
- **VRoid Hub** - https://hub.vroid.com/
- **Booth.pm** - Free section

### Paid Models
- **Booth.pm** - $20-100 for quality models
- **Commission Artists** - $100-500 for custom

### DIY
- **VRoid Studio** - Create your own 3D model
- **Live2D Cubism** - Create 2D rigging (advanced)

## Additional Resources

- [VTube Studio Documentation](https://github.com/DenchiSoft/VTubeStudio)
- [VTube Studio Discord](https://discord.gg/vtubestudio)
- [Live2D Tutorial](https://www.live2d.com/en/learn/tutorial/)

---

**Happy Streaming!** 🎭✨
