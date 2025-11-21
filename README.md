# BiometricExpoDemo

A cross‑platform (Android, iOS, Web) multi‑layer authentication demo built with React Native + Expo. It showcases device biometrics, custom PIN/password, and camera‑based face recognition with platform‑aware fallbacks and a clean, dark UI.

## Table of Contents
- Overview
- Feature Matrix
- Architecture
- Workflow (End‑to‑End)
- Key Screens
- Security Model and Considerations
- Platform Notes (Web vs Native)
- Important Code Snippets
- Project Structure
- Setup & Run
- Troubleshooting
- Roadmap / Production Hardening

---

## Overview
BiometricExpoDemo implements a progressive, multi‑factor flow where users must complete all enabled authentication layers before accessing a mock “Secure Vault.” On web, native biometrics are unavailable; the app adapts by enabling custom methods (PIN/Password/Face) and skipping system biometric.

## Feature Matrix
- System Biometric (native only): fingerprint / Face ID / device passcode using `expo-local-authentication`.
- Custom PIN: 4+ digits, setup + validation.
- Custom Password: 6+ chars, setup + validation.
- Face Recognition (demo): camera capture + simple matching placeholder. Native uses `expo-camera`; Web uses MediaStream + Canvas.
- Multi‑factor orchestration: user must complete all enabled layers.
- Platform adaptation: conditional imports and behaviors for Web vs Native.
- UI/UX: dark theme, clear statuses, modals for setup/auth, success/failure feedback, progress indicators.

## Architecture
- React Native (functional components + hooks).
- Expo SDK 54, RN 0.81.x, TypeScript strict.
- Conditional module loading for web safety (require at runtime only on native):
  - `expo-local-authentication`
  - `expo-camera` (Camera, CameraView)
- State buckets:
  - `currentScreen`: 'lock' | 'setup' | 'auth' | 'vault'
  - `enabledMethods`: which factors are on
  - `userCredentials`: pin/password/faceData (base64)
  - `completedMethods`: per‑factor completion flags
  - camera/permission states and web video/canvas refs

## Workflow (End‑to‑End)
1) Lock Screen
- Native: prompts system biometric; on success → Setup.
- Web: system biometric skipped → Setup.

2) Security Setup
- Toggle methods (PIN/Password/Face). Enabling opens a setup modal.
- PIN: enter + confirm; Password: enter + confirm; Face: capture image.

3) Authentication
- Lists only enabled methods. Each tile opens its auth modal.
- System biometric (native) or web fallback; PIN/Password inputs; Face: live camera authenticate (demo success).
- After each success, flag method as completed and check overall completion.

4) Vault
- When all enabled methods are completed, show the vault screen (mock balance) with option to lock (reset flow to Lock).

## Key Screens
- Lock: entry point; system unlock or web skip.
- Setup: enable factors, configure credentials, proceed.
- Auth: complete each enabled method; visual progress.
- Vault: success screen, lock out button.

## Security Model and Considerations
- Demo stores credentials in component state; base64 for face images. For production:
  - Use secure storage (Keychain/Keystore, SecureStore), never keep secrets in memory longer than needed.
  - Hash PIN/password (Argon2/bcrypt/scrypt) with salt.
  - Add rate limiting, lockout, re‑try backoff.
  - Face: replace placeholder with ML embeddings + thresholding + liveness (anti‑spoofing), possibly server‑side.
  - Audit logs; tokens/session management post‑auth.

## Platform Notes (Web vs Native)
- Web: `expo-local-authentication` unavailable → system biometric disabled; camera via `navigator.mediaDevices.getUserMedia`; capture via hidden <video> + <canvas>.
- Native: System biometric via `LocalAuthentication.authenticateAsync` and camera via `expo-camera` with `CameraView`.
- Conditional `require` used to avoid bundling native modules on web.

## Important Code Snippets

### Platform Detection & Safe Imports (App.tsx)
```ts
let LocalAuthentication: any = null;
let Camera: any = null;
let CameraView: any = null;

if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
  const cameraModule = require('expo-camera');
  Camera = cameraModule.Camera;
  CameraView = cameraModule.CameraView;
}
```

