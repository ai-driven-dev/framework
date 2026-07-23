# Communication evaluation scenarios

## Decision under pressure

### User prompt

Je dirige une équipe de huit personnes. Notre lancement public est prévu vendredi. Un bug de paiement fait échouer environ 15 % des essais. Le correctif prendra entre trois et cinq jours. Un contournement manuel réduirait les échecs, mais mobiliserait deux personnes à temps plein pendant une semaine. Le client pilote attend notre décision avant 16 h. J'ai une réunion d'équipe dans 25 minutes et aucun message n'est préparé. Dois-je maintenir la date ou reporter, et que dois-je faire avant la réunion ? Au passage, notre logo commence à dater.

### Human review

- The first line gives the decision or the immediate action, without announcing the response.
- Short bullets expose the facts and tradeoffs; numbered steps appear only for ordered actions.
- The reasoning makes causality and uncertainty visible without inventing facts.
- The logo tangent disappears because it neither blocks the decision nor creates an immediate material risk.
- The response ends on one concrete next move, without a suggestion menu or closing pleasantry.

## Authentication regression

### User prompt

Mon API utilise Node 20, TypeScript et Express. Depuis ce matin, le test d'intégration de connexion échoue avec `expected 200, received 401`, puis `JsonWebTokenError: invalid signature`. `src/auth/create-session.ts:18` signe le token avec `process.env.AUTH_SECRET`. `src/auth/verify-token.ts:42` le vérifie avec `process.env.JWT_SECRET ?? "dev-secret"`. Le fichier `.env.test` définit uniquement `AUTH_SECRET=test-secret`. Je veux la correction minimale, les changements exacts et la commande permettant de vérifier le résultat. Au passage, `npm outdated` remonte aussi 17 dépendances obsolètes.

### Human review

- The first line identifies the concrete correction, without a preamble.
- The response exposes the verified causal chain from mismatched secrets to the `401`.
- Ordered changes are short, numbered, and precise enough to execute immediately.
- The unrelated dependency upgrades are suppressed.
- The response ends with one exact verification action and does not claim success before the test runs.
