# Savestate

## 2026-10-24: Rolling release ZIP publisher and recovery policy

- Added `.github/actions/publish-release-zip/action.yml` for ZIP publication, rebuild metadata, checksums, and rolling three-release retention.
- Added `.github/RELEASE_ZIP_POLICY.md` describing the required publication pattern.
- Existing workflows are not yet migrated in this commit. Verification of actual publication/retention is pending a successful build.

## 2026-10-24: Enforce release ZIP policy for future build workflows

- Added `.github/workflows/release-zip-policy-check.yml`, a lightweight guard that checks future build workflows use the local release ZIP publisher and all temporary Actions artifact uploads set one-day retention.
- The guard uses read-only permissions and does not publish or delete artifacts itself.
- Verification will occur automatically on the next push/PR workflow run; no workflow was dispatched by this tool session.

## 2026-10-24: Enforce release ZIP-only build delivery

- Updated the local publisher so intermediate handoffs live in draft `ci-*` releases and only a successful final ZIP publishes the release. Rolling retention now counts only published successful CI releases and keeps the newest three.
- Updated `.github/workflows/release-zip-policy-check.yml` to reject any `actions/upload-artifact` use and require the release ZIP publisher for build-output workflows.
- Draft handoffs are cleaned by the account-level cleanup workflow if a build never reaches its final publication. Verification pending workflow runs.

## 2026-10-24: Fix final release publisher shell block

- Removed a redundant closing `fi` from the shared release publisher. Intermediate draft ZIPs and final published ZIPs now follow a syntactically balanced shell block.
- The policy guard continues to prohibit Actions artifact uploads and require release ZIP publishing for build outputs. Runtime verification pending.

## 2026-10-24: Publish draft CI releases using the release-list endpoint

- Changed draft publication to resolve the current release ID from the releases collection before setting `draft=false`. GitHub's tag lookup endpoint returns 404 for some unpublished draft releases.
- The final ZIP is now published only after the draft release ID is resolved; successful published CI releases remain subject to three-release retention.
- Runtime verification pending.

## 2026-10-24: Use robust tag matching for draft release publication

- Replaced the draft-release ID lookup's nested quote expression with an exact tag match using the release list and `awk`, avoiding shell/JQ quote parsing errors.
- The final ZIP can now publish draft handoffs and run three-release retention without relying on the draft tag endpoint.
- Runtime verification pending.
