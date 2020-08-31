This repo is based on a Next.js starter, but it really just contains a single function in `pages/API` to get Air Quality readings from Purple Air, store it in Sanity.io and send it out over Twilio on SMS.

## Getting Started

You will need to provision it with the following .env vars:

- SANITY_TOKEN
- SANITY_PROJECT_ID
- TWILIO_AUTH_TOKEN
- TWILIO_NUMBER
- TWILIO_ACCOUNT_SID

To run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000/api/main](http://localhost:3000/api/main) to run the function.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/import?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
