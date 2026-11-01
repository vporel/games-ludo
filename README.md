# Ludo

Ludo multijoueur en ligne (2 à 4 joueurs) : Next.js 15 (App Router) + Supabase (Auth, Postgres, Realtime).

- Inscription et connexion **par pseudo uniquement** (pas d'email ni de mot de passe côté joueur).
- Un joueur crée une salle et reçoit un **code à 6 chiffres** (ou un lien `/room/<code>`) à partager.
- Le bouton **Play** (réservé à l'hôte) s'active dès qu'un 2e joueur est là. Maximum 4 joueurs.
- Le serveur fait foi : dé tiré côté serveur, coups validés par le moteur, écriture avec la clé `service_role`.

## Installation

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # http://localhost:3000/ludo
```

Ludo est servi sous `games.vporel.com/ludo` (`basePath: "/ludo"`, voir `src/lib/base-path.ts`). La racine du domaine appartient à la vitrine des jeux (`../vporel-website-games`).

### Variables d'environnement (`.env.local`)

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (le même que Cloverly) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` (serveur uniquement) |

### Supabase

1. Exécuter `supabase/migrations/001_ludo_init.sql` dans le SQL Editor. Toutes les tables sont préfixées `ludo_` pour cohabiter avec Cloverly.
2. La confirmation d'email n'est pas nécessaire : les comptes sont créés côté serveur avec l'email déjà confirmé (`<pseudo>@user.games.vporel.com`).
3. Realtime : la migration ajoute `ludo_rooms`, `ludo_room_players` et `ludo_games` à la publication `supabase_realtime`.

## Authentification sans mot de passe

À l'inscription, le serveur crée l'utilisateur avec l'API admin, avec un mot de passe interne `HMAC-SHA256(constante, pseudo)` que le joueur ne voit jamais. La constante est écrite dans `src/app/actions/auth.ts` : ce n'est pas un vrai secret, et il ne faut **jamais la modifier** une fois des comptes créés. À la connexion, il recalcule ce mot de passe et ouvre la session (cookies via `@supabase/ssr`).

Conséquence assumée : connaître un pseudo suffit pour se connecter avec.

## Règles implémentées

- Un **6** est nécessaire pour sortir un pion. Un 6 donne un tour supplémentaire. **Trois 6 d'affilée** font perdre le tour.
- Le circuit fait 52 cases, puis chaque couleur a un couloir de 5 cases et le centre. Il faut un **score exact** pour arriver.
- Une **capture** renvoie le pion adverse à sa maison et donne un tour supplémentaire. Arriver au centre donne aussi un tour supplémentaire.
- Les **cases sûres** sont les 4 cases de départ et les 4 étoiles.
- Si aucun coup n'est possible, le tour passe. Si un seul coup est possible, il est joué automatiquement.
- **Minuteur de 30 s.** À expiration, n'importe quel client demande au serveur de jouer automatiquement (lancer, puis meilleur coup).
- La partie se joue jusqu'au classement complet. Un joueur qui quitte abandonne et ses pions sont retirés.
- À 2 joueurs, les couleurs sont rouge et jaune (face à face).

## Structure

```
src/game/            moteur pur (TS), testé : constants, board (géométrie), engine (règles), describe (journal)
src/server/rooms.ts  accès base côté serveur + verrou optimiste (colonne version)
src/app/actions/     server actions : auth, salles, coups
src/components/      Board (SVG), Dice (3D CSS), GameView, Lobby, useRoom (realtime)
src/app/dev          bac à sable local, sans Supabase (dev uniquement) : http://localhost:3000/ludo/dev
supabase/migrations  schéma, RLS (lecture membres uniquement), trigger « 4 joueurs max »
```

## Scripts

- `npm run dev` : serveur de développement
- `npm test` : tests unitaires (Vitest)
- `npm run lint`
- `npm run build` : build de production et archive `ludo.zip` **sans** `node_modules` (déploiement courant)
- `npm run build-full` : même chose **avec** `node_modules` (premier déploiement, ou après l'ajout ou la mise à jour d'un package)
