// Injected JavaScript for AdBlocking, tracker prevention and element hiding
export const getAdblockScript = (enabled: boolean) => {
  if (!enabled) {
    return `
      window.__adblockEnabled = false;
      console.log("[Zapi AdBlock] AdBlock is disabled");
    `;
  }

  return `
    (function() {
      window.__adblockEnabled = true;
      console.log("[Zapi AdBlock] AdBlock engine initialized");

      // Ad URL keywords & domains to block
      const blockList = [
        'doubleclick.net',
        'googleadservices.com',
        'googlesyndication.com',
        'adservice.google.com',
        'adnxs.com',
        'adsrvr.org',
        'quantserve.com',
        'crwdcntrl.net',
        'scorecardresearch.com',
        'amazon-adsystem.com',
        'taboola.com',
        'outbrain.com',
        'popads.net',
        'propellerads.com',
        'adcolony.com',
        'unityads',
        '/ads/',
        '/adserver/',
        '/banners/',
        'analytics.js',
        'gtag/js',
        'google-analytics.com',
        'facebook.net/en_US/fbevents.js',
        'adsbygoogle'
      ];

      // Ad CSS selectors to hide
      const adSelectors = [
        '.ad-container', '.ad-box', '.ad-banner', '.adsbygoogle', 
        '#ad-container', '#ad-box', '#ad-banner', '[id^="ad-"]', 
        '[class^="ad-"]', '[class*=" ad-"]', '[id*="-ad-"]', 
        'iframe[src*="doubleclick"]', 'iframe[src*="ads"]',
        '.sponsor-post', '.sponsored-link', '.sponsored-ads',
        '.advertisement', '.ad-slot', '#ad-slot', 'div.ad'
      ];

      let blockedCount = 0;

      function notifyBlocked(url) {
        blockedCount++;
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AD_BLOCKED',
            url: url,
            count: 1
          }));
        } catch (e) {}
      }

      // 1. Overriding XMLHttpRequest
      const rawOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string') {
          const shouldBlock = blockList.some(keyword => url.toLowerCase().includes(keyword));
          if (shouldBlock) {
            console.log("[Zapi AdBlock] Blocked XHR request:", url);
            notifyBlocked(url);
            // Return dummy open that doesn't execute
            return;
          }
        }
        return rawOpen.apply(this, [method, url, ...args]);
      };

      // 2. Overriding fetch
      const rawFetch = window.fetch;
      window.fetch = function(input, init) {
        let url = '';
        if (typeof input === 'string') {
          url = input;
        } else if (input && typeof input === 'object' && input.url) {
          url = input.url;
        }

        if (url) {
          const shouldBlock = blockList.some(keyword => url.toLowerCase().includes(keyword));
          if (shouldBlock) {
            console.log("[Zapi AdBlock] Blocked Fetch request:", url);
            notifyBlocked(url);
            return Promise.reject(new TypeError('Failed to fetch due to AdBlock'));
          }
        }
        return rawFetch.apply(this, arguments);
      };

      // 3. Inject CSS to hide ads immediately
      const style = document.createElement('style');
      style.innerHTML = adSelectors.join(', ') + ' { display: none !important; opacity: 0 !important; pointer-events: none !important; height: 0 !important; width: 0 !important; margin: 0 !important; padding: 0 !important; }';
      document.head.appendChild(style);

      // 4. Periodically clean up leftover ad elements (handling dynamic elements)
      const cleanElements = () => {
        adSelectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(el => {
              if (el && el.style.display !== 'none') {
                el.style.display = 'none';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                el.style.height = '0';
                el.style.width = '0';
              }
            });
          } catch (e) {}
        });
      };

      // Run cleanup
      cleanElements();
      setInterval(cleanElements, 1500);

      // 5. Block window.open / popups if requested
      const rawOpenWindow = window.open;
      window.open = function(url, name, specs) {
        console.log("[Zapi AdBlock] Blocked popup / window.open to:", url);
        notifyBlocked(url || 'popup');
        return null;
      };

    })();
  `;
};
