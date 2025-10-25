# Wake Word & Smart Response Guide

Complete guide to configuring wake word detection and AI-powered response filtering.

## Overview

The CoHost system has two intelligent features to control when it responds:

1. **Wake Word Detection** - Only respond when a specific word/phrase is said
2. **Smart Response Filter** - AI decides if a message is worth responding to

These features prevent the CoHost from responding to every message, making conversations more natural and avoiding spam.

---

## Wake Word Detection

### What It Does

The system only responds when it detects a specific wake word or phrase in the message.

**Examples:**
- ✅ "Hey CoHost, what game are we playing?" → **Responds**
- ❌ "This game is fun" → **Ignores**
- ✅ "@CoHost tell me a joke" → **Responds**
- ❌ "lol that's hilarious" → **Ignores**

### Configuration

```env
# Enable/disable wake word detection
WAKE_WORD_ENABLED=true

# Set your wake word (not case-sensitive)
WAKE_WORD=hey cohost
```

### Wake Word Triggers

The system responds when it detects:

1. **Your configured wake word**: "hey cohost"
2. **Bot's name**: "CoHost"
3. **@mentions**: "@CoHost" or "@your_bot_username"

**Examples of wake words:**
- `hey cohost`
- `hey claude`
- `yo bot`
- `assistant`
- `ai friend`

### How It Works

```
Chat: "hey cohost, how are you?"
  ↓
Wake Word Detection: ✅ "hey cohost" found!
  ↓
AI Processes and Responds
```

```
Chat: "this stream is awesome"
  ↓
Wake Word Detection: ❌ No wake word
  ↓
Ignored (but added to memory for context)
```

### Voice Input with Wake Word

When speaking, you must say the wake word:

```
You say: "Hey CoHost, what should I play next?"
  ↓
VAD captures speech → Whisper transcribes
  ↓
Wake Word Detection: ✅ "hey cohost" found!
  ↓
AI responds with suggestion
```

```
You say: "I think I'll play Minecraft"
  ↓
VAD captures speech → Whisper transcribes
  ↓
Wake Word Detection: ❌ No wake word
  ↓
Ignored (but remembered for context)
```

---

## Smart Response Filter

### What It Does

The AI analyzes each message to determine if it's worth responding to, even without a wake word.

**Uses Claude AI to evaluate:**
- Is this a direct question?
- Does it require engagement?
- Would a response benefit the stream?
- Is it just a reaction/emote?

### Configuration

```env
# Enable/disable AI-powered filtering
SMART_RESPONSE_FILTER=true
```

### How It Works

```
Chat: "what's your favorite game?"
  ↓
AI Analysis: ✅ Direct question - RESPOND
  ↓
Confidence: 90%
  ↓
AI generates response
```

```
Chat: "lol"
  ↓
AI Analysis: ❌ Just a reaction - SKIP
  ↓
Confidence: 85%
  ↓
Ignored
```

### AI Decision Examples

**Messages AI will respond to:**
- "what game are you playing?"
- "can you explain that?"
- "hey, how does this work?"
- "what do you think about X?"
- "tell me more about that"

**Messages AI will ignore:**
- "lol"
- "gg"
- "Kappa"
- "PogChamp"
- "nice"
- "F"

### Console Output

You'll see the AI's decision-making:

```
[CoHost] AI analysis: RESPOND - direct question (confidence: 92%)
[CoHost] Generating response...
```

```
[CoHost] AI analysis: SKIP - common chat reaction (confidence: 88%)
```

---

## Configuration Modes

### Mode 1: Wake Word Only

```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=false
WAKE_WORD=hey cohost
```

**Behavior:**
- ✅ Only responds to messages with "hey cohost"
- ❌ Ignores everything else
- **Best for:** Streams with lots of chat activity, want full control

### Mode 2: Smart Filter Only

```env
WAKE_WORD_ENABLED=false
SMART_RESPONSE_FILTER=true
```

**Behavior:**
- ✅ AI decides what to respond to
- ❌ May still respond to questions without wake word
- **Best for:** Quieter streams, natural conversation

### Mode 3: Both Enabled (Recommended)

```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=true
WAKE_WORD=hey cohost
```

**Behavior:**
- ✅ Wake word **always** triggers response
- ✅ Without wake word, AI decides
- **Best for:** Balanced approach, flexibility

**Example flow:**
```
"hey cohost, hi!" → RESPOND (wake word)
"what's happening?" → AI decides (maybe respond)
"lol" → AI decides (probably skip)
```

