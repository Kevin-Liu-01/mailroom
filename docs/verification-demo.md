# Google OAuth verification: the demo video

**Status (2026-09-28):** submitted. The demo video is https://youtu.be/bcbSblgWA88 (unlisted, 52 s, recorded from
the live site with the owner's account; the Gmail filters list is blurred because filter criteria include personal addresses; the
first cut, mKZpCdDcXH0, should be set to private in YouTube Studio), the Verification Center shows "Your app's data access is under review",
and both questionnaire acknowledgements (requirements read; CASA required for restricted scopes) were accepted.
The `Additional info` text below was sent with it. If Google asks for a new recording, the shot list still applies;
the source clips are `~/Downloads/mailroom-demo-part{1,2}.gif` and the cut is `~/Downloads/mailroom-demo-v2.mp4`.

Everything else in the Verification Center is complete (branding verified, scopes justified, privacy and
terms pages live). The one missing field is **Video link**: an unlisted YouTube video that shows the OAuth
consent flow and how each Gmail scope is used. Google's reviewers watch for three things: the consent screen
with the app name and every scope, the app's URL bar, and the scopes actually being exercised.

## Recording (about two minutes, one take, no narration needed)

Use QuickTime or `Cmd+Shift+5` on the whole screen, English UI, signed out of Mailroom first.

1. **Landing.** Open https://mailroom.kevinliu.studio and pause a second on the hero.
2. **Sign in.** Click *Connect Gmail*. On the Google account chooser pick k.bowen.liu@gmail.com.
   On the "Google hasn't verified this app" screen click *Advanced* → *Go to mailroom.kevinliu.studio (unsafe)*.
3. **Consent screen.** Slow down here. Hover over each checkbox so the full scope text is readable:
   "Read, compose, and send emails" (gmail.modify) and "See, edit, create, or change your email settings and
   filters" (gmail.settings.basic). Leave both checked, click *Continue*.
4. **Dashboard.** Let it load. Click *Preview*, wait for the summary table (rules matched, nothing changed).
5. **Apply.** Click *Apply now*, confirm, wait for the receipt (changed count, per-rule table).
6. **Gmail, in a new tab.** Open https://mail.google.com, show the Mailroom labels in the left rail and one
   labeled thread. Open *Settings → See all settings → Filters and Blocked Addresses* and scroll the
   Mailroom filters (this is the gmail.settings.basic scope in use).
7. **Undo.** Back in Mailroom, open the run in *Runs* and click *Undo*; show the count go back.
8. **Policy and leaving.** Open *Policy* (the user controls every rule), then scroll to *Leave Mailroom*
   (disconnect revokes the token and deletes the data). Stop recording.

## Upload

YouTube → Create → Upload → visibility **Unlisted** → copy the link. Paste it into
Google Auth Platform → Data Access → the Gmail scopes' *Demo video* field, save, then Verification Center →
*Prepare for verification* → *Confirm*. Or drop the link in chat and Claude will submit it.

## Additional info (paste into the submission form)

Mailroom is a single-developer mailbox organizer. Users connect their own Gmail; the app reads message
metadata only (headers, snippet, label ids), never message bodies or attachments, and stores only what is
needed to show receipts and cached judgments. It never sends mail, never permanently deletes, and every run
can be undone from the dashboard. Data is not shared with or sold to third parties; the only processor is
TypeSafe (metadata-only classification), disclosed in the privacy policy. Disconnecting revokes the Google
token and deletes the account's data. Source: https://github.com/Kevin-Liu-01/mailroom.

## What happens next

Google's initial review takes about a week. Because gmail.modify is a restricted scope, they will most
likely then ask for a CASA Tier 2 security assessment (a scan by an authorized lab, free tiers exist) before
the "unverified app" screen disappears. Until approval the screen stays for everyone, including the owner,
and at most 100 people can connect.

## Converting a QuickTime recording

```bash
ffmpeg -i demo.mov -vf "scale=1920:-2,fps=30" -c:v libx264 -pix_fmt yuv420p -crf 20 -an demo.mp4
```

## 2026-09-29 re-cut (v3)

Kevin noticed the video had giant white margins. The consent screens (5–26 s) and the Gmail Settings segment (46–48 s)
had been captured at a smaller window size and padded with white to 1316×896. v3 crops those segments to their content
and scales them back to the canvas, and cuts a 0.8 s white flash:

```bash
ffmpeg -i mailroom-demo-v2.mp4 -filter_complex "[0:v]trim=0:5.13,setpts=PTS-STARTPTS[a];[0:v]trim=5.13:26.0,setpts=PTS-STARTPTS,crop=878:598:0:0,scale=1316:896:flags=lanczos[b];[0:v]trim=26.0:45.6,setpts=PTS-STARTPTS[c];[0:v]trim=46.4:48.6,setpts=PTS-STARTPTS,crop=1198:816:0:0,scale=1316:896:flags=lanczos[d];[0:v]trim=48.6,setpts=PTS-STARTPTS[e];[a][b][c][d][e]concat=n=5:v=1:a=0,format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 18 -r 15 -movflags +faststart mailroom-demo-v3.mp4
```

The blur over the Filters page survives the crop (it is baked into v2's pixels). v3 is unlisted at
https://youtu.be/k2CBwddGPUI and is the link on the Data Access page; v1 (mKZpCdDcXH0) and v2 (bcbSblgWA88) are Private.
Segment boundaries came from classifying every frame's non-white bounding box with Pillow (see the session log).

