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
