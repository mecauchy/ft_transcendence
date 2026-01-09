==== TEST A EFFECTUER POUR VERIFIER QUE ALERT MANAGER FONCTIONNE BIEN EN CAS DE PROBLEMES + NOTIF SERVER DISCORD ====


1/ redemarrer prometheus

docker restart prometheus && sleep 3 && docker logs prometheus 2>&1 | tail -10

2/ Arreter un container

echo "Attente de 70 secondes pour que l'alerte TargetDown se déclenche..." && sleep 70 && echo "" && echo "=== Alertes en cours ===" && curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}'

3/ Vérifier manuellement sur Discord que la notification d'alerte a bien été reçue


5/ Arreter mes containers

docker compose --profile monitoring down -v

6/ Relancer tous les services avec le profil monitoring

docker compose --profile monitoring up -d

7 / reconstruire les images (après des modifications)

docker compose --profile monitoring up -d --build


============== Acces aux interfaces ==================

Grafana : 
http://localhost:3002

Prometheus :
http://localhost:9090

Alertmanager :
http://localhost:9090/alerts
http://localhost:9093/#/alerts

cAdvisor :
http://localhost:8081

=========== Script pour afficher les credentials ============

lancement :
./scripts/show_creds.sh


### 🖥️ Dashboard "Infrastructure Overview"

Dashboard **global du système** - Vue d'ensemble de l'infrastructure complète.

#### Métriques affichées :

| Métrique									|		Description														|Unité |
|----------									|		-------------													|-------|
| **Prometheus Status**						|		État de Prometheus (UP/DOWN) 									| Status |
| **Running Containers**					|		Nombre total de conteneurs Docker actifs 						| Nombre |
| **System CPU Usage**						|		Graphique temporel avec 3 métriques CPU : <br>- **Total CPU** : Utilisation CPU
											|		globale<br>- **System CPU** : CPU utilisé par le kernel<br>- **User CPU** : CPU utilisé
											|		par les applications 											| % |
| **System Memory Usage**					|		Graphique temporel avec 3 métriques mémoire : <br>- **Total Memory** : Mémoire totale
											|		utilisée<br>- **Cache** : Mémoire en cache<br>- **RSS** : Resident Set Size (mémoire 	
											|		physique réelle) 												| Bytes |
| **System Network I/O**					|		Trafic réseau global du système (toutes interfaces confondues) 	| Bytes/s |
| **Container Memory Usage % of Limit**		|		Pourcentage d'utilisation mémoire par rapport à la limite configurée pour chaque 
											|		conteneur (si limite définie dans docker-compose) 				| % |

**Cas d'usage** : Vue d'ensemble rapide de la santé du système, détection de problèmes globaux, monitoring de la charge système totale.

---

### 🔍 Différences clés entre les deux dashboards

| Critère | Docker Containers | Infrastructure Overview |
|---------|-------------------|------------------------|
| **Niveau de détail** | Granulaire (par conteneur) | Global (système entier) |
| **Objectif** | Debug et optimisation des conteneurs | Monitoring de la santé globale |
| **Métriques CPU** | Par conteneur | Agrégées (total + system + user) |
| **Métriques Mémoire** | Working Set, Cache par conteneur | Total + Cache + RSS global |
| **Réseau** | Par interface (limité en rootless) | Agrégé global |
| **Cas d'usage** | "Quel conteneur pose problème ?" | "Mon système est-il surchargé ?" |
