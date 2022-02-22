navigator.mediaDevices.getUserMedia({
  audio: true,
  video: false
}).then(() => window.close()).catch(e => {
  alert('Cannot listen to your speech: ' + e.message);
});
