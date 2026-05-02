
# TimeIn-Timeout System

A mobile-first Expo Router app for campus access control with Student, Guard, and Admin portals.

## What this app includes

- Login screen with mock Student / Guard / Admin accounts
- Student portal with QR access card view
- Guard portal using device camera QR scanning
- Activity Logs page with filter controls and status summary
- Admin dashboard (mock data UI)

## Prerequisites

- Node 18+ / npm
- Expo CLI installed globally (optional)
- Android or iOS device/emulator

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the project

   ```bash
   npx expo start
   ```

3. Open on device/emulator

- Android: `a`
- iOS: `i`
- Web: `w`

> For the guard QR scanner, use a physical device or a simulator that supports camera permissions.

## Available scripts

- `npm start` — launch Expo development server
- `npm run android` — open on Android
- `npm run ios` — open on iOS
- `npm run web` — open on web
- `npm run lint` — run ESLint
- `npm run reset-project` — reset starter project structure

## Dev notes

- App routes live under `app/` with Expo Router file-based routing
- Screen components are in `app/screens/`
- Mock data and authentication are in `services/mockData.ts` and `services/authService.ts`
- Shared types are in `types/index.ts`

### Login credentials

- Student: `Student01` / `00000`
- Guard: `Guard01` / `00000`
- Admin: `admin01` / `00000`

## Contributing

1. Pull the latest changes from main:
   git checkout main
   git pull origin main

2. Create a feature branch:
   git checkout -b feature/your-feature-name

3. Make your changes and add them:
   git add .
   or
   git add specific-file.js

4. Commit your changes with a clear message:
   git commit -m "Brief description of what you changed"

5. Push your branch to GitHub:
   git push origin feature/your-feature-name

6. Open a Pull Request on GitHub:
   - Go to the repository on GitHub
   - Click "Pull requests" tab
   - Click "New pull request"
   - Set base: main and compare: feature/your-feature-name
   - Click "Create pull request"

7. Request a review from a team member

8. After getting 1 approval and no conflicts, merge the PR

9. Delete the feature branch (optional):
   git branch -d feature/your-feature-name

## Notes for other devs

- Keep the `app/` folder structure consistent with Expo Router
- Use `expo install expo-camera` for camera support
- Run `npx tsc --noEmit` before pushing to catch TypeScript issues
=======
# TimeIn-Timeout-System
A student attendance management system built with React Native and Expo. Allows students to check-in/check-out, tracks attendance records, and provides real-time monitoring of student presence.

