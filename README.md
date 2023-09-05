A semantic release group of actions action for generating the next release version & changelog based on commit messages
& notifying closed issues.

Still very much a v0.x beta.

# Assumptions

1. You have no diverging version trees. The version can only ever keep going up - if you release an update in v2.x you cannot use this action to release a for v1.x.
1. You're following [semantic versioning](https://semver.org/).
1. You're using the following conventional commit message format:

```
type(scope?): Message

Extended message
```

Where the extended message can contain the following keywords:

- `Closes #1`, `Closes #1, #2, #n` (case-insensitive) - mark this commit as closing the given issues.
- `BREAKING CHANGE: description` (case-sensitive, configurable) - mark this commit as a breaking change.

# Primary action

1. Parse commits since last release
1. Determine next release version and whether we should make a release
1. Generate changelog
1. Output everything as action outputs

## Inputs

| Key                        | Required | Default           | Description                                                                                                                                      | 
|----------------------------|----------|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `breaking-change-keywords` | :check:  | `BREAKING CHANGE` | If the commit message extended body starts with one of these prefixes (one per line, case sensitive) then a breaking change release will be made |
| `minor-types`              | :x:      |                   | Types that result in a minor version release. Format: `type: Heading in the changelog` (one per line).                                           |
| `patch-types`              | :x:      |                   | Types that result in a patch version release. Format: same as `minor-types`                                                                      |
| `trivial-types`            | :x:      |                   | Types that are included in the changelog, but don't result in a version bump. Format: same as `minor-types`                                      |
| `stay-at-zero`             | :x:      | `false`           | If we're currently at version 0.x (or no version at all) then this can be set to true to stay at version 0.x with our releases.                  |

Types with identical headings will get merged under the same heading in the changelog regardless of whether they're 
all major/minor/patch or not.

## Outputs

| Name                    | Description                                                                                                |
|-------------------------|------------------------------------------------------------------------------------------------------------|
| `changelog`             | The generated changelog                                                                                    |
| `commit-count`          | Total number of commits since the previous release                                                         |
| `relevant-commit-count` | `commit-count` with commits with mismatching message regex filtered out                                    |
| `release-type`          | The type of release that was generated: `major`, `minor`, `patch`                                          |
| `next-version`          | The next version we should release, based on commit messages                                               |
| `next-version-major`    | If `next-version` outputs `v1.2.3` then this will output `1`                                               |
| `next-version-minor`    | If `next-version` outputs `v1.2.3` then this will output `2`                                               |
| `next-version-patch`    | If `next-version` outputs `v1.2.3` then this will output `3`                                               |
| `last-tag`              | The last tag we scanned from, if any                                                                       |
| `in-sync`               | Gets set to true if we're in sync with the remote repository, i.e. not behind or ahead of it in commits    |
| `issues-closed`         | A comma-separated list of issue numbers (without `#`) closed by this release, if any                       |
| `should-release`        | Gets set to true there were version bumping commits processed and we're in sync with the remote repository |

# Notify issues on release

This action lives under `/notify`.

1. Take the `issues-closed` and, most likely, `next-version` outputs of the primary action
1. Check if we're ahead of/behind the remote and terminate early if needed
1. Apply a label to each issue and add a comment.

## Inputs

