# Strava Receipt

Turn your Strava workouts into beautiful receipt-style summaries.

![Strava Receipt](https://img.shields.io/badge/Strava-FC4C02?style=for-the-badge&logo=strava&logoColor=white)

## Features

- 🏃 Connect to your Strava account
- 📊 View your recent activities (initial load last 100, can choose to load all)
- 🗺️ See GPS routes visualized
- 📷 View activity photos
- 📥 Download receipt as image (coming soon)
- 🖨️ Print to thermal printer (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- A Strava API application ([create one here](https://www.strava.com/settings/api))

### Installation

1. Clone the repo:
```bash
git clone https://github.com/yourusername/strava-receipt.git
cd strava-receipt
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with your Strava API credentials:
```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_STRAVA_CLIENT_ID=your_client_id
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/strava-receipt)

Make sure to set the environment variables in Vercel:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `NEXT_PUBLIC_STRAVA_CLIENT_ID`
- `NEXT_PUBLIC_APP_URL` (your deployed URL)

And update your Strava API app's callback domain to your Vercel domain.

## Print Server (Optional)

To enable thermal printing, you can run a local print server:

**Printer:** EPSON TM-T20III (80mm thermal receipt printer)  
**Connection:** USB

1. Install optional dependencies (for image processing):
```bash
npm install jimp sharp
```

2. Connect your thermal printer via USB and ensure it's detected by your system.

3. Start the print server:
```bash
npm run print-server
```

The print server will run on `http://localhost:3001` and handle print requests from the web interface. The print button in the web interface will only be visible when running on `localhost` (automatically hidden on production).

The print server formats receipt-style summaries using ESC/POS commands and can print:
- Activity details (name, stats, distance, pace, etc.)
- GPS route visualization
- Activity photos (up to 3)
- QR code linking to Strava activity

The design is similar to the web-app, but not the exact same since it's hard to replicate the exact design with ESC/POC commands. Potential to fillout with more details here.

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Strava API](https://developers.strava.com/) - Activity data

## License

MIT

---

Made by [Pete](https://repete.art)

Support my work with a follow or a coffee :D
- [Instagram](https://www.instagram.com/_re_pete)
- [Twitter](https://twitter.com/_re_pete)
- [Substack](https://substack.com/@petecybriwsky)
- [Buy Me a Coffee](https://www.buymeacoffee.com/repete)
