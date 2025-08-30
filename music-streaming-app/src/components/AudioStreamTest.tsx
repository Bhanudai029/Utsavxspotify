import { useState } from 'react'

export default function AudioStreamTest() {
  const [currentSong, setCurrentSong] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Using the exact same URL from your working test
  const songs = [
    {
      url: "https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/Baby%20Shark%20Dance.mp3",
      title: "Baby Shark Dance"
    }
  ]

  const addDebugInfo = (info: string) => {
    console.log(info)
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
  }

  const handlePlaySong = async (url: string) => {
    addDebugInfo('Button clicked!')
    setIsLoading(true)
    
    try {
      addDebugInfo(`Setting current song to: ${url}`)
      setCurrentSong(url)
      addDebugInfo('Current song state updated')
    } catch (error) {
      addDebugInfo(`Error loading song: ${error}`)
      console.error('Error loading song:', error)
    } finally {
      setIsLoading(false)
      addDebugInfo('Loading finished')
    }
  }

  const testDirectAudio = () => {
    addDebugInfo('Testing direct Audio() object...')
    const audio = new Audio(songs[0].url)
    
    audio.addEventListener('loadstart', () => addDebugInfo('Audio loadstart event'))
    audio.addEventListener('canplay', () => addDebugInfo('Audio canplay event'))
    audio.addEventListener('error', (e) => addDebugInfo(`Audio error: ${e.type}`))
    
    audio.play()
      .then(() => addDebugInfo('Direct Audio().play() succeeded!'))
      .catch((err) => addDebugInfo(`Direct Audio().play() failed: ${err.message}`))
  }

  return (
    <div className="p-6 bg-spotify-black text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">🎵 Baby Shark Audio Debug Test</h2>
      
      <div className="mb-6">
        {songs.map((song, i) => (
          <div key={i} className="mb-4">
            <button 
              onClick={() => handlePlaySong(song.url)}
              disabled={isLoading}
              className="bg-spotify-green text-black px-6 py-3 rounded-full font-medium hover:scale-105 transition-transform disabled:opacity-50 mr-4"
            >
              {isLoading ? 'Loading...' : `🎶 Play ${song.title}`}
            </button>
            
            <button 
              onClick={testDirectAudio}
              className="bg-blue-500 text-white px-6 py-3 rounded-full font-medium hover:scale-105 transition-transform"
            >
              🔊 Test Direct Audio
            </button>
          </div>
        ))}
      </div>

      {/* Always show the audio element for testing */}
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3">Audio Element Test:</h3>
        <audio 
          controls 
          src={songs[0].url}
          className="w-full max-w-md mb-4"
          onLoadStart={() => addDebugInfo('Audio element: loadstart')}
          onCanPlay={() => addDebugInfo('Audio element: canplay')}
          onPlay={() => addDebugInfo('Audio element: play started')}
          onError={(e) => addDebugInfo(`Audio element error: ${e.type}`)}
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      {currentSong && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Auto-Playing Audio:</h3>
          <audio 
            controls 
            autoPlay 
            src={currentSong}
            className="w-full max-w-md"
            onLoadStart={() => addDebugInfo('AutoPlay audio: loadstart')}
            onCanPlay={() => addDebugInfo('AutoPlay audio: canplay')}
            onPlay={() => addDebugInfo('AutoPlay audio: play started')}
            onError={(e) => addDebugInfo(`AutoPlay audio error: ${e.type}`)}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3">Debug Info:</h3>
        <div className="bg-gray-800 p-4 rounded text-sm max-h-40 overflow-y-auto">
          {debugInfo.length === 0 ? (
            <p className="text-gray-400">No debug info yet. Click a button to start testing.</p>
          ) : (
            debugInfo.map((info, idx) => (
              <div key={idx} className="mb-1">{info}</div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-4">
        <p className="text-sm text-spotify-light-gray">
          Audio URL: <br />
          <code className="text-xs bg-spotify-gray p-1 rounded break-all">{songs[0].url}</code>
        </p>
      </div>
    </div>
  )
}