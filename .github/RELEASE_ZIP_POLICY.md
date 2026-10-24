# Rolling release ZIP policy

Every successful build that produces downloadable outputs must publish them with
`.github/actions/publish-release-zip`. The action packages all specified outputs
into a ZIP, adds `BUILD-RECOVERY.txt` and `SHA256SUMS.txt`, publishes the ZIP to
a GitHub Release tagged `ci-<run-id>-<attempt>`, and retains the three newest
successful CI releases. Failed builds must not replace or prune successful builds.

## Standard usage

Give the workflow `permissions: contents: write`, keep the existing build and
test steps unchanged, then add:

```yaml
- name: Publish build ZIP
  if: success() && github.event_name != 'pull_request'
  uses: ./.github/actions/publish-release-zip
  with:
    token: ${{ github.token }}
    mode: final
    asset-name: project-build.zip
    paths: |
      build/
      dist/
```

Only list directories/files that contain the intended build deliverables. The
action fails rather than publishing an empty ZIP. For cross-job handoffs, an
intermediate ZIP can be published with `mode: intermediate`; the final job
must publish a final ZIP after collecting the required outputs. Do not publish
release assets from untrusted pull-request contexts. Keep only short-lived
Actions artifacts needed for same-run handoffs and set their retention to one
day; the account cleanup workflow removes artifacts/caches at least 24 hours
old and never deletes GitHub Release assets.

The CI release contains the ZIP and build recovery metadata. The three newest
successful CI releases are retained; older `ci-*` releases are pruned. Normal
version-tag releases (for example `v1.2.3`) are not deleted by this policy.
