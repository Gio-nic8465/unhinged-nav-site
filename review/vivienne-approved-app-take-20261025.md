# Vivienne website sample — use the owner-approved app take

Owner reported both the website voice and wording still sounded wrong after refreshing, then confirmed “The one on the app sounds great.” The website now derives from that exact accepted app MP3, not a newly generated or stitched take.

Input:56736bytes/SHA256 ab20eb8f2f787967de3108593396ce863d9dad8ae08d4501c39bf5c3a972cace. Its wording is the app's “Continue ahead when it is safe. A little composure. This is not a [bleep] audition.” with the swear word uncensored in the original app source. Public transcript is now matched to this recording, and its guidance cue reads “Continue ahead when it is safe.” The other eight demos keep their 200-foot directions.

Offline word alignment located the swear word at3.63–4.01seconds. Only3.62–4.02seconds was replaced with a1kHz tone. All other decoded PCM samples and the sample count are identical before final MP3 encoding; there is no concatenation or retiming. Encoded tone-band energy fraction0.999738 confirms the bleep. This is alignment to the known script, not an independent human listening result. No new voice generation, provider request or credit charge was used for this website change.

Output: vivienne-app-approved-bleep-v2.mp3,57645bytes/SHA256 995acb8a00aaabce9f53bd4560eb68678e49b4defb8022287e2064839416cf0f. The changed URL prevents the earlier website recording from being reused by its old media URL. The earlier website clip is removed from the current site, retained in Git history and the verified pre-change bundle.

Before publication: node scripts/check-voice-samples.cjs PASS across all nine files, mode/character mappings, transcript and cue matching, switching, stale callbacks, completion, error and retry; inline JavaScript parses; git diff --check PASS. Live asset and browser verification follow publication. The app service and app recording remain unchanged.
