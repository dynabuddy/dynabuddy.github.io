// Puts the right download first for this computer, shows the latest version, and fills in the changelog.
(() => {
  const ua = navigator.userAgent;
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua);
  const base = "https://github.com/dynabuddy/dynabuddy.github.io/releases/latest/download/";
  const mac = { title: "Download for Mac", note: "macOS 26 or later", href: base + "DynaBuddy-mac.dmg" };
  const win = { title: "Download for Windows (beta)", note: "Beta · Windows 10 or 11 · 64-bit", href: base + "DynaBuddy-win-Setup.exe" };
  const [first, second] = isWindows ? [win, mac] : [mac, win];
  const set = (id, d) => {
    document.getElementById(id).href = d.href;
    document.getElementById(id + "-title").textContent = d.title;
    document.getElementById(id + "-note").textContent = d.note;
  };
  set("dl-primary", first);
  set("dl-secondary", second);
  if (!isWindows && !isMac) document.getElementById("dl-primary-note").textContent += " · open this page on your computer";

  fetch("updates/mac.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((feed) => {
      if (!feed) return;
      const date = feed.date ? new Date(feed.date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
      document.getElementById("version").textContent = `Version ${feed.version}${date ? " · " + date : ""}`;
    })
    .catch(() => {});

  const box = document.getElementById("changelog");
  fetch("changelog.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((releases) => {
      for (const rel of releases.slice(0, 6)) {
        const row = document.createElement("article");
        row.className = "release";
        row.id = "v" + rel.version;
        const h = document.createElement("h3");
        h.textContent = rel.version;
        const ul = document.createElement("ul");
        for (const n of rel.notes) {
          const li = document.createElement("li");
          li.textContent = n;
          ul.append(li);
        }
        row.append(h, ul);
        box.append(row);
      }
    })
    .catch(() => {});
})();