### Mode 4: Everything Disabled

```env
WAKE_WORD_ENABLED=false
SMART_RESPONSE_FILTER=false
```

**Behavior:**
- ⚠️ Responds to almost everything (questions, mentions)
- **Not recommended** - can spam responses

---

## Use Cases

### High-Activity Chat Stream

```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=false
WAKE_WORD=hey cohost
```

**Why:** Prevents spam, chat must explicitly ask the CoHost

### Chill Stream with Few Viewers

```env
WAKE_WORD_ENABLED=false
SMART_RESPONSE_FILTER=true
```

**Why:** More natural, AI engages with interesting messages

### Voice-Controlled CoHost

```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=true
WAKE_WORD=hey claude
```

**Why:** Say "hey claude" when you want it to respond to your speech

---

## Testing

### Test Wake Word Detection

```bash
# Start the system
npm run gui

# In Twitch chat, try:
"hey cohost, can you hear me?"     # Should respond
"this is a test message"            # Should ignore
"@CoHost what's up?"                # Should respond
```

### Test Smart Filter

```bash
# Disable wake word temporarily
WAKE_WORD_ENABLED=false
SMART_RESPONSE_FILTER=true

# In Twitch chat, try:
"what game are you playing?"        # Should respond
"lol"                               # Should ignore
"can you explain that?"             # Should respond
"gg"                                # Should ignore
```

### Check Console Logs

Watch for these messages:

```
[CoHost] Wake word detected! Responding to: "hey cohost, hi!"
[CoHost] No wake word in: "just chatting" - skipping
[CoHost] AI analysis: RESPOND - direct question (confidence: 90%)
[CoHost] AI analysis: SKIP - common reaction (confidence: 85%)
```

---

## Best Practices

### 1. Choose a Clear Wake Word

**Good wake words:**
- "hey cohost"
- "hey claude"
- "yo assistant"

**Avoid:**
- Common words ("ok", "well", "so")
- Single letters
- Words used frequently in your game/stream

### 2. Let Viewers Know

Tell your chat:
> "To talk to my AI cohost, start your message with 'hey cohost'!"

### 3. Monitor Console

Keep an eye on why the AI is responding/skipping:
- Too many skips? Lower confidence threshold or disable smart filter
- Too many responses? Enable wake word only

### 4. Adjust for Your Stream

- **High-energy stream**: Wake word only
- **Educational stream**: Smart filter (responds to questions)
- **Gaming stream**: Both (wake word for direct, AI for interesting convos)

---

## Troubleshooting

### "It responds to everything!"

**Solution:**
```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=false
WAKE_WORD=hey cohost
```

### "It never responds!"

**Solution:**
- Check wake word spelling in .env
- Make sure wake word is in your messages
- Check console for "Wake word detected" messages
- Try disabling wake word temporarily

### "AI skips questions I want it to answer"

**Solution:**
- Use wake word for important questions
- Check AI's reasoning in console
- Consider disabling smart filter

### "Wake word not working in voice"

**Solution:**
- Speak clearly
- Say wake word at start: "Hey cohost, what should I do?"
- Check Whisper transcription accuracy
- Try a simpler wake word

---

## Advanced Configuration

### Custom Wake Word Variations

You can modify the `detectWakeWord` method in `src/cohost.ts` to add variations:

```typescript
private detectWakeWord(message: string): boolean {
  const messageLower = message.toLowerCase();

  // Add your custom variations
  const wakeWords = [
    this.config.cohost.wakeWord.toLowerCase(),
    'hey ai',
    'yo bot',
    'assistant',
  ];

  return wakeWords.some(word => messageLower.includes(word));
}
```

### Adjust AI Confidence Threshold

Edit `src/cohost.ts`:

```typescript
// Only respond if AI is highly confident
if (analysis.confidence < 0.8) {
  return; // Skip low-confidence decisions
}
```

---

## Summary

**Wake Word Detection:**
- ✅ Explicit control
- ✅ Prevents spam
- ✅ Works with voice
- ❌ Requires users to know the wake word

**Smart Response Filter:**
- ✅ Natural conversation
- ✅ AI decides relevance
- ✅ Learns from context
- ❌ May miss some messages
- ❌ Costs API calls

**Best Setup:**
```env
WAKE_WORD_ENABLED=true
SMART_RESPONSE_FILTER=true
WAKE_WORD=hey cohost
```

This gives you both control AND intelligence!

---

**Happy Streaming!** 🎮🎤
