import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { generateStoryFromLocation, askQuestionAboutStory } from './StoryService';
import { checkForGeofencedAds, MarketingCompanion } from './GeofenceService';
import { useAppStore } from './store';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const { location, setLocation, mode, setMode, isListening, toggleListening, currentStory, setCurrentStory, isSpeaking, setIsSpeaking, hasCompletedOnboarding, setHasCompletedOnboarding } = useAppStore();
  
  // Phase 5: Onboarding Flow State
  const [onboardingStep, setOnboardingStep] = useState(0);

  // State for Custom User Tips & Ask AI
  const [isTipModalVisible, setTipModalVisible] = useState(false);
  const [userTip, setUserTip] = useState('');
  const [isAskModalVisible, setAskModalVisible] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  
  // Phase 5: Trip Planning
  const [isTripModalVisible, setTripModalVisible] = useState(false);
  const [destination, setDestination] = useState('');
  const [activeDestination, setActiveDestination] = useState(null);
  
  // Animation for the AI "speaking" pulse effect
  const pulseAnim = useRef(new Animated.Value(1)).current;



  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      Animated.timing(pulseAnim).stop();
    }
  }, [isSpeaking]);

  useEffect(() => {
    let subscription = null;
    
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentStory('Permission to access location was denied');
        return;
      }

      if (isListening) {
        setCurrentStory('Acquiring high-precision GPS lock...');
        try {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLocation(loc);
          handleLocationTrigger(loc.coords.latitude, loc.coords.longitude, mode, loc.coords.speed || 0, activeDestination);
        } catch (err) {
          console.warn(err);
          setCurrentStory('Location unavailable. Please make sure GPS/Location services are enabled.');
        }
      }
    })();

    return () => {
      if (subscription) subscription.remove();
      Speech.stop();
    };
  }, [mode, isListening, activeDestination]);

  const handleLocationTrigger = async (lat, lng, currentMode, speed = 0, currentDestination = null) => {
    setCurrentStory('Scanning area and generating narrative...');
    setIsSpeaking(false);
    Speech.stop();
    
    // 1. Generate core story from Groq AI
    let storyText = await generateStoryFromLocation(lat, lng, currentMode, speed, currentDestination);
    
    // 2. Open Audio Ad Platform - Intercept and inject native targeted campaigns
    const adCopy = checkForGeofencedAds(lat, lng, currentMode);
    if (adCopy) {
      storyText += ` ${adCopy}`;
    }

    setCurrentStory(storyText);
    
    // 3. Trigger Text-To-Speech (TTS) engine
    setIsSpeaking(true);
    Speech.speak(storyText, {
      language: 'en-US',
      pitch: 1.1, // Slightly higher pitch for clarity over road noise
      rate: 0.9,  // Slightly slower for perfect pronunciation
      volume: 1.0, // Max volume (if supported by OS)
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    Speech.stop();
    setIsSpeaking(false);
  };

  const renderOnboarding = () => {
    const screens = [
      { title: "Welcome to Voyage AI", sub: "Your Context-Aware Travel Companion." },
      { title: "Eyes on the Road", sub: "No reading required. We dynamically narrate the world around you based on your speed and location." },
      { title: "Crowdsourced Secrets", sub: "Discover hidden gems, drop your own local tips, and ask the AI follow-up questions via voice!" }
    ];
    
    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center', padding: 24}]}>
        <View style={styles.waveformInner} />
        <Text style={[styles.heroTitle, {fontSize: 28, marginBottom: 12}]}>{screens[onboardingStep].title}</Text>
        <Text style={[styles.storyText, {marginBottom: 48}]}>{screens[onboardingStep].sub}</Text>
        
        <TouchableOpacity 
          style={styles.modalBtnSubmit}
          onPress={() => {
            if (onboardingStep < 2) {
              setOnboardingStep(prev => prev + 1);
            } else {
              setHasCompletedOnboarding(true);
            }
          }}
        >
          <Text style={{color: '#000', fontWeight: 'bold', fontSize: 18}}>
            {onboardingStep < 2 ? "Next" : "Start Driving 🚀"}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  };

  if (!hasCompletedOnboarding) {
    return renderOnboarding();
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar: Minimal Status & Trip Planner */}
      <View style={styles.topBar}>
        <View style={styles.statusGroup}>
          <View style={[styles.statusDot, { backgroundColor: isListening ? '#BB86FC' : '#F44336' }]} />
          <Text style={styles.statusText}>{isListening ? 'GPS Active' : 'Offline'}</Text>
        </View>
        <TouchableOpacity style={styles.destinationBtn} onPress={() => setTripModalVisible(true)}>
          <Text style={styles.destinationBtnText} numberOfLines={1}>
            {activeDestination ? `Navigating to: ${activeDestination}` : 'Set Destination 📍'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero Center: Waveform & Encapsulated Text Box */}
      <View style={styles.heroCenter}>
        <Animated.View style={[styles.waveformCircle, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.waveformInner} />
        
        <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
          {isSpeaking ? 'Narrating...' : (isListening ? 'Scanning area...' : 'System Paused')}
        </Text>

        {/* Live Story Text Display - Encapsulated inside ScrollView */}
        <View style={styles.textContainer}>
          <ScrollView style={{maxHeight: 120}} showsVerticalScrollIndicator={true}>
            <Text style={styles.storyText}>{currentStory || "Select a mode and start driving to hear local stories!"}</Text>
          </ScrollView>
        </View>
      </View>

      {/* Bottom Bar: Huge Hit Targets & Encapsulated Chips */}
      <View style={styles.bottomBar}>
        {/* Persona Chips - Encapsulated horizontally */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {['History', 'Food', 'Legends', 'Scenic'].map((m) => (
            <TouchableOpacity 
              key={m} 
              style={[styles.chip, mode === m && styles.chipActive]}
              onPress={() => toggleMode(m)}
            >
              <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Huge Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={[styles.bigBtn, styles.btnSecondary]} onPress={toggleListening}>
            <Text style={styles.bigBtnText}>{isListening ? 'PAUSE' : 'RESUME'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bigBtn, styles.btnSecondary, {backgroundColor: '#2C2C2C'}]} onPress={() => { Speech.stop(); setAskModalVisible(true); }}>
            <Text style={styles.bigBtnText}>ASK 🎤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bigBtn, styles.btnPrimary]} onPress={() => Speech.stop()}>
            <Text style={[styles.bigBtnText, {color: '#000'}]}>SKIP ⏭</Text>
          </TouchableOpacity>
        </View>

        {/* Community Fact & Review Drop */}
        <TouchableOpacity 
          style={{marginTop: 16, backgroundColor: '#BB86FC', padding: 16, borderRadius: 12, alignItems: 'center'}}
          onPress={() => setTipModalVisible(true)}
        >
          <Text style={{color: '#000', fontWeight: 'bold', fontSize: 16}}>Drop Local Tip / Fact 📍</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for User Input */}
      <Modal visible={isTipModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Leave a Local Tip</Text>
            <Text style={styles.modalSub}>Help train our model! Leave a fact about this exact location.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Try the spicy noodles here!"
              placeholderTextColor="#555"
              value={userTip}
              onChangeText={setUserTip}
              multiline
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setTipModalVisible(false)}>
                <Text style={{color: '#FFF'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnSubmit} 
                onPress={() => {
                  if(!location) {
                    alert("GPS required."); return;
                  }
                  if(!userTip.trim()) {
                    alert("Please enter a tip."); return;
                  }
                  MarketingCompanion.createCampaign(
                    'Local_Traveler', location.coords.latitude, location.coords.longitude, 10000, mode, 
                    `A local traveler just left this tip here: "${userTip}"`
                  );
                  setTipModalVisible(false);
                  setUserTip('');
                  alert("Tip saved! The next person who drives here will hear it.");
                }}
              >
                <Text style={{color: '#000', fontWeight: 'bold'}}>Save Tip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Ask AI */}
      <Modal visible={isAskModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ask AI</Text>
            <Text style={styles.modalSub}>Have a question about the last story?</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. What year was that built?"
              placeholderTextColor="#555"
              value={userQuestion}
              onChangeText={setUserQuestion}
              multiline
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setAskModalVisible(false)}>
                <Text style={{color: '#FFF'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnSubmit} 
                onPress={async () => {
                  if(!userQuestion.trim()) return;
                  const question = userQuestion;
                  setAskModalVisible(false);
                  setUserQuestion('');
                  
                  setCurrentStory(`Thinking about: "${question}"...`);
                  setIsSpeaking(true);
                  
                  try {
                    const lat = location?.coords?.latitude;
                    const lng = location?.coords?.longitude;
                    const answer = await askQuestionAboutStory(currentStory, question, lat, lng);
                    setCurrentStory(answer);
                    Speech.speak(answer, { pitch: 1.1, rate: 0.9 });
                  } catch(e) {
                    setCurrentStory("Sorry, I couldn't find the answer right now.");
                  }
                }}
              >
                <Text style={{color: '#000', fontWeight: 'bold'}}>Ask</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Trip Planner */}
      <Modal visible={isTripModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Trip Planner</Text>
            <Text style={styles.modalSub}>Where are we heading today?</Text>
            
            <TextInput
              style={[styles.modalInput, {minHeight: 50}]}
              placeholder="e.g. Grand Canyon, AZ"
              placeholderTextColor="#555"
              value={destination}
              onChangeText={setDestination}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setTripModalVisible(false)}>
                <Text style={{color: '#FFF'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnSubmit} 
                onPress={() => {
                  if(!destination.trim()) return;
                  setActiveDestination(destination);
                  setTripModalVisible(false);
                  
                  setCurrentStory(`Route locked: Heading to ${destination}. Enjoy the ride!`);
                  Speech.speak(`Route locked. We are now navigating towards ${destination}.`, { pitch: 1.1, rate: 0.9 });
                }}
              >
                <Text style={{color: '#000', fontWeight: 'bold'}}>Set Route</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0F13',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    alignItems: 'center',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12, height: 12, borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  etaText: {
    color: '#A0A0A0',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  destinationBtn: {
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 150,
  },
  destinationBtnText: {
    color: '#BB86FC',
    fontWeight: 'bold',
    fontSize: 12,
  },
  heroCenter: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  waveformCircle: {
    position: 'absolute',
    top: 0,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(187, 134, 252, 0.2)',
  },
  waveformInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#BB86FC',
    marginTop: 20,
    marginBottom: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
  },
  textContainer: {
    backgroundColor: '#16181F',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  storyText: {
    color: '#E0E0E0',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomBar: {
    padding: 24,
    paddingBottom: 48,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#16181F',
    margin: 4,
  },
  chipActive: {
    backgroundColor: '#BB86FC',
  },
  chipText: {
    color: '#A0A0A0',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#000',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bigBtn: {
    flex: 1,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 8,
  },
  btnSecondary: {
    backgroundColor: '#16181F',
  },
  btnPrimary: {
    backgroundColor: '#BB86FC',
  },
  bigBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  modalContent: {
    backgroundColor: '#1E1E1E', 
    padding: 24, 
    borderRadius: 20, 
    width: '85%', 
    borderWidth: 1, 
    borderColor: '#333'
  },
  modalTitle: {
    color: '#BB86FC', 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 8
  },
  modalSub: {
    color: '#A0A0A0', 
    fontSize: 14, 
    marginBottom: 16
  },
  modalInput: {
    backgroundColor: '#121212', 
    color: '#FFF', 
    borderRadius: 12, 
    padding: 16, 
    minHeight: 100, 
    textAlignVertical: 'top', 
    borderWidth: 1, 
    borderColor: '#333', 
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  modalBtnCancel: {
    padding: 12, 
    marginRight: 16
  },
  modalBtnSubmit: {
    backgroundColor: '#BB86FC', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 24
  }
});
