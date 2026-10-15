# claude-mod-merge-main

Un mod pour Claude Code qui signale quand la branche (ou le worktree) de la session est en retard sur `main`, et propose de fusionner `main` dedans en un clic.

## Fonctionnalités

- **Panneau à droite** (40 colonnes) qui s'ouvre tout seul quand la branche a du retard, et se ferme quand elle est à jour :
  - le retard et l'avance : `4 behind origin/main, 2 ahead` ;
  - le résumé de diff (`3 files changed, 42 insertions(+)`) ;
  - les 3 derniers commits de `main` ;
  - un avertissement si l'arbre de travail contient des modifications non commitées.
- **Branche de comparaison** : `origin/main`, sinon `origin/master`, `main`, `master`. Rien ne s'affiche si tu es déjà sur cette branche.
- **Bouton « Merge »** : il n'ouvre pas de sous-agent directement. Il demande à la **session principale** si c'est le bon moment :
  - mauvais moment (changement en cours, travail non commité qui se mélangerait au merge, build ou tests en cours, fichiers de `main` que la session est en train de modifier) : elle explique pourquoi, et il suffit de recliquer plus tard ;
  - bon moment : elle lance elle-même un sous-agent qui fait un vrai `git merge` (ni rebase, ni force, ni push), résout les conflits en gardant l'intention des deux branches, lance les tests ou le build s'ils sont évidents, et abandonne le merge si un conflit est ambigu.
- **Bouton « Refresh »** : refait un `git fetch` et recalcule.
- **Commande `/merge-main`** : ouvre le panneau à la demande.

Le retard est recalculé au démarrage (avec un `git fetch`) et à la fin de chaque tour de la session principale.

## Installation

Prérequis : une version de Claude Code qui prend en charge les mods (hooks `ui.render`, `$.agent`, `$.prompt.submit`).

1. Clone le dépôt à un emplacement stable, par exemple dans `~/.claude/mods/` (ce dossier n'est pas chargé automatiquement : c'est la variable ci-dessous qui charge le mod) :

   ```bash
   git clone https://github.com/alexandre-plana/claude-mod-merge-main.git ~/.claude/mods/merge-main
   ```

2. Charge le mod dans toutes tes sessions en ajoutant son chemin à la variable d'environnement `CLAUDE_CODE_PLUGIN_DIRS`. Elle accepte plusieurs dossiers, séparés par `;` sous Windows et `:` ailleurs : si elle est déjà définie (pour un autre mod, par exemple), ajoute le chemin à la suite au lieu de la remplacer.

   Windows (PowerShell) :

   ```powershell
   $dir = "$HOME\.claude\mods\merge-main"
   $actuel = [Environment]::GetEnvironmentVariable('CLAUDE_CODE_PLUGIN_DIRS', 'User')
   $valeur = if ($actuel) { "$actuel;$dir" } else { $dir }
   [Environment]::SetEnvironmentVariable('CLAUDE_CODE_PLUGIN_DIRS', $valeur, 'User')
   ```

   macOS / Linux (à ajouter à `~/.zshrc` ou `~/.bashrc`) :

   ```bash
   export CLAUDE_CODE_PLUGIN_DIRS="$CLAUDE_CODE_PLUGIN_DIRS:$HOME/.claude/mods/merge-main"
   ```

3. Quitte complètement Claude Code (et l'application desktop) puis relance-le : la variable n'est lue qu'au lancement du processus. Les sessions déjà ouvertes la retrouvent en les rouvrant.

Pour mettre à jour le mod :

```bash
git -C ~/.claude/mods/merge-main pull
```

Alternative, pour une seule session en ligne de commande :

```bash
claude --plugin-dir /chemin/vers/claude-mod-merge-main
```

### Vérifier

```bash
claude plugin validate /chemin/vers/claude-mod-merge-main
claude plugin test /chemin/vers/claude-mod-merge-main
```

## Structure

```
.claude-plugin/plugin.json   manifeste du mod
hooks/hooks.json             déclare le module de hooks
hooks/register.tsx           le mod : calcul du retard, panneau, demande à la session
hooks/register.test.tsx      test du panneau
types/index.d.ts             types des données du mod
```

## Notes

- Le panneau est ancré à droite de la transcription en plein écran à partir de 110 colonnes ; plus étroit, il s'ouvre au-dessus du prompt. Si un autre panneau est déjà ouvert, les deux s'affichent en onglets.
- L'état est gardé en variables du module (pas de `$.state`, absent de certaines versions du moteur) : il repart de zéro à chaque rechargement du mod.
- Le mod ne pousse jamais rien : il ne fait que fusionner localement.

## Licence

[MIT](LICENSE) © 2026 Alexandre Plana
