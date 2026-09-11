# IB Economics production deployment receipt

- Reviewed release commit: `64fbf579ee208d88616622894f84fc5461156f09`.
- Merged PR: [#24](https://github.com/Saksham106/pastpaperprep/pull/24), merge commit `601ced11e28d5f56dac2156c6f3f746e4ba3782f`.
- Vercel project: `prj_qHuVtPwz0ooTItwRUUNtJ1J490JV`.
- Previous production deployment recorded before publish: `dpl_6QEWP4XnP28AxjMgkhwmxwkQa5hn` (`pastpaperprep-mh7tttdmi-saksham-goels-projects-0ecf36cd.vercel.app`).
- Rollback command supported by installed Vercel CLI: `vercel rollback <url|deploymentId>`.

## Published deployment

- Deployment ID: `dpl_7HmnvxuGoWo2RBmghFYz9cvUQpUJ`.
- Deployment URL: `https://pastpaperprep-2ciqam664-saksham-goels-projects-0ecf36cd.vercel.app`.
- Production alias: `https://pastpaperprep.com`.
- Inspect URL: `https://vercel.com/saksham-goels-projects-0ecf36cd/pastpaperprep/7HmnvxuGoWo2RBmghFYz9cvUQpUJ`.
- Readback: Vercel `READY`, target `production`; production build completed successfully.
- Runtime flags passed explicitly, and the Economics bank route returned the reviewed HL page with the `111 questions` marker.

## Anonymous route readback

- `GET /banks/ib-economics-hl`: `200` and reviewed Economics page present.
- `GET /api/private-bank-index/ib-economics-hl`: `401 {"error":"Sign in required"}`.
- `POST /api/assets/sign` for a reviewed HL question: `403 {"error":"Access required"}`.
- `GET /api/local-preview-assets/...`: `404 {"error":"Not found"}` in production.

Full entitled browser QA is intentionally not claimed here; that is the separate post-deploy boundary.
