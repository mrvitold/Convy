/**
 * Build i.SAF 1.2 XML from header config + mapped invoice rows.
 * Conforms to official i.SAF 1.2 XSD: http://www.vmi.lt/cms/imas/isaf
 * Structure: iSAFFile > Header > FileDescription, MasterFiles (Customers/Suppliers), SourceDocuments (SalesInvoices/PurchaseInvoices).
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

  /** Format date-time for FileDateCreated (xs:dateTime) */
  formatDateTime() {
    const d = new Date();
    return d.toISOString().slice(0, 19);
  },

  /** Normalize number for XML (decimal with dot) */
  formatNumber(val) {
    if (val == null || val === '') return '';
    const n = Number(String(val).replace(',', '.'));
    return isNaN(n) ? '' : String(n);
  },

  /** Valid Lithuanian VAT tariffs (%). */
  VAT_TARIFFS: [0, 5, 9, 21],

  /** Format VAT rate: round to nearest valid Lithuanian tariff (0, 5, 9, 21). */
  formatVatRate(val) {
    if (val == null || val === '') return '';
    const n = Number(String(val).replace(',', '.'));
    if (isNaN(n)) return '';
    const tariffs = ConvyISAF.VAT_TARIFFS || [0, 5, 9, 21];
    let nearest = tariffs[0];
    let minDist = Math.abs(n - nearest);
    for (let i = 1; i < tariffs.length; i++) {
      const d = Math.abs(n - tariffs[i]);
      if (d < minDist) { minDist = d; nearest = tariffs[i]; }
    }
    return String(nearest);
  },

  /**
   * Group mapped rows by invoice (invoiceNumber + documentType if present).
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
   * Build full i.SAF 1.2 XML string.
   * @param {Object} header - { companyName, registrationNumber, vatNumber, dataType, selectionStartDate, selectionEndDate }
   * @param {Object[]} mappedRows - from ConvyMapping.applyMapping
   */
  build(header, mappedRows) {
    const enc = this.escape;
    const fmtDate = this.formatDate;
    const fmtNum = this.formatNumber;
    const fmtVatRate = this.formatVatRate;
    const NS = 'http://www.vmi.lt/cms/imas/isaf';

    const softwareCompanyName = enc(header.softwareCompanyName || 'Convy');
    const softwareName = enc(header.softwareName || 'Convy');
    const softwareVersion = enc(header.softwareVersion || '1.0');
    const registrationNumber = enc(String(header.registrationNumber || '').replace(/\s/g, ''));
    const dataType = (header.dataType === 'F' || header.dataType === 'S' || header.dataType === 'P') ? header.dataType : 'F';
    const startDate = fmtDate(header.selectionStartDate) || fmtDate(new Date());
    const endDate = fmtDate(header.selectionEndDate) || fmtDate(new Date());
    const fileDateCreated = this.formatDateTime();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<iSAFFile xmlns="' + NS + '" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n';

    // Part I – Header > FileDescription
    xml += '  <Header>\n';
    xml += '    <FileDescription>\n';
    xml += '      <FileVersion>iSAF1.2</FileVersion>\n';
    xml += '      <FileDateCreated>' + fileDateCreated + '</FileDateCreated>\n';
    xml += '      <DataType>' + dataType + '</DataType>\n';
    xml += '      <SoftwareCompanyName>' + softwareCompanyName + '</SoftwareCompanyName>\n';
    xml += '      <SoftwareName>' + softwareName + '</SoftwareName>\n';
    xml += '      <SoftwareVersion>' + softwareVersion + '</SoftwareVersion>\n';
    xml += '      <RegistrationNumber>' + registrationNumber + '</RegistrationNumber>\n';
    xml += '      <NumberOfParts>1</NumberOfParts>\n';
    xml += '      <PartNumber>1</PartNumber>\n';
    xml += '      <SelectionCriteria>\n';
    xml += '        <SelectionStartDate>' + startDate + '</SelectionStartDate>\n';
    xml += '        <SelectionEndDate>' + endDate + '</SelectionEndDate>\n';
    xml += '      </SelectionCriteria>\n';
    xml += '    </FileDescription>\n';
    xml += '  </Header>\n';

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

    // Part II – MasterFiles: Customers, Suppliers (with Name)
    const customers = new Map();
    const suppliers = new Map();
    invoices.forEach(inv => {
      inv.lines.forEach(line => {
        const id = (line.counterpartyRegistrationNumber || line.counterpartyName || '').toString().trim();
        const vat = (line.counterpartyVatNumber || '').toString().trim() || 'ND';
        const country = (line.counterpartyCountry || '').toString().trim() || 'LT';
        const name = (line.counterpartyName || '').toString().trim() || 'ND';
        if (inv.isIssued && id) customers.set(id, { id, vat, country, name });
        if (!inv.isIssued && id) suppliers.set(id, { id, vat, country, name });
      });
    });

    if (customers.size || suppliers.size) {
      xml += '  <MasterFiles>\n';
      if (customers.size) {
        xml += '    <Customers>\n';
        customers.forEach((c) => {
          xml += '      <Customer>\n';
          xml += '        <CustomerID>' + enc(c.id) + '</CustomerID>\n';
          xml += '        <VATRegistrationNumber>' + enc(c.vat) + '</VATRegistrationNumber>\n';
          xml += '        <RegistrationNumber>' + enc(c.id) + '</RegistrationNumber>\n';
          xml += '        <Country>' + enc(c.country) + '</Country>\n';
          xml += '        <Name>' + enc(c.name || 'ND') + '</Name>\n';
          xml += '      </Customer>\n';
        });
        xml += '    </Customers>\n';
      }
      if (suppliers.size) {
        xml += '    <Suppliers>\n';
        suppliers.forEach((s) => {
          xml += '      <Supplier>\n';
          xml += '        <SupplierID>' + enc(s.id) + '</SupplierID>\n';
          xml += '        <VATRegistrationNumber>' + enc(s.vat) + '</VATRegistrationNumber>\n';
          xml += '        <RegistrationNumber>' + enc(s.id) + '</RegistrationNumber>\n';
          xml += '        <Country>' + enc(s.country) + '</Country>\n';
          xml += '        <Name>' + enc(s.name || 'ND') + '</Name>\n';
          xml += '      </Supplier>\n';
        });
        xml += '    </Suppliers>\n';
      }
      xml += '  </MasterFiles>\n';
    }

    // Part III – SourceDocuments: SalesInvoices (issued), PurchaseInvoices (received)
    const writeSalesInvoice = (inv) => {
      const first = inv.lines[0];
      const net = inv.lines.reduce((sum, l) => sum + (Number(String(l.netAmount).replace(',', '.')) || 0), 0);
      const vat = inv.lines.reduce((sum, l) => sum + (Number(String(l.vatAmount).replace(',', '.')) || 0), 0);
      const taxCode = (first.vatClassificationCode || '').toString().trim() || 'PVM1';
      const taxPct = fmtVatRate(first.vatRate) || '21';
      const invoiceDate = fmtDate(first.invoiceDate) || startDate;
      const buyerId = (first.counterpartyRegistrationNumber || first.counterpartyName || '').toString().trim();
      const buyerVat = (first.counterpartyVatNumber || '').toString().trim() || 'ND';
      const buyerCountry = (first.counterpartyCountry || '').toString().trim() || 'LT';
      const buyerName = (first.counterpartyName || '').toString().trim() || 'ND';

      xml += '      <Invoice>\n';
      xml += '        <InvoiceNo>' + enc(inv.invoiceNumber) + '</InvoiceNo>\n';
      xml += '        <CustomerInfo>\n';
      xml += '          <CustomerID>' + enc(buyerId) + '</CustomerID>\n';
      xml += '          <VATRegistrationNumber>' + enc(buyerVat) + '</VATRegistrationNumber>\n';
      xml += '          <RegistrationNumber>' + enc(buyerId) + '</RegistrationNumber>\n';
      xml += '          <Country>' + enc(buyerCountry) + '</Country>\n';
      xml += '          <Name>' + enc(buyerName) + '</Name>\n';
      xml += '        </CustomerInfo>\n';
      xml += '        <InvoiceDate>' + invoiceDate + '</InvoiceDate>\n';
      xml += '        <InvoiceType>SF</InvoiceType>\n';
      xml += '        <SpecialTaxation></SpecialTaxation>\n';
      xml += '        <References></References>\n';
      xml += '        <VATPointDate xsi:nil="true"></VATPointDate>\n';
      xml += '        <DocumentTotals>\n';
      xml += '          <DocumentTotal>\n';
      xml += '            <TaxableValue>' + fmtNum(net) + '</TaxableValue>\n';
      xml += '            <TaxCode>' + enc(taxCode) + '</TaxCode>\n';
      xml += '            <TaxPercentage>' + taxPct + '</TaxPercentage>\n';
      xml += '            <Amount>' + fmtNum(vat) + '</Amount>\n';
      xml += '            <VATPointDate2 xsi:nil="true"></VATPointDate2>\n';
      xml += '          </DocumentTotal>\n';
      xml += '        </DocumentTotals>\n';
      xml += '      </Invoice>\n';
    };

    const writePurchaseInvoice = (inv) => {
      const first = inv.lines[0];
      const net = inv.lines.reduce((sum, l) => sum + (Number(String(l.netAmount).replace(',', '.')) || 0), 0);
      const vat = inv.lines.reduce((sum, l) => sum + (Number(String(l.vatAmount).replace(',', '.')) || 0), 0);
      const taxCode = (first.vatClassificationCode || '').toString().trim() || 'PVM1';
      const taxPct = fmtVatRate(first.vatRate) || '21';
      const invoiceDate = fmtDate(first.invoiceDate) || startDate;
      const supplierId = (first.counterpartyRegistrationNumber || first.counterpartyName || '').toString().trim();
      const supplierVat = (first.counterpartyVatNumber || '').toString().trim() || 'ND';
      const supplierCountry = (first.counterpartyCountry || '').toString().trim() || 'LT';
      const supplierName = (first.counterpartyName || '').toString().trim() || 'ND';

      xml += '      <Invoice>\n';
      xml += '        <InvoiceNo>' + enc(inv.invoiceNumber) + '</InvoiceNo>\n';
      xml += '        <SupplierInfo>\n';
      xml += '          <SupplierID>' + enc(supplierId) + '</SupplierID>\n';
      xml += '          <VATRegistrationNumber>' + enc(supplierVat) + '</VATRegistrationNumber>\n';
      xml += '          <RegistrationNumber>' + enc(supplierId) + '</RegistrationNumber>\n';
      xml += '          <Country>' + enc(supplierCountry) + '</Country>\n';
      xml += '          <Name>' + enc(supplierName) + '</Name>\n';
      xml += '        </SupplierInfo>\n';
      xml += '        <InvoiceDate>' + invoiceDate + '</InvoiceDate>\n';
      xml += '        <InvoiceType>SF</InvoiceType>\n';
      xml += '        <SpecialTaxation></SpecialTaxation>\n';
      xml += '        <References></References>\n';
      xml += '        <VATPointDate xsi:nil="true"></VATPointDate>\n';
      xml += '        <RegistrationAccountDate xsi:nil="true"></RegistrationAccountDate>\n';
      xml += '        <DocumentTotals>\n';
      xml += '          <DocumentTotal>\n';
      xml += '            <TaxableValue>' + fmtNum(net) + '</TaxableValue>\n';
      xml += '            <TaxCode>' + enc(taxCode) + '</TaxCode>\n';
      xml += '            <TaxPercentage>' + taxPct + '</TaxPercentage>\n';
      xml += '            <Amount>' + fmtNum(vat) + '</Amount>\n';
      xml += '          </DocumentTotal>\n';
      xml += '        </DocumentTotals>\n';
      xml += '      </Invoice>\n';
    };

    if (issued.length || received.length) {
      xml += '  <SourceDocuments>\n';
      if (received.length) {
        xml += '    <PurchaseInvoices>\n';
        received.forEach(writePurchaseInvoice);
        xml += '    </PurchaseInvoices>\n';
      }
      if (issued.length) {
        xml += '    <SalesInvoices>\n';
        issued.forEach(writeSalesInvoice);
        xml += '    </SalesInvoices>\n';
      }
      xml += '  </SourceDocuments>\n';
    }
    xml += '</iSAFFile>';
    return xml;
  },
};
(function(g){ if (g) { g.ConvyISAF = ConvyISAF; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
