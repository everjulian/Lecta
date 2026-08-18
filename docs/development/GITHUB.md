# GitHub development settings

## Continuous Integration

`.github/workflows/ci.yml` runs for every pull request targeting `main` and
every push to `main`. The required status check is the `Quality` job from the
`CI` workflow. It installs the exact lockfile with
`pnpm install --frozen-lockfile` and then checks formatting, lint, types, tests
and the production build.

CI does not receive product secrets. Tests must continue using local mocks and
must not contact OpenAI, remote transcription services or other external
providers. Offline environment flags prevent accidental Hugging Face model
downloads.

The independent `E2E` job is intentionally skipped. Enable it only when the
Playwright phase adds its configuration, browser installation and E2E tests.

## Recommended protection for `main`

In GitHub, open **Settings → Branches → Add branch protection rule** and use
the branch name pattern `main`. Configure:

1. Enable **Require a pull request before merging**.
2. Require at least one approval when more than one contributor works on the
   repository.
3. Enable **Require status checks to pass before merging**.
4. Select the `Quality` check from the `CI` workflow after its first successful
   run.
5. Enable **Require branches to be up to date before merging** when concurrent
   changes frequently touch the same areas. This increases safety but may cause
   additional CI runs.
6. Enable **Block force pushes** or leave **Allow force pushes** disabled.
7. Leave **Allow deletions** disabled so `main` cannot be deleted.
8. Optionally enable **Require conversation resolution before merging**.

Do not require the `E2E` check until that job is activated; a permanently
skipped check must not block pull requests.

These rules were not configured automatically because GitHub CLI is not
available in the current development environment. Repository administrators
should apply the manual steps above after the first successful CI run. GitHub
plans and repository types can affect which protection options are available.
