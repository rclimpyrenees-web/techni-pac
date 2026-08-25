# Techni-Pac — Poste de gestion (PWA + base de données partagée)

Cette application est prête à être mise en ligne, installée sur iPhone comme une app,
et **synchronise en temps réel** toutes les données (clients, rapports, planning, devis,
facturation) entre tous les appareils connectés — vous sur le terrain, votre secrétaire
au bureau.

Je ne peux pas créer les comptes ni mettre le site en ligne moi-même, mais voici la
marche à suivre complète — environ 20 minutes la première fois.

---

## Étape 1 — Créer la base de données (Supabase, gratuit)

1. Allez sur **https://supabase.com**, créez un compte gratuit.
2. Cliquez **"New project"**. Donnez-lui un nom (ex. `techni-pac`), choisissez un mot
   de passe de base de données (notez-le, pas besoin de le retenir après), et une région
   proche de vous (Europe/Paris ou Frankfurt).
3. Une fois le projet créé (1–2 minutes), allez dans **SQL Editor** (menu de gauche) →
   **New query**.
4. Ouvrez le fichier **`supabase/schema.sql`** de ce projet, copiez tout son contenu,
   collez-le dans l'éditeur SQL de Supabase, puis cliquez **"Run"**.
   → Cela crée toutes les tables nécessaires et sécurise l'accès aux données.
5. Allez dans **Authentication → Users** (menu de gauche) → **"Add user"** → **"Create new user"**.
   Créez un compte pour vous (email + mot de passe), et un second pour votre secrétaire.
   Cochez "Auto Confirm User" pour éviter l'étape d'email de confirmation.
6. Allez dans **Project Settings → API** (icône engrenage en bas à gauche).
   Notez les deux valeurs suivantes, elles serviront à l'étape 3 :
   - **Project URL** (ex. `https://xxxxxxxx.supabase.co`)
   - **anon public key** (longue chaîne commençant par `eyJ...`)

## Étape 2 — Mettre le code en ligne (sans rien installer sur votre ordinateur)

1. Créez un compte **https://github.com** (gratuit) si vous n'en avez pas.
2. Créez un **nouveau repository** (bouton vert "New"), nom libre, ex. `techni-pac`.
3. Sur la page du repository, **"Add file" → "Upload files"**, glissez-déposez tous les
   fichiers et dossiers de ce projet (en conservant la structure : `src/`, `public/`,
   `supabase/`, `index.html`, `package.json`, `vite.config.js`). Ne mettez **pas** le
   fichier `.env` (il n'existe pas encore, c'est normal — voir étape suivante).
4. Validez ("Commit changes").
5. Créez un compte sur **https://vercel.com** (gratuit), connecté avec votre compte GitHub.
6. **"Add New" → "Project"**, sélectionnez votre repository `techni-pac`.
7. Avant de cliquer sur Deploy, dépliez **"Environment Variables"** et ajoutez :
   - `VITE_SUPABASE_URL` → collez votre Project URL (étape 1.6)
   - `VITE_SUPABASE_ANON_KEY` → collez votre anon public key (étape 1.6)
8. Cliquez **"Deploy"**. Après 1–2 minutes, vous obtenez une adresse du type
   `https://techni-pac.vercel.app` — c'est votre application, en ligne, avec vraie
   base de données.

## Étape 3 — Installer l'app sur iPhone

1. Ouvrez l'adresse obtenue dans **Safari** sur l'iPhone (obligatoirement Safari).
2. Connectez-vous avec l'email/mot de passe créé à l'étape 1.5.
3. Appuyez sur l'icône **Partager** → **"Sur l'écran d'accueil"** → **"Ajouter"**.

Une icône Techni-Pac apparaît sur l'écran d'accueil, en plein écran, comme une vraie app.

---

## Étape 4 — Activer la synchronisation Pennylane (facultatif)

Cette étape connecte votre logiciel à Pennylane pour créer automatiquement les
factures et suivre leur statut payé/impayé. Elle nécessite d'avoir installé
l'outil en ligne de commande Supabase (**Supabase CLI**) une seule fois — voir
https://supabase.com/docs/guides/cli si besoin.

1. **Générez votre clé API Pennylane** : dans Pennylane, roue crantée (⚙️) →
   **Connectivité** → **Développeurs** → **Générer un Token API**. Copiez-la,
   elle ne sera plus jamais réaffichée. (Nécessite un abonnement Pennylane
   Essentiel ou supérieur, et un rôle administrateur/gestionnaire.)

2. **Reliez le projet à votre Supabase** (une seule fois, depuis un terminal, à
   la racine du dossier `techni-pac`) :
   ```
   supabase login
   supabase link --project-ref VOTRE_PROJECT_REF
   ```
   (le `VOTRE_PROJECT_REF` se trouve dans l'URL de votre projet Supabase, ou
   dans Paramètres du projet → General.)

3. **Enregistrez votre clé Pennylane comme secret** (elle ne sera jamais visible
   dans le code ni dans le navigateur) :
   ```
   supabase secrets set PENNYLANE_API_KEY=votre_cle_copiee_a_l_etape_1
   ```

4. **Déployez la fonction de synchronisation** :
   ```
   supabase functions deploy pennylane-sync
   ```

5. Dans le logiciel, allez dans **Paramètres → Facturation Pennylane** et cochez
   **"Activer la synchronisation automatique avec Pennylane"**.

À partir de là : chaque rapport de mise en service ou d'entretien enregistré
**avec un montant renseigné et sans devis à effectuer** crée automatiquement la
facture correspondante dans Pennylane (le client y est créé ou retrouvé
automatiquement). Dans l'onglet Facturation, un bouton 🔄 apparaît sur les
factures liées à Pennylane pour vérifier si elles ont été payées.

Si vous modifiez un jour le code de la fonction (`supabase/functions/pennylane-sync/index.ts`),
il suffit de relancer `supabase functions deploy pennylane-sync` pour republier.

---

## Et après ?

- Toute donnée saisie (par vous ou votre secrétaire, sur n'importe quel appareil) est
  **sauvegardée immédiatement** et **visible par tout le monde en quelques secondes**.
- Les données sont hébergées chez Supabase, avec sauvegardes automatiques de leur côté.
- Si vous modifiez le code plus tard (nouvelle demande de modification), il suffira de
  re-uploader les fichiers changés sur GitHub — Vercel republie automatiquement.
- Le plan gratuit de Supabase est largement suffisant pour ce volume d'utilisation
  (2 utilisateurs, usage quotidien). Vous pourrez upgrader plus tard si besoin, sans
  rien changer au code.

