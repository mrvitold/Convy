/**
 * Missing required data: detect, ask in Lithuanian, collect answers, optional AI fill.
 */
const ConvyMissingData = {
  /** Lithuanian questions for header fields */
  questions: {
    companyName: 'Įmonės pavadinimas nerastas. Įveskite įmonės pavadinimą.',
    registrationNumber: 'Įmonės kodas nerastas failo antraštėje. Įveskite įmonės kodą (9 skaitmenų).',
    vatNumber: 'PVM mokėtojo kodas neįvestas. Įveskite PVM kodą (pvz. LT123456789 arba LT123456789012) arba ND, jei neturi.',
    dataType: 'Pasirinkite duomenų tipą: F (pilnas), S (tik išrašytos SF), P (tik gautos SF).',
    selectionStartDate: 'Laikotarpio pradžios data trūksta. Pasirinkite pradžios datą.',
    selectionEndDate: 'Laikotarpio pabaigos data trūksta. Pasirinkite pabaigos datą.',
  },

  hints: {
    registrationNumber: 'Įmonės kodas turi būti 9 skaitmenų.',
    vatNumber: 'PVM kodas: LT + 8–12 skaitmenų arba ND.',
    selectionStartDate: 'Data turi būti nuo 30 m. atgal iki 5 m. į priekį.',
    selectionEndDate: 'Data turi būti nuo 30 m. atgal iki 5 m. į priekį.',
  },

  /**
   * Validate single value by rule.
   * @param {string} fieldId - e.g. registrationNumber, selectionStartDate
   * @param {string} value
   * @returns {boolean} true if valid
   */
  /** Date range: 30 years ago to 5 years ahead */
  _dateInRange(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setFullYear(min.getFullYear() - 30);
    const max = new Date(today);
    max.setFullYear(max.getFullYear() + 5);
    return d >= min && d <= max;
  },

  validate(fieldId, value) {
    const v = (value != null ? String(value) : '').trim();
    switch (fieldId) {
      case 'registrationNumber':
      case 'companyCode':
        return /^[0-9]{9}$/.test(v.replace(/\s/g, ''));
      case 'vatNumber':
        return v.toUpperCase() === 'ND' || /^LT[0-9]{8,12}$/.test(v.replace(/\s/g, '').toUpperCase());
      case 'selectionStartDate':
      case 'selectionEndDate':
        return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime()) && this._dateInRange(v);
      case 'dataType':
        return ['F', 'S', 'P'].includes(v);
      default:
        return v.length > 0;
    }
  },

  /**
   * Collect header values from form (or state object).
   * @param {Object} formValues - { companyName, companyCode, vatNumber, dataType, periodStart, periodEnd }
   * @returns {Object} normalized header for isaf-builder
   */
  getHeaderFromForm(formValues) {
    return {
      companyName: (formValues.companyName || '').trim(),
      registrationNumber: (formValues.registrationNumber || formValues.companyCode || '').replace(/\s/g, ''),
      vatNumber: (formValues.vatNumber || '').trim(),
      dataType: (formValues.dataType || 'F').toUpperCase().slice(0, 1),
      selectionStartDate: formValues.selectionStartDate || formValues.periodStart || '',
      selectionEndDate: formValues.selectionEndDate || formValues.periodEnd || '',
      softwareCompanyName: formValues.softwareCompanyName || 'Convy',
      softwareName: formValues.softwareName || 'Convy',
      softwareVersion: formValues.softwareVersion || '1.0',
    };
  },

  /**
   * Check which required header fields are missing or invalid.
   * @param {Object} header - from getHeaderFromForm
   * @returns {{ fieldId: string, message: string, hint?: string }[]}
   */
  checkHeader(header) {
    const h = header || {};
    const out = [];
    const fields = [
      { id: 'companyName', key: 'companyName' },
      { id: 'registrationNumber', key: 'registrationNumber' },
      { id: 'selectionStartDate', key: 'selectionStartDate' },
      { id: 'selectionEndDate', key: 'selectionEndDate' },
      { id: 'vatNumber', key: 'vatNumber' },
      { id: 'dataType', key: 'dataType' },
    ];
    fields.forEach(({ id, key }) => {
      const value = h[key];
      if (!this.validate(id, value)) {
        let message = this.questions[id] || `Trūksta: ${id}`;
        if ((id === 'selectionStartDate' || id === 'selectionEndDate') && value && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) && !this._dateInRange(String(value).trim())) {
          message = (id === 'selectionStartDate' ? 'Laikotarpio pradžios' : 'Laikotarpio pabaigos') + ' data už leidžiamo laiko (30 m. atgal – 5 m. į priekį).';
        }
        out.push({
          fieldId: id,
          message,
          hint: this.hints[id],
        });
      }
    });
    return out;
  },

  /**
   * Normalize date to YYYY-MM-DD for range check.
   */
  _normalizeDate(val) {
    if (val == null || val === '') return null;
    const s = String(val).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return m[0];
    let d;
    if (typeof val === 'number' && val > 0) {
      d = new Date((val - 25569) * 86400 * 1000);
    } else {
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  /** Valid Lithuanian VAT tariffs (%). */
  VAT_TARIFFS: [0, 5, 9, 21],

  _vatRateDiffFromNearest(rate) {
    const n = Number(String(rate).replace(',', '.'));
    if (isNaN(n)) return { nearest: null, diff: null };
    const tariffs = this.VAT_TARIFFS;
    let nearest = tariffs[0];
    let minDist = Math.abs(n - nearest);
    for (let i = 1; i < tariffs.length; i++) {
      const d = Math.abs(n - tariffs[i]);
      if (d < minDist) { minDist = d; nearest = tariffs[i]; }
    }
    return { nearest, diff: minDist };
  },

  /**
   * Check mapped rows for missing required invoice-level fields (e.g. invoice number, date).
   * Also checks date range and VAT rate validity.
   * Returns list of { invoiceIndex, fieldId, message } for first N issues.
   */
  checkMappedRows(mappedRows, maxIssues = 15) {
    const issues = [];
    (mappedRows || []).forEach((row, i) => {
      if (issues.length >= maxIssues) return;
      if (!(row.invoiceNumber != null && String(row.invoiceNumber).trim())) {
        issues.push({ invoiceIndex: i, fieldId: 'invoiceNumber', message: `Eilutė ${i + 1}: trūksta sąskaitos faktūros numerio.` });
      }
      const dateVal = row.invoiceDate != null ? String(row.invoiceDate).trim() : '';
      if (!dateVal) {
        issues.push({ invoiceIndex: i, fieldId: 'invoiceDate', message: `Eilutė ${i + 1}: trūksta sąskaitos datos.` });
      } else {
        const norm = this._normalizeDate(row.invoiceDate);
        if (norm && !this._dateInRange(norm)) {
          issues.push({ invoiceIndex: i, fieldId: 'invoiceDate', message: `Eilutė ${i + 1}: data už leidžiamo laiko (30 m. atgal – 5 m. į priekį).` });
        }
      }
      const vatRateVal = row.vatRate != null ? String(row.vatRate).trim() : '';
      if (vatRateVal) {
        const { nearest, diff } = this._vatRateDiffFromNearest(vatRateVal);
        if (nearest != null && diff !== null && diff > 1.5) {
          issues.push({ invoiceIndex: i, fieldId: 'vatRate', message: `Eilutė ${i + 1}: PVM tarifas (${vatRateVal}%) nutolęs nuo leidžiamų (0, 5, 9, 21%) daugiau nei 1.5%. Artimiausias: ${nearest}%. Patikrinkite.` });
        }
      } else if (row._vatRateSuspicious) {
        issues.push({ invoiceIndex: i, fieldId: 'vatRate', message: `Eilutė ${i + 1}: mokesčio tarifas neatitinka standartinių (0, 5, 9, 21%). Patikrinkite.` });
      }
      const regNum = (row.counterpartyRegistrationNumber != null ? String(row.counterpartyRegistrationNumber).replace(/\s/g, '') : '');
      const isPlaceholder = (v) => /\([^)]+\)/.test(String(v || '').trim());
      if (regNum && !isPlaceholder(regNum) && !/^[0-9]{8,12}$/.test(regNum)) {
        issues.push({ invoiceIndex: i, fieldId: 'counterpartyRegistrationNumber', message: `Eilutė ${i + 1}: pirkėjo/tiekėjo kodas turėtų būti 8–12 skaitmenų.` });
      }
      const vatNum = (row.counterpartyVatNumber != null ? String(row.counterpartyVatNumber).trim().toUpperCase().replace(/\s/g, '') : '');
      const vatValid = !vatNum || vatNum === 'ND' || /^LT[0-9]{8,12}$/.test(vatNum) || /^[0-9]{8,12}$/.test(vatNum);
      if (vatNum && !isPlaceholder(vatNum) && !vatValid) {
        issues.push({ invoiceIndex: i, fieldId: 'counterpartyVatNumber', message: `Eilutė ${i + 1}: PVM kodas turėtų būti LT + 8–12 skaitmenų arba ND.` });
      }
    });
    return issues;
  },
};
(function(g){ if (g) { g.ConvyMissingData = ConvyMissingData; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
