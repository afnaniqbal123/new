# Infrastructure-as-Code Checklist

Use when Stage 1 detects Terraform (`.tf`), CloudFormation/SAM
(`template.yaml`), Kubernetes manifests, Helm charts, Ansible playbooks, or
Dockerfiles. These findings are about the _deployed_ attack surface, so the
exploitability reasoning should describe what an attacker with a foothold
(or the internet, for public-facing resources) could actually do.

## A. Identity & Access Management

- Overly permissive IAM policies: `"Action": "*"` / `"Resource": "*"`,
  wildcard trust policies, roles attached to compute that grant far more
  than the workload needs.
- Long-lived credentials (IAM user access keys) where a role/instance
  profile would work instead.
- Cross-account trust relationships that are broader than intended
  (missing `sts:ExternalId` condition, wildcard principal).

## B. Network Exposure

- Security groups / firewall rules open to `0.0.0.0/0` on anything other
  than 80/443 for a genuinely public service — especially management ports
  (22, 3389, database ports 3306/5432/6379/27017/9200).
- Public subnets used for resources that should be private (databases,
  internal services) with no NAT/bastion pattern.
- Load balancers or ingress without TLS termination, or with weak/legacy
  TLS policies.

## C. Storage & Data

- Object storage (S3 buckets, GCS buckets, Azure blobs) with public
  read/write ACLs or bucket policies, especially combined with no
  encryption-at-rest.
- Databases/volumes provisioned without encryption at rest where the
  provider supports it for free or near-free.
- Snapshots/backups with public or overly broad sharing permissions.

## D. Secrets in IaC

- Secrets (DB passwords, API keys, TLS private keys) as plaintext values in
  `.tf`/`.yaml` files instead of referencing a secrets manager
  (AWS Secrets Manager, Vault, SOPS-encrypted values, K8s Secrets backed by
  an external provider).
- Kubernetes `Secret` objects that are just base64 (not encrypted) checked
  into git — flag as secrets-in-code even though technically "K8s Secret"
  sounds safe.

## E. Kubernetes-Specific

- Containers running as root (`runAsNonRoot` not set / `runAsUser: 0`),
  privileged containers (`privileged: true`), or `hostNetwork`/`hostPID`
  set without clear justification.
- Missing resource limits (DoS via noisy-neighbor resource exhaustion) —
  usually `low`, note it but don't over-weight it.
- Overly broad RBAC: `ClusterRole` with `*` verbs/resources bound to
  workloads that don't need cluster-wide access.
- Default service account token auto-mounted into pods that don't need API
  server access.

## F. Container Images / Dockerfiles

- Base images pinned to `latest` instead of a digest or specific version
  (reproducibility/supply-chain concern — usually `low`/`info` unless
  combined with something else).
- Secrets baked into image layers (even if removed in a later layer, they
  persist in image history — check with `docker history` reasoning, not
  just the final `Dockerfile` state).
- Running as root inside the container with no `USER` directive.

## G. CI/CD Pipeline Config

- Deploy credentials with broad scope stored as plaintext CI variables
  instead of OIDC federation / short-lived tokens.
- Pipelines that run on `pull_request` from forks with access to secrets
  (classic path for a malicious PR to exfiltrate CI secrets) —
  GitHub Actions `pull_request_target` combined with checking out and
  running the PR's code is the canonical footgun here.
- Missing branch protection / required review before merge to a branch
  that auto-deploys to production (this is more of a process finding —
  note it but keep severity modest unless paired with a technical issue).

---

Cite the specific misconfiguration class and, where relevant, a CIS
Benchmark control ID (e.g. "CIS AWS Foundations 1.16", "CIS Kubernetes
Benchmark 5.2.5") in `citations`.
