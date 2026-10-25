# Codependent website playback repair — October 25, 2026

The live Codependent button was silent in a browser without a specifically named female speech-synthesis voice. Reproduced the visible unavailable-voice message before editing.

Replaced device-dependent synthesis with a same-origin PCM WAV preview, synthesized locally using Microsoft Zira Desktop (female, en-US), rate -1, with pauses between the existing three sample sentences. This is a preview, not a new approved final character recording. The existing final-recording-coming-soon label remains.

All three modes now share an HTML audio player. Mode changes stop previous playback; outdated callbacks cannot reset a newer selection. Playback animation begins on the playing event; failed playback displays a retry message.

Validation before publication: inline JavaScript parse; git diff --check; isolated execution without any speech-synthesis API; all three source paths; switching; stale completion/rejection; visible failure and retry; end cleanup; media existence and WAV RIFF header. Live browser acceptance is a separate post-deployment check.

Recovery: complete-history Git bundle verified before edits at Lab1 Documents/Unhinged-Nav-Backups/website-before-codependent-fix-20261025.bundle, baseline fda1eabc2e424ba7546b92ca59f08dcb2592ec5b. WAV 450022 bytes, SHA256 5fa01c4fe2d6860323d1514264141e39732910b0d8c94f8748af53b999b7ef18.

Record limits: recovered October 24 Mach42-release copies of Master Index and Changelog are historical; remaining requested mission/start/task/October 8/addendum files were not located. No current Android build or readiness claim is made by this website repair.
