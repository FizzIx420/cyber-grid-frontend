# Savestate

## 2026-10-24: Rolling release ZIP publisher and recovery policy

- Added `.github/actions/publish-release-zip/action.yml` for ZIP publication, rebuild metadata, checksums, and rolling three-release retention.
- Added `.github/RELEASE_ZIP_POLICY.md` describing the required publication pattern.
- Existing workflows are not yet migrated in this commit. Verification of actual publication/retention is pending a successful build.
