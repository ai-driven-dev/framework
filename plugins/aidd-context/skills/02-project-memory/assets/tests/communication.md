# Communication evaluation scenarios

## Decision under pressure

### User prompt

Je dirige une équipe de huit personnes. Notre lancement public est prévu vendredi. Un bug de paiement fait échouer environ 15 % des essais. Le correctif prendra entre trois et cinq jours. Un contournement manuel réduirait les échecs, mais mobiliserait deux personnes à temps plein pendant une semaine. Le client pilote attend notre décision avant 16 h. J'ai une réunion d'équipe dans 25 minutes et aucun message n'est préparé. Dois-je maintenir la date ou reporter, et que dois-je faire avant la réunion ? Au passage, notre logo commence à dater.

## Authentication regression

### User prompt

Mon API utilise Node 20, TypeScript et Express. Depuis ce matin, le test d'intégration de connexion échoue avec `expected 200, received 401`, puis `JsonWebTokenError: invalid signature`. `src/auth/create-session.ts:18` signe le token avec `process.env.AUTH_SECRET`. `src/auth/verify-token.ts:42` le vérifie avec `process.env.JWT_SECRET ?? "dev-secret"`. Le fichier `.env.test` définit uniquement `AUTH_SECRET=test-secret`. Je veux la correction minimale, les changements exacts et la commande permettant de vérifier le résultat. Au passage, `npm outdated` remonte aussi 17 dépendances obsolètes.
