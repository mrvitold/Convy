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
    return sheetObjects.map(row => {
      const out = {};
      this.excelMappableFields.forEach(f => {
        const col = mapping[f.id];
        out[f.id] = col && col !== '—' && row[col] != null ? row[col] : '';
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
        if (!isNaN(net) && net !== 0) out.vatRate = String(Math.round((vat / net) * 100 * 100) / 100);
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
          'israsyta', 'sale', 'purchase', 'outgoing', 'incoming', 'out', 'in'
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
        matchCount = all.filter(s => /^LT[0-9]{9}$/i.test(String(s).replace(/\s/g, '')) || str(s) === 'nd').length;
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
        matchCount = all.filter(s => /^\d+([.,]\d+)?%?$/.test(String(s).replace(',', '.').replace('%', ''))).length;
        break;
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
      invoiceNumber: ['nr', 'numeris', 'number', 'sf', 'saskaitos', 'sąskaitos', 'invoice', 'no', 'no.', 'serija', 'invoice_id', 'id', 'pvm saskaitos fakturos numeris', 'pvm sąskaitos faktūros numeris'],
      invoiceDate: ['data', 'date', 'dat', 'datra', 'saskaitos data', 'sąskaitos data', 'issuance', 'isdavimo', 'pvm saskaitos fakturos data', 'pvm sąskaitos faktūros data'],
      documentType: ['tipas', 'type', 'israsyt', 'gaut', 'issued', 'received', 'invoice_type', 'dokumento', 'pardavimai', 'pirkimai', 'sales', 'purchases', 'kryptis', 'direction', 'rūšis', 'kind', 'doc_type', 'doc type', 'pvm saskaitos fakturos tipas'],
      counterpartyName: ['pirkėjas', 'pirkėj', 'tiekėjas', 'tiekėj', 'buyer', 'supplier', 'customer', 'client', 'pavadinimas', 'name', 'company_name', 'kontrahentas', 'klientas', 'imoner', 'imone', 'imon', 'įmonė'],
      counterpartyRegistrationNumber: ['kodas', 'code', 'imones kodas', 'įmonės kodas', 'registration', 'tax_code', 'pirkėjo kodas', 'tiekėjo kodas'],
      counterpartyVatNumber: ['pvm kodas', 'pvm mokėtojo', 'vat number', 'vat kodas'],
      counterpartyCountry: ['šalis', 'salis', 'country', 'valstybe'],
      description: ['aprašymas', 'aprasymas', 'description', 'prekes', 'prekės', 'paslaugos', 'item'],
      quantity: ['kiekis', 'quantity', 'qty'],
      unitPrice: ['kaina', 'price', 'vnt', 'unit'],
      netAmount: ['suma be pvm', 'net', 'be pvm', 'without vat', 'without_vat', 'amount_without', 'amount_without_vat', 'amount', 'suma', 'avra', 'apmokest', 'vertė', 'verte', 'taxable', 'value'],
      vatRate: ['tarifas', 'rate', 'pvm %', 'vat rate', 'mokescio tarifas', 'mokesčio tarifas', 'tax rate'],
      vatClassificationCode: ['pvm klasifikatoriaus', 'klasifikatoriaus kodas', 'tax code', 'pvm1', 'pvm2', 'pvm3', 'pvm4'],
      vatAmount: ['pvm suma', 'vat amount', 'vat_amount', 'amount_vat', 'pvm eur', 'vat', 'pvm', 'nds'],
      grossAmount: ['suma su pvm', 'gross', 'su pvm', 'total', 'with vat', 'with_vat', 'amount_with_vat', 'bendra suma', 'avra'],
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
        if (f.id === 'vatAmount' && ['kodas','numeris','sąskaitos','faktūros','tarifas','be pvm'].some(s => h.includes(s))) continue;
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
      const contentFields = ['documentType', 'counterpartyRegistrationNumber', 'counterpartyVatNumber', 'counterpartyCountry', 'description', 'quantity', 'unitPrice', 'vatRate'];
      contentFields.forEach(fieldId => {
        if (mapping[fieldId] && mapping[fieldId] !== '—') return;
        let bestKey = null;
        let bestScore = 0.25;
        columnKeys.forEach(colKey => {
          if (usedColumns.has(colKey)) return;
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

    return mapping;
  },
};
(function(g){ if (g) { g.ConvyMapping = ConvyMapping; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
