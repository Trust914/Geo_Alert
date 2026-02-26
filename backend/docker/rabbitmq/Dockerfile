ARG RABBITMQ_VERSION=3.13-management-alpine

FROM rabbitmq:${RABBITMQ_VERSION}

# Production environment variables
ENV RABBITMQ_PRODUCTION=true \
    RABBITMQ_LOGS=-

USER root

# Install dependencies, including dos2unix to fix line endings
RUN apk add --no-cache --update \
    tini \
    su-exec \
    dos2unix \
    && apk upgrade --no-cache \
    && rm -rf /var/cache/apk/*

# Configuration setup
RUN mkdir -p /etc/rabbitmq/conf.d \
    && chown -R rabbitmq:rabbitmq /etc/rabbitmq

COPY rabbitmq.conf /etc/rabbitmq/
COPY entrypoint.sh /usr/local/bin/

# Fix line endings and set permissions
RUN dos2unix /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && chown rabbitmq:rabbitmq /usr/local/bin/entrypoint.sh \
    && chmod 644 /etc/rabbitmq/rabbitmq.conf

# Switch back to rabbitmq user (Fixed formatting)
USER rabbitmq

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD rabbitmq-diagnostics check_port_connectivity

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]