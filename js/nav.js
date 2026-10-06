/* Bottom navigation.
 *
 * Replaces the old horizontally-scrolling "Demo guide" strip. Five items that
 * did not fit became four, because "Compare three modes" was never a
 * destination - it is the toggle that appears above the first set of results.
 *
 * Four items at phone width need no scrolling, sit under the thumb, and match
 * the pattern the product being mocked actually uses.
 */
(function () {
  // Four items, not five. "Ask a friend" is reached by its own trigger - it
  // surfaces automatically when a hunt stalls, which is when anyone wants it -
  // so it does not need a permanent slot competing with the rest.
  var ITEMS = [
    {
      href: 'library.html',
      label: 'Library',
      icon: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 15l4.5-4.5 4 4 3-3L21 17"/><circle cx="8.5" cy="8.5" r="1.4"/>'
    },
    {
      href: 'index.html',
      label: 'Find',
      icon: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/>'
    },
    {
      href: 'scratch.html',
      label: 'Card',
      icon: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5 10.1 12.8 4.5 10.9 10.1 9z"/><path d="M18.5 3v3M20 4.5h-3"/>'
    },
    {
      href: 'deposits.html',
      label: 'Index',
      icon: '<path d="M4 6h16M4 12h16M4 18h10"/>'
    }
  ];

  function render() {
    var wrapper = document.getElementById('app-wrapper') || document.body;

    // The old guide bar is gone; remove any that survives in markup.
    var legacy = document.querySelector('.demo-guide-bar');
    if (legacy) legacy.remove();
    if (document.querySelector('.bottom-nav')) return;

    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!here) here = 'index.html';
    // passiton has no nav slot; it belongs to the Find flow, so mark that.
    if (here === 'passiton.html') here = 'index.html';

    var nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Main');

    ITEMS.forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'nav-item' + (here === item.href ? ' active' : '');
      a.href = item.href;
      if (here === item.href) a.setAttribute('aria-current', 'page');
      a.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        item.icon + '</svg><span>' + item.label + '</span>';
      nav.appendChild(a);
    });

    wrapper.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
