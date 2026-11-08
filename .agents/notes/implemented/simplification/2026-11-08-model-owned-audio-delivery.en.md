# Agent Note: Model-owned audio delivery

Status: implemented

## Problem

Model-link mode already provides audio-first guidance. A separate plugin download-and-send mode duplicates ChatLuna's delivery responsibilities and retains another set of download timeouts, size limits and platform delivery paths.

## Decision

- Remove audio-buffer, the download method, download-only constants and the voice-send branch. Keep audio-url-model as the default and music-card as the other mode.
- The unpublished plugin does not retain compatibility transforms for audio-buffer / audio-url / file. Both configuration and tool arguments reject removed modes, and the client does not correct saved values automatically.
- Candidate, single-song and AI-override results retain original URLs and audio-first guidance without downloading, sending or setting ends. Music cards and the QQ web-page fallback remain unchanged; indexed direct-delivery ends behavior now applies only to cards.
- Networking only handles search and Meting resolution, retaining cancellation and bounded response reads. Media responses are cancelled after their headers and return their final URL rather than downloading the complete audio.

## Alternatives considered

Removing only the UI choice would leave legacy configuration and tool arguments able to trigger direct delivery. Keeping the old default would leave new configurations pointing at removed behavior, so the default becomes model links as well.

## Consequences

The model still receives instructions to honor explicit file/link requests and fall back to the original link when audio cannot be sent. This is guidance, not a deterministic delivery guarantee. The plugin no longer imposes a 15-second or 64 MiB audio-download limit; subsequent delivery limits belong to the host and adapters. Tests cover two modes, rejected removed modes, card delivery, default model links, argument rejection, response bounds and cancellation.
