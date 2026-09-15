## NovelTribe

NovelTribe is a private-first reading tracker built with Next.js, Supabase, React, and TypeScript.

Install dependencies and run the development server:

```powershell
npm run dev
```

Before committing changes, run:

```powershell
npm run build
npm run lint
git diff --check
```

## Library Imports

From Profile, users can import a Goodreads library CSV or a Libby/OverDrive tag spreadsheet. In Libby, export a tag from **Tags → Actions → Export Tag → Spreadsheet → Titles**, then upload the file in Profile.

Imports use ISBN metadata for covers and genre classification, preserve formats and tags, and safely upsert matching books instead of creating duplicates. Goodreads and Libby/OverDrive files are detected automatically; CSV, TSV, and TXT files are accepted.

Onboarding instructions are available at `/getting-started`, and product history is available at `/updates`.

## Environment Variables

Configure the Supabase and optional provider variables described in `PROJECT_HANDOFF.md`. Never commit secrets or service-role keys.

The server-side feedback form requires a `RESEND_API_KEY` and a verified `noreply@novel-tribe.com` sender in Resend. Submissions are routed to `kblume427@gmail.com`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
