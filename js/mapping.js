/**
 * Column mapping: i.SAF fields <-> Excel columns.
 * Field IDs match what isaf-builder and missing-data expect.
 */
var ConvyMapping = {
  /** i.SAF fields for file header (user form / missing-data) */
  headerFields: [
    { id: 'companyName', label: 'Įmonės pavadinimas', required: true },
    { id: 'registrationNumber', label: 'Įmonės kodas (9 skaitmenų)', required: true, validate: 'companyCode' },
    { id: 'vatNumber', label: 'PVM mokėtojo kodas', required: true },
    { id: 'dataType', label: 'Duomenų tipas (F/S/P)', required: true },
    { id: 'selectionStartDate', label: 'Laikotarpio pradžia', required: true, validate: 'date' },
    { id: 'selectionEndDate', label: 'Laikotarpio pabaiga', required: true, validate: 'date' },
  ],

  /** i.SAF fields from Excel. Required (bold) = mandatory for valid XML; VMI requires amounts, counterparty, tax rate, tax code. */
  excelMappableFields: [
    { id: 'invoiceNumber', label: 'Sąskaitos faktūros numeris', required: true },
    { id: 'invoiceDate', label: 'Sąskaitos data', required: true },
    { id: 'documentType', label: 'Tipas (Išrašyta / Gauta)', required: true },
    { id: 'counterpartyName', label: 'Pirkėjas / Tiekėjas (pavadinimas)', required: true },
    { id: 'counterpartyRegistrationNumber', label: 'Pirkėjo / Tiekėjo kodas', required: true },
    { id: 'counterpartyVatNumber', label: 'Pirkėjo / Tiekėjo PVM kodas', required: true },
    { id: 'counterpartyCountry', label: 'Šalis (kodas)', required: false },
    { id: 'description', label: 'Aprašymas / Prekės paslaugos', required: false },
    { id: 'quantity', label: 'Kiekis', required: false },
    { id: 'unitPrice', label: 'Kaina vnt.', required: false },
    { id: 'netAmount', label: 'Suma be PVM', required: true },
    { id: 'vatRate', label: 'Mokesčio tarifas / PVM tarifas (%)', required: true },
    { id: 'vatClassificationCode', label: 'PVM klasifikatoriaus kodas (pvz. PVM1, PVM2 – gali būti skaičiuojamas iš tarifo)', required: false },
    { id: 'vatAmount', label: 'PVM suma', required: true },
    { id: 'grossAmount', label: 'Suma su PVM (nebūtina – skaičiuojama iš Suma be PVM + PVM suma)', required: false },
  ],

  /**
   * Build mapping table state: list of { fieldId, label, required, columnKey }.
   * columnKey = Excel column letter or header label (from parser).
   */
  buildMappingSchema(headerLabels) {
    const columns = ['—', ...(headerLabels || [])];
    return this.excelMappableFields.map(f => ({
      fieldId: f.id,
      label: f.label,
      required: !!f.required,
      columnKey: f.required ? (headerLabels && headerLabels[0]) : '—',
      options: columns,
    }));
  },

  /**
   * Normalize date to YYYY-MM-DD for i.SAF. Handles Excel serial, Date objects, YYYY-MM-DD, DD.MM.YYYY, MM/DD/YY.
   */
  normalizeDateToYMD(val) {
    if (val == null || val === '') return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
    }
    const s = String(val).trim();
    if (!s) return '';
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return m1[0];
    const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m2) {
      const [, d, mo, y] = m2;
      return y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    const m3 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
    if (m3) {
      const [, d, mo, yy] = m3;
      const y = parseInt(yy, 10) >= 0 && parseInt(yy, 10) <= 50 ? 2000 + parseInt(yy, 10) : 1900 + parseInt(yy, 10);
      return y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m4) {
      const [, a, b, y] = m4;
      const mo = parseInt(a, 10) <= 12 ? a : b;
      const d = parseInt(a, 10) <= 12 ? b : a;
      return y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    const m5 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m5) {
      const [, a, b, yy] = m5;
      const y = parseInt(yy, 10) >= 0 && parseInt(yy, 10) <= 50 ? 2000 + parseInt(yy, 10) : 1900 + parseInt(yy, 10);
      const mo = parseInt(a, 10) <= 12 ? a : b;
      const d = parseInt(a, 10) <= 12 ? b : a;
      return y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    if (typeof val === 'number' && val > 0) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + val * 86400000);
      if (isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  /**
   * Remove duplicate column assignments: each column may map to only one field. First field wins.
   */
  deduplicateMapping(mapping) {
    const seen = new Set();
    const out = { ...mapping };
    this.excelMappableFields.forEach(f => {
      const col = out[f.id];
      if (col && col !== '—') {
        if (seen.has(col)) out[f.id] = '—';
        else seen.add(col);
      }
    });
    return out;
  },

  /**
   * Apply current mapping (object: fieldId -> columnKey) to sheet data (array of objects with column keys).
   * Returns array of normalized invoice rows { fieldId: value }.
   */
  applyMapping(mapping, sheetObjects) {
    const parseNum = (v) => {
      if (v == null || v === '') return NaN;
      return Number(String(v).replace(',', '.'));
    };
    const rateToTaxCode = (rate) => {
      if (isNaN(rate)) return '';
      const r = Math.round(rate);
      if (r >= 20 && r <= 22) return 'PVM1';
      if (r >= 8 && r <= 10) return 'PVM2';
      if (r >= 4 && r <= 6) return 'PVM3';
      if (r === 0) return 'PVM4';
      return 'PVM1';
    };
    const deduped = this.deduplicateMapping(mapping);
    return sheetObjects.map(row => {
      const out = {};
      this.excelMappableFields.forEach(f => {
        const col = deduped[f.id];
        let val = col && col !== '—' && row[col] != null ? row[col] : '';
        if (f.id === 'invoiceDate' && val) val = this.normalizeDateToYMD(val) || val;
        out[f.id] = val;
      });
      if ((out.grossAmount == null || out.grossAmount === '') && (out.netAmount != null && out.netAmount !== '') && (out.vatAmount != null && out.vatAmount !== '')) {
        const net = parseNum(out.netAmount);
        const vat = parseNum(out.vatAmount);
        if (!isNaN(net) && !isNaN(vat)) out.grossAmount = String(net + vat);
      }
      if ((out.vatClassificationCode == null || out.vatClassificationCode === '') && (out.netAmount != null && out.netAmount !== '') && (out.vatAmount != null && out.vatAmount !== '')) {
        const net = parseNum(out.netAmount);
        const vat = parseNum(out.vatAmount);
        if (!isNaN(net) && net !== 0) {
          const rate = (vat / net) * 100;
          out.vatClassificationCode = rateToTaxCode(rate);
        }
      }
      if ((out.vatRate == null || out.vatRate === '') && (out.netAmount != null && out.netAmount !== '') && (out.vatAmount != null && out.vatAmount !== '')) {
        const net = parseNum(out.netAmount);
        const vat = parseNum(out.vatAmount);
        if (!isNaN(net) && net !== 0) {
          const rate = (vat / net) * 100;
          out.vatRate = String(Math.round(rate * 100) / 100);
          const stdRates = [0, 5, 9, 21];
          const near = stdRates.some(r => Math.abs(rate - r) <= 1.5);
          if (!near) out._vatRateSuspicious = true;
        }
      } else if (out.vatRate != null && out.vatRate !== '') {
        const r = parseNum(out.vatRate);
        if (!isNaN(r)) {
          const stdRates = [0, 5, 9, 21];
          if (!stdRates.some(sr => Math.abs(r - sr) <= 1.5)) out._vatRateSuspicious = true;
        }
      }
      if ((out.counterpartyCountry == null || String(out.counterpartyCountry).trim() === '') && (out.counterpartyVatNumber != null && String(out.counterpartyVatNumber).trim().toUpperCase().startsWith('LT'))) {
        out.counterpartyCountry = 'LT';
      }
      return out;
    });
  },

  /**
   * Score how well a column's sample values fit an i.SAF field (for content-based matching).
   * @param {string} fieldId
   * @param {any[]} values - array of cell values from one column
   * @returns {number} 0..1
   */
  scoreColumnContentForField(fieldId, values) {
    const nonEmpty = (values || []).filter(v => v != null && String(v).trim() !== '');
    if (nonEmpty.length === 0) return 0;
    const str = (v) => String(v).trim().toLowerCase();
    const all = nonEmpty.map(str);
    const unique = [...new Set(all)];
    let matchCount = 0;
    switch (fieldId) {
      case 'documentType': {
        const docTypeTokens = [
          'israsyt', 'gauta', 'issued', 'received', 'invoice', 'credit', 's', 'p', 'i', 'f',
          'tipas', 'type', 'sf', 'gaut', 'pardavimai', 'pirkimai', 'sales', 'purchases',
          'israsyta', 'sale', 'purchase', 'outgoing', 'incoming', 'out', 'in', 'pardavim',
          'pirkim', 'gavimas', 'isdavimas', 'debit', 'flow'
        ];
        const norm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        matchCount = all.filter(s => {
          const n = norm(s);
          return docTypeTokens.some(t => n.includes(norm(t)) || n === norm(t) || /^[spif]$/.test(n));
        }).length;
        break;
      }
      case 'counterpartyRegistrationNumber': {
        matchCount = all.filter(s => {
          const t = String(s).replace(/\s/g, '');
          return /^[0-9]{9}$/.test(t) || /^[A-Za-z0-9]{8,11}$/.test(t);
        }).length;
        break;
      }
      case 'counterpartyVatNumber': {
        const str = (v) => String(v).trim().toLowerCase();
        matchCount = all.filter(s => /^LT[0-9]{8,12}$/i.test(String(s).replace(/\s/g, '')) || str(s) === 'nd').length;
        break;
      }
      case 'counterpartyCountry': {
        matchCount = all.filter(s => /^[A-Za-z]{2}$/.test(String(s).trim())).length;
        break;
      case 'description': {
        const avgLen = all.reduce((a, s) => a + s.length, 0) / all.length;
        const multiWord = all.filter(s => s.split(/\s+/).length >= 2).length;
        return (Math.min(1, avgLen / 20) * 0.5 + (multiWord / nonEmpty.length) * 0.5);
      }
      case 'quantity': {
        matchCount = all.filter(s => /^\d+([.,]\d+)?$/.test(String(s).replace(',', '.'))).length;
        break;
      }
      case 'unitPrice': {
        matchCount = all.filter(s => /^-?\d+([.,]\d+)?$/.test(String(s).replace(',', '.'))).length;
        break;
      case 'vatRate': {
        const stdRates = [0, 5, 9, 21];
        matchCount = all.filter(s => {
          const n = parseFloat(String(s).replace(',', '.').replace('%', ''));
          return !isNaN(n) && stdRates.some(r => Math.abs(n - r) <= 0.5);
        }).length;
        break;
      }
      case 'vatAmount': {
        matchCount = all.filter(s => /^-?\d+([.,]\d+)?$/.test(String(s).replace(',', '.'))).length;
        break;
      }
      default:
        return 0;
    }
    return matchCount / nonEmpty.length;
  },

  /**
   * Try to auto-detect column mapping from header labels, then from content for unmatched fields.
   * @param {string[]} headers - column header row
   * @param {function(number): string} [getColumnKey] - (i) => value to use in mapping (header or letter)
   * @param {Object[]} [sampleRows] - optional array of row objects (keys = column keys) for content-based matching
   */
  suggestMappingFromHeaders(headers, getColumnKey, sampleRows) {
    const hints = {
      invoiceNumber: ['nr', 'numeris', 'number', 'sf', 'saskaitos', 'sąskaitos', 'invoice', 'no', 'no.', 'serija', 'invoice_id', 'id', 'pvm saskaitos fakturos numeris', 'pvm sąskaitos faktūros numeris', 'pvm sf numeris', 'dokumento numeris', 'fakturos numeris', 'pvm sf nr', 'inv no', 'inv#', 'invoice no', 'invoice ref', 'doc number', 'document no', 'reference', 'inv_num', 'ref', 'doc_num', 'invoice_number'],
      invoiceDate: ['data', 'date', 'dat', 'datra', 'saskaitos data', 'sąskaitos data', 'issuance', 'isdavimo data', 'data sf', 'pvm saskaitos fakturos data', 'pvm sąskaitos faktūros data', 'fakturos data', 'dokumento data', 'pvm sf data', 'invoice date', 'issue date', 'doc date', 'created', 'created date', 'bill date', 'invoice_date', 'inv_date', 'document_date'],
      documentType: ['tipas', 'type', 'israsyt', 'gaut', 'issued', 'received', 'invoice_type', 'dokumento tipas', 'pardavimai', 'pirkimai', 'sales', 'purchases', 'kryptis', 'direction', 'rūšis', 'kind', 'doc_type', 'doc type', 'pvm saskaitos fakturos tipas', 'pvm sf tipas', 'flow', 'transaction_type', 'in out', 'sale purchase', 'gavimas', 'isdavimas'],
      counterpartyName: ['pirkėjas', 'pirkėj', 'tiekėjas', 'tiekėj', 'buyer', 'supplier', 'customer', 'client', 'pavadinimas', 'name', 'company_name', 'kontrahentas', 'klientas', 'imoner', 'imone', 'imon', 'įmonė', 'pardavejas', 'pirkėjo pavadinimas', 'tiekėjo pavadinimas', 'vendor', 'customer name', 'company name', 'party name', 'vendor_name', 'customer_name', 'company', 'organization', 'counterparty', 'pirkėjo/tiekėjo'],
      counterpartyRegistrationNumber: ['kodas', 'code', 'imones kodas', 'įmonės kodas', 'registration', 'tax_code', 'pirkėjo kodas', 'tiekėjo kodas', 'registracijos numeris', 'juridinio asmens kodas', 'jak', 'company code', 'registration number', 'tax id', 'org number', 'company number', 'reg no', 'registration_no', 'company_number', 'organization_number', 'org_no', 'company_code'],
      counterpartyVatNumber: ['pvm kodas', 'pvm mokėtojo', 'vat number', 'vat kodas', 'pirkėjo pvm', 'tiekėjo pvm', 'pvm mokėtojo kodas', 'vat no', 'vat id', 'vat code', 'vat reg', 'vat_registration', 'tax number', 'vat_number'],
      counterpartyCountry: ['šalis', 'salis', 'šalies kodas', 'salies kodas', 'country', 'valstybe', 'valstybė', 'country code', 'country_code', 'iso', 'šalies', 'country_iso'],
      description: ['aprašymas', 'aprasymas', 'description', 'prekes', 'prekės', 'paslaugos', 'item', 'prekių aprašymas', 'desc', 'product', 'service', 'goods', 'line_description', 'product_description', 'item_description', 'prekės paslaugos'],
      quantity: ['kiekis', 'quantity', 'qty', 'amount', 'units', 'vnt', 'kiek', 'qty_ordered', 'ordered_qty', 'quantity_ordered'],
      unitPrice: ['kaina', 'price', 'vnt', 'unit', 'kaina vnt', 'vnt kaina', 'vieneto kaina', 'unit price', 'unit_price', 'price per unit', 'price_per_unit', 'unit_cost', 'price_vnt'],
      netAmount: ['suma be pvm', 'net', 'be pvm', 'without vat', 'without_vat', 'amount_without', 'amount_without_vat', 'amount', 'suma', 'avra', 'apmokest', 'vertė', 'verte', 'taxable', 'value', 'neto', 'apmokestinama suma', 'net amount', 'amount without vat', 'taxable amount', 'base amount', 'subtotal', 'net_amount', 'amount_net', 'suma_be_pvm'],
      vatRate: ['tarifas', 'rate', 'pvm %', 'vat rate', 'mokescio tarifas', 'mokesčio tarifas', 'tax rate', 'pvm tarifas', 'tarifas %', 'vat %', 'vat_rate', 'tax_rate', 'rate %', 'pvm_procentas'],
      vatClassificationCode: ['pvm klasifikatoriaus', 'klasifikatoriaus kodas', 'tax code', 'pvm1', 'pvm2', 'pvm3', 'pvm4', 'pvm kodas klasifikatorius', 'tax_classification', 'vat_classification_code'],
      vatAmount: ['pvm suma', 'vat amount', 'vat_amount', 'vat_amount_eur', 'amount_vat', 'pvm eur', 'nds', 'pvm suma eur', 'vat sum', 'vat_amount_eur', 'amount_vat_eur', 'vat_total', 'tax amount', 'pvm mokestis', 'pvm_suma'],
      grossAmount: ['suma su pvm', 'gross', 'su pvm', 'total', 'with vat', 'with_vat', 'amount_with_vat', 'bendra suma', 'avra', 'suma su pvm eur', 'is viso', 'iš viso', 'gross amount', 'total amount', 'amount with vat', 'gross_amount', 'total_amount', 'bendra_suma'],
    };
    const mapping = {};
    const lower = (s) => (s != null ? String(s).toLowerCase() : '');
    const norm = (s) => (lower(s) || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const columnKeys = [];
    for (let i = 0; i < (headers || []).length; i++) {
      columnKeys[i] = typeof getColumnKey === 'function' ? getColumnKey(i) : (headers[i] || '—');
    }
    this.excelMappableFields.forEach(f => {
      const words = (hints[f.id] || []).concat([f.id]);
      for (let i = 0; i < (headers || []).length; i++) {
        const h = lower(headers[i]);
        const hNorm = norm(headers[i]);
        if (f.id === 'vatAmount' && (hNorm.includes('fakturos') || hNorm.includes('saskaitos') || h.includes('without') || h.includes('without_vat') || h.includes('be pvm') || ['kodas','numeris','tarifas','data','tipas'].some(s => hNorm.includes(norm(s)) || h.includes(s)))) continue;
        if (f.id === 'vatRate' && (h.includes('amount') || h.includes('eur') || h.includes('suma')) && !h.includes('rate') && !h.includes('tarifas')) continue;
        if (f.id === 'netAmount' && ((hNorm.includes(norm('pvm suma')) || h.includes('pvm suma')) && !(hNorm.includes(norm('be pvm')) || h.includes('be pvm')) || h.includes('vat_amount') || h.includes('amount_vat') || (h.includes('vat amount') && !h.includes('without')))) continue;
        if (f.id === 'counterpartyRegistrationNumber' && (h.includes('pvm') || h.includes('šalies') || h.includes('salies'))) continue;
        if (f.id === 'invoiceNumber' && ((h.includes('data') && !h.includes('nr') && !h.includes('numeris')) || h.includes('mokesčių mokėtojo') || h.includes('identifikacinis'))) continue;
        if (f.id === 'invoiceDate' && (h.includes(' nr') || h.includes(' nr.') || (h.includes('numeris') && !h.includes('data')))) continue;
        if (words.some(w => h.includes(w) || hNorm.includes(norm(w)))) {
          mapping[f.id] = columnKeys[i];
          break;
        }
      }
      if (!mapping[f.id]) mapping[f.id] = '—';
    });

    if (sampleRows && sampleRows.length > 0 && columnKeys.length > 0) {
      const usedColumns = new Set(Object.values(mapping).filter(v => v && v !== '—'));
      const contentFields = ['documentType', 'counterpartyRegistrationNumber', 'counterpartyVatNumber', 'counterpartyCountry', 'description', 'quantity', 'unitPrice', 'vatRate', 'vatAmount'];
      contentFields.forEach(fieldId => {
        if (mapping[fieldId] && mapping[fieldId] !== '—') return;
        let bestKey = null;
        let bestScore = 0.25;
        columnKeys.forEach((colKey, colIdx) => {
          if (usedColumns.has(colKey)) return;
          const header = lower((headers || [])[colIdx] || colKey);
          if (fieldId === 'vatRate' && (header.includes('amount') || header.includes('eur') || header.includes('suma')) && !header.includes('rate') && !header.includes('tarifas')) return;
          const values = sampleRows.map(r => r[colKey]);
          const score = this.scoreColumnContentForField(fieldId, values);
          if (score > bestScore) {
            bestScore = score;
            bestKey = colKey;
          }
        });
        if (bestKey) {
          mapping[fieldId] = bestKey;
          usedColumns.add(bestKey);
        }
      });
    }

    return this.deduplicateMapping(mapping);
  },
};
(function(g){ if (g) { g.ConvyMapping = ConvyMapping; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
