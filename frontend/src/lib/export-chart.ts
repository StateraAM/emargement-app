/**
 * Export a Recharts chart container as a PNG image.
 * Finds the SVG element inside the container, converts it to a canvas, then triggers download.
 */
export function exportChartAsPng(containerId: string, filename: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const svgElement = container.querySelector("svg");
  if (!svgElement) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const scale = 2; // retina quality
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);
    // Fill with white background for charts
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, "image/png");

    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/**
 * Trigger browser print dialog with print-optimized styles applied.
 */
export function printAnalytics() {
  window.print();
}
