// Local illustrative replies only: no user input, API calls or tracking.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.v2-breathe img[data-still]').forEach(img => { img.src = img.dataset.still; });
  }
  const replies = {
    start: 'okay. one tiny step first. what are you trying to get started on?',
    break: 'oof. a lot on your plate? we can take a quiet minute. you don’t have to earn a break.',
    banter: 'my big news: another leaf. trying to stay humble. what’s happening in your considerably more eventful life?',
  };
  document.querySelectorAll('[data-chat-example]').forEach(button => {
    button.addEventListener('click', () => {
      const demo = button.closest('.v2-chat-demo');
      demo.querySelector('.v2-example').textContent = replies[button.dataset.chatExample];
      demo.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    });
  });
  document.querySelectorAll('.version-nav a').forEach(link => {
    if (new URL(link.href).pathname === location.pathname) link.setAttribute('aria-current', 'page');
  });
})();
