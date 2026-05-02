<<<<<<< HEAD
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

## Push workflow

1. Add and commit changes

   ```bash
   git add .
   git commit -m "Update activity screen layout and guard camera scanner"
   ```

2. Add remote if not existing

   ```bash
   git remote add origin https://github.com/Soleuss2/TimeIn-Timeout-System.git
   ```

3. Push to GitHub

   ```bash
   git push origin master
   ```

## Notes for other devs

- Keep the `app/` folder structure consistent with Expo Router
- Use `expo install expo-camera` for camera support
- Run `npx tsc --noEmit` before pushing to catch TypeScript issues
=======
# TimeIn-Timeout-System
A student attendance management system built with React Native and Expo. Allows students to check-in/check-out, tracks attendance records, and provides real-time monitoring of student presence.
>>>>>>> a98de34604a8e244d65a09982d804b1405dbad09
