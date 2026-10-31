# Character welcome showcases

Owner authorized implementation on October 30, 2026 after reviewing the welcome/mode proposal.

Codependent: Brenda Borderline, Marty Martyr, HAL. Sarcastic: Graham Grudge, Roxie Razor, Raven Morrow. Adult: Frankie Fastlane, Rita Redline, Vivienne Vex.

Versioned H.264/AAC MP4s use each original approved performance and original audio, with identical picture/audio trims. Full transcripts, source hashes, trim ranges, mode membership, output hashes and durations are in manifest.json. Public Adult language remains bleeped; no new synthesis. Roxie uses the approved tighter performance framing. The historical originals are retained.

The landing preview is silent until a gesture enables sound. Reduced-motion visitors get a poster and Play control. Switching modes stops prior playback. Individual audio, signup, Skip, visibility changes and scrolling out of view pause the showcase. A failed network request times out, keeps signup available, and never retries automatically.

The app uses the same public player.html and media with its existing WebView dependency. The native app controls mode eligibility, consent, navigation/motion/foreground checks and copilot selection. This player receives no login credentials or location. Streaming is optional: native character selection remains available when videos fail. App voice activation requirements remain unchanged.

Checks: node scripts/check-voice-samples.cjs; node scripts/check-marketing-events.mjs; node scripts/check-showcase.cjs; git diff --check. Verify the deployed browser media before claiming playback acceptance.
