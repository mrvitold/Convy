/**
 * Missing required data: detect, ask in Lithuanian, collect answers, optional AI fill.
 */
const ConvyMissingData = {
  /** Lithuanian questions for header fields */
  questions: {
    companyName: 'Įmonės pavadinimas nerastas. Įveskite įmonės pavadinimą.',
    registrationNumber: 'Įmonės kodas nerastas failo antraštėje. Įveskite įmonės kodą (9 skaitmenų).',
    vatNumber: 'PVM mokėtojo kodas neįvestas. Įveskite PVM kodą (pvz. LT123456789) arba ND, jei neturi.',
    dataType: 'Pasirinkite duomenų tipą: F (pilnas), S (tik išrašytos SF), P (tik gautos SF).',
    selectionStartDate: 'Laikotarpio pradžios data trūksta. Pasirinkite pradžios datą.',
    selectionEndDate: 'Laikotarpio pabaigos data trūksta. Pasirinkite pabaigos datą.',
  },

  hints: {
    registrationNumber: 'Įmonės kodas turi būti 9 skaitmenų.',
    vatNumber: 'PVM kodas pradedamas LT arba įrašykite ND.',
  },

  /**
   * Validate single value by rule.
   * @param {string} fieldId - e.g. registrationNumber, selectionStartDate
   * @param {string} value
   * @returns {boolean} true if valid
   */
  validate(fieldId, value) {
    const v = (value != null ? String(value) : '').trim();
    switch (fieldId) {
      case 'registrationNumber':
      case 'companyCode':
        return /^[0-9]{9}$/.test(v.replace(/\s/g, ''));
      case 'vatNumber':
        return v.toUpperCase() === 'ND' || /^LT[0-9]{9}$/.test(v.replace(/\s/g, '').toUpperCase());
      case 'selectionStartDate':
      case 'selectionEndDate':
        return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());
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
        out.push({
          fieldId: id,
          message: this.questions[id] || `Trūksta: ${id}`,
          hint: this.hints[id],
        });
      }
    });
    return out;
  },

  /**
   * Check mapped rows for missing required invoice-level fields (e.g. invoice number, date).
   * Returns list of { invoiceIndex, fieldId, message } for first N issues.
   */
  checkMappedRows(mappedRows, maxIssues = 10) {
    const issues = [];
    (mappedRows || []).forEach((row, i) => {
      if (issues.length >= maxIssues) return;
      if (!(row.invoiceNumber != null && String(row.invoiceNumber).trim())) {
        issues.push({ invoiceIndex: i, fieldId: 'invoiceNumber', message: `Eilutė ${i + 1}: trūksta sąskaitos faktūros numerio.` });
      }
      if (!(row.invoiceDate != null && String(row.invoiceDate).trim())) {
        issues.push({ invoiceIndex: i, fieldId: 'invoiceDate', message: `Eilutė ${i + 1}: trūksta sąskaitos datos.` });
      }
    });
    return issues;
  },
};
(function(g){ if (g) { g.ConvyMissingData = ConvyMissingData; } })(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
