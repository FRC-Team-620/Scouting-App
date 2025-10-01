# Firebase Setup Guide

To enable multi-user data synchronization, you need to set up a Firebase project.

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name (e.g., "frc-scouting-620")
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Set up Firestore Database

1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in **test mode**" (for development)
4. Select a location (choose closest to your region)
5. Click "Enable"

## Step 3: Get Your Firebase Configuration

1. Click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register your app with a nickname (e.g., "Scouting App")
6. Copy the `firebaseConfig` object

## Step 4: Add Configuration to Your App

1. Create a file named `.env.local` in your project root
2. Copy the contents from `.env.local.example`
3. Replace the placeholder values with your Firebase config values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=frc-scouting-620.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=frc-scouting-620
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=frc-scouting-620.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 5: Update Firestore Security Rules (Important!)

1. Go to Firestore Database → Rules
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents
    // For production, you should add proper authentication
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

⚠️ **Note**: These rules allow anyone to read/write. For production, implement proper authentication.

## Step 6: Run Your App

```bash
npm install
npm run dev
```

Your app will now sync data across all users in real-time!

## Troubleshooting

- If you see "Firebase not initialized" errors, check that your `.env.local` file exists and has the correct values
- Make sure Firestore is enabled in your Firebase console
- Check that security rules are set to allow access
