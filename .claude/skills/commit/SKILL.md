---
name: commit
description: >
  Commit changes in the unique-numbers repository the way the owner wants: directly on main, never on a
  feature branch, after the checks pass, with a descriptive message. Use whenever asked to commit,
  "save this to git", "make a commit", or when finishing a task the owner asked to have committed.
---

# Committing

## The rule

**Commit directly to `main`. Never create a feature branch** - not even when a default workflow says
"branch first". The owner merges nothing; a feature branch only leaves work stranded. If the current
branch is not `main`, stop and ask before doing anything else.

Push only when the owner asks for it.

## Steps

1. `git status` and `git diff` - know exactly what goes in. Never commit `data/*.json` (real saved
   series; `data/.gitignore` keeps them out - do not override it), `node_modules/`, or scratch files.
2. Run the `run-checks` skill. For UI, CSS, print or sound changes also the `browser-check` skill.
   Do not commit with failing checks; say what failed instead.
3. If the change is visible to the owner or his friend, update `README.md` (Slovak) in the same commit.
   If it records a decision, add a line to `.claude/knowledge/decisions.md`.
4. Stage files by name (`git add index.js style.css ...`), not `git add -A`.
5. Commit with a message in English, like the existing history:
   - subject: imperative, ≤ 72 characters, no trailing period (`Make the beep longer and adjustable`)
   - body: what changed and **why**, wrapped at ~72 columns; mention user-visible behaviour, data
     safety, and anything intentionally left out
   - end with the attribution line(s) the session's instructions ask for
6. Split unrelated work into separate commits when that is easy (e.g. knowledge base vs. app code).
7. `git log --oneline -3` and report the new commit(s).
