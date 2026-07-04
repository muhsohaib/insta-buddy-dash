# Loomly Documentation

This folder is a [Mintlify](https://mintlify.com) documentation site.

The **API Reference** tab is generated automatically from the live OpenAPI spec
served by the app at `/api/public/v1/openapi` — you don't need to edit any files
under `api-reference/`. Mintlify fetches the spec at build time and renders one
interactive page per endpoint.

The **Guides** tab is hand-written Markdown/MDX under `guides/`.

## Local preview

```bash
npm i -g mint
cd docs
mint dev
```

Then open http://localhost:3000.

## Deployment

Push this folder to the GitHub repo connected to your Mintlify project, or
point Mintlify at this subdirectory. Mintlify will re-fetch the OpenAPI
spec on every deploy, so new endpoints appear automatically as soon as
`src/routes/api/public/v1/openapi.ts` is updated.

## Updating the API Reference

Nothing to do in this folder. Add the endpoint to
`src/routes/api/public/v1/openapi.ts` in the main app, deploy, and the
next Mintlify build will pick it up.
