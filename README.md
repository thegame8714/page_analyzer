This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Analyzing pages before you deploy them

The analyzer accepts local pages as well as live URLs, so you can check a page while
you're still editing it.

**Web UI** — run `npm run dev`, then paste a local address such as `localhost:4321/landing`
(it defaults to `http://` for local hosts).

**CLI / Claude Code agent** — the same analysis from the terminal:

```bash
npx tsx scripts/analyze.ts localhost:3000/pricing   # a local dev server
npx tsx scripts/analyze.ts ./site/index.html        # an HTML file (or a folder with index.html)
npx tsx scripts/analyze.ts https://example.com --json
```

The `landing-page-analyzer` agent (`.claude/agents/`) wraps this CLI, so in Claude Code you
can just ask it to audit a page, local or live.

For local pages, HTTPS, response time and `llms.txt` aren't judged — they say nothing about
the deployed site.

**Deploying the UI?** Local and private addresses are blocked when `NODE_ENV=production`, so a
public instance can't be used to make your server fetch its own internal network. Set
`ALLOW_LOCAL_URLS=1` if you run the production build on your own machine and want them back.
The check is hostname-based and applies to every redirect hop.
