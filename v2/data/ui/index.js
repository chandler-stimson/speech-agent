/* global webkitSpeechRecognition */

const textarea = document.getElementById('textarea');
const command = document.getElementById('command');
const msg = document.getElementById('msg');
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

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

class SSR {
  constructor() {
    this.step = -1;
    this.transcripts = [];
  }
  start() {
    const next = () => {
      this.step += 1;

      const recognition = this.recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = e => {
        const content = [...e.results].map(r => r[0].transcript).join('');
        this.transcripts[this.step] = content;
        textarea.textContent = this.transcripts.reduce((p, c) => p += c);

        port.postMessage({
          transcript: textarea.textContent
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
        console.log(e);
      };
      recognition.start();
    };
    next();
  }
  stop() {
    this.recognition.stop();
  }
}
const s = new SSR();

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
    msg.textContent = e.message;
  }
});
document.getElementById('stop').addEventListener('click', () => {
  s.stop();
  stream.getTracks().forEach(t => t.stop());
  clearInterval(id);
  analyser.disconnect();
  draw.clean();
  textarea.textContent = '';

  command.dataset.mode = 'start';
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
chrome.tabs.executeScript({
  file: 'data/inject/inject.js',
  allFrames: true,
  matchAboutBlank: true
}, arr => {
  document.getElementById('start').click();

  const lastError = chrome.runtime.lastError;

  if (lastError) {
    return notify(lastError.message);
  }
  if (!arr || !arr.filter(a => a).length) {
    notify('No active input found! First select a writable input on the page');
  }
});

document.getElementById('copy').addEventListener('click', () => {
  navigator.clipboard.writeText(textarea.textContent).then(() => window.close()).catch(e => {
    alert(e.message);
  });
});
