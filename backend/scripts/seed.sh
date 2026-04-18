#!/bin/sh
ENV=${APP_ENV:-development}

if [ "$ENV" = "development" ]; then
  exec npx tsx --env-file=envs/.env.$ENV "$@"
else
  exec npx tsx "$@"
fi