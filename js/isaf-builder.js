/**
 * Build i.SAF 1.2 XML from header config + mapped invoice rows.
 * Structure: FileDescription (Part I), optional MasterData (Part II), SourceDocuments (Part III).
 */
const ConvyISAF = {
  /** Escape for XML text content */
  escape(str) {
    if (str == null) return '';
    const s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /** Format date YYYY-MM-DD for i.SAF */
  formatDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /** Format date-time for FileDateCreated */
  formatDateTime() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace('T', ' ');
  },

  /** Normalize number for XML (decimal with dot) */
  formatNumber(val) {
    if (val == null || val === '') return '';
    const n = Number(String(val).replace(',', '.'));
    return isNaN(n) ? '' : String(n);
  },

  /**
   * Group mapped rows by invoice (invoiceNumber + documentType if present).
   * Each group becomes one Invoice with header + lines.
   */
  groupByInvoice(mappedRows) {
    const groups = new Map();
    mappedRows.forEach((row, index) => {
      const num = (row.invoiceNumber != null ? String(row.invoiceNumber) : '').trim() || `_row_${index}`;
      const type = (row.documentType != null ? String(row.documentType) : '').toLowerCase();
      const isIssued = type.includes('israsyt') || type.includes('issued') || type === 's' || type === 'i';
      const key = `${num}|${isIssued ? 'issued' : 'received'}`;
      if (!groups.has(key)) groups.set(key, { invoiceNumber: num, isIssued, lines: [] });
      groups.get(key).lines.push(row);
    });
    return Array.from(groups.values());
  },

  /**
   * Build full i.SAF XML string.
   * @param {Object} header - { companyName, registrationNumber, vatNumber, dataType, selectionStartDate, selectionEndDate, softwareName?, softwareVersion? }
   * @param {Object[]} mappedRows - from ConvyMapping.applyMapping
   */
  build(header, mappedRows) {
    const enc = this.escape;
    const fmtDate = this.formatDate;
    const fmtNum = this.formatNumber;

    const softwareCompanyName = enc(header.softwareCompanyName || 'Convy');
    const softwareName = enc(header.softwareName || 'Convy');
    const softwareVersion = enc(header.softwareVersion || '1.0');
    const registrationNumber = enc(String(header.registrationNumber || '').replace(/\s/g, ''));
    const dataType = (header.dataType === 'F' || header.dataType === 'S' || header.dataType === 'P') ? header.dataType : 'F';
    const startDate = fmtDate(header.selectionStartDate) || fmtDate(new Date());
    const endDate = fmtDate(header.selectionEndDate) || fmtDate(new Date());

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<AuditFile xmlns="https://www.vmi.lt/cms/saf-t">\n';

    // Part I – FileDescription
    xml += '  <FileDescription>\n';
    xml += '    <FileVersion>1.2</FileVersion>\n';
    xml += '    <FileDateCreated>' + enc(this.formatDateTime()) + '</FileDateCreated>\n';
    xml += '    <DataType>' + dataType + '</DataType>\n';
    xml += '    <SoftwareCompanyName>' + softwareCompanyName + '</SoftwareCompanyName>\n';
    xml += '    <SoftwareName>' + softwareName + '</SoftwareName>\n';
    xml += '    <SoftwareVersion>' + softwareVersion + '</SoftwareVersion>\n';
    xml += '    <RegistrationNumber>' + registrationNumber + '</RegistrationNumber>\n';
    xml += '    <SelectionCriteria>\n';
    xml += '      <SelectionStartDate>' + startDate + '</SelectionStartDate>\n';
    xml += '      <SelectionEndDate>' + endDate + '</SelectionEndDate>\n';
    xml += '    </SelectionCriteria>\n';
    xml += '  </FileDescription>\n';

    const isPlaceholder = (v) => /\([^)]+\)/.test(String(v || '').trim());
    const isEmptyRow = (row) => {
      const inv = (row.invoiceNumber != null ? String(row.invoiceNumber) : '').trim();
      const date = (row.invoiceDate != null ? String(row.invoiceDate) : '').trim();
      if (!inv || !date) return true;
      if (isPlaceholder(inv) || isPlaceholder(date)) return true;
      return false;
    };
    const rows = (mappedRows || []).filter(row => !isEmptyRow(row));
    const invoices = this.groupByInvoice(rows);
    const issued = invoices.filter(inv => inv.isIssued);
    const received = invoices.filter(inv => !inv.isIssued);

    // Part II – MasterData: unique customers/suppliers (simplified: from invoice rows)
    const customers = new Map();
    const suppliers = new Map();
    invoices.forEach(inv => {
      inv.lines.forEach(line => {
        const id = (line.counterpartyRegistrationNumber || line.counterpartyName || '').toString().trim();
        const vat = (line.counterpartyVatNumber || '').toString().trim() || 'ND';
        const country = (line.counterpartyCountry || '').toString().trim() || 'LT';
        if (inv.isIssued && id) customers.set(id, { id, vat, country });
        if (!inv.isIssued && id) suppliers.set(id, { id, vat, country });
      });
    });

    if (customers.size || suppliers.size) {
      xml += '  <MasterFiles>\n';
      customers.forEach((c, id) => {
        xml += '    <Customer>\n';
        xml += '      <CustomerID>' + enc(id) + '</CustomerID>\n';
        xml += '      <VATRegistrationNumber>' + enc(c.vat) + '</VATRegistrationNumber>\n';
        xml += '      <RegistrationNumber>' + enc(id) + '</RegistrationNumber>\n';
        xml += '      <Country>' + enc(c.country) + '</Country>\n';
        xml += '    </Customer>\n';
      });
      suppliers.forEach((s, id) => {
        xml += '    <Supplier>\n';
        xml += '      <SupplierID>' + enc(id) + '</SupplierID>\n';
        xml += '      <VATRegistrationNumber>' + enc(s.vat) + '</VATRegistrationNumber>\n';
        xml += '      <RegistrationNumber>' + enc(id) + '</RegistrationNumber>\n';
        xml += '      <Country>' + enc(s.country) + '</Country>\n';
        xml += '    </Supplier>\n';
      });
      xml += '  </MasterFiles>\n';
    }

    // Part III – SourceDocuments (IssuedInvoice / ReceivedInvoice)
    xml += '  <SourceDocuments>\n';

    const writeInvoice = (inv, tag) => {
      const first = inv.lines[0];
      const net = inv.lines.reduce((sum, l) => sum + (Number(String(l.netAmount).replace(',', '.')) || 0), 0);
      const vat = inv.lines.reduce((sum, l) => sum + (Number(String(l.vatAmount).replace(',', '.')) || 0), 0);
      let gross = inv.lines.reduce((sum, l) => sum + (Number(String(l.grossAmount).replace(',', '.')) || 0), 0);
      if (!gross && (net || vat)) gross = net + vat; // i.SAF requires GrossTotal; derive from net+vat if not mapped
      const invoiceDate = fmtDate(first.invoiceDate) || startDate;
      const buyerId = (first.counterpartyRegistrationNumber || first.counterpartyName || '').toString().trim();
      xml += '    <' + tag + '>\n';
      xml += '      <InvoiceNo>' + enc(inv.invoiceNumber) + '</InvoiceNo>\n';
      xml += '      <InvoiceDate>' + invoiceDate + '</InvoiceDate>\n';
      xml += '      <CustomerID>' + enc(buyerId) + '</CustomerID>\n';
      xml += '      <NetTotal>' + fmtNum(net || first.netAmount) + '</NetTotal>\n';
      xml += '      <VATTotal>' + fmtNum(vat || first.vatAmount) + '</VATTotal>\n';
      xml += '      <GrossTotal>' + fmtNum(gross || first.grossAmount || (net + vat)) + '</GrossTotal>\n';
      inv.lines.forEach(line => {
        const taxCode = (line.vatClassificationCode || '').toString().trim() || '';
        const taxPct = fmtNum(line.vatRate) || '';
        xml += '      <Line>\n';
        xml += '        <Description>' + enc(line.description || '') + '</Description>\n';
        xml += '        <Quantity>' + fmtNum(line.quantity || 1) + '</Quantity>\n';
        xml += '        <UnitPrice>' + fmtNum(line.unitPrice) + '</UnitPrice>\n';
        xml += '        <NetAmount>' + fmtNum(line.netAmount) + '</NetAmount>\n';
        if (taxCode) xml += '        <TaxCode>' + enc(taxCode) + '</TaxCode>\n';
        if (taxPct) xml += '        <TaxPercentage>' + taxPct + '</TaxPercentage>\n';
        xml += '        <VATAmount>' + fmtNum(line.vatAmount) + '</VATAmount>\n';
        xml += '      </Line>\n';
      });
      xml += '    </' + tag + '>\n';
    };

    issued.forEach(inv => writeInvoice(inv, 'IssuedInvoice'));
    received.forEach(inv => writeInvoice(inv, 'ReceivedInvoice'));

    xml += '  </SourceDocuments>\n';
    xml += '</AuditFile>';
    return xml;
  },
};
(function(g){ if (g) { g.ConvyISAF = ConvyISAF; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
