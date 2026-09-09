# WordPress on OpenShift

A beginner-friendly, copy-and-pasteable guide for deploying a small WordPress site on an OpenShift cluster using public images from [Docker Hub](https://hub.docker.com/). The supplied manifests create:

- a MySQL database with persistent storage;
- a WordPress Apache deployment with persistent uploads, plugins, and themes;
- an OpenShift `Route` that exposes the site publicly.

> **Learning sandbox only.** The sample uses a basic MySQL deployment and public container tags to keep the path easy to understand. Follow the production notes before using this pattern for a real site.

## Architecture

```text
Internet
   |
OpenShift Route (wordpress)
   |
WordPress Service :80  --->  WordPress Pod + PVC
   |
MySQL Service :3306  ----->  MySQL Pod + PVC
```

| Component | Docker Hub image | Purpose |
| --- | --- | --- |
| WordPress | `wordpress:6-apache` | PHP/Apache web application |
| MySQL | `mysql:8.4` | WordPress database |

Both image names are explicitly defined in [`manifests/wordpress.yaml`](manifests/wordpress.yaml). For repeatable deployments, replace floating major tags with an image digest you have tested.

## Prerequisites

1. An OpenShift 4 cluster you can log in to with the `oc` CLI.
2. Permission to create a project, deployments, services, persistent-volume claims, secrets, and routes.
3. A cluster ingress controller and a default storage class. Confirm storage first:

   ```bash
   oc get storageclass
   ```

4. A public Docker Hub pull path. If your cluster cannot pull Docker Hub anonymously, mirror the two images to an approved registry and update the image values in the manifest.

See [`docs/prerequisites.md`](docs/prerequisites.md) for commands and common sandbox constraints.

## Deploy

### 1. Log in and create an isolated project

```bash
oc login https://api.example.openshift.com:6443
oc new-project wordpress-sandbox
```

Use an existing project instead of `oc new-project` if your sandbox provisions one for you:

```bash
oc project wordpress-sandbox
```

### 2. Create strong database credentials

Do **not** commit real passwords. Create the secret directly in the cluster; it supplies the database root password, the WordPress database password, and the application salts.

```bash
oc create secret generic wordpress-secrets \
  --from-literal=mysql-root-password="$(openssl rand -base64 24)" \
  --from-literal=mysql-password="$(openssl rand -base64 24)" \
  --from-literal=auth-key="$(openssl rand -base64 48)" \
  --from-literal=secure-auth-key="$(openssl rand -base64 48)" \
  --from-literal=logged-in-key="$(openssl rand -base64 48)" \
  --from-literal=nonce-key="$(openssl rand -base64 48)" \
  --from-literal=auth-salt="$(openssl rand -base64 48)" \
  --from-literal=secure-auth-salt="$(openssl rand -base64 48)" \
  --from-literal=logged-in-salt="$(openssl rand -base64 48)" \
  --from-literal=nonce-salt="$(openssl rand -base64 48)"
```

If `openssl` is unavailable, generate unique long random values with your password manager. Keep the values: changing WordPress salts signs every user out.

### 3. Apply the workload

```bash
oc apply -f manifests/wordpress.yaml
oc get pods,svc,pvc,route
```

Wait until both pods are ready:

```bash
oc wait --for=condition=Ready pod -l app.kubernetes.io/name=mysql --timeout=5m
oc wait --for=condition=Ready pod -l app.kubernetes.io/name=wordpress --timeout=5m
```

### 4. Open the public URL and finish WordPress setup

```bash
WORDPRESS_URL="https://$(oc get route wordpress -o jsonpath='{.spec.host}')"
printf '%s\n' "$WORDPRESS_URL"
```

Open that URL in a browser. The WordPress installer will ask for a site title and administrator account; use a unique administrator password. The route is configured for edge TLS. In a lab cluster with a self-signed or untrusted ingress certificate, the browser may show a certificate warning.

## Verify and operate

```bash
# Inspect rollout status and recent events
oc rollout status deployment/mysql
oc rollout status deployment/wordpress
oc get events --sort-by=.lastTimestamp

# View application logs
oc logs deployment/mysql
oc logs deployment/wordpress

# Check the route target
oc describe route wordpress
```

To force WordPress to reload after an image update:

```bash
oc rollout restart deployment/wordpress
oc rollout status deployment/wordpress
```

## Troubleshooting

| Symptom | Check | Likely resolution |
| --- | --- | --- |
| Pods remain `Pending` | `oc describe pod <pod-name>` and `oc get pvc` | Your sandbox may not provide a default storage class or enough quota. Ask for storage or set a permitted `storageClassName`. |
| `ImagePullBackOff` | `oc describe pod <pod-name>` | The cluster cannot reach Docker Hub or needs registry credentials. Mirror images or configure a pull secret. |
| WordPress cannot connect to the database | `oc logs deployment/wordpress` and `oc get endpoints mysql` | Ensure the `wordpress-secrets` secret exists before applying and MySQL is ready. |
| Installer reappears or uploads disappear | `oc get pvc` | Confirm the `wordpress-data` PVC is `Bound`; do not delete it during redeployments. |
| Route does not resolve externally | `oc get route wordpress` | Confirm the cluster has an ingress domain and that your sandbox permits public routes. |

## Cleanup

Delete all sandbox resources, including the database and uploaded files:

```bash
oc delete project wordpress-sandbox
```

If you used a shared project instead, delete only the resources from this guide and the secret:

```bash
oc delete -f manifests/wordpress.yaml
oc delete secret wordpress-secrets
```

## Production notes

This repository is intentionally simple, not a production baseline. For production, use a managed or highly available database, backups and restore testing, a private mirrored registry, pinned image digests with a vulnerability-scanning process, resource quotas and monitoring, a Web Application Firewall where appropriate, and a certificate managed by your organization. Limit administrator access and keep WordPress core, themes, and plugins updated.

The manifest sets CPU/memory requests and limits, uses an `edge` TLS route, and disables service-account token mounting. Review the image security behavior against your cluster's Security Context Constraints (SCCs). Do not grant `anyuid` or privileged access merely to make an image start; use an image designed for arbitrary OpenShift-assigned UIDs or have the image owner remediate file permissions.

## Repository layout

```text
.
├── README.md                  # Deployment, verification, and cleanup guide
├── docs/prerequisites.md      # Preflight checks and Docker Hub access options
└── manifests/wordpress.yaml   # OpenShift/Kubernetes resources
```

## License

This documentation is released under the [MIT License](LICENSE).
