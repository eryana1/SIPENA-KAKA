/**
 * Safely downloads a Blob as a file in the user's browser.
 * Uses native HTMLAnchorElement and URL.createObjectURL for maximum browser compatibility.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    
    // Clean up after download triggers
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error("Error downloading blob:", err);
    // Fallback: open in new window/tab
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
};
