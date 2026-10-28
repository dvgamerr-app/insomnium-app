export function ownedPdf(){
 const first='BT /F1 18 Tf 30 120 Td (Owned PDF page one) Tj ET\n0 0 1 rg 20 20 20 20 re f\n';
 const second='BT /F1 18 Tf 30 120 Td (Owned PDF page two) Tj ET\n1 0 0 rg 20 20 20 20 re f\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R /OpenAction 8 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
 `<< /Length ${first.length} >>\nstream\n${first}endstream`,
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
 `<< /Length ${second.length} >>\nstream\n${second}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 '<< /Type /Action /S /JavaScript /JS (globalThis.__ownedPdfAction = true) >>'];
 let text='%PDF-1.4\n';const offsets=[0];for(const [index,value] of objects.entries()){offsets.push(text.length);text+=`${index+1} 0 obj\n${value}\nendobj\n`;}
 const xref=text.length;text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
 return Buffer.from(text+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`).toString('base64');
}
