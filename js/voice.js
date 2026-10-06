function initVoice(textField, micBtn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    return {
      isSupported: false,
      start: () => { alert("Speech recognition is not supported in this browser. Please ensure you are using Chrome or Safari in a secure context (HTTPS/localhost)."); },
      stop: () => {},
      isListening: () => false
    };
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';

  // states: 'idle', 'starting', 'listening', 'stopping'
  let state = 'idle';
  let finalTranscript = '';
  let silenceTimeout = null;
  let baseText = ''; 

  recognition.onstart = () => {
    state = 'listening';
    baseText = textField.value ? textField.value + ' ' : '';
    finalTranscript = '';
    micBtn.classList.add('listening');
    resetSilenceTimeout();
  };

  recognition.onresult = (event) => {
    resetSilenceTimeout();
    
    let interimTranscript = '';
    finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    textField.value = baseText + finalTranscript + interimTranscript;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    if (event.error === 'not-allowed') {
      micBtn.style.display = 'none'; 
      alert("Microphone access was denied. Please allow microphone access in your browser settings.");
    } else if (event.error === 'network') {
      micBtn.style.display = 'none';
      alert("Voice input failed (Network error). This requires an active internet connection to Google's speech servers. If you are using Brave, this feature is blocked by default for privacy.");
    } else {
      alert("Voice input stopped: " + event.error);
    }
    // Browser aborts on error, so we transition to idle
    state = 'idle';
    micBtn.classList.remove('listening');
  };

  recognition.onend = () => {
    state = 'idle';
    micBtn.classList.remove('listening');
    clearTimeout(silenceTimeout);
    baseText = textField.value ? textField.value + ' ' : '';
  };

  function start() {
    console.log('Voice start requested, current state:', state);
    if (state !== 'idle') {
      console.warn('Cannot start voice, state is not idle:', state);
      // Force reset if stuck
      if (state === 'stopping' || state === 'starting') {
         state = 'idle';
      } else {
         return;
      }
    }
    state = 'starting';
    try {
      recognition.start();
    } catch (e) {
      console.warn("Could not start recognition:", e);
      alert("Could not start recognition: " + e.message);
      state = 'idle';
    }
  }

  function stop() {
    console.log('Voice stop requested, current state:', state);
    if (state === 'idle' || state === 'stopping') return;
    if (state === 'starting') {
      state = 'idle'; // Force idle if aborting while starting
      recognition.abort();
      return;
    }
    state = 'stopping';
    recognition.stop();
  }

  function resetSilenceTimeout() {
    clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(() => {
      stop();
    }, 3000); 
  }

  return {
    isSupported: true,
    start,
    stop,
    isListening: () => (state === 'starting' || state === 'listening')
  };
}

window.initVoice = initVoice;
