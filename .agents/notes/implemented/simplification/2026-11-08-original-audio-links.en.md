# Agent Note: Original audio links

Status: implemented

## Problem

Local HTTP 302 links replace original audio URLs in tool results and add server-reachability and mapping-lifecycle constraints.

## Decision

Remove short-link settings, routes, mappings, constants and the MusicPlayer shortening callback. Candidate and single-song results use MusicClient.resolve values without rewriting signed parameters or adding local redirects. The plugin does not inject server; its development dependency is only used by lifecycle tests. UI and README text describe original source links.

## Alternatives considered

Hiding settings would retain URL rewriting, while returning both kinds of links would keep unnecessary routes and mappings. The feature is removed instead.

## Consequences

The model receives original source URLs and ChatLuna handles subsequent delivery. External source redirects are unchanged. Tests verify absent route registration, unchanged URL parameters, no direct delivery and continued model execution. No compatibility contract is maintained for unpublished configuration versions.
