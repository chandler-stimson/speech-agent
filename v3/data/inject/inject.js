window.focused = [
  document.activeElement,
  document.querySelector(':focus')
].filter(e => e && e !== document.body).filter(e => {
  const name = e.nodeName.toLowerCase();
  if (e.nodeType === 1 && (
    name === 'textarea' ||
    (name === 'input' && /^(?:text|email|number|search|tel|url|password)$/i.test(e.type)) ||
    e.isContentEditable
  )) {
    return true;
  }
}).shift();


if (window.focused) {
  let transcript = '';
  const port = chrome.runtime.connect();
  port.onDisconnect.addListener(() => {
    port.close();
  });
  port.onMessage.addListener(request => {
    if (request.transcript) {
      const focused = window.focused;
      if (focused.isContentEditable) {
        return;
      }

      if (focused.selectionStart === focused.selectionEnd) {
        const value = focused.value.substr(0, focused.selectionEnd);
        const i = value.lastIndexOf(transcript);
        if (i !== -1 && transcript.length + i === value.length) {
          focused.selectionStart = i;
          focused.selectionEnd = i + transcript.length;
        }
      }

      document.execCommand('insertText', null, request.transcript);
      transcript = request.transcript;
    }
  });
}

window.focused && window.focused.nodeName
