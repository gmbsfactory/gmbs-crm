# Docker avec plusieurs projets Supabase sur la même machine

> Rédigé le 2026-09-05 après l'incident du 3 septembre : la machine virtuelle de Docker est passée en
> lecture seule (« EXT4-fs : I/O error while writing superblock »), ce qui a arrêté la base locale du
> CRM et les deux serveurs de la démo. Ce guide explique la cause et la façon de ne plus la revivre.

## 1. Ce qui se passait

Trois piles Supabase sont enregistrées sur cette machine, plus une application de test :

| Pile | Conteneurs | Politique de redémarrage | Mémoire mesurée |
|---|---|---|---|
| `CRM_template` (ce projet) | 7 | `unless-stopped` | ≈ 720 Mo |
| `comfi` | 8 | `unless-stopped` | ≈ 800 Mo (estimation, pile complète) |
| `web` | 1 visible | `unless-stopped` | — |
| `readiness_*` | 3 | **`always`** | ≈ 68 Mo |

`unless-stopped` veut dire : **au lancement de Docker, tout revient**, sauf ce qui a été arrêté à la
main. Trois piles Supabase qui redémarrent ensemble demandent plus de 2,5 Go — or Docker n'avait que
**2 Go**. Résultat : des conteneurs tués par manque de mémoire (`exited (137)`), et, le disque du Mac
étant plein à 99 %, une écriture impossible qui a mis le disque de la machine virtuelle en lecture
seule.

## 2. Ce qui a été changé

| Réglage | Avant | Après |
|---|---|---|
| Mémoire Docker | 2 048 Mio | **5 120 Mio** |
| Échange (swap) | 1 024 Mio | **2 048 Mio** — évite les arrêts brutaux plutôt que de tuer un conteneur |
| Cache de compilation | 2,55 Go | purgé (`docker builder prune -af`) |
| Pile `CRM_template` | 12 conteneurs | **7** — `studio`, `analytics` et `inbucket` désactivés dans `supabase/config.toml` |

Sauvegarde du réglage précédent :
`~/Library/Group Containers/group.com.docker/settings-store.json.avant-5go`.

## 3. Les trois réflexes

**a. Une seule pile Supabase à la fois.** Avant de travailler sur un projet, arrêter les autres :

```bash
cd ~/Projects/<autre-projet> && supabase stop
```

`supabase stop` marque les conteneurs comme arrêtés à la main : avec `unless-stopped`, ils ne
reviendront **pas** au prochain lancement de Docker. C'est la différence avec `docker kill`.

**b. Alléger chaque pile.** Dans le `supabase/config.toml` de chaque projet, désactiver ce qui ne
sert pas au développement quotidien — cela économise environ 400 Mo par pile :

```toml
[studio]
enabled = false      # l'interface web ; psql et les migrations suffisent
[analytics]
enabled = false      # collecteur de journaux
[inbucket]
enabled = false      # boîte mail de test
```

**c. Surveiller le disque.** La machine virtuelle de Docker ne rend pas l'espace au Mac quand on
supprime des images : son image disque est creuse et ne fait que grossir. Sous 10 Go libres, Docker
devient instable.

```bash
df -h /System/Volumes/Data | tail -1        # espace libre du Mac
docker system df                            # ce que Docker occupe et ce qui est récupérable
docker builder prune -af                    # cache de compilation : sans risque
docker image prune -a                       # images inutilisées : elles seront retéléchargées
docker volume ls -f dangling=true           # volumes orphelins : VÉRIFIER avant de supprimer
```

## 4. Remettre la pile du CRM en route

```bash
cd ~/Projects/gmbs-crm
supabase start                              # jamais --linked : la démo est 100 % locale
scripts/demo/load-seed.sh                   # données de démonstration
scripts/demo/start-crm.sh                   # CRM sur http://localhost:3000
```

Et le portail, dans l'autre dépôt : `scripts/demo/start-portal.sh` (http://localhost:3001).

## 5. Redémarrer la pile mise en pause

La pile `comfi` a été arrêtée le 2026-09-05 pour libérer de la mémoire. Pour la relancer :

```bash
cd ~/Projects/<projet-comfi> && supabase start
```
