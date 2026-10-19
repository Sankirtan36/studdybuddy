## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)


# AI Agent Instructions — StuddyBuddy

## Mandatory First Step

Before starting any task, read `STUDDYBUDDY_SRS.md` completely and read any relevant project documentation.

The SRS is the authoritative source for StuddyBuddy's product requirements and approved technology stack.

## Approved Technology Stack

- Astro.js
- TypeScript with strict mode
- Tailwind CSS
- MongoDB Atlas
- Secure Astro-compatible authentication and server-side sessions
- Cloudflare R2 or compatible S3 object storage
- Vercel with the official Astro adapter

Do not introduce Next.js, Supabase, or a replacement database or storage platform without explicit authorization.

## Before Making Changes

1. Inspect the existing repository and `package.json`.
2. Read the SRS requirements relevant to the task.
3. Identify existing components and functionality that can be reused.
4. Make a focused implementation plan.
5. Preserve existing working features and user changes.

## Implementation Rules

- Make targeted, minimal changes whenever possible.
- Do not rewrite the entire application for a small feature.
- Do not remove functionality without approval.
- Enforce authentication, ownership, and permissions on the server.
- Validate all external inputs.
- Never expose secrets to the browser or commit real credentials.
- Do not fabricate users, resources, analytics, download counts, upload success, or test results.
- Do not use fake processing animations in place of actual functionality.
- Add or update tests for relevant behavior.
- Update documentation when configuration or behavior changes.
- Do not claim a feature is complete until the implementation has been inspected and appropriately tested.

## Handling Conflicts

If a task conflicts with the SRS, identify the conflict before making a potentially destructive or architecture-changing decision.

Do not silently change the approved technology stack or weaken security requirements.

## Final Report

At the end of each task, list:

- Changes implemented.
- Files modified.
- SRS requirements addressed.
- Tests executed and actual results.
- Known limitations.
- Required environment variables or deployment steps.
- Remaining work.

Distinguish clearly between implemented, tested locally, and verified in production.

Keep `STUDDYBUDDY_SRS.md` updated when an approved product requirement changes.