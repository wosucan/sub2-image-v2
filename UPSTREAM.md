# Upstream and Backup Notes

This repository is a customized backup of the gallery source deployed for Sub2.

## Upstream

- Upstream project: https://github.com/CookSleep/gpt_image_playground
- License: MIT
- Original copyright notice: `Copyright (c) 2026 CookSleep`

Keep the upstream `LICENSE` file and attribution notices when publishing or redistributing this code.

## Local Customization

The deployed gallery is a standalone React/Vite project. It is not part of the Sub2 frontend source tree. Sub2 integration is implemented by embedded mode, account syncing, and API proxy/account API code inside this gallery project.

Relevant local integration areas:

- `src/lib/embeddedMode.ts`
- `src/lib/embeddedSub2Api.ts`
- `src/lib/sub2apiAccount.ts`
- `src/components/Header.tsx`
- `src/components/SettingsModal.tsx`
- `src/store.ts`
- `vite.config.ts`
- `deploy/`

## Files intentionally excluded from backup

- `node_modules/`
- `dist/`
- `.wrangler/`
- `.env.production`
- `dev-proxy.config.json`
- temporary planning files such as `task_plan.md`, `findings.md`, and `progress.md`
- timestamped backup files such as `*.bak.*`

## Future upstream sync

After this directory is initialized as a Git repository, add the original project as an upstream remote:

```bash
git remote add upstream https://github.com/CookSleep/gpt_image_playground.git
git fetch upstream
git merge upstream/main
```

After resolving conflicts, run the normal project checks and redeploy the gallery.
