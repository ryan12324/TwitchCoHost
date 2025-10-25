# Fixing onnxruntime-node on Windows

## Problem
The `@ericedouard/vad-node-realtime` package depends on `onnxruntime-node`, which requires native binaries. The installation with `--ignore-scripts` skipped the setup.

## Solution 1: Clean Reinstall (Try this first)

```powershell
# Delete node_modules and package-lock
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies normally
npm install
```

If this fails with sharp errors, try:

```powershell
# Install with sharp disabled
$env:SHARP_IGNORE_GLOBAL_LIBVIPS="1"
npm install
```

## Solution 2: Install Visual C++ Redistributables

onnxruntime-node requires Visual C++ Runtime. Install:

**Microsoft Visual C++ 2015-2022 Redistributable (x64)**
Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe

Then run Solution 1 again.

## Solution 3: Revert to Original VAD (Recommended if above fails)

The original `@ricky0123/vad-node` has better Windows support with prebuild binaries.

Edit `package.json`:
```json
"dependencies": {
  "@ricky0123/vad-node": "^0.0.13",
  // Remove @ericedouard/vad-node-realtime
}
```

Then revert `src/services/audio-capture.ts` to use:
```typescript
import { MicVAD } from '@ricky0123/vad-node';
```

## Solution 4: Use WebAssembly VAD (Fallback)

If native modules continue to fail, we can use a pure JavaScript/WASM VAD that doesn't require native binaries.

---

## Which solution should we try?

Based on your Windows environment, I recommend:
1. **Try Solution 1 first** (clean reinstall)
2. **If that fails, try Solution 2** (install VC++ redistributables)
3. **If still failing, use Solution 3** (revert to @ricky0123/vad-node which has better Windows support)

Would you like me to implement Solution 3 (revert to the original VAD package)? It's the most reliable for Windows.
