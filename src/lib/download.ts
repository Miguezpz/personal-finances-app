/** Saves a Blob generated in the browser as a file (no server round trip, Principle I). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
