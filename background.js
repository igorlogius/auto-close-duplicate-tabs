/* global browser */

const manifest = browser.runtime.getManifest();
const extname = manifest.name;

let delayTimerId = null;
let isActive = false;
let ready = false;
let regexList = null;

async function buildRegExList() {
  const out = [];
  (await getFromStorage("string", "matchers", ""))
    .split("\n")
    .forEach((line) => {
      line = line.trim();
      if (line !== "") {
        try {
          out.push(new RegExp(line));
        } catch (e) {
          console.error(e);
        }
      }
    });
  return out;
}

function isOnRegexList(url) {
  for (let i = 0; i < regexList.length; i++) {
    if (regexList[i].test(url)) {
      return true;
    }
  }
  return false;
}

async function getFromStorage(type, id, fallback) {
  let tmp = await browser.storage.local.get(id);
  return typeof tmp[id] === type ? tmp[id] : fallback;
}

async function setToStorage(id, value) {
  let obj = {};
  obj[id] = value;
  return browser.storage.local.set(obj);
}

async function onStorageChanged() {
  regexList = await buildRegExList();
}

async function delayed_delDups() {
  if (ready) {
    clearTimeout(delayTimerId);
    delayTimerId = setTimeout(delDups, 2500); // 2.5 seconds w/o tab status changes
  }
}

async function delDups() {
  if (!isActive) {
    return;
  }
  const allTabs = await browser.tabs.query({ currentWindow: true });

  // check if any tab is still loading , if so we wait
  if (allTabs.some((t) => t.status !== "complete")) {
    delayed_delDups();
    return;
  }

  // all tabs have finished loading at this point

  let focus_group = "";

  const dup_groups = new Map();

  for (const t of allTabs) {
    if (!isOnRegexList(t.url)) {
      const key = t.cookieStoreId + "_" + t.url;

      if (!dup_groups.has(key)) {
        dup_groups.set(key, []);
      }
      dup_groups.get(key).push(t);
      if (t.active) {
        focus_group = key;
      }
    }
  }

  let tabsToClose = [];

  for (const [k, v] of dup_groups) {
    // only if multiple tabs have the same key are they dups
    if (v.length > 1) {
      // we'll keep the tabs which are farest from the left side
      // or are active open
      v.sort((a, b) => {
        if (k == focus_group) {
          if (a.active) {
            return -1;
          }
          if (b.active) {
            return 1;
          }
        }
        return b.index - a.index;
      });

      //out = out + " - " + (v.length - 1) + " x " + v[0].url + "\n";
      // close all tabs after the first element
      //browser.tabs.remove(v.slice(1).map((t) => t.id));
      tabsToClose = tabsToClose.concat(v.slice(1).map((t) => t.id));
    }
  }
  for (const tid of tabsToClose) {
    try {
      await browser.tabs.remove(tid);
    } catch (e) {}
  }
  delayTimerId = null;
}

async function onBAClicked() {
  if (ready) {
    clearTimeout(delayTimerId);
    isActive = !isActive;
    setToStorage("isActive", isActive);
    if (isActive) {
      browser.browserAction.setBadgeBackgroundColor({ color: "green" });
      browser.browserAction.setBadgeText({ text: "on" });
      delayed_delDups();
    } else {
      browser.browserAction.setBadgeBackgroundColor({ color: "red" });
      browser.browserAction.setBadgeText({ text: "off" });
    }
  }
}

// setup
(async () => {
  await onStorageChanged();
  isActive = await getFromStorage("boolean", "isActive", isActive);
  setToStorage("isActive", isActive);

  if (isActive) {
    browser.browserAction.setBadgeBackgroundColor({ color: "green" });
    browser.browserAction.setBadgeText({ text: "on" });
  } else {
    browser.browserAction.setBadgeBackgroundColor({ color: "red" });
    browser.browserAction.setBadgeText({ text: "off" });
  }
  ready = true;
})();

// add listeners
browser.browserAction.onClicked.addListener(onBAClicked);
browser.tabs.onUpdated.addListener(delayed_delDups, {
  properties: ["url", "status"],
});
browser.tabs.onCreated.addListener(delayed_delDups);
browser.storage.onChanged.addListener(onStorageChanged);
