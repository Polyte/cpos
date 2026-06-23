/**
 * PrintService
 * 
 * Robust 80mm thermal printing architecture for CLINTPOS.
 * Bypasses browser popup blockers using a persistent hidden iframe.
 * Uses JetBrains Mono for forensic-grade high-contrast output.
 */

import { toast } from 'sonner';

export interface PrintOptions {
  title?: string;
  width?: string; // e.g. "80mm"
  printableWidth?: string; // e.g. "72mm"
  fontFamily?: string;
}

class PrintService {
  private iframeId = 'clintpos-print-iframe';

  private getIframe(): HTMLIFrameElement {
    let iframe = document.getElementById(this.iframeId) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = this.iframeId;
      iframe.style.position = 'fixed';
      iframe.style.right = '100%';
      iframe.style.bottom = '100%';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    return iframe;
  }

  public async print(contentHtml: string, options: PrintOptions = {}) {
    const {
      title = 'CLINTPOS_Print_Job',
      width = '80mm',
      printableWidth = '72mm',
      fontFamily = "'JetBrains Mono', monospace"
    } = options;

    const iframe = this.getIframe();
    const doc = iframe.contentWindow?.document || iframe.contentDocument;

    if (!doc) {
      toast.error('Print failure: IFrame context inaccessible');
      return;
    }

    // High-contrast industrial CSS for thermal printers
    const style = `
      @page { 
        margin: 0; 
        size: ${width} auto; 
      }
      body { 
        margin: 0; 
        padding: 4mm 5mm; 
        background: #fff; 
        font-family: ${fontFamily}; 
        color: #000;
        font-size: 9pt;
        width: ${printableWidth};
        line-height: 1.3;
        -webkit-print-color-adjust: exact;
        word-wrap: break-word;
      }
      * { box-sizing: border-box; }
      img { max-width: 100%; height: auto; }
      .receipt-header { text-align: center; margin-bottom: 4mm; }
      .receipt-divider { border-bottom: 1px dashed #000; margin: 3mm 0; }
      .receipt-row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
      .receipt-footer { text-align: center; margin-top: 6mm; font-size: 8pt; color: #555; }
      .font-bold { font-weight: 800; }
      .font-black { font-weight: 900; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .uppercase { text-transform: uppercase; }
      .tracking-tight { letter-spacing: -0.025em; }
      .tracking-widest { letter-spacing: 0.1em; }
      .node-tag { font-size: 7px; color: #aaa; margin-top: 4mm; border-top: 1px dotted #ccc; padding-top: 2mm; }
      
      /* Barcode simulation */
      .barcode-strip {
        display: flex;
        justify-content: center;
        gap: 1px;
        margin: 10px 0;
        filter: grayscale(1);
      }
      .barcode-bar {
        background: #000;
        height: 20px;
      }

      @media print {
        body { width: ${printableWidth}; }
        .no-print { display: none; }
      }
    `;

    const nodeId = localStorage.getItem('clintpos_node_id') || 'NODE-UNDEFINED';
    const forensicNodeHtml = `<div class="node-tag uppercase text-center">PRINT NODE IDENTIFIER: ${nodeId}</div>`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>${style}</style>
        </head>
        <body>
          <div style="width: 100%;">
            ${contentHtml}
            ${forensicNodeHtml}
          </div>
          <script>
            window.focus();
            // Ensure all images/fonts are loaded
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    toast.info('Sending job to thermal node...');
  }
}

export const printService = new PrintService();
