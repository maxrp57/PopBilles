# PopBilles

PopBilles est un jeu de fusion de billes jouable dans le navigateur. Les parties,
la collection, les succès et les paramètres sont sauvegardés localement dans le
navigateur. Aucune clé API ni aucun serveur ne sont nécessaires.

## Lancer le jeu en local

Prérequis : Node.js 22 ou plus récent et npm.

```sh
npm ci
npm run dev
```

Pour vérifier la version de production :

```sh
npm run build
npm run preview
```

## Publier sur GitHub Pages

Le workflow GitHub Actions `.github/workflows/deploy-pages.yml` construit le
site et le publie automatiquement à chaque mise à jour de la branche `main`.

Dans le dépôt GitHub, ouvrir **Settings → Pages**, puis choisir **GitHub Actions**
comme source de déploiement. Une fois le workflow terminé, le jeu sera disponible
à l’adresse `https://maxrp57.github.io/PopBilles/`.
