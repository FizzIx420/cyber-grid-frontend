# Savestate

## 2026-10-24: Rolling release ZIP publisher and recovery policy

- Added `.github/actions/publish-release-zip/action.yml` for ZIP publication, rebuild metadata, checksums, and rolling three-release retention.
- Added `.github/RELEASE_ZIP_POLICY.md` describing the required publication pattern.
- Existing workflows are not yet migrated in this commit. Verification of actual publication/retention is pending a successful build.

## 2026-10-24: Enforce release ZIP policy for future build workflows

- Added `.github/workflows/release-zip-policy-check.yml`, a lightweight guard that checks future build workflows use the local release ZIP publisher and all temporary Actions artifact uploads set one-day retention.
- The guard uses read-only permissions and does not publish or delete artifacts itself.
- Verification will occur automatically on the next push/PR workflow run; no workflow was dispatched by this tool session.
