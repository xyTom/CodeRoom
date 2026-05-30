let assetsPromise = null;

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadZoomToolkit(version) {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      loadStyle(`https://source.zoom.us/uitoolkit/${version}/videosdk-ui-toolkit.css`),
      window.UIToolkit
        ? Promise.resolve()
        : loadScript(`https://source.zoom.us/uitoolkit/${version}/videosdk-ui-toolkit.min.umd.js`),
    ]).catch((error) => {
      assetsPromise = null;
      throw error;
    });
  }

  await assetsPromise;
  return window.UIToolkit;
}
