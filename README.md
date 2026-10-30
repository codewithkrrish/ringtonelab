# RingtoneLab

I have a song I love, and I wanted exactly the best 30 seconds of it
as my ringtone — not a random clip, and not a file I had to upload
to some site first. Every cutter I tried either wanted an account or
sent my audio to a server. So I built the version I wanted: drop a
song in, drag a region on the waveform, hear it loop, add fades, and
download the ringtone. The whole thing runs in your browser.

## What it does

- Audio intake four ways: drag and drop, the file picker, pasting a
  copied audio file, or a demo tone generated in the browser if you
  have no file handy and just want to try the flow.
- A real waveform drawn from the decoded audio, not a fake picture.
  It is zoomable and scrollable, so a long song stays usable, with a
  playhead that follows playback.
- Selection three ways: drag on the waveform, drag the red handles,
  or type exact start and end times. The readout always shows the
  selection length. Presets cover the obvious cases: a 30-second
  ringtone window from your current position, the first 30 seconds,
  the last 30 seconds, and the full file.
- Playback: play the selection only, play from the playhead, loop
  preview, and volume. Keyboard shortcuts: Space plays or stops the
  selection, L toggles loop, R applies the 30-second preset. They
  stay quiet while you are typing in a field.
- Fades: fade-in and fade-out sliders from 0 to 5 seconds, shown as
  shaded zones on the waveform and applied at export.
- Export: WAV (16-bit PCM), named after your song with "-ringtone"
  added, so the original is never overwritten. Before exporting,
  the page shows the estimated WAV size next to the original file
  size, so the uncompressed size does not surprise you.
- A "How it works" strip and a plain-language limitations panel on
  the page itself.

## Why WAV and not MP3

I looked into MP3 export and decided against shipping it. A real MP3
encoder in the browser means a large encoder library, and this
project's rule is no large binaries in the repo. WAV encoding, by
contrast, is a few dozen lines of honest code in `js/wav.js`, and it
always works. The trade-off is size: a 30-second WAV at CD quality
is roughly 5 MB. It works as a ringtone on Android and most players.
iPhones are the exception — they need .m4r and a sync step, which
this page does not do. That is stated on the page rather than hidden.

## Honest limitations

- Whether a file decodes depends on your browser's codecs. MP3 and
  WAV work almost everywhere; OGG and FLAC fail in Safari, and
  DRM-protected files never decode.
- Very long files are held fully in memory while decoding and
  exporting. A full album in one go can be slow or fail on a
  low-memory device.
- iPhones do not accept WAV files as ringtones directly.
- Only cut audio you own or have the right to cut. The page does
  not check rights, and it never uploads your files anywhere.

## Run it locally

No build step, no dependencies to install — it is plain HTML, CSS
and JavaScript modules. Serve the folder over HTTP (ES modules do
not run from `file://` in most browsers) and open it:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000. Everything runs in the browser,
so there is no server component to start.

## License

MIT — see LICENSE.
