FROM docker.elastic.co/kibana/kibana:8.12.0

# Installer curl et jq pour le script d'init
USER root
RUN apt-get update && \
    apt-get install -y jq curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copier le dashboard et le script d'init
COPY dashboards/ft-transcendence-logs.ndjson /usr/share/kibana/config/dashboards/
COPY init-dashboard.sh /usr/local/bin/

# Donner les permissions
RUN chmod +x /usr/local/bin/init-dashboard.sh && \
    chown -R kibana:kibana /usr/share/kibana/config/dashboards

USER kibana

# Le script sera lancé manuellement après le démarrage
