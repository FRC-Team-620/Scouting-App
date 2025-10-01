# FRC Scouting App - REEFSCAPE 2025

A modern web application for collecting and analyzing FRC match data during competitions.

## Features

- **Competition Setup**: Manage multiple competitions, teams, and matches
- **Match Scouting**: Intuitive data entry forms for recording:
  - Autonomous period performance (Coral L1-L4, Algae scoring)
  - Teleoperated period performance
  - Endgame actions (Deep climb, Shallow climb, Park)
  - Performance ratings (Defense, Driver skill, Robot speed)
  - Additional notes
- **Data Analysis**: Review and analyze team performance with:
  - Aggregated statistics per team
  - Match-by-match data viewing
  - CSV export for further analysis
- **Real-time Sync**: Multi-user collaboration with Firebase
- **Modern UI**: Beautiful, responsive design with dark mode support

## Tech Stack

- **Next.js 14** - React framework with static export
- **TypeScript** - Type-safe development
- **Firebase Firestore** - Real-time cloud database
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library

## Getting Started

### Prerequisites

1. **Set up Firebase** (see `FIREBASE_SETUP.md` for detailed instructions):
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Get your Firebase configuration

2. **Configure environment variables**:
   - Copy `.env.local.example` to `.env.local`
   - Add your Firebase credentials

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Usage

1. **Setup Phase**: Navigate to the Setup tab to:
   - Add competitions (name, event key, dates)
   - Add teams (team number, team name)
   - Add matches (competition, match number, match type)

2. **Scouting Phase**: Navigate to the Scout tab to:
   - Select competition, match, and team
   - Record autonomous and teleoperated performance
   - Note endgame actions
   - Rate overall performance
   - Add additional observations

3. **Review Phase**: Navigate to the Review tab to:
   - Filter data by competition or team
   - View aggregated statistics
   - Export data to CSV for spreadsheet analysis

## Data Storage

All data is stored in Firebase Firestore (cloud database). This means:
- ✅ **Multi-user sync** - All scouts see the same data in real-time
- ✅ Data persists across devices and browsers
- ✅ Automatic backups
- ✅ Free tier supports most teams
- 💡 Export to CSV for offline analysis

## Deployment

This app is configured for static export and can be deployed to:
- Netlify
- Vercel
- GitHub Pages
- Any static hosting service

## Team 620

Built for FRC Team 620 to scout the 2025 REEFSCAPE game.