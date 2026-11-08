# Agent Note: Delivery mode ownership

Status: implemented

## Problem

Downloaded voice, direct URL and remote-file modes duplicate ChatLuna's delivery capabilities.

## Decision

- Keep model links as the default and music cards as the other mode. [ChatLuna owns audio delivery](2026-11-08-model-owned-audio-delivery.en.md).
- The plugin is unpublished, so removed mode aliases, hidden transforms and client display mappings are not retained. Configuration and tool arguments reject removed modes.
- The client renders current choices and saved values without correcting unknown values. The README describes user features and usage, not development history or compatibility policies.

## Alternatives considered

Hiding choices would retain obsolete execution paths. Maintaining compatibility for an unpublished version adds unnecessary maintenance, so neither approach is used.

## Consequences

Regressions cover two choices, absent hidden branches, rejected unknown modes, defaults, reset and locale changes. Model links do not send or set ends; subsequent ChatLuna delivery is not an internal plugin mode.