### State Layout (App.tsx)
```ts
const [currentScreen, setCurrentScreen] = useState<'lock'|'setup'|'auth'|'vault'>('lock');
const isWeb = Platform.OS === 'web';
const [enabledMethods, setEnabledMethods] = useState({
  systemBiometric: !isWeb,
  customPin: false,
  customPassword: false,
  customFace: false,
});
const [userCredentials, setUserCredentials] = useState({ pin: '', password: '', faceData: null as string|null });
const [completedMethods, setCompletedMethods] = useState({ systemBiometric:false, customPin:false, customPassword:false, customFace:false });
```

### System Biometric (Native) with Web Fallback
```ts
const performSystemAuth = async () => {
  if (isWeb || !LocalAuthentication) {
    if (currentScreen === 'lock') {
      setCurrentScreen('setup');
      Alert.alert('✅ Web Access!', 'System authentication skipped on web platform.');
    } else {
      setCompletedMethods(p => ({ ...p, systemBiometric: true }));
      checkAuthCompletion();
    }
    return;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: '🔐 System Authentication Required',
    subPromptMessage: "Use your device's security to continue",
    fallbackLabel: 'Use Device PIN',
    disableDeviceFallback: false,
  });
  if (result.success) {
    if (currentScreen === 'lock') setCurrentScreen('setup');
    else setCompletedMethods(p => ({ ...p, systemBiometric: true }));
    checkAuthCompletion();
  }
};
```

### Web Camera Start/Capture/Stop
```ts
const startWebCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  setWebStream(stream);
  setTimeout(() => { if (webVideoRef.current) webVideoRef.current.srcObject = stream; }, 100);
};

const captureWebImage = () => {
  const video = webVideoRef.current!;
  const canvas = webCanvasRef.current!;
  const ctx = canvas.getContext('2d')!;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const base64Image = canvas.toDataURL('image/jpeg', 0.7);
  const base64Data = base64Image.split(',')[1];
  setUserCredentials(p => ({ ...p, faceData: base64Data }));
  setEnabledMethods(p => ({ ...p, customFace: true }));
  stopWebCamera();
};

const stopWebCamera = () => {
  webStream?.getTracks().forEach(t => t.stop());
  setWebStream(null);
};
```

### Completion Gate
```ts
const checkAuthCompletion = () => {
  const required = Object.entries(enabledMethods).filter(([,e]) => e).map(([k]) => k);
  const done = Object.entries(completedMethods).filter(([,d]) => d).map(([k]) => k);
  const all = required.every(k => done.includes(k));
  if (all) { setCurrentScreen('vault'); Alert.alert('🎉 Access Granted!', 'All authentication layers completed!'); }
};
```

## Project Structure
```
BiometricExpoDemo/
├─ App.tsx                  # Web‑compatible, platform‑aware main app
├─ App-MultiLayer.tsx       # Mobile‑focused variant (always enables system biometric)
├─ index.ts                 # Expo entry
├─ app.json                 # Expo config (icons, splash, android/ios/web)
├─ package.json             # Dependencies (expo, camera, local-auth, etc.)
├─ tsconfig.json            # TS strict config
├─ assets/                  # Icons & splash
└─ README.md                # This file
```

## Setup & Run
- Prereqs: Node LTS, Expo CLI (`npm i -g expo`)
- Install deps: `npm install`
- Start:
  - General: `npm run start`
  - Android: `npm run android`
  - iOS: `npm run ios`
  - Web: `npm run web`

## Troubleshooting
- Web camera blocked → enable browser camera permission.
- Native camera denied → OS Settings > App > Camera permission.
- Biometric not available → ensure device has biometrics enrolled or fall back to PIN/Password.
- Metro cache issues → stop server, clear cache: `expo start -c`.

## Roadmap / Production Hardening
- Replace face demo with embeddings + liveness (TensorFlow.js or native MLKit).
- Secure storage for credentials; never keep plaintext in state.
- Server‑issued tokens + refresh flow; audit logs and anomaly detection.
- Rate limiting, lockout, alerts; SOC/monitoring hooks.
- E2E tests per platform; accessibility & localization.

---

© BiometricExpoDemo. For demo/educational purposes only; do not ship as‑is for production security use.
