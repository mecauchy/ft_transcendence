## 📊 Kibana Dashboard - Monitoring des Logs

### 🎯 Dashboard automatique pré-configuré

Le projet inclut un **dashboard Kibana pré-configuré** qui s'importe automatiquement pour visualiser les logs de tous les conteneurs Docker.

### 🚀 Utilisation rapide

```bash
# 1. Démarrer le monitoring
make monitoring

# 2. Attendre 2 minutes que les services soient prêts

# 3. Initialiser le dashboard (une seule fois)
make kibana-init

# 4. Accéder à Kibana
# URL: http://localhost:5601
# Dashboard: "FT Transcendence - Logs Overview"
```

### 📈 Visualisations incluses

Le dashboard **"FT Transcendence - Logs Overview"** contient 6 visualisations :

| Visualisation | Type | Description |
|---------------|------|-------------|
| **Logs Timeline** | Barres empilées | Évolution temporelle des logs par niveau (INFO/WARN/ERROR) |
| **Logs by Level** | Donut Chart | Répartition globale des logs par niveau de sévérité |
| **Logs by Container** | Barres horizontales | Top 15 des conteneurs les plus actifs |
| **Error Logs Distribution** | Pie Chart | Répartition des erreurs par conteneur |
| **Top Error Messages** | Table | Top 10 des messages d'erreur les plus fréquents |
| **Recent Logs** | Table de recherche | Logs récents avec colonnes : Conteneur, Niveau, Message |

### 🔍 Filtrage et recherche

Dans Kibana, utilisez la barre de recherche avec **KQL (Kibana Query Language)** :

```bash
# Logs d'erreur uniquement
log.level: ERROR

# Logs d'un conteneur spécifique
container.name: "api-gateway"

# Logs contenant un mot-clé
message: "authentication"

# Combinaison de filtres
log.level: ERROR AND container.name: "postgres"

# Recherche avec joker
message: *failed*
```

### ⏰ Période et rafraîchissement

- **Période par défaut** : 15 dernières minutes
- **Changement de période** : Sélecteur en haut à droite (1h, 24h, 7 jours, etc.)
- **Auto-refresh** : Activer pour rafraîchir automatiquement (10s, 30s, 1m)

### 🛠️ Personnalisation

Pour modifier le dashboard :
1. Ouvrir http://localhost:5601
2. Naviguer vers **Analytics > Dashboard > FT Transcendence - Logs Overview**
3. Cliquer sur **Edit**
4. Modifier les visualisations (taille, requêtes, filtres)
5. **Save** pour enregistrer

Pour exporter vos modifications :
- **Menu > Stack Management > Saved Objects > Dashboard**
- Sélectionner et exporter le dashboard
- Remplacer `infra/monitoring/elk/kibana/dashboards/ft-transcendence-logs.ndjson`

### 📊 Champs disponibles

| Champ | Description | Exemples |
|-------|-------------|----------|
| `@timestamp` | Date/heure du log | `2026-01-09T12:30:45.123Z` |
| `message` | Contenu du log | `User login successful` |
| `log.level` | Niveau de sévérité | `INFO`, `WARN`, `ERROR`, `DEBUG` |
| `container.name` | Nom du conteneur | `api-gateway`, `postgres`, `redis` |
| `container.id` | ID Docker du conteneur | `abc123def456...` |
| `stream` | Flux de sortie | `stdout`, `stderr` |

### 🔧 Troubleshooting

**Le dashboard ne s'affiche pas :**
```bash
# Réinitialiser l'import
make kibana-init

# Vérifier les logs
docker compose logs kibana
```

**Aucune donnée dans les visualisations :**
```bash
# Vérifier que Filebeat collecte des logs
docker compose logs filebeat | tail -20

# Vérifier qu'Elasticsearch reçoit des données
curl -X GET "localhost:9200/filebeat-*/_count" | jq
```

**Réinitialisation complète :**
```bash
docker compose down -v
make monitoring
make kibana-init
```

### 📚 Documentation complète

Pour plus de détails sur la configuration et la personnalisation :
- Voir `infra/monitoring/elk/kibana/README.md`
- [Documentation officielle Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)

---

### 🎨 Différence avec Grafana

| Critère | Kibana | Grafana |
|---------|--------|---------|
| **Focus** | Logs et recherche full-text | Métriques et time-series |
| **Sources** | Logs Elasticsearch (Docker logs) | Prometheus (CPU, RAM, réseau) |
| **Cas d'usage** | Debugging, analyse de logs, recherche de messages d'erreur | Monitoring système, alertes sur seuils, performance |
| **Type de données** | Logs textuels (stderr/stdout conteneurs) | Métriques numériques (usage CPU, mémoire, etc.) |
| **Query Language** | KQL (Kibana Query Language) | PromQL (Prometheus Query Language) |
| **URL** | http://localhost:5601 | http://localhost:3009 |

**En résumé :**
- 📊 **Grafana** = "Mon conteneur consomme trop de CPU/RAM"
- 🔍 **Kibana** = "Quelle est la cause de l'erreur dans mes logs ?"

Les deux sont complémentaires pour un monitoring complet !
