/* global browser */

function onChange(evt) {
  const id = evt.target.id;
  let el = document.getElementById(id);

  let value = el.type === "checkbox" ? el.checked : el.value;
  let obj = {};
  if (typeof value === "string") {
    value = value.trim(); // strip whitespace
  }
  obj[id] = value;

  browser.storage.local.set(obj);
}

["matchers"].map((id) => {
  browser.storage.local
    .get(id)
    .then((obj) => {
      let el = document.getElementById(id);
      let val = obj[id];

      if (typeof val !== "undefined") {
        if (el.type === "checkbox") {
          el.checked = val;
        } else {
          el.value = val;
        }
      }
    })
    .catch(console.error);

  let el = document.getElementById(id);
  el.addEventListener("click", onChange);
  el.addEventListener("input", onChange);
});
