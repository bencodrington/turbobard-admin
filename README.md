# Turbobard Admin

Private, separate administration workspace for the Turbobard Sound catalog.
The catalog API is read-only and connects to Firestore only after its
server-side credentials and Google permissions are configured.

## Requirements

- Node 26 (`.nvmrc`)
- npm 11 or newer

Read [the Node tooling guidance](docs/agents/node-tooling.md) before running
project commands.

## Local development

```powershell
npm ci
npm run dev
```

`npm run verify` runs formatting, linting, typechecking, unit tests, build, and
Playwright. Playwright uses desktop Chromium by default.

## Cloudflare setup: one deployment

There is one Cloudflare Worker named `turbobard-admin`; there are no separate
staging and production deployments. The repository keeps one Wrangler file so
the build knows how to publish the app and route `/api/*` requests to the
server-side Worker. Cloudflare provides its free `workers.dev` URL; the sign-in
policy and Google credentials are kept in the Cloudflare Dashboard.

The steps below set up the app from a new Cloudflare account. You do not need to
buy a domain or add a DNS zone.

### Before you start

- Have access to the Cloudflare account that will own this Worker.
- Know the email address that should be the only admin user.
- For catalog data, have a Google service account whose permissions are
  limited to reading Firestore documents. Cloudflare Access controls who can
  open the admin app; Google IAM controls what the Worker can read. They are
  two separate checks.

### 1. Deploy the Worker

In a terminal at the repository root, install dependencies and sign Wrangler
into the Cloudflare account:

```powershell
npm ci
npx wrangler login
npm run deploy
```

`npm run deploy` builds the React app, then uploads it and its API Worker as one
deployment. Cloudflare gives it a URL in the form
`https://turbobard-admin.<YOUR_ACCOUNT_SUBDOMAIN>.workers.dev`. Find your
account subdomain in **Workers & Pages** and confirm the URL under the Worker's
**Settings** → **Domains & Routes**. The URL is public until you finish step 2,
so set up Access promptly. Preview URLs remain disabled.

### 2. Require the owner's sign-in

Cloudflare Access is the sign-in gate in front of the admin app. Enable Zero
Trust on the account if needed, and configure an identity provider, such as a
supported email sign-in method. Then protect the Worker:

1. In the Cloudflare Dashboard, open **Workers & Pages** and select
   **turbobard-admin**.
2. Open the **Access** tab and select **Protect this Worker behind Access**.
3. Choose **All traffic**, including production traffic, rather than **Previews
   only**.
4. Configure an **Allow** policy for the exact owner email address. Select the
   identity provider the owner will use, then apply Access.

Access denies people who do not match an Allow policy. Use the one owner's exact
email; do not choose a whole email domain or an everyone option. Worker-level
Access protects the web pages and API paths such as `/api/health` and
`/api/catalog`.

### 3. Add the Google settings the API needs

The Worker needs a few values to request read access to Firestore. Set them on
the Worker itself; they are not part of the browser app.

1. In **Workers & Pages**, select **turbobard-admin**.
2. Open **Settings** and find **Variables and Secrets**.
3. Add `GOOGLE_PROJECT_ID` as a text variable with the Google Cloud project ID.
4. Add `GOOGLE_CLIENT_EMAIL` as a text variable with the service account's
   email address.
5. Add `GOOGLE_PRIVATE_KEY` as a **Secret** and paste the private key from the
   service-account credentials.
6. Save the settings and deploy the Worker version when prompted.

The private key is sensitive: enter it only as a Secret. Cloudflare hides a
Secret's value after it is saved. Never put it in this repository, a `VITE_*`
variable, or a browser-visible file. The Google service account also needs
Firestore read permissions in Google Cloud; these Cloudflare steps do not grant
those permissions or change database data.

### 4. Check the setup

Without signing in, request both the home page and the API health path. Access
should send each request to sign-in or block it:

```powershell
$workerUrl = "https://turbobard-admin.YOUR_ACCOUNT_SUBDOMAIN.workers.dev"
curl.exe -I "$workerUrl/"
curl.exe -I "$workerUrl/api/health"
```

Then sign in as the allowed owner and open the admin page. The API health
response should report `"integrationConfigured": true` without revealing any
credential values. If it reports `false`, check that all three Worker settings
were added with the exact names above. Catalog reads also require the Google
service account to have Firestore read permission.

For future code updates, run `npm run deploy` again. It updates the same Worker;
there is no staging/production choice. The owner-only Access policy stays in
the Dashboard, while `wrangler.jsonc` keeps the `workers.dev` URL enabled.

Cloudflare's current instructions: [workers.dev URLs](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [Worker variables](https://developers.cloudflare.com/workers/configuration/environment-variables/), and [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Project records

- [Domain glossary](GLOSSARY.md)
- [Approved scope](docs/admin-design.md)
- [Slice plan](docs/admin-slices.md)
- [R2 integration feasibility](docs/integration-feasibility.md)
- [Schema-freeze decision](docs/adr/0001-preserve-shared-schema-until-legacy-retirement.md)
