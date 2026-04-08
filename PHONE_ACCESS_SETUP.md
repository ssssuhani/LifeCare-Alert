# Phone Access Setup (GPS Enabled)

This file saves the exact process to run the website on your phone and allow phone GPS.

## 1) Start the website locally

From project root:

```bash
npm run dev
```

Vite is configured to run on:

- Local: `http://localhost:4173/`
- LAN: `http://<your-computer-ip>:4173/`

## 2) Create HTTPS tunnel for phone access

Use this command in a new terminal:

```bash
ssh -o StrictHostKeyChecking=no -R 80:localhost:4173 nokey@localhost.run
```

It prints a URL like:

`https://<random-subdomain>.lhr.life`

Use that URL on the phone (same base URL for all pages).

Examples:

- `https://<subdomain>.lhr.life/`
- `https://<subdomain>.lhr.life/phone-listener.html`
- `https://<subdomain>.lhr.life/dashboard.html`

## 3) Enable GPS and alert audio on phone

Open:

`https://<subdomain>.lhr.life/phone-listener.html`

Then:

1. Tap `Enable Location Permission`
2. Tap `Allow` in browser popup
3. On iPhone, keep `Precise Location` ON
4. Tap `Enable Alarm Sound`
5. Keep the page open in foreground

## 4) If location permission was denied earlier

- iPhone: `Settings -> Safari -> Location -> Allow`
- Android Chrome: `Settings -> Site settings -> Location -> Allow`

Then reopen `phone-listener.html` and tap `Enable Location Permission` again.

## Notes

- HTTPS is required for reliable geolocation on mobile browsers.
- Tunnel URL changes each time you rerun `localhost.run`.
