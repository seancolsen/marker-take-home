<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git commits

Whenever you change files in the repo, make a Git commit at the end of your turn, without being asked. Commit straight to the current branch (usually `main`), and don't push.

Write your final response first, then use it in the commit message, formatted like this:

```
<Short imperative summary, like "Revamp navigation system">

<My prompt, verbatim>

---

<Your final response to me, in markdown, verbatim>
```

- Copy my prompt exactly, including its paragraph breaks. Don't summarize or reword it.
- The response in the commit should be the same text you show me at the end of the turn.
- Pass the message with `git commit -F <file>` (write the file to your scratchpad), so markdown, backticks and quotes survive the shell.
