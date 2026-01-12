FROM docker.elastic.co/kibana/kibana:8.12.0

# Install curl and jq for dashboard import
USER root
RUN apt-get update && \
    apt-get install -y jq curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy dashboard and initialization scripts
COPY dashboards/ft-transcendence-logs.ndjson /usr/share/kibana/config/dashboards/
COPY entrypoint.sh /usr/local/bin/
COPY init-dashboard.sh /usr/local/bin/

# Set permissions and make scripts executable
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/init-dashboard.sh && \
    chown -R kibana:kibana /usr/share/kibana/config/dashboards

USER kibana

# Use custom entrypoint to auto-import dashboard at startup
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
