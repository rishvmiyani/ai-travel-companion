import { create } from 'zustand';

export const useAppStore = create((set) => ({
  location: null,
  setLocation: (loc) => set({ location: loc }),
  
  mode: 'History',
  setMode: (newMode) => set({ mode: newMode }),
  
  isListening: true,
  toggleListening: () => set((state) => ({ isListening: !state.isListening })),
  
  currentStory: 'Waiting for GPS signal...',
  setCurrentStory: (story) => set({ currentStory: story }),
  
  isSpeaking: false,
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),

  b2bAdPlaying: false,
  setB2BAdPlaying: (isPlaying) => set({ b2bAdPlaying: isPlaying }),
  
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: (status) => set({ hasCompletedOnboarding: status }),
}));
