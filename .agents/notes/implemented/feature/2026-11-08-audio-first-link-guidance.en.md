# Agent Note: Audio-first model link guidance

Status: implemented

## Problem

Model-link mode returns usable URLs but previously did not establish a default delivery preference, so the model could respond with link text alone.

## Decision

A shared MODEL_LINK_DELIVERY_HINT directs the model to prefer audio using the original URL when no format was requested, honor explicit file or link requests, and fall back to the original URL when audio cannot be sent. Both candidate and single-song link results include the hint. Tool definitions and their Chinese descriptions include it whenever model-link mode is available, including per-call AI overrides.

## Alternatives considered

A description-only hint can be overridden by host tool metadata. A candidate-only hint omits single-result and indexed calls. Sharing the hint across these boundaries avoids adding another plugin delivery path.

## Consequences

Model-link mode still returns original URLs without downloading, sending, setting ends or changing the saved mode. The hint guides model behavior; it does not guarantee successful audio delivery. ChatLuna handles delivery and failure recovery. Native-tool regressions cover the wording, entry points and absence of delivery side effects.
