# Papera Demo Video

## How to record and add your demo

### 1. Install OpenScreen
The installer was downloaded to `~/Downloads/Openscreen-installer.dmg`. Double-click to install.

If macOS Gatekeeper blocks it (no developer cert), run:
```bash
xattr -rd com.apple.quarantine /Applications/Openscreen.app
```

Grant screen recording + accessibility permissions in System Settings.

### 2. Start the Papera dev server
```bash
cd "packages/web"
npm run dev
```
Open `http://localhost:5173/app` and log in as a real user.

### 3. Record the demo (45-60 seconds recommended)

**Suggested script:**

| Beat | Duration | Action |
|---|---|---|
| 1 | 0:00-0:05 | Show empty notebook with clean paper |
| 2 | 0:05-0:10 | Tap "AI Generate" button, open prompt modal |
| 3 | 0:10-0:18 | Type: "Weekly planner for a startup founder" |
| 4 | 0:18-0:22 | Click generate, show AI thinking indicator |
| 5 | 0:22-0:35 | Blocks cascade in: heading, priority matrix, mood tracker, weekly grid |
| 6 | 0:35-0:42 | User clicks a block and edits text inline |
| 7 | 0:42-0:48 | Switch paper type (lined -> dotted), content adapts |
| 8 | 0:48-0:55 | Export as PDF, show clean preview |

### 4. Export settings in OpenScreen
- **Resolution:** 1920x1200 (matches video component aspect ratio 16:10)
- **Format:** MP4
- **Frame rate:** 60fps
- **Audio:** Optional (autoplay is muted by default)
- **Motion blur:** Enabled for smooth pans
- **Background:** Transparent or subtle gradient

### 5. Drop the file

Save the exported MP4 as:
```
packages/web/public/demo/papera-demo.mp4
```

Optionally, save a poster frame as:
```
packages/web/public/demo/papera-demo-poster.jpg
```

The `DemoVideoSection` component will auto-detect the video and replace
the animated placeholder with your real recording. No code changes needed.

### Recommended video length
- **Minimum:** 30 seconds (shows generation)
- **Optimal:** 45-60 seconds (full user flow)
- **Maximum:** 90 seconds (people lose focus after)

### File size targets
- Under 10MB for web performance
- Use [Handbrake](https://handbrake.fr/) with "Web Optimized" preset
- Or ffmpeg: `ffmpeg -i input.mp4 -vcodec libx264 -crf 24 -preset slow -movflags +faststart papera-demo.mp4`
