/**
 * Excel parser using SheetJS. Reads workbook, returns sheets and row data.
 * Supports auto-detection of header row and skipping empty rows/sheets.
 */
const ConvyParser = {
  /**
   * @param {ArrayBuffer} arrayBuffer - Raw file data
   * @returns {{ sheetNames: string[], sheets: Object }} sheet names and SheetJS sheet objects
   */
  readWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    return {
      sheetNames: wb.SheetNames,
      sheets: wb.Sheets,
    };
  },

  /**
   * Get the actual data extent by scanning all cell keys (handles sparse sheets where !ref may be incomplete).
   */
  getSheetExtent(sheet) {
    const ref = sheet['!ref'];
    let range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    let maxR = range.e.r;
    let maxC = range.e.c;
    const allKeys = Object.keys(sheet);
    const cellKeys = allKeys.filter(function(k){ return k[0]!=='!' && k!=='__rowNum__'; });
    cellKeys.forEach(function(key) {
      const m = key.match(/^([A-Z]+)(\d+)$/i);
      if (m) {
        const c = XLSX.utils.decode_col(m[1].toUpperCase());
        const r = parseInt(m[2], 10) - 1;
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    });
    return { s: { r: range.s.r, c: range.s.c }, e: { r: maxR, c: maxC } };
  },

  /**
   * Get all rows from a sheet as array of arrays (raw). No header/data split.
   * @returns {{ rows: any[][], rangeStartRow: number }} rangeStartRow = 0-based first row in sheet's used range (for Excel row number display)
   */
  getSheetRawRows(sheet) {
    const range = this.getSheetExtent(sheet);
    const rows = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[addr];
        let value = cell ? (cell.w !== undefined ? cell.w : cell.v) : '';
        if (value != null && typeof value === 'object' && value instanceof Date) {
          value = value.toISOString().slice(0, 10);
        }
        row.push(value);
      }
      rows.push(row);
    }
    return { rows, rangeStartRow: range.s.r };
  },

  /**
   * Find the first row that looks like a header (enough non-empty cells).
   * @param {any[][]} rows - from getSheetRawRows
   * @param {{ maxSearch?: number, minNonEmpty?: number }} opts - default maxSearch 25, minNonEmpty 3
   * @returns {number} 0-based header row index
   */
  findHeaderRow(rows, opts = {}) {
    const maxSearch = Math.min(rows.length, opts.maxSearch != null ? opts.maxSearch : 25);
    const minNonEmpty = opts.minNonEmpty != null ? opts.minNonEmpty : 3;
    for (let r = 0; r < maxSearch; r++) {
      const row = rows[r] || [];
      const nonEmpty = row.filter(c => c != null && String(c).trim() !== '').length;
      if (nonEmpty >= minNonEmpty) return r;
    }
    return 0;
  },

  /**
   * Count data rows after header that have at least one non-empty cell (excluding fully empty rows).
   */
  countDataRows(rows, headerRowIndex, minNonEmpty = 1) {
    let count = 0;
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nonEmpty = row.filter(c => c != null && String(c).trim() !== '').length;
      if (nonEmpty >= minNonEmpty) count++;
    }
    return count;
  },

  /**
   * Pick best sheet and header row for invoice data (most data rows after a sensible header).
   * @param {Object} sheets - SheetJS sheets by name
   * @param {string[]} sheetNames
   * @returns {{ sheetName: string, headerRowArrayIndex: number, rangeStartRow: number, dataRowCount: number }}
   */
  pickBestSheetAndHeader(sheets, sheetNames) {
    const invoiceHeaderHints = ['pvm sąskaitos faktūros', 'pvm saskaitos fakturos', 'sąskaitos faktūros', 'saskaitos fakturos', 'sf nr', 'sf numeris'];
    let best = null;
    const candidates = [];
    (sheetNames || []).forEach(name => {
      const sheet = sheets[name];
      if (!sheet) return;
      const raw = this.getSheetRawRows(sheet);
      const rows = raw.rows || [];
      const rangeStartRow = raw.rangeStartRow != null ? raw.rangeStartRow : 0;
      if (rows.length === 0) return;
      const columnCount = rows[0] ? rows[0].length : 0;
      const headerRowArrayIndex = this.findHeaderRow(rows);
      const dataRowCount = this.countDataRows(rows, headerRowArrayIndex);
      const headerRow = rows[headerRowArrayIndex] || [];
      const headerText = headerRow.map(c => String(c || '').toLowerCase()).join(' ');
      const invoiceScore = invoiceHeaderHints.some(h => headerText.includes(h)) ? 1 : 0;
      candidates.push({ name, columnCount, dataRowCount, headerRowArrayIndex, rangeStartRow, invoiceScore });
      const bestInv = best ? (candidates.find(c => c.name === best.sheetName)?.invoiceScore ?? 0) : -1;
      const better = !best ||
        invoiceScore > bestInv ||
        (invoiceScore === bestInv && columnCount > best.columnCount) ||
        (invoiceScore === bestInv && columnCount === best.columnCount && dataRowCount > best.dataRowCount);
      if (better) {
        best = { sheetName: name, headerRowArrayIndex, rangeStartRow, dataRowCount, columnCount };
      }
    });
    if (!best) {
      best = { sheetName: sheetNames[0] || '', headerRowArrayIndex: 0, rangeStartRow: 0, dataRowCount: 0, columnCount: 0 };
    }
    return best;
  },

  /**
   * Get rows from a sheet as array of arrays (raw).
   * @param {Object} sheet - SheetJS sheet object
   * @param {number} headerRowIndex - 0-based row index for headers (default 0)
   * @returns {{ headers: string[], rows: any[][], allRows: any[][] }}
   */
  getSheetRows(sheet, headerRowIndex = 0) {
    const range = this.getSheetExtent(sheet);
    const rows = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[addr];
        let value = cell ? (cell.w !== undefined ? cell.w : cell.v) : '';
        if (value != null && typeof value === 'object' && value instanceof Date) {
          value = value.toISOString().slice(0, 10);
        }
        row.push(value);
      }
      rows.push(row);
    }
    const headers = rows[headerRowIndex] || [];
    let dataRows = rows.slice(headerRowIndex + 1);
    const minNonEmpty = 1;
    dataRows = dataRows.filter(row => {
      const n = (row || []).filter(c => c != null && String(c).trim() !== '').length;
      return n >= minNonEmpty;
    });
    return { headers, rows: dataRows, allRows: rows };
  },

  /**
   * Convert sheet to array of objects (keys = header labels or column letters).
   * @param {Object} sheet - SheetJS sheet object
   * @param {number} headerRowIndex - 0-based
   * @param {boolean} useLetters - if true, keys are A, B, C...; else first row values
   * @param {{ skipEmptyRows?: boolean }} options - if true, omit rows that are entirely empty (default true)
   */
  sheetToObjects(sheet, headerRowIndex = 0, useLetters = false, options = {}) {
    const skipEmpty = options.skipEmptyRows !== false;
    const { headers, rows } = this.getSheetRows(sheet, headerRowIndex);
    const keys = useLetters
      ? headers.map((_, i) => XLSX.utils.encode_col(i))
      : headers.map((h, i) => (h != null && String(h).trim() !== '' ? String(h).trim() : XLSX.utils.encode_col(i)));
    let dataRows = rows;
    if (skipEmpty) {
      dataRows = rows.filter(row => {
        const n = (row || []).filter(c => c != null && String(c).trim() !== '').length;
        return n >= 1;
      });
    }
    return dataRows.map(row => {
      const obj = {};
      keys.forEach((k, i) => {
        obj[k] = row[i] != null ? row[i] : '';
      });
      return obj;
    });
  },
};
