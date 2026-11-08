# Agent Note: Local npm publishing workflow

Status: implemented

## Problem

The plugin now has a public Git repository, but its build dependencies still come from the private v2 workspace. It needs a local npm publishing entry point matching onebot-sandbox.

## Decision

- Add `scripts/publish.mjs` using only Node.js built-ins to synchronize, remove stale output, build in the host, typecheck, test, pack with Yarn and publish the extracted directory. Read the version from package.json without bumping it.
- Real publishing requires a clean worktree, HEAD matching the same branch on origin, no existing version tag and an authenticated npm session. Recheck the worktree and commit after packing. Tag the verified commit and push only after npm succeeds.
- `--dry-run` permits uncommitted changes and skips remote Git operations and npm login checks. It still validates the package and ultimately invokes only npm dry-run. Check the entry point, declarations, client bundle, README and LICENSE in the package.
- Reject unknown arguments and unsupported prerelease identifiers; alpha/beta/rc/next use matching dist-tags. Support OTP without including sensitive command arguments in child-process failure messages.
- Do not register an npm publish lifecycle script, which could recursively invoke this workflow from the extracted package. Document commands and constraints in scripts/AGENTS.md and register that guide in the root index.

## Alternatives considered

- GitHub Actions cannot directly obtain the current private v2 workspace and is not the publishing path at this stage.
- Publishing a tarball directly does not meet the market's README metadata requirement; npm pack also does not replace Yarn's workspace dependency rewriting.

## Consequences

- Regression tests execute the real publishing and synchronization scripts with isolated temporary source and host directories. Local executable fixtures intercept external commands without touching npm, Git remotes or the user's worktree.
- A successful dry-run validates the build and package, not an npm release. If npm succeeds but pushing the tag fails, push the tag separately rather than rolling back the published package.
