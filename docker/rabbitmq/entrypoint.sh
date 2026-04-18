#!/bin/sh
set -eo pipefail

# Read secrets and strip invisible characters (newlines/returns)
# 'tr -d' removes the \r (carriage return) and \n (newline) characters
export RABBITMQ_DEFAULT_USER=$(cat /run/secrets/rabbitmq_user | tr -d '\r\n')
export RABBITMQ_DEFAULT_PASS=$(cat /run/secrets/rabbitmq_password | tr -d '\r\n')

# Ensure required variables are set
: "${RABBITMQ_DEFAULT_USER:?RabbitMQ user secret is missing}"
: "${RABBITMQ_DEFAULT_PASS:?RabbitMQ password secret is missing}"

# Pass explicit command to original entrypoint
exec docker-entrypoint.sh rabbitmq-server "$@"