# Maintainer repository governance

This document describes governance for maintainers of the **source boilerplate repository only**. It is not a requirement imposed on projects created from this starter; downstream teams should choose repository governance appropriate to their own environment.

## `main` merge contract

`main` must be protected so repository-level settings reinforce the executable engineering checks rather than allowing them to be bypassed.

Required settings:

- pull requests are required before changes reach `main`;
- force pushes and branch deletion are disabled;
- all review conversations must be resolved before merge;
- linear history is required;
- merge commits are disabled; squash and/or rebase remain the supported merge methods;
- the required status check is the canonical GitHub Actions check **`Quality Gate / Verify`**;
- the branch should be required to be up to date before merge while that remains reliable for the repository workflow;
- bypass permissions should remain disabled for normal maintainer and bot workflows. Any emergency bypass policy must be narrow, explicit, and separately justified.

An approval count of zero is acceptable for a small maintainer team. The non-negotiable contract is that the canonical executable quality gate and protected-history rules cannot be skipped in the normal workflow.

## Repository merge settings

Repository-level merge configuration must stay aligned with the protected-branch policy:

- merge commits: disabled;
- squash merge: allowed;
- rebase merge: allowed;
- update-branch support: recommended when available and reliable for protected-branch maintenance.

## Verification

After changing GitHub repository settings, maintainers should verify the policy with an intentionally failing pull request:

1. Open a PR whose `Quality Gate / Verify` check fails.
2. Confirm GitHub does not allow that PR to merge into `main`.
3. Confirm unresolved review conversations block merge.
4. Confirm a force push to `main` is rejected.
5. Confirm `main` cannot be deleted through the normal maintainer workflow.
6. Confirm merge commits are not offered/accepted for PR merges.

The GitHub branch settings are the enforcement layer. This document records the intended maintainer policy; it is not a substitute for branch protection itself.
