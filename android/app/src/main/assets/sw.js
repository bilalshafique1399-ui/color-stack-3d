/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "a2b3fcfebaa900754659895e1504cad6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "8f4fb5aa6bf16faf20f5d50d0d146060"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e0da7b808b8ea2cd3d7d9c534ec7e94a"
  }, {
    "url": "privacy-policy.html",
    "revision": "f8cbf4f6303830ed96b329c205f75fcd"
  }, {
    "url": "index.html",
    "revision": "8a2ba7a20fe2ad2e5b63b712b6811f5d"
  }, {
    "url": "icon.svg",
    "revision": "aa6b7419887d7c13129a0dd6a91c3f0f"
  }, {
    "url": "favicon.ico",
    "revision": "6724a40dff3be34297633fe6fa547e6e"
  }, {
    "url": "favicon-32x32.png",
    "revision": "58dd22f17a939f8b1858cac434bee143"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "85c267bd10d65111b078e968401f5eeb"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-D7QIGRL5.css",
    "revision": null
  }, {
    "url": "assets/index-C1Ah3InT.js",
    "revision": null
  }, {
    "url": "assets/aistudio/file_00000000ce8481fa8a5392f131b6186a_ad82b76a.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "85c267bd10d65111b078e968401f5eeb"
  }, {
    "url": "favicon-32x32.png",
    "revision": "58dd22f17a939f8b1858cac434bee143"
  }, {
    "url": "favicon.ico",
    "revision": "6724a40dff3be34297633fe6fa547e6e"
  }, {
    "url": "privacy-policy.html",
    "revision": "f8cbf4f6303830ed96b329c205f75fcd"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e0da7b808b8ea2cd3d7d9c534ec7e94a"
  }, {
    "url": "pwa-512x512.png",
    "revision": "8f4fb5aa6bf16faf20f5d50d0d146060"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "a2b3fcfebaa900754659895e1504cad6"
  }, {
    "url": "manifest.webmanifest",
    "revision": "970db26832cc136a8b69159c17b6fb18"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/privacy-policy\.html/, /^\/api\//]
  }));

}));
