# Agent Note: Tool metadata ownership

Status: implemented

## Problem

The migrated toolName and toolDescription settings duplicate v2's native tool management.

## Decision

Remove both fields from the Config type, schema and execution path. Register the stable music_voice identifier and built-in description; v2 owns metadata management without a plugin-side metadata migration mechanism.

## Alternatives considered

Hiding fields while continuing to consume old values would retain two metadata sources, so it was rejected.

## Consequences

Plugin settings do not expose these fields. Tests check schema absence and registration with the stable identifier and built-in description, not unpublished configuration compatibility.
