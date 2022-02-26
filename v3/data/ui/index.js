const notify = m => {
  const e = document.getElementById('notify');
  clearTimeout(notify.id);
  notify.id = setTimeout(() => {
    e.textContent = '';
  }, 1000);
  e.textContent = m.message || m;
};

const textarea = document.getElementById('textarea');
const command = document.getElementById('command');
const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
context.lineWidth = '1';
const rect = canvas.getBoundingClientRect();
canvas.width = rect.width;
canvas.height = rect.height;

let analyser = '';
let stream;
let id;
let port = {
  postMessage() {}
};

class SSR {
  constructor(language, maxAlternatives = 5, interimResults = true) {
    this.step = -1;
    this.transcripts = [];
    this.language = language;
    this.interimResults = interimResults;
    this.maxAlternatives = maxAlternatives;
  }
  start() {
    const next = () => {
      this.step += 1;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      // const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      const recognition = this.recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = this.interimResults;
      recognition.lang = this.language;
      recognition.maxAlternatives = this.maxAlternatives;

      recognition.onresult = e => {
        const content = [...e.results].map(r => r[0].transcript).join('');
        this.transcripts[this.step] = content;
        textarea.value = this.transcripts.reduce((p, c) => p += c);

        port.postMessage({
          transcript: textarea.value
        });
      };
      recognition.onspeechend = () => {
        recognition.stop();
      };
      recognition.onerror = e => {
        if (e.error === 'no-speech') {
          recognition.stop();
          next();
        }
      };
      recognition.start();
    };
    next();
  }
  stop() {
    this.recognition.stop();
  }
}

chrome.storage.local.get({
  language: navigator.language,
  languages: ['en-US'],
  maxAlternatives: 2,
  interimResults: true
}, prefs => {
  document.getElementById('lang').value = prefs.language;
  document.getElementById('alt').value = prefs.maxAlternatives;

  for (const s of prefs.languages) {
    const e = document.querySelector(`#lang [value="${s}"]`);
    if (e) {
      document.getElementById('freq').appendChild(e);
    }
  }

  const s = new SSR(prefs.language, prefs.maxAlternatives, prefs.interimResults);

  document.getElementById('start').addEventListener('click', async () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;

      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      }).catch(() => {
        chrome.tabs.create({
          url: 'data/inject/permission.html'
        }, () => window.close());
      });

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      clearInterval(id);
      id = setInterval(draw, 200);

      s.start();
      command.dataset.mode = 'stop';
    }
    catch (e) {
      notify(e);
    }
  });
  document.getElementById('stop').addEventListener('click', () => {
    s.stop();
    stream.getTracks().forEach(t => t.stop());
    clearInterval(id);
    analyser.disconnect();
    draw.clean();

    command.dataset.mode = 'start';
  });
});

const draw = () => {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);

  draw.clean();
  analyser.getFloatTimeDomainData(dataArray);
  const max = Math.max(...[...dataArray].map(a => Math.abs(a))) || 1;
  const weight = Math.pow(max, 0.2) / max;

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i];
    const y = v * canvas.height * weight;

    context.beginPath();
    context.rect(x - sliceWidth / 2, canvas.height / 2, sliceWidth, y);
    context.fillStyle = y > 0 ? '#ea4335' : '#4285f4';
    context.fill();
    x += sliceWidth;
  }
};
draw.clean = () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
};

chrome.runtime.onConnect.addListener(p => {
  port = p;
});
chrome.tabs.query({
  active: true,
  currentWindow: true
}, ([tab]) => {
  chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
      allFrames: true
    },
    files: ['data/inject/inject.js']
  }, arr => {
    document.getElementById('start').click();

    const lastError = chrome.runtime.lastError;
    if (lastError) {
      return notify(lastError.message);
    }
    if (!arr || !arr.filter(a => a.result).length) {
      notify('No active input found!\nTo automatically fill the the input element on the page, first select it.');
    }
  });
});

document.getElementById('copy').addEventListener('click', () => {
  if (textarea.value) {
    navigator.clipboard.writeText(textarea.value).then(() => window.close()).catch(e => {
      alert(e.message);
    });
  }
  else {
    notify('Nothing to copy!');
  }
});

document.getElementById('lang').onchange = e => chrome.storage.local.get({
  languages: ['en-US']
}, prefs => chrome.storage.local.set({
  language: e.target.value,
  languages: [e.target.value, ...prefs.languages].filter((s, i, l) => s && l.indexOf(s) === i).slice(0, 6)
}, () => location.reload()));

document.getElementById('alt').onchange = e => chrome.storage.local.set({
  maxAlternatives: e.target.value
}, () => location.reload());
