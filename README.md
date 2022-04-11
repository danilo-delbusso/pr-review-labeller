 ### Attention! 🚨
 
If you're using `GITHUB_TOKEN`, you'll only be able to use this action for PRs opened within the same repository.

If you're planning to support PRs opened from forks, you'll need to create an _ad-hoc_ token from the repository settings, and give it: read permissions for the PRs, and readwrite permissions for the labels.

See this comment for more information: https://github.com/xenserver/xenadmin/pull/2875#issuecomment-930281214

# Update PR Status Labels Action

This action updates the labels of a PR after a review has been added.

It currently supports four labels:

- One Approval label
- Two Approvals label
- Changes Requested label
- Updated PR Label

These labels have to exist in the repository already.

You will simply need to specify their names in the `.yml` configuration.

## Inputs

### `one-approval-label-name`

**Required** Name of the label to show when the PR has one approval. Defaults to `1 approval`.

### `two-approvals-label-name`

**Required** Name of the label to show when the PR has two approvals. Defaults to `2 approvals`.

### `changes-requested-label-name`

**Required** Name of the label to show when the PR needs changes. Defaults to `needs updating`.

### `updated-pr-label-name`

**Required** Name of the label to show when the PR has been updated (new commits). Defaults to `updated`.

## Environment Variables

## `GITHUB_TOKEN`

The token needs to be added to the yml description in order for the action to call GitHub's API.

## Example usage with default label names

```yml
name: Update PR Labels
on:
  pull_request_review:
    types: [submitted]
  pull_request:
    types: [synchronize]

jobs:
  update-pr-labels:
    runs-on: ubuntu-latest
    name: Update PR Labels
    steps:
      - name: Update Labels
        uses: danilo-delbusso/pr-review-labeller@v1.1.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Example usage with custom label names

```yml
name: Update PR Labels
on:
  pull_request_review:
    types: [submitted]
  pull_request:
    types: [synchronize]

jobs:
  update-pr-labels:
    runs-on: ubuntu-latest
    name: Update PR Labels
    steps:
      - name: Update Labels
        uses: danilo-delbusso/pr-review-labeller@v1.1.0
        with:
          one-approval-label-name: "1 approval"
          two-approvals-label-name: "2 approvals"
          changes-requested-label-name: "needs updating"
          updated-pr-label-name: "updated"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
