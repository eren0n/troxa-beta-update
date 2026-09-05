const FABRIC_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';

let fabricPromise = null;

// Fabric.js (~300KB) is only needed by the two canvas editor routes. Loading
// it on demand instead of via a blocking <script> tag keeps it off the
// critical path for every other page (login, dashboard, generate, etc).
export function loadFabric() {
  if (window.fabric) return Promise.resolve(window.fabric);
  if (fabricPromise) return fabricPromise;

  fabricPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = FABRIC_SRC;
    script.async = true;
    script.onload = () => resolve(window.fabric);
    script.onerror = () => {
      fabricPromise = null;
      reject(new Error('Failed to load Fabric.js'));
    };
    document.head.appendChild(script);
  });

  return fabricPromise;
}
