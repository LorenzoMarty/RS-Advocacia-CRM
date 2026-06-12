#!/usr/bin/env bash
# Generate self-signed TLS certs for the Redis broker (10-year validity).
# Output lands in ./certs/, mounted read-only by the redis container.
#
# The Vercel side connects with ?ssl_cert_reqs=CERT_NONE (encrypted but not
# authenticated). To harden later, switch to a Let's Encrypt cert for the VM
# hostname and use CERT_REQUIRED.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p certs
cd certs

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -sha256 -key ca.key -days 3650 \
  -subj "/CN=agenda-juri-redis-ca" -out ca.crt

openssl genrsa -out redis.key 2048
openssl req -new -sha256 -key redis.key -subj "/CN=agenda-juri-redis" -out redis.csr
openssl x509 -req -sha256 -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 3650 -in redis.csr -out redis.crt
rm redis.csr

chmod 600 ca.key redis.key
echo "Certificados gerados em $(pwd)"
