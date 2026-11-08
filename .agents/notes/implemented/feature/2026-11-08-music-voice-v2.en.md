# Agent Note: Music voice migration to ChatLuna v2

Status: implemented

## Problem

The 0.0.10 plugin depends on Koishi ChatLuna, LangChain StructuredTool and Zod, which do not participate in Cordis 4 tool, configuration and delivery lifecycles.

## Decision

- Keep an independent source tree and synchronize it one way to external/music-voice. Use @chatluna/schema, native Tools, trusted inbound Sessions and httpFetch(ctx.http).
- Preserve NetEase/QQ search order, repeat-search selection and per-call AI overrides. Delivery is now [reduced to two modes](../simplification/2026-11-08-model-owned-audio-delivery.en.md): model links by default, plus music cards. ChatLuna owns audio delivery. Local HTTP 302 links were [removed](../simplification/2026-11-08-original-audio-links.en.md), and tool metadata is [owned by v2](../simplification/2026-11-08-tool-metadata-ownership.en.md).
- Use call.end() only after indexed card delivery succeeds. Single-result cards, candidates and model links retain textual results.
- Send cards through ctx.chat.send; the plugin no longer downloads or transcodes audio. Embed the ui-kit mode picker in the original SchemaForm with vertical layout to avoid narrow desktop labels.
- Fix partial-platform failure coupling, empty results winning races and malformed QQ items rejecting a whole batch. Set Meting platforms explicitly, resolve model links concurrently, propagate cancellation/disposal and bound response bodies.
- Initial voice acceptance tests led to a separately authorized sandbox SILK patch preserving original bytes and IDs while adding WAV browser previews. This historical verification does not imply that the current plugin still sends voice directly.

## Alternatives considered

- A Koishi/LangChain compatibility layer would bypass native permissions and lifecycle handling.
- A separate settings page would duplicate host persistence and validation.
- Initial voice verification fixed the sandbox rather than changing the production OneBot format solely to accommodate it.

## Consequences

- External services remain outside the plugin's control. Successful search and resolution do not guarantee subsequent audio delivery. CDN download failures in the initial migration records belong to the removed direct-download path; current delivery limits belong to the host and adapters.
- Selection intentionally repeats the search without caching, so provider ordering can change.
- Tests cover native tools, configuration, parsers, HTTP, lifecycle and real UI controls. Initial isolated OneBot/SILK and browser evidence remains historical; current modes and defaults are defined by the updated regressions.
