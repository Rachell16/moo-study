import { useCallback, useEffect, useState } from "react";

// Jendela mengambang di atas semua aplikasi (Document Picture-in-Picture): hanya Chrome dan Edge di komputer.
type DocPiP = { requestWindow: (options?: { width?: number; height?: number }) => Promise<Window> };
const api = () =>
  (window as unknown as { documentPictureInPicture?: DocPiP }).documentPictureInPicture;

// Salin semua gaya halaman ke jendela mengambang supaya tampilannya sama.
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.document.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.className = document.documentElement.className;
}

export function usePip() {
  const [supported, setSupported] = useState(false);
  const [win, setWin] = useState<Window | null>(null);
  useEffect(() => setSupported(!!api()), []);

  const open = useCallback(async () => {
    const pip = api();
    if (!pip) return;
    const w = await pip.requestWindow({ width: 320, height: 200 });
    copyStyles(w);
    w.document.title = "Moo Study";
    w.addEventListener("pagehide", () => setWin(null));
    setWin(w);
  }, []);

  const close = useCallback(() => {
    win?.close();
    setWin(null);
  }, [win]);

  // jendela ikut tertutup kalau aplikasinya ditutup
  useEffect(() => () => win?.close(), [win]);

  return { supported, win, open, close };
}
