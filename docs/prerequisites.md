# Prerequisites and preflight checks

Run these commands before deployment from the repository root.

```bash
oc whoami
oc project
oc get storageclass
oc auth can-i create route
oc auth can-i create persistentvolumeclaim
oc auth can-i create secret
```

The deployment needs two persistent-volume claims. It relies on the cluster default storage class; identify it with:

```bash
oc get storageclass -o custom-columns=NAME:.metadata.name,DEFAULT:.metadata.annotations.storageclass\.kubernetes\.io/is-default-class
```

If there is no default storage class, either ask the cluster administrator to configure one or add the allowed `storageClassName` to both claims in [`../manifests/wordpress.yaml`](../manifests/wordpress.yaml).

## Docker Hub access

The manifest uses the public Docker Hub image references `wordpress:6-apache` and `mysql:8.4`. First check whether the cluster can pull them after applying the resources:

```bash
oc get pods -w
```

If image pulls fail because Docker Hub is unreachable, rate-limited, or disallowed, use your organization registry instead. Mirror the images through the approved process, then replace the two `image:` fields in the manifest. Keep the image behavior compatible with OpenShift's restricted security model.

For a private Docker Hub repository, create a pull secret and attach it to the service account:

```bash
oc create secret docker-registry dockerhub-pull \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username='<dockerhub-user>' \
  --docker-password='<dockerhub-token>' \
  --docker-email='<email>'
oc secrets link default dockerhub-pull --for=pull
```

Use a Docker Hub access token rather than your account password. Do not store it in Git.

## Network and public exposure

An OpenShift `Route` only becomes internet-reachable when the cluster ingress is configured and your network policy allows it. Check the generated hostname after deployment:

```bash
oc get route wordpress -o wide
```

For an internal-only sandbox, remove the `Route` resource from the manifest and access the service temporarily with `oc port-forward service/wordpress 8080:80`.
