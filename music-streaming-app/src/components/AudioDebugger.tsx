import React, { useState, useEffect } from 'react';
import { useMusicPlayer } from '../App';

const AudioDebugger: React.FC = () => {
  const { currentTrack, isPlaying } = useMusicPlayer();
  const [showDebug, setShowDebug] = useState(false);
  const [audioState, setAudioState] = useState({
    readyState: 0,
    networkState: 0,
    error: null as MediaError | null,
    src: '',
    currentTime: 0,
    duration: 0,
    paused: true,
    ended: false
  });

  useEffect(() => {
    // Find the audio element (it's created in App.tsx)
    const audio = document.querySelector('audio') as HTMLAudioElement;
    if (audio) {
      
      const updateState = () => {
        setAudioState({
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
          src: audio.src,
          currentTime: audio.currentTime,
          duration: audio.duration,
          paused: audio.paused,
          ended: audio.ended
        });
      };

      // Update state periodically
      const interval = setInterval(updateState, 1000);
      
      // Update on events
      const events = ['loadstart', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'stalled', 'waiting'];
      events.forEach(event => {
        audio.addEventListener(event, updateState);
      });

      return () => {
        clearInterval(interval);
        events.forEach(event => {
          audio.removeEventListener(event, updateState);
        });
      };
    }
  }, []);

  const getReadyStateText = (state: number) => {
    switch (state) {
      case 0: return 'HAVE_NOTHING';
      case 1: return 'HAVE_METADATA';
      case 2: return 'HAVE_CURRENT_DATA';
      case 3: return 'HAVE_FUTURE_DATA';
      case 4: return 'HAVE_ENOUGH_DATA';
      default: return 'UNKNOWN';
    }
  };

  const getNetworkStateText = (state: number) => {
    switch (state) {
      case 0: return 'NETWORK_EMPTY';
      case 1: return 'NETWORK_IDLE';
      case 2: return 'NETWORK_LOADING';
      case 3: return 'NETWORK_NO_SOURCE';
      default: return 'UNKNOWN';
    }
  };

  if (!showDebug) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowDebug(true)}
          className="bg-red-600 text-white px-3 py-1 rounded text-xs font-mono hover:bg-red-700"
        >
          Debug Audio
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-sm text-xs font-mono">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-yellow-400">Audio Debug</h3>
        <button
          onClick={() => setShowDebug(false)}
          className="text-red-400 hover:text-red-300"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <span className="text-green-400">Track:</span> {currentTrack?.name || 'None'}
        </div>
        <div>
          <span className="text-green-400">Artist:</span> {currentTrack?.artist || 'None'}
        </div>
        <div>
          <span className="text-green-400">Playing:</span> {isPlaying ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="text-green-400">Audio Paused:</span> {audioState.paused ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="text-green-400">Ready State:</span> {getReadyStateText(audioState.readyState)}
        </div>
        <div>
          <span className="text-green-400">Network State:</span> {getNetworkStateText(audioState.networkState)}
        </div>
        <div>
          <span className="text-green-400">Error:</span> {audioState.error ? audioState.error.message : 'None'}
        </div>
        <div>
          <span className="text-green-400">Time:</span> {audioState.currentTime.toFixed(1)}s / {audioState.duration.toFixed(1)}s
        </div>
        <div>
          <span className="text-green-400">Source:</span> 
          <div className="text-xs text-gray-300 break-all mt-1">
            {audioState.src || 'No source'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioDebugger;