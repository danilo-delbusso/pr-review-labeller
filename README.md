# Update PR Status Labels Action

This action updates the labels of a PR after a review has been added.

It currently supports three labels:

- One Approval label
- Two Approvals label
- Changes Requested label

These labels have to exist in the repository already.

You will simply need to specify their names in the `.yml` configuration.

## Inputs

### `one-approval-label-name`

**Required** Name of the label to show when the PR has one approval. Defaults to `1 approval`.

### `two-approvals-label-name`

**Required** Name of the label to show when the PR has two approvals. Defaults to `2 approvals`.

### `changes-requested-label-name`

**Required** Name of the label to show when the PR needs changes. Defaults to `needs updating`.

## Environment Variables

## `GITHUB_TOKEN`

The token needs to be added to the yml description in order for the action to call GitHub's API.

## Example usage with default label names

```yml
name: Update PR Labels
on: [pull_request_review]

jobs:
  update-pr-labels:
    runs-on: ubuntu-latest
    name: Update PR Labels
    steps:
      - name: Update Labels
        uses: danilo-delbusso/label-pr-approval-status-action@1.0.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Example usage with custom label names

```yml
name: Update PR Labels
on: [pull_request_review]

jobs:
  update-pr-labels:
    runs-on: ubuntu-latest
    name: Update PR Labels
    steps:
      - name: Update Labels
        uses: danilo-delbusso/label-pr-approval-status-action@1.0.1
        with:
          one-approval-label-name: "1 approval"
          two-approvals-label-name: "2 approvals"
          changes-requested-label-name: "needs updating"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
