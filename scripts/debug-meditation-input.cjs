// Temporary opt-in development diagnostic. No text inputs or persisted data.
module.exports = function inspectMeditation(win, getClickThrough) {
  let previous = '';
  win.webContents.once('did-finish-load', async () => {
    await win.webContents.executeJavaScript(`(() => {
      window.__meditationInputEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        document.addEventListener(type, event => {
          const panel = event.target.closest?.('[data-slot="panel"]');
          const isMeditation = panel?.querySelector('h2')?.textContent === 'Breathe with me';
          window.__meditationInputEvents.push({type, area: isMeditation ? 'meditation' : 'other', tag: event.target.tagName, x: Math.round(event.clientX), y: Math.round(event.clientY)});
          window.__meditationInputEvents = window.__meditationInputEvents.slice(-12);
        }, true);
      }
    })()`);
    const timer = setInterval(async () => {
      if (win.isDestroyed()) return clearInterval(timer);
      try {
        const state = await win.webContents.executeJavaScript(`(() => {
          const a = document.querySelector('[data-meditation="voice"]');
          const panel = a?.closest('[data-slot="panel"]');
          const button = panel && [...panel.querySelectorAll('button')].find(b => /^(Start one minute|Resume|Pause|Another minute)$/.test(b.textContent));
          const rect = button?.getBoundingClientRect();
          return {panel: !!panel, button: button?.textContent, disabled: button?.disabled, rect: rect && {x:rect.x,y:rect.y,w:rect.width,h:rect.height}, audio: a && {paused:a.paused, time:Math.floor(a.currentTime),ready:a.readyState,error:a.error?.code}, hidden:document.hidden, width:innerWidth, events:window.__meditationInputEvents.splice(0)};
        })()`);
        const result = { ...state, bounds: win.getContentBounds(), zoom: win.webContents.getZoomFactor(), ignoring: getClickThrough() };
        const encoded = JSON.stringify(result);
        if (encoded !== previous) { console.log('[meditation-input]', encoded); previous = encoded; }
      } catch {}
    }, 1000);
    timer.unref();
  });
};