| Key                    | Required | Default                                                            | Description                                                                                                                                                                                                                                                                         |
|------------------------|----------|--------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tag`                  | :check:  |                                                                    | The tag that just just released, e.g. the `next-version` output of the primary step                                                                                                                                                                                                 |
| `issues`               | :check:  |                                                                    | A comma-separated list of issues to notify, e.g. the `issues-closed` output of the primary step. Note that no duplicate verification happens in order to conserve API call quota, therefore calling this action repeatedly with the same issue(s) will result in multuple comments. |
| `labels`               | :check:  | `Released`                                                         | Labels to apply to released issues (1 per line)                                                                                                                                                                                                                                     |
| `gh-token`             | :check:  | `${{ github.token }}`                                              | API token to use                                                                                                                                                                                                                                                                    |
| `error-on-ratelimit`   | :x:      | `false`                                                            | Error if the GitHub API token gits a rate limit (true) or just warn (false)                                                                                                                                                                                                         |
| `error-on-out-of-sync` | :x:      | `false`                                                            | If we're behind/ahead of the remote, should the action skip notifications, but succeed (false) or fail with an error (true)?                                                                                                                                                        |
| `comment`              | :check:  | `This issue has been included in [{{tag}}]({{releaseUrl}}) :tada:` | The comment that'll be made on every issue. Accepts placeholders in the form of `{{name}}` - list included below.                                                                                                                                                                   |


Comment placeholders:

- **tag**: The `tag` input
- **owner**: The repo owner
- **repo**: The repo name
- **baseUrl**: Shorthand for `https://github.com/{{owner}}/{{repo}}`
- **releaseUrl**: Shorthand for `{{baseUrl}}/releases/tag/{{tag}}`


# Plain old changelog generator

This action lives under `/generate-changelog`.

Take a commit range in, spit a changelog out.

## Inputs

Same as primary action: `breaking-change-keywords`, `minor-types`, `patch-types`, `trivial-types`

| Key     | Required | Default                   | Description                                                                |
|---------|----------|---------------------------|----------------------------------------------------------------------------|
| `from`  | :x:      | The beginning of all time | Commit/tag to start from. The lefthand side of a `git log xx..yy` command. |
| `until` | :x:      | `HEAD`                    | Commit/tag to end at. The righthand side of a `git log xx..yy` command.    |

## Outputs

Same as primary action: `changelog`, `release-type`, `commit-count`, `relevant-commit-count`, `issues-closed`

# Resolve the last released tag

This action lives under `/last-tag`. Same step as the primary action uses.

Inputs: none

Outputs: `last-tag`, if resolved.

# Example workflows

<details>
<summary>Generate a release when the main branch gets major/minor/patch commits</summary>

```yaml
name: Release
on:
  push:
    branches:
      - master
      - main
jobs:
  release:
    runs-on: ubuntu-latest
    name: Release
    permissions:
      contents: write # Needed for the notify step unless a different GitHub token is provided
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # need to fetch the whole history
          fetch-tags: true # needed to know what the previous release was
          
      - uses: Alorel/semantic-release-lite@v0
        id: parse-release
        with:
          minor-types: "feat: Features"
          patch-types: |
            fix: Bug Fixes
            perf: Performance improvements
          trivial-types: |
            deps: Dependency Updates
            ci: CI & Build
            build: CI & Build
            chore: Maintenance

      - run: whatever you need to do for your release
        if: ${{ steps.parse-release.outputs.should-release }}  

      - uses: Alorel/semantic-release-lite/notify@v0
        if: ${{ steps.parse-release.outputs.should-release && steps.parse-release.outputs.issues-closed }}
        with:
          tag: ${{ steps.parse-release.outputs.next-version }}
          issues: ${{ steps.parse-release.outputs.issues-closed }}
```

</details>

<details>
<summary>Generate a changelog for a specific commit range</summary>

```yaml
name: Preliminary changelog
on: [pull_request]
jobs:
  release:
    runs-on: ubuntu-latest
    name: Release
    permissions:
      contents: write # Needed for the notify step unless a different GitHub token is provided
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # need to fetch the whole history
          fetch-tags: true # needed to know what the previous release was
      
      - uses: Alorel/semantic-release-lite/generate-changelog@v0
        id: changelog
        with:
          from: master
          minor-types: "feat: Features"
          patch-types: |
            fix: Bug Fixes
            perf: Performance improvements
          trivial-types: |
            deps: Dependency Updates
            ci: CI & Build
            build: CI & Build
            chore: Maintenance

      # Might want to e.g. post this as a PR comment
      - run: 'echo -e "Changelog for this release: ${{ steps.parse-release.outputs.changelog }}  "'
```

</details>
