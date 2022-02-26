document.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (e.code === 'KeyJ' && meta) {
    const count = document.querySelectorAll('#lang option').length;
    const e = document.getElementById('lang');
    e.selectedIndex = (e.selectedIndex - 1 + count) % count;
    e.preventDefault();
  }
  else if (e.code === 'KeyK' && meta) {
    const count = document.querySelectorAll('#lang option').length;
    const e = document.getElementById('lang');
    e.selectedIndex = (e.selectedIndex + 1) % count;
    e.preventDefault();
  }
  else if (e.code === 'KeyF' && meta) {
    document.getElementById('search').focus();
    document.getElementById('search').select();
    e.preventDefault();
  }
});

document.getElementById('search').onsearch = e => {
  const o = document.querySelector(`#lang [value="${e.target.value}"]`);
  if (o) {
    document.getElementById('lang').value = e.target.value;
    document.getElementById('lang').dispatchEvent(new Event('change'));
  }
};
