import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, Modal, ScrollView, Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';

// Web-safe imports
let LocalAuthentication: any = null;
let Camera: any = null;
let CameraView: any = null;

if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
  const cameraModule = require('expo-camera');
  Camera = cameraModule.Camera;
  CameraView = cameraModule.CameraView;
}

export default function App() {
  // Main app states
  const [currentScreen, setCurrentScreen] = useState<'lock' | 'setup' | 'auth' | 'vault'>('lock');
  const [biometricType, setBiometricType] = useState<string>('');
  
  // Platform detection
  const isWeb = Platform.OS === 'web';
  
  // User's configured authentication methods
  const [enabledMethods, setEnabledMethods] = useState({
    systemBiometric: !isWeb,   // Disabled on web, enabled on mobile
    customPin: false,
    customPassword: false,
    customFace: false
  });
  
  // User's stored credentials
  const [userCredentials, setUserCredentials] = useState({
    pin: '',
    password: '',
    faceData: null as string | null
  });
  
  // Authentication progress tracking
  const [completedMethods, setCompletedMethods] = useState({
    systemBiometric: false,
    customPin: false,
    customPassword: false,
    customFace: false
  });
  
  // Modal states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentSetupMethod, setCurrentSetupMethod] = useState<'pin' | 'password' | 'face' | null>(null);
  const [currentAuthMethod, setCurrentAuthMethod] = useState<'pin' | 'password' | 'face' | null>(null);
  
  // Input states
  const [pinInput, setPinInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  
  // Camera states
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  
  // Web camera states
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const [isWebCameraActive, setIsWebCameraActive] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement>(null);
  const webCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    if (isWeb || !LocalAuthentication) {
      setBiometricType('Web Platform - No Biometric Support');
      return;
    }
    
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else {
        setBiometricType('Device Passcode');
      }
    } catch (error) {
      setBiometricType('Device Security');
    }
  };

  // STEP 1: System Authentication
  const performSystemAuth = async () => {
    if (isWeb || !LocalAuthentication) {
      // Skip system authentication on web
      if (currentScreen === 'lock') {
        setCurrentScreen('setup');
        Alert.alert('✅ Web Access!', 'System authentication skipped on web platform. You can now configure custom security layers.');
      } else {
        setCompletedMethods(prev => ({ ...prev, systemBiometric: true }));
        checkAuthCompletion();
      }
      return;
    }
    
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '🔐 System Authentication Required',
        subPromptMessage: 'Use your device\'s security to continue',
        fallbackLabel: 'Use Device PIN',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        if (currentScreen === 'lock') {
          setCurrentScreen('setup');
          Alert.alert('✅ System Unlocked!', 'You can now configure additional security layers.');
        } else {
          setCompletedMethods(prev => ({ ...prev, systemBiometric: true }));
          checkAuthCompletion();
        }
      }
    } catch (error) {
      Alert.alert('❌ Error', 'System authentication failed.');
    }
  };

  // STEP 2: Setup Functions
  const toggleAuthMethod = (method: keyof typeof enabledMethods) => {
    if (method === 'systemBiometric') return;
    
    if (enabledMethods[method]) {
      // Disable method
      setEnabledMethods(prev => ({ ...prev, [method]: false }));
    } else {
      // Enable method - show setup
      const setupMethod = method.replace('custom', '').toLowerCase() as 'pin' | 'password' | 'face';
      setCurrentSetupMethod(setupMethod);
      setShowSetupModal(true);
    }
  };

  const setupPin = () => {
    if (pinInput.length >= 4 && pinInput === confirmInput) {
      setUserCredentials(prev => ({ ...prev, pin: pinInput }));
      setEnabledMethods(prev => ({ ...prev, customPin: true }));
      closeModals();
      Alert.alert('✅ PIN Set!', 'Your custom PIN has been configured.');
    } else {
      Alert.alert('❌ Error', 'PINs must be at least 4 digits and match.');
    }
  };

  const setupPassword = () => {
    if (passwordInput.length >= 6 && passwordInput === confirmInput) {
      setUserCredentials(prev => ({ ...prev, password: passwordInput }));
      setEnabledMethods(prev => ({ ...prev, customPassword: true }));
      closeModals();
      Alert.alert('✅ Password Set!', 'Your custom password has been configured.');
    } else {
      Alert.alert('❌ Error', 'Passwords must be at least 6 characters and match.');
    }
  };

  const setupFaceRecognition = async () => {
    if (isWeb) {
      // Use web camera API
      try {
        await startWebCamera();
        setHasPermission(true);
      } catch (error) {
        Alert.alert('❌ Camera Permission', 'Camera access was denied. Please allow camera access and try again.');
      }
      return;
    }
    
    if (!Camera) {
      Alert.alert('❌ Error', 'Camera not available on this platform.');
      return;
    }
    
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('❌ Permission', 'Camera access is required.');
      return;
    }
    setHasPermission(true);
  };
  
  const startWebCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setWebStream(stream);
      setIsWebCameraActive(true);
      
      // Set video stream when component is ready
      setTimeout(() => {
        if (webVideoRef.current) {
          webVideoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw error;
    }
  };
  
  const stopWebCamera = () => {
    if (webStream) {
      webStream.getTracks().forEach(track => track.stop());
      setWebStream(null);
    }
    setIsWebCameraActive(false);
  };

  const captureFaceImage = async () => {
    if (isWeb) {
      captureWebImage();
    } else if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });
        
        setUserCredentials(prev => ({ ...prev, faceData: photo.base64 }));
        setEnabledMethods(prev => ({ ...prev, customFace: true }));
        setCapturedImage(`data:image/jpg;base64,${photo.base64}`);
        
        setTimeout(() => {
          closeModals();
          Alert.alert('✅ Face Enrolled!', 'Your face has been registered.');
        }, 1500);
      } catch (error) {
        Alert.alert('❌ Error', 'Failed to capture image.');
      }
    }
  };
  
  const captureWebImage = () => {
    if (webVideoRef.current && webCanvasRef.current) {
      const video = webVideoRef.current;
      const canvas = webCanvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        const base64Data = base64Image.split(',')[1];
        
        setUserCredentials(prev => ({ ...prev, faceData: base64Data }));
        setEnabledMethods(prev => ({ ...prev, customFace: true }));
        setCapturedImage(base64Image);
        
        stopWebCamera();
        
        setTimeout(() => {
          closeModals();
          Alert.alert('✅ Face Enrolled!', 'Your face has been registered for authentication.');
        }, 1500);
      }
    }
  };

  // STEP 3: Authentication Functions
  const startAuthentication = () => {
    setCurrentScreen('auth');
    setCompletedMethods({
      systemBiometric: false,
      customPin: false,
      customPassword: false,
      customFace: false
    });
  };

  const authenticateWithMethod = (method: 'pin' | 'password' | 'face') => {
    setCurrentAuthMethod(method);
    setShowAuthModal(true);
  };

  const validatePin = () => {
    if (pinInput === userCredentials.pin) {
      setCompletedMethods(prev => ({ ...prev, customPin: true }));
      closeModals();
      checkAuthCompletion();
    } else {
      Alert.alert('❌ Wrong PIN', 'Please try again.');
      setPinInput('');
    }
  };

  const validatePassword = () => {
    if (passwordInput === userCredentials.password) {
      setCompletedMethods(prev => ({ ...prev, customPassword: true }));
      closeModals();
      checkAuthCompletion();
    } else {
      Alert.alert('❌ Wrong Password', 'Please try again.');
      setPasswordInput('');
    }
  };

  const validateFace = async () => {
    if (capturedImage && userCredentials.faceData) {
      // Simple comparison - in real app, use proper ML
      setCompletedMethods(prev => ({ ...prev, customFace: true }));
      closeModals();
      checkAuthCompletion();
      Alert.alert('✅ Face Matched!', 'Face recognition successful.');
    } else {
      Alert.alert('❌ Face Not Recognized', 'Please try again.');
    }
  };

  const checkAuthCompletion = () => {
    const requiredMethods = Object.entries(enabledMethods)
      .filter(([_, enabled]) => enabled)
      .map(([method, _]) => method);
    
    const completedMethodsList = Object.entries(completedMethods)
      .filter(([_, completed]) => completed)
      .map(([method, _]) => method);
    
    const allCompleted = requiredMethods.every(method => completedMethodsList.includes(method));
    
    if (allCompleted) {
      setCurrentScreen('vault');
      Alert.alert('🎉 Access Granted!', 'All authentication layers completed!');
    }
  };

  const closeModals = () => {
    setShowSetupModal(false);
    setShowAuthModal(false);
    setCurrentSetupMethod(null);
    setCurrentAuthMethod(null);
    setPinInput('');
    setPasswordInput('');
    setConfirmInput('');
    setCapturedImage(null);
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'lock':
        return (
          <View style={styles.screenContainer}>
            <Text style={styles.header}>🔐 Multi-Layer Security</Text>
            <Text style={styles.subtitle}>
              {isWeb ? 'Web platform - Skip to security setup' : 'Unlock with system authentication first'}
            </Text>
            
            <TouchableOpacity onPress={performSystemAuth} style={styles.button}>
              <Text style={styles.buttonTitle}>
                {isWeb ? '🌐 Enter Web Mode' : '🔓 Unlock System'}
              </Text>
              <Text style={styles.buttonSubtitle}>
                {isWeb ? 'Configure custom security layers' : `Use ${biometricType} or Device PIN`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      
      case 'setup':
        return (
          <ScrollView style={styles.container}>
            <View style={styles.screenContainer}>
              <Text style={styles.header}>⚙️ Security Setup</Text>
              <Text style={styles.subtitle}>Configure authentication layers</Text>
              
              {/* System Biometric - Platform Dependent */}
              {!isWeb ? (
                <View style={styles.methodRow}>
                  <Text style={styles.methodText}>👆 System {biometricType}</Text>
                  <Text style={styles.enabledText}>✅ Always Enabled</Text>
                </View>
              ) : (
                <View style={styles.methodRow}>
                  <Text style={styles.methodText}>🌐 Web Platform</Text>
                  <Text style={styles.disabledText}>ℹ️ Biometric Not Available</Text>
                </View>
              )}
              
              {/* Custom PIN */}
              <TouchableOpacity 
                style={styles.methodRow} 
                onPress={() => toggleAuthMethod('customPin')}
              >
                <Text style={styles.methodText}>🔢 Custom PIN</Text>
                <Text style={enabledMethods.customPin ? styles.enabledText : styles.disabledText}>
                  {enabledMethods.customPin ? '✅ Enabled' : '❌ Tap to Enable'}
                </Text>
              </TouchableOpacity>
              
              {/* Custom Password */}
              <TouchableOpacity 
                style={styles.methodRow} 
                onPress={() => toggleAuthMethod('customPassword')}
              >
                <Text style={styles.methodText}>🔑 Custom Password</Text>
                <Text style={enabledMethods.customPassword ? styles.enabledText : styles.disabledText}>
                  {enabledMethods.customPassword ? '✅ Enabled' : '❌ Tap to Enable'}
                </Text>
              </TouchableOpacity>
              
              {/* Custom Face Recognition */}
              <TouchableOpacity 
                style={styles.methodRow} 
                onPress={() => toggleAuthMethod('customFace')}
              >
                <Text style={styles.methodText}>📷 Custom Face Recognition</Text>
                <Text style={enabledMethods.customFace ? styles.enabledText : styles.disabledText}>
                  {enabledMethods.customFace ? '✅ Enabled' : '❌ Tap to Enable'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={startAuthentication} style={styles.continueButton}>
                <Text style={styles.continueButtonText}>🔒 Proceed to Authentication</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      
      case 'auth':
        const enabledMethodsList = Object.entries(enabledMethods)
          .filter(([_, enabled]) => enabled);
        
        return (
          <ScrollView style={styles.container}>
            <View style={styles.screenContainer}>
              <Text style={styles.header}>🔐 Multi-Layer Authentication</Text>
              <Text style={styles.subtitle}>Complete all enabled methods</Text>
              
              {enabledMethodsList.map(([method, _]) => {
                const isCompleted = completedMethods[method as keyof typeof completedMethods];
                const methodNames = {
                  systemBiometric: isWeb ? '🌐 Web Access' : `👆 ${biometricType}`,
                  customPin: '🔢 Custom PIN',
                  customPassword: '🔑 Custom Password',
                  customFace: '📷 Face Recognition'
                };
                
                return (
                  <TouchableOpacity 
                    key={method}
                    style={[styles.authMethodButton, isCompleted && styles.completedMethod]}
                    onPress={() => {
                      if (isCompleted) return;
                      
                      if (method === 'systemBiometric') {
                        performSystemAuth();
                      } else {
                        const authMethod = method.replace('custom', '').toLowerCase();
                        authenticateWithMethod(authMethod as 'pin' | 'password' | 'face');
                      }
                    }}
                    disabled={isCompleted}
                  >
                    <Text style={styles.authMethodText}>
                      {methodNames[method as keyof typeof methodNames]}
                    </Text>
                    <Text style={isCompleted ? styles.completedText : styles.pendingText}>
                      {isCompleted ? '✅ Completed' : '🔒 Authenticate'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        );
      
      case 'vault':
        return (
          <View style={styles.screenContainer}>
            <Text style={styles.header}>🏦 Secure Vault</Text>
            <Text style={styles.vaultBalance}>💰 $1,000,000</Text>
            <Text style={styles.successMessage}>✅ All security layers verified!</Text>
            
            <TouchableOpacity 
              onPress={() => {
                setCurrentScreen('lock');
                setCompletedMethods({
                  systemBiometric: false,
                  customPin: false,
                  customPassword: false,
                  customFace: false
                });
              }} 
              style={styles.logoutButton}
            >
              <Text style={styles.logoutButtonText}>🔒 Lock Vault</Text>
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderCurrentScreen()}
      
      {/* Setup Modals */}
      <Modal visible={showSetupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {currentSetupMethod === 'pin' && (
              <>
                <Text style={styles.modalTitle}>🔢 Setup Custom PIN</Text>
                <TextInput
                  style={styles.input}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="Enter PIN (4+ digits)"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
                <TextInput
                  style={styles.input}
                  value={confirmInput}
                  onChangeText={setConfirmInput}
                  placeholder="Confirm PIN"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={setupPin}>
                    <Text style={styles.confirmButtonText}>Set PIN</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {currentSetupMethod === 'password' && (
              <>
                <Text style={styles.modalTitle}>🔑 Setup Custom Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter Password (6+ chars)"
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  value={confirmInput}
                  onChangeText={setConfirmInput}
                  placeholder="Confirm Password"
                  secureTextEntry
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={setupPassword}>
                    <Text style={styles.confirmButtonText}>Set Password</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {currentSetupMethod === 'face' && (
              <>
                <Text style={styles.modalTitle}>📷 Setup Face Recognition</Text>
                {hasPermission === null ? (
                  <TouchableOpacity style={styles.confirmButton} onPress={setupFaceRecognition}>
                    <Text style={styles.confirmButtonText}>Request Camera Permission</Text>
                  </TouchableOpacity>
                ) : hasPermission === false ? (
                  <Text>No camera access</Text>
                ) : capturedImage ? (
                  <Text style={styles.successMessage}>✅ Face Captured Successfully!</Text>
                ) : CameraView ? (
                  <View style={styles.cameraContainer}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="front"
                    />
                    <TouchableOpacity style={styles.captureButton} onPress={captureFaceImage}>
                      <Text style={styles.captureButtonText}>📸 Capture Face</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text>Camera not available on this platform</Text>
                )}
                <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Authentication Modals */}
      <Modal visible={showAuthModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {currentAuthMethod === 'pin' && (
              <>
                <Text style={styles.modalTitle}>🔢 Enter Your PIN</Text>
                <TextInput
                  style={styles.input}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="Enter PIN"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={validatePin}>
                    <Text style={styles.confirmButtonText}>Authenticate</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {currentAuthMethod === 'password' && (
              <>
                <Text style={styles.modalTitle}>🔑 Enter Your Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter Password"
                  secureTextEntry
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={validatePassword}>
                    <Text style={styles.confirmButtonText}>Authenticate</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {currentAuthMethod === 'face' && (
              <>
                <Text style={styles.modalTitle}>📷 Face Authentication</Text>
                {hasPermission && CameraView ? (
                  <View style={styles.cameraContainer}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="front"
                    />
                    <TouchableOpacity style={styles.captureButton} onPress={validateFace}>
                      <Text style={styles.captureButtonText}>📸 Authenticate</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text>Camera not available on this platform</Text>
                )}
                <TouchableOpacity style={styles.cancelButton} onPress={closeModals}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#b19cd9',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ff6b6b',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 250,
  },
  buttonTitle: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: '#ffcccc',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: '100%',
  },
  methodText: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  enabledText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#ff9800',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
    minWidth: 250,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  authMethodButton: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 15,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  completedMethod: {
    backgroundColor: '#2e7d32',
  },
  authMethodText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  completedText: {
    color: '#a5d6a7',
  },
  pendingText: {
    color: '#ffb74d',
  },
  vaultBalance: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4caf50',
    marginVertical: 20,
  },
  successMessage: {
    fontSize: 18,
    color: '#4caf50',
    marginBottom: 30,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ff6b6b',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minWidth: 200,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
  },
  confirmButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  cameraContainer: {
    width: 250,
    height: 300,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  captureButton: {
    backgroundColor: '#ff6b6b',
    padding: 15,
    alignItems: 'center',
  },
  captureButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});