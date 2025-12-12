==== TEST A EFFECTUER POUR VERIFIER QUE ALERT MANAGER FONCTIONNE BIEN EN CAS DE PROBLEMES + NOTIF SERVER DISCORD ====


1/ redemarrer prometheus

docker restart prometheus && sleep 3 && docker logs prometheus 2>&1 | tail -10

2/ Arreter un container

echo "Attente de 70 secondes pour que l'alerte TargetDown se déclenche..." && sleep 70 && echo "" && echo "=== Alertes en cours ===" && curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}'

3/ Verifier manuelement qu'on a bien recu une notif envoye a discord

echo "Attente de 70 secondes pour que l'alerte TargetDown se déclenche..." && sleep 70 && echo "" && echo "=== Alertes en cours ===" && curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}'


5/ Arreter mes containers

docker compose --profile monitoring down -v

6/ Relancer tous les services avec le profil monitoring

docker compose --profile monitoring up -d

7 / reconstruire les images (après des modifications)

docker compose --profile monitoring up -d --build


============== Acces aux interfaces ==================

Grafana : 
http://localhost:3000 (grafana_admin / admin***)

Prometheus :
http://localhost:9090

Alertmanager :
http://localhost:9090/alerts
http://localhost:9093/#/alerts

cAdvisor :
http://localhost:8081
