echo '=== docker ps -a (buildkit containers) ==='
docker ps -a --filter name=buildx_buildkit || true

echo '\n=== buildx inspect mybuilder ==='
docker buildx inspect mybuilder --bootstrap || true

echo '\n=== logs for buildx_buildkit_mybuilder0 (last 200 lines) ==='
docker logs buildx_buildkit_mybuilder0 --tail 200 || true

echo '\nIf logs show issues, attempt to remove the container and recreate the builder (will recreate buildkit).'

echo '\nRemoving buildkit container (if exists) and recreating builder...'
set -e
if docker ps -a --format '{{.Names}}' | grep -q '^buildx_buildkit_mybuilder0$'; then
  docker rm -f buildx_buildkit_mybuilder0 || true
fi

docker buildx rm mybuilder || true

docker buildx create --name mybuilder --use || true

docker buildx inspect --bootstrap || true

echo '\n=== final buildx ls ==='
docker buildx ls || true
