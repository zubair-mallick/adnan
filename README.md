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

### Authentication Methods
- **System Biometric (native only)**: fingerprint / Face ID / device passcode using `expo-local-authentication`
- **Custom PIN**: 4+ digits with setup + validation, secure input masking
- **Custom Password**: 6+ characters with setup + validation, alphanumeric requirements
- **Face Recognition (demo)**: camera capture + simple matching placeholder. Native uses `expo-camera`; Web uses MediaStream + Canvas
- **Multi-factor orchestration**: user must complete all enabled layers in sequence
- **Platform adaptation**: conditional imports and behaviors for Web vs Native

### User Experience Features
- **Dark theme UI**: Professional dark color scheme (#1a1a2e) with color-coded status indicators
- **Progress tracking**: Real-time authentication completion status with visual feedback
- **Modal-driven workflows**: Clean setup and authentication modals with keyboard handling
- **Responsive design**: Adaptive layouts for various screen sizes and orientations
- **Emoji indicators**: Intuitive visual icons for different authentication states
- **Error handling**: Comprehensive error messages with recovery options
- **Success feedback**: Clear achievement notifications and confirmations

### Technical Implementation Features
- **TypeScript strict mode**: Type-safe development with comprehensive error checking
- **Functional components**: Modern React hooks-based architecture
- **Memory management**: Proper stream cleanup and resource management
- **Performance optimizations**: Lazy loading, conditional imports, ref management
- **Component modularization**: Reusable modal and screen components
- **State persistence**: Authentication state management across screen transitions

### Platform-Specific Capabilities
- **Native biometric detection**: Automatic identification of device capabilities
- **Web camera integration**: MediaStream API with Canvas processing for face capture
- **Permission management**: Dynamic camera and biometric permission requests
- **Fallback mechanisms**: Intelligent degradation when features are unavailable
- **Cross-platform deployment**: Single codebase for Android, iOS, and Web

## Architecture

### Core Technologies
- **React Native (functional components + hooks)**: Modern React patterns with useState, useEffect, useRef
- **Expo SDK 54**: Latest stable version with comprehensive feature set
- **React Native 0.81.x**: Native UI components and platform APIs
- **TypeScript strict mode**: Enhanced type safety and error prevention

### Cross-Platform Module Loading
- **Safe conditional imports**: Platform-specific modules loaded at runtime only on native platforms
  - `expo-local-authentication`: Biometric hardware integration
  - `expo-camera` (Camera, CameraView): Camera access and control
  - `expo-face-detector`: Facial recognition capabilities (imported but not actively used)
  - `expo-media-library`: Media storage and management
  - `expo-status-bar`: System UI customization

### State Management Architecture
- **`currentScreen`**: 'lock' | 'setup' | 'auth' | 'vault' - Navigation state management
- **`enabledMethods`**: Configuration object for active authentication factors
- **`userCredentials`**: Secure storage object (demo implementation)
  - `pin`: Numeric PIN code
  - `password`: Alphanumeric password
  - `faceData`: Base64 encoded facial image data
- **`completedMethods`**: Progress tracking for each authentication factor
- **Camera state management**: 
  - `hasPermission`: Camera permission status
  - `capturedImage`: Recently captured face image
  - `webStream`: Web video stream (MediaStream instance)
  - `isWebCameraActive`: Web camera active status
  - `cameraRef`, `webVideoRef`, `webCanvasRef`: DOM element references

### Component Structure
- **Main App Component**: Central authentication logic and screen routing
- **Modal System**: Dynamic modals for setup and authentication workflows
- **Screen Components**: Separate logical screens (Lock, Setup, Auth, Vault)
- **Platform Adaptation Layer**: Web vs Native behavior switching

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

## Configuration Reference

### app.json (Expo)
- `name`, `slug`, `version`: App identity
- `icon`, `splash`: Branding assets
- `android.adaptiveIcon`: Foreground/background color
- `android.edgeToEdgeEnabled`: Immersive UI
- `android.predictiveBackGestureEnabled`: Navigation control
- `ios.supportsTablet`: iPad support
- `web.favicon`: Web icon

### package.json (Scripts)
- `start`: Launch Expo dev server
- `android` / `ios` / `web`: Platform shortcuts

## API Surface (Internal)

### Screens
- `lock` → `setup` → `auth` → `vault` (via `currentScreen`)

### Methods
- `performSystemAuth()` → Native biometric prompt / web fallback
- `toggleAuthMethod(method)` → Enable/disable and open setup
- `setupPin()` / `setupPassword()` / `setupFaceRecognition()` → Configure factors
- `captureFaceImage()` / `captureWebImage()` → Enrollment capture
- `authenticateWithMethod('pin'|'password'|'face')` → Open auth modal
- `validatePin()` / `validatePassword()` / `validateFace()` → Verify inputs
- `checkAuthCompletion()` → Gatekeeper for vault access
- `closeModals()` → Reset modal/UI state

### State Contracts
- `enabledMethods`: { systemBiometric, customPin, customPassword, customFace }
- `completedMethods`: mirrors enabled keys with booleans
- `userCredentials`: { pin, password, faceData }

## Contribution Guide
- Fork and create a feature branch: `git checkout -b feat/your-feature`
- Run locally on all platforms you can (web + at least one mobile)
- Add tests where possible; keep styles and UX consistent
- Submit PR with a clear description and screenshots/GIFs

## Setup & Development

### Prerequisites
- **Node.js**: Latest LTS version recommended
- **Expo CLI**: `npm i -g expo`
- **Mobile Development**: Expo Go app (for testing) or physical device
- **Web Development**: Modern browser with camera support (Chrome, Firefox, Safari)

### Installation
```bash
# Clone or navigate to project directory
cd BiometricExpoDemo

# Install dependencies
npm install

# Start development server
npm run start
```

### Platform-Specific Running
- **General Development**: `npm run start` (opens Expo developer tools)
- **Android**: `npm run android` (requires Android Studio/SDK)
- **iOS**: `npm run ios` (requires Xcode on macOS)
- **Web**: `npm run web` (opens browser with development server)

### Development Tools
- **Expo Developer Tools**: Real-time device preview and debugging
- **Metro Bundler**: JavaScript bundling with hot reload
- **React Native Debugger**: Network/React component inspection
- **Browser DevTools**: Web platform debugging and performance profiling

## Detailed Troubleshooting

### Common Issues and Solutions

#### Web Platform Issues
- **Camera Access Blocked**:
  - Enable browser camera permissions in site settings
  - Use HTTPS (required for MediaStream API in most browsers)
  - Restart browser after permission changes

#### Native Platform Issues
- **Camera Permission Denied**:
  - Navigate to Settings > Apps > BiometricExpoDemo > Permissions > Camera
  - Toggle camera permission and restart app
  - Some Android versions may need Settings > Apps > Special app access > Camera access

#### Biometric Authentication Problems
- **Device Biometrics Not Recognized**:
  - Ensure fingerprint/Face ID is enrolled in device settings
  - Check device settings for biometric availability
  - Fallback to PIN/Password authentication methods

#### Development Environment Issues
- **Metro Cache Problems**:
  ```bash
  expo start -c  # Clear cache and restart
  npm start -- --reset-cache  # Alternative cache reset
  ```
- **Module Resolution Errors**:
  - Delete node_modules and reinstall: `rm -rf node_modules && npm install`
  - Check Expo CLI version compatibility
  - Verify TypeScript configuration

#### Performance Issues
- **Slow Camera Initialization**:
  - Web: Check browser console for MediaStream errors
  - Native: Verify camera hardware acceleration
  - Restart development server after long sessions

### Platform-Specific Limitations

#### Web Browser Compatibility
- **Safari**: May have stricter camera permission requirements
- **Firefox**: Different MediaStream API implementation considerations
- **Mobile Browsers**: Limited camera resolution and quality options

#### Native Device Considerations
- **Android**: Camera permission model varies by Android version
- **iOS**: More restrictive biometric authentication flows
- **Older Devices**: May lack sufficient camera resolution or biometric hardware

### Debug Mode Enhancements
- **Development Flags**: Enable detailed logging during development
- **Error Boundaries**: Graceful error handling for unexpected failures
- **Network Inspection**: Monitor API calls and data flow in development

## Roadmap / Production Hardening
- Replace face demo with embeddings + liveness (TensorFlow.js or native MLKit).
- Secure storage for credentials; never keep plaintext in state.
- Server‑issued tokens + refresh flow; audit logs and anomaly detection.
- Rate limiting, lockout, alerts; SOC/monitoring hooks.
- E2E tests per platform; accessibility & localization.
- Threat modeling and STRIDE analysis; DFDs for data movement
- Accessibility (WCAG 2.1 AA), localization/i18n
- CI/CD with lint, typecheck, tests, bundle size budgets

## Security Best Practices Checklist
- [ ] Store secrets in platform-secure storage only (Keychain/Keystore); never in Redux/state
- [ ] Hash PIN/password with Argon2/bcrypt/scrypt + per-user salt
- [ ] Implement exponential backoff and account lockout on repeated failures
- [ ] Use TLS everywhere; CSP and secure headers on web
- [ ] Add liveness detection for face to prevent spoofing (blink/motion/3D cues)
- [ ] Use ephemeral tokens with short TTL; rotate refresh tokens; bind to device
- [ ] Maintain audits (who/when/where), monitor anomalies
- [ ] Red-team/pentest regularly; dependency vulnerability scanning

---

© BiometricExpoDemo. For demo/educational purposes only; do not ship as‑is for production security use.
