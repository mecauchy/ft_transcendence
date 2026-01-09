# Kibana Dashboard - FT Transcendence

## 📊 Dashboard pré-configuré automatique

Ce dossier contient un dashboard Kibana pré-configuré qui s'importe automatiquement au démarrage du stack de monitoring.

## 🚀 Démarrage rapide

### 1. Démarrer le monitoring
```bash
make monitoring
```

### 2. Attendre que les services soient prêts (~2 minutes)
```bash
# Vérifier que Kibana est accessible
curl http://localhost:5601/api/status
```

### 3. Initialiser le dashboard
```bash
make kibana-init
```

### 4. Accéder à Kibana
- **URL** : http://localhost:5601
- Le dashboard "**FT Transcendence - Logs Overview**" sera disponible dans le menu

## 📈 Visualisations incluses

Le dashboard contient 6 visualisations pré-configurées :

### 1. **Logs Timeline** (Graphique en barres empilées)
- Évolution temporelle des logs
- Répartition par niveau (INFO, WARN, ERROR)
- Permet de voir les pics d'activité

### 2. **Logs by Level** (Diagramme circulaire)
- Répartition globale des logs par niveau
- Format donut pour meilleure lisibilité
- Affiche les pourcentages

### 3. **Logs by Container** (Barres horizontales)
- Nombre de logs générés par chaque conteneur Docker
- Top 15 conteneurs les plus actifs
- Utile pour identifier les services verbeux

### 4. **Error Logs Distribution** (Diagramme circulaire)
- Répartition des erreurs par conteneur
- Filtre automatique sur `log.level: ERROR`
- Identifie rapidement les sources de problèmes

### 5. **Top Error Messages** (Table)
- Top 10 des messages d'erreur les plus fréquents
- Compte le nombre d'occurrences
- Permet d'identifier les erreurs récurrentes

### 6. **Recent Logs** (Table de recherche)
- Logs récents de tous les conteneurs
- Colonnes : Nom du conteneur, Niveau, Message
- Tri par timestamp décroissant (plus récent en premier)

## 🔍 Utilisation

### Accéder au dashboard
1. Ouvrir http://localhost:5601
2. Menu hamburger (☰) > **Analytics** > **Dashboard**
3. Cliquer sur "**FT Transcendence - Logs Overview**"

### Filtrer les logs
Le dashboard utilise l'index pattern `filebeat-*` qui contient tous les logs Docker collectés.

**Exemples de filtres** (barre de recherche Kibana) :
```
# Logs d'erreur uniquement
log.level: ERROR

# Logs d'un conteneur spécifique
container.name: "api-gateway"

# Logs contenant un mot-clé
message: "authentication"

# Combinaison
log.level: ERROR AND container.name: "postgres"
```

### Modifier la période
- Sélecteur en haut à droite : **Last 15 minutes** (par défaut)
- Changez pour voir plus d'historique : 1h, 24h, 7 jours, etc.

### Rafraîchissement automatique
- Cliquez sur l'icône de rafraîchissement en haut à droite
- Activez **Auto-refresh** avec l'intervalle souhaité (ex: 10s, 30s, 1m)

## 🛠️ Personnalisation

### Modifier le dashboard
1. Ouvrir le dashboard dans Kibana
2. Cliquer sur **Edit** en haut à droite
3. Modifier les visualisations (taille, requêtes, etc.)
4. **Save** pour enregistrer les modifications

### Exporter le dashboard modifié
```bash
# Dans Kibana UI
# Menu > Stack Management > Saved Objects > Dashboard
# Sélectionner "FT Transcendence - Logs Overview"
# Export > Télécharger le fichier .ndjson
```

Remplacer ensuite `ft-transcendence-logs.ndjson` avec le nouveau fichier.

### Ajouter des visualisations
1. Dans le dashboard, cliquer sur **Edit**
2. **Add panel** > **Create new**
3. Choisir le type de visualisation
4. Configurer la visualisation
5. **Save and return**

## 📁 Structure des fichiers

```
kibana/
├── Dockerfile                          # Image custom avec jq et curl
├── kibana.yml                          # Configuration Kibana
├── init-dashboard.sh                   # Script d'import automatique
└── dashboards/
    └── ft-transcendence-logs.ndjson   # Dashboard pré-configuré
```

## 🔧 Troubleshooting

### Le dashboard ne s'affiche pas
```bash
# Vérifier que l'import a fonctionné
make kibana-init

# Vérifier les logs Kibana
docker compose logs kibana | tail -50
```

### Aucune donnée dans les visualisations
```bash
# Vérifier que Filebeat collecte des logs
docker compose logs filebeat | tail -20

# Vérifier qu'Elasticsearch reçoit des données
curl -X GET "localhost:9200/filebeat-*/_count" | jq
```

### Réinitialiser le dashboard
```bash
# Supprimer et recréer
docker compose down -v
make monitoring
make kibana-init
```

## 📊 Métriques disponibles

Les champs principaux dans les logs Filebeat :

| Champ | Description | Exemple |
|-------|-------------|---------|
| `@timestamp` | Date/heure du log | `2026-01-09T12:30:45.123Z` |
| `message` | Contenu du log | `User authentication successful` |
| `log.level` | Niveau de sévérité | `INFO`, `WARN`, `ERROR` |
| `container.name` | Nom du conteneur | `api-gateway`, `postgres` |
| `container.id` | ID Docker | `abc123def456...` |
| `host.name` | Nom de l'hôte | `docker-host` |
| `stream` | Flux de sortie | `stdout`, `stderr` |

## 🔗 Ressources

- [Documentation Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)
- [KQL Query Language](https://www.elastic.co/guide/en/kibana/current/kuery-query.html)
- [Kibana Dashboard Tutorial](https://www.elastic.co/guide/en/kibana/current/dashboard.html)
