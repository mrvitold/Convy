/**
 * Convy – main app: wizard steps, file upload, form, mapping, convert, download.
 */
(function () {
  const STORAGE_KEY = 'convy_company';
  function getConvyMapping() {
    return (typeof window !== 'undefined' && window.ConvyMapping) || (typeof globalThis !== 'undefined' && globalThis.ConvyMapping) || null;
  }
  function getConvyISAF() {
    return (typeof window !== 'undefined' && window.ConvyISAF) || (typeof globalThis !== 'undefined' && globalThis.ConvyISAF) || null;
  }
  function applyMappingFallback(mapping, sheetObjects) {
    var fields = ['invoiceNumber','invoiceDate','documentType','counterpartyName','counterpartyRegistrationNumber','counterpartyVatNumber','counterpartyCountry','netAmount','vatAmount','grossAmount','description','quantity','unitPrice','vatRate','vatClassificationCode'];
    var CM = getConvyMapping();
    var m = (CM && CM.deduplicateMapping) ? CM.deduplicateMapping(mapping) : mapping;
    var parseNum = function(v){ if (v == null || v === '') return NaN; return Number(String(v).replace(',', '.')); };
    var rateToTaxCode = function(rate){ if (isNaN(rate)) return ''; var r = Math.round(rate); if (r >= 20 && r <= 22) return 'PVM1'; if (r >= 8 && r <= 10) return 'PVM2'; if (r >= 4 && r <= 6) return 'PVM3'; if (r === 0) return 'PVM4'; return 'PVM1'; };
    var normalizeDate = (CM && CM.normalizeDateToYMD) ? function(v){ return CM.normalizeDateToYMD(v); } : function(v){ if (!v) return ''; var d = new Date(v); return isNaN(d.getTime()) ? v : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    return (sheetObjects || []).map(function(row){
      var out = {};
      fields.forEach(function(fid){
        var col = m[fid];
        var val = col && col !== '—' && row[col] != null ? row[col] : '';
        if (fid === 'invoiceDate' && val) val = normalizeDate(val) || val;
        out[fid] = val;
      });
      if ((!out.grossAmount || out.grossAmount === '') && out.netAmount && out.vatAmount) { var n = parseNum(out.netAmount), v = parseNum(out.vatAmount); if (!isNaN(n) && !isNaN(v)) out.grossAmount = String(n + v); }
      if ((!out.vatClassificationCode || out.vatClassificationCode === '') && out.netAmount && out.vatAmount) { var n = parseNum(out.netAmount), v = parseNum(out.vatAmount); if (!isNaN(n) && n !== 0) out.vatClassificationCode = rateToTaxCode((v / n) * 100); }
      if ((!out.vatRate || out.vatRate === '') && out.netAmount && out.vatAmount) { var n = parseNum(out.netAmount), v = parseNum(out.vatAmount); if (!isNaN(n) && n !== 0) { var rate = (v / n) * 100; out.vatRate = String(Math.round(rate * 100) / 100); var stdRates = [0, 5, 9, 21]; if (!stdRates.some(function(r){ return Math.abs(rate - r) <= 1.5; })) out._vatRateSuspicious = true; } }
      if ((!out.counterpartyCountry || String(out.counterpartyCountry).trim() === '') && out.counterpartyVatNumber && String(out.counterpartyVatNumber).trim().toUpperCase().indexOf('LT') === 0) out.counterpartyCountry = 'LT';
      return out;
    });
  }
  const stepPanels = document.querySelectorAll('.step-panel');
  const stepDots = document.querySelectorAll('.step-dot');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const uploadResult = document.getElementById('upload-result');
  const fileNameEl = document.getElementById('file-name');
  const sheetInfoEl = document.getElementById('sheet-info');
  const headerRowInput = document.getElementById('header-row');
  const confirmUploadBtn = document.getElementById('confirm-upload');
  const companyForm = document.getElementById('company-form');
  const gotoMappingBtn = document.getElementById('goto-mapping');
  const mappingTbodyRequired = document.getElementById('mapping-tbody-required');
  const mappingTbodyOptional = document.getElementById('mapping-tbody-optional');
  const ollamaStatusEl = document.getElementById('ollama-status');
  const sampleTableWrap = document.getElementById('sample-table-wrap');
  const gotoConvertBtn = document.getElementById('goto-convert');
  const missingDataSection = document.getElementById('missing-data-section');
  const missingQuestionsEl = document.getElementById('missing-questions');
  const applyMissingBtn = document.getElementById('apply-missing-answers');
  const convertSection = document.getElementById('convert-section');
  const convertStatusEl = document.getElementById('convert-status');
  const doConvertBtn = document.getElementById('do-convert');
  const downloadSection = document.getElementById('download-section');
  const downloadXmlBtn = document.getElementById('download-xml');
  const step1AiStatusEl = document.getElementById('step1-ai-status');
  const sheetSelectEl = document.getElementById('sheet-select');
  const sheetSelectLabel = document.getElementById('sheet-select-label');
  function getAIProvider() {
    var key = (typeof window !== 'undefined' && window.ConvyGeminiApiKey) ? (window.ConvyGeminiApiKey || '').trim() : '';
    if (key && typeof ConvyGemini !== 'undefined' && ConvyGemini.chat) return ConvyGemini;
    return null;
  }

  let state = {
    step: 1,
    workbook: null,
    sheetNames: [],
    currentSheetName: null,
    headerRowIndex: 0,
    headers: [],
    sheetObjects: [],
    mapping: {},
    generatedXml: null,
  };

  function goToStep(step) {
    state.step = Math.max(1, Math.min(4, step));
    if (step === 2) {
      var s = document.getElementById('period-start');
      var e = document.getElementById('period-end');
      if (s && s.value) s.value = firstDayOfMonthYMD(s.value);
      if (e && e.value) e.value = lastDayOfMonthYMD(e.value);
    }
    stepPanels.forEach(panel => {
      panel.classList.toggle('active', parseInt(panel.dataset.step, 10) === state.step);
    });
    stepDots.forEach((dot, i) => {
      const n = i + 1;
      dot.classList.toggle('active', n === state.step);
      dot.classList.toggle('done', n < state.step);
    });
    if (state.step === 3) {
      setTimeout(function () {
        try {
          if ((!state.headers || state.headers.length === 0) && state.workbook && state.currentSheetName && headerRowInput) {
            const row = parseInt(headerRowInput.value, 10) || 1;
            applySheetAndHeader(state.currentSheetName, row);
          }
          buildMappingUI();
          renderSampleTable();
        } catch (e) {
          console.error('Convy step 3 build:', e);
        }
      }, 0);
    }
    if (state.step === 4) {
      showMissingOrConvert();
    }
  }

  function firstDayOfMonthYMD(ymd) {
    if (!ymd || ymd.length < 7) return ymd;
    return ymd.slice(0, 7) + '-01';
  }
  function lastDayOfMonthYMD(ymd) {
    if (!ymd || ymd.length < 7) return ymd;
    var y = parseInt(ymd.slice(0, 4), 10);
    var m = parseInt(ymd.slice(5, 7), 10);
    var last = new Date(y, m, 0);
    return last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0');
  }

  function loadStoredCompany() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el && v != null) el.value = v;
      };
      set('company-name', data.companyName);
      set('company-code', data.companyCode);
      set('vat-number', data.vatNumber);
      set('data-type', data.dataType);
      if (data.periodStart) set('period-start', firstDayOfMonthYMD(data.periodStart));
      if (data.periodEnd) set('period-end', lastDayOfMonthYMD(data.periodEnd));
    } catch (_) {}
  }

  function saveCompanyToStorage() {
    var startEl = document.getElementById('period-start');
    var endEl = document.getElementById('period-end');
    var periodStart = startEl ? startEl.value : '';
    var periodEnd = endEl ? endEl.value : '';
    const data = {
      companyName: document.getElementById('company-name').value,
      companyCode: document.getElementById('company-code').value,
      vatNumber: document.getElementById('vat-number').value,
      dataType: document.getElementById('data-type').value,
      periodStart: periodStart ? firstDayOfMonthYMD(periodStart) : '',
      periodEnd: periodEnd ? lastDayOfMonthYMD(periodEnd) : '',
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function parseCellAsDate(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number' && !isNaN(val)) {
      var excelEpoch = new Date(1899, 11, 30);
      var d = new Date(excelEpoch.getTime() + val * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
    var s = String(val).trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
    if (m) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10), y = parseInt(m[3], 10);
      var fullY = y >= 0 && y <= 50 ? 2000 + y : 1900 + y;
      var day, month;
      if (a > 12) { day = a; month = b; } else if (b > 12) { day = b; month = a; } else { day = a; month = b; }
      return new Date(fullY, month - 1, day);
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function getMinMaxDatesFromSheet() {
    var rows = state.sheetObjects || [];
    var columnKeys = state.columnKeys || [];
    var headers = state.headers || [];
    var dateHints = ['data', 'date', 'saskaitos data', 'sąskaitos data', 'issuance', 'data sf', 'pvm sąskaitos faktūros data'];
    var dateColKey = null;
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] != null ? String(headers[i]) : '').toLowerCase();
      if (dateHints.some(function (w) { return h.indexOf(w) >= 0; })) {
        dateColKey = columnKeys[i] != null ? columnKeys[i] : (headers[i] || columnKeys[i]);
        break;
      }
    }
    if (!dateColKey) return null;
    var minD = null, maxD = null;
    for (var r = 0; r < rows.length; r++) {
      var cell = rows[r][dateColKey];
      var d = parseCellAsDate(cell);
      if (d) {
        if (!minD || d.getTime() < minD.getTime()) minD = d;
        if (!maxD || d.getTime() > maxD.getTime()) maxD = d;
      }
    }
    if (!minD || !maxD) return null;
    var toYMD = function (date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); };
    return { min: toYMD(minD), max: toYMD(maxD) };
  }

  function setDefaultDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toYMD = d => d.toISOString().slice(0, 10);
    const startEl = document.getElementById('period-start');
    const endEl = document.getElementById('period-end');
    if (startEl && !startEl.value) startEl.value = toYMD(firstDay);
    if (endEl && !endEl.value) endEl.value = toYMD(lastDay);
  }

  function prefillPeriodFromFile() {
    var range = getMinMaxDatesFromSheet();
    var startEl = document.getElementById('period-start');
    var endEl = document.getElementById('period-end');
    var setStart = null, setEnd = null;
    if (range && range.min && range.max && startEl && endEl) {
      setStart = firstDayOfMonthYMD(range.min);
      setEnd = lastDayOfMonthYMD(range.max);
      startEl.value = setStart;
      endEl.value = setEnd;
    } else if (startEl && endEl) {
      var now = new Date();
      var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      var toYMD = function (d) { return d.toISOString().slice(0, 10); };
      setStart = toYMD(firstDay);
      setEnd = toYMD(lastDay);
      startEl.value = setStart;
      endEl.value = setEnd;
    }
  }

  // —— Step 1: Upload ——
  if (uploadZone) uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  if (uploadZone) uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  if (uploadZone) uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  function onFileSelected() {
    var file = fileInput ? fileInput.files[0] : null;
    if (file) handleFile(file);
  }
  if (fileInput) {
    fileInput.addEventListener('change', onFileSelected);
    fileInput.addEventListener('input', onFileSelected);
  }
  var changeFileBtn = document.getElementById('change-file-btn');
  if (changeFileBtn) changeFileBtn.addEventListener('click', function (e) { e.preventDefault(); fileInput.click(); });

  function applySheetAndHeader(sheetName, headerRow1Based) {
    if (!state.workbook || !sheetName) return;
    const sheet = state.workbook.sheets[sheetName];
    const raw = ConvyParser.getSheetRawRows(sheet);
    const rangeStartRow = (raw.rangeStartRow != null) ? raw.rangeStartRow : 0;
    const arrayIndex = Math.max(0, Math.min((raw.rows || []).length - 1, (headerRow1Based || 1) - 1 - rangeStartRow));
    const { headers, rows } = ConvyParser.getSheetRows(sheet, arrayIndex);
    state.currentSheetName = sheetName;
    state.headerRowIndex = arrayIndex;
    state.headers = headers;
    state.columnKeys = (headers || []).map((h, i) => (h != null && String(h).trim() !== '') ? String(h).trim() : (typeof XLSX !== 'undefined' ? XLSX.utils.encode_col(i) : 'Col' + i));
    state.sheetObjects = ConvyParser.sheetToObjects(sheet, arrayIndex, false);
    sheetInfoEl.textContent = 'Lapas: ' + state.currentSheetName + ', eilučių: ' + state.sheetObjects.length;
    headerRowInput.value = rangeStartRow + arrayIndex + 1;
  }

  function handleFile(file) {
    const name = file.name || 'failas.xlsx';
    if (!/\.(xlsx|xls)$/i.test(name)) {
      alert('Pasirinkite XLSX arba XLS failą.');
      return;
    }
    if (typeof XLSX === 'undefined') {
      alert('Excel biblioteka neįkelta. Patikrinkite ar js/xlsx.full.min.js egzistuoja.');
      return;
    }
    if (step1AiStatusEl) step1AiStatusEl.textContent = 'Apdorojama…';
    const reader = new FileReader();
    reader.onerror = function () { if (step1AiStatusEl) step1AiStatusEl.textContent = ''; alert('Nepavyko nuskaityti failo.'); };
    reader.onload = () => {
      try {
        const buf = reader.result;
        const { sheetNames, sheets } = ConvyParser.readWorkbook(buf);
        state.workbook = { sheetNames, sheets };
        state.sheetNames = sheetNames;

        var best = ConvyParser.pickBestSheetAndHeader(sheets, sheetNames);
        var excelHeaderRow1Based = best.rangeStartRow + best.headerRowArrayIndex + 1;
        applySheetAndHeader(best.sheetName, excelHeaderRow1Based);
        prefillPeriodFromFile();

        fileNameEl.textContent = name;
        sheetInfoEl.textContent = 'Lapas: ' + state.currentSheetName + ', eilučių: ' + state.sheetObjects.length;
        uploadZone.classList.add('hidden');
        uploadResult.classList.remove('hidden');

        if (sheetNames.length > 1 && sheetSelectEl) {
          sheetSelectLabel.classList.remove('hidden');
          sheetSelectEl.innerHTML = '';
          sheetNames.forEach((s) => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            if (s === state.currentSheetName) o.selected = true;
            sheetSelectEl.appendChild(o);
          });
        } else if (sheetSelectLabel) {
          sheetSelectLabel.classList.add('hidden');
        }

        var currentSheet = sheets[state.currentSheetName];
        var rawPreview = currentSheet ? ConvyParser.getSheetRawRows(currentSheet) : {};
        var allRows = rawPreview.rows || [];
        var previewLines = allRows.slice(0, 25).map(function (row) {
          return (row || []).map(function (c) { return c != null ? String(c) : ''; }).join('\t');
        });
        var previewText = previewLines.join('\n');

        var ai = getAIProvider();
        if (ai && ai.analyzeUpload) {
          ai.available(function (ok) {
            if (!ok) {
              if (step1AiStatusEl) step1AiStatusEl.textContent = 'Lapas ir antraštės eilutė nustatyti automatiškai. Pakeiskite žemiau, jei reikia.';
              return;
            }
            step1AiStatusEl.textContent = 'Analizuojama…';
            ai.analyzeUpload(sheetNames, previewText, function (err, result) {
              if (err || !result) {
                if (step1AiStatusEl) step1AiStatusEl.textContent = 'Lapas ir antraštės eilutė nustatyti automatiškai. Pakeiskite žemiau, jei reikia.';
                return;
              }
              var sheetIndex = result.sheetIndex != null ? result.sheetIndex : sheetNames.indexOf(state.currentSheetName);
              if (sheetIndex < 0) sheetIndex = 0;
              var sheetName = sheetNames[sheetIndex] || state.currentSheetName;
              var headerRow = result.headerRow != null ? result.headerRow : (state.headerRowIndex + 1);
              applySheetAndHeader(sheetName, headerRow);
              prefillPeriodFromFile();
              if (sheetSelectEl && sheetNames.length > 1) sheetSelectEl.value = sheetName;
              if (step1AiStatusEl) step1AiStatusEl.textContent = 'Failas išanalizuotas. Patikrinkite žemiau arba spauskite Toliau.';
            });
          });
        } else {
          if (step1AiStatusEl) step1AiStatusEl.textContent = 'Lapas ir antraštės eilutė nustatyti automatiškai. Pakeiskite žemiau, jei reikia.';
        }
      } catch (err) {
        if (step1AiStatusEl) step1AiStatusEl.textContent = '';
        alert('Nepavyko nuskaityti failo: ' + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  if (sheetSelectEl) {
    sheetSelectEl.addEventListener('change', function () {
      var sheetName = sheetSelectEl.value;
      if (!state.workbook || !sheetName) return;
      var row = parseInt(headerRowInput.value, 10) || 1;
      applySheetAndHeader(sheetName, row);
      prefillPeriodFromFile();
      buildMappingUI();
      renderSampleTable();
    });
  }

  headerRowInput.addEventListener('change', () => {
    const row = parseInt(headerRowInput.value, 10);
    if (!state.workbook || !state.currentSheetName) return;
    applySheetAndHeader(state.currentSheetName, row);
    prefillPeriodFromFile();
    buildMappingUI();
    renderSampleTable();
  });

  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', () => {
      try {
        saveCompanyToStorage();
        loadStoredCompany();
        prefillPeriodFromFile();
        if (state.headers && state.headers.length > 0) {
          buildMappingUI();
          renderSampleTable();
        }
      } catch (e) {
        console.error('Convy step 1 next:', e);
      }
      goToStep(2);
    });
  }

  // —— Step 2: Company form ——
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.goto, 10)));
  });
  /** Run mapping suggestion (Gemini or header + content-based) and apply to UI. Call when entering step 3. */
  function applySuggestionToMapping() {
    var getKey = (i) => (state.columnKeys && state.columnKeys[i]) ? state.columnKeys[i] : (state.headers[i] || '—');
    var sampleRows = (state.sheetObjects || []).slice(0, 15);
    function runHeaderAndContentSuggestion() {
      var CM = (typeof window !== 'undefined' && window.ConvyMapping) ? window.ConvyMapping : null;
      if (CM && CM.suggestMappingFromHeaders) return CM.suggestMappingFromHeaders(state.headers, getKey, sampleRows);
      return suggestMappingFromHeadersFallback(state.headers, getKey, sampleRows);
    }
    var ai = getAIProvider();
    if (!ai || !ai.suggestMapping) {
      var suggested = runHeaderAndContentSuggestion();
      buildMappingUI(suggested);
      renderSampleTable();
      if (ollamaStatusEl) ollamaStatusEl.textContent = 'Pasiūlytas susiejimas taikytas.';
      return;
    }
    if (ollamaStatusEl) ollamaStatusEl.textContent = 'Pasiūlymas ruošiamas…';
    ai.suggestMapping(state.headers, state.sheetObjects.slice(0, 8), (err, mapping) => {
      if (err || !mapping) {
        if (ollamaStatusEl) ollamaStatusEl.textContent = 'Automatinis susiejimas laikinai nepasiekiamas. Taikytas pasiūlymas pagal stulpelių pavadinimus ir turinį.';
        var suggested = runHeaderAndContentSuggestion();
        buildMappingUI(suggested);
        renderSampleTable();
        return;
      }
      if (ollamaStatusEl) ollamaStatusEl.textContent = 'Pasiūlytas susiejimas taikytas.';
      var normalized = {};
      Object.keys(mapping).forEach(function (k) {
        var v = mapping[k];
        if (!v || v === '—') { normalized[k] = '—'; return; }
        var idx = state.headers && state.headers.indexOf(v) >= 0 ? state.headers.indexOf(v) : -1;
        normalized[k] = (idx >= 0 && state.columnKeys && state.columnKeys[idx]) ? state.columnKeys[idx] : v;
      });
      var contentFallback = runHeaderAndContentSuggestion();
      Object.keys(normalized).forEach(function (k) {
        if (normalized[k] === '—' && contentFallback[k] && contentFallback[k] !== '—') normalized[k] = contentFallback[k];
      });
      var CM = getConvyMapping();
      if (CM && CM.deduplicateMapping) normalized = CM.deduplicateMapping(normalized);
      buildMappingUI(normalized);
      renderSampleTable();
    });
  }

  if (gotoMappingBtn) {
    gotoMappingBtn.addEventListener('click', () => {
      try {
        saveCompanyToStorage();
        applySuggestionToMapping();
      } catch (e) {
        console.error('Convy step 2 next:', e);
      }
      goToStep(3);
    });
  }

  // —— Step 3: Mapping ——
  function getColumnKey(i) {
    if (!state.columnKeys || !state.columnKeys[i]) return (state.headers && state.headers[i]) || '—';
    return state.columnKeys[i];
  }

  /** Normalize string for matching (lowercase, strip diacritics). */
  function normForMatch(s) {
    return (s != null ? String(s).toLowerCase() : '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  /** Fallback header-based suggestion when ConvyMapping is unavailable. */
  function suggestMappingFromHeadersFallback(headers, getKey, sampleRows) {
    var hints = {
      invoiceNumber: ['nr', 'numeris', 'number', 'sf', 'saskaitos', 'sąskaitos', 'invoice', 'no', 'no.', 'serija', 'invoice_id', 'id', 'saskaitos nr', 'sf nr', 'pvm saskaitos fakturos numeris', 'pvm sąskaitos faktūros numeris'],
      invoiceDate: ['data', 'date', 'dat', 'datra', 'saskaitos data', 'sąskaitos data', 'issuance', 'isdavimo data', 'data sf', 'pvm saskaitos fakturos data', 'pvm sąskaitos faktūros data'],
      documentType: ['tipas', 'type', 'israsyt', 'gaut', 'issued', 'received', 'invoice_type', 'dokumento tipas', 'pardavimai', 'pirkimai', 'sales', 'purchases', 'kryptis', 'direction', 'rūšis', 'kind', 'doc_type'],
      counterpartyName: ['pirkėjas', 'pirkėj', 'tiekėjas', 'tiekėj', 'buyer', 'supplier', 'customer', 'client', 'pavadinimas', 'name', 'company_name', 'kontrahentas', 'klientas', 'imoner', 'imone', 'imon', 'įmonė'],
      counterpartyRegistrationNumber: ['kodas', 'code', 'imones kodas', 'įmonės kodas', 'registration', 'tax_code', 'pirkėjo kodas', 'tiekėjo kodas'],
      counterpartyVatNumber: ['pvm kodas', 'pvm mokėtojo', 'vat number', 'vat kodas'],
      counterpartyCountry: ['šalies kodas', 'salies kodas', 'country', 'šalis', 'salis'],
      netAmount: ['suma be pvm', 'net', 'be pvm', 'without vat', 'amount_without_vat', 'suma be pvm eur', 'amount', 'suma', 'avra', 'apmokest', 'vertė', 'verte', 'taxable', 'value'],
      vatRate: ['tarifas', 'rate', 'pvm %', 'vat rate', 'mokescio tarifas', 'mokesčio tarifas', 'tax rate'],
      vatClassificationCode: ['pvm klasifikatoriaus', 'klasifikatoriaus kodas', 'tax code', 'pvm1', 'pvm2', 'pvm3', 'pvm4'],
      vatAmount: ['pvm suma', 'vat amount', 'vat_amount', 'amount_vat', 'pvm eur', 'vat', 'pvm', 'nds'],
      grossAmount: ['suma su pvm', 'gross', 'su pvm', 'total', 'with vat', 'amount_with_vat', 'bendra suma', 'avra'],
    };
    var mapping = {};
    var lower = function (s) { return (s != null ? String(s).toLowerCase() : ''); };
    var keys = [];
    for (var i = 0; i < (headers || []).length; i++) keys[i] = typeof getKey === 'function' ? getKey(i) : (headers[i] || '—');
    ['invoiceNumber', 'invoiceDate', 'documentType', 'counterpartyName', 'counterpartyRegistrationNumber', 'counterpartyVatNumber', 'counterpartyCountry', 'netAmount', 'vatRate', 'vatClassificationCode', 'vatAmount', 'grossAmount'].forEach(function (fieldId) {
      var words = (hints[fieldId] || []).concat([fieldId]);
      for (var i = 0; i < (headers || []).length; i++) {
        var h = lower(headers[i]);
        var hNorm = normForMatch(headers[i]);
        if (fieldId === 'vatAmount' && (hNorm.indexOf('fakturos') >= 0 || hNorm.indexOf('saskaitos') >= 0 || ['kodas','numeris','tarifas','be pvm','data','tipas'].some(function(s){ return hNorm.indexOf(normForMatch(s)) >= 0 || h.indexOf(s) >= 0; }))) continue;
      if (fieldId === 'netAmount' && (hNorm.indexOf(normForMatch('pvm suma')) >= 0 || h.indexOf('pvm suma') >= 0) && (hNorm.indexOf(normForMatch('be pvm')) < 0 && h.indexOf('be pvm') < 0)) continue;
        if (fieldId === 'counterpartyRegistrationNumber' && (h.indexOf('pvm') >= 0 || h.indexOf('šalies') >= 0 || h.indexOf('salies') >= 0)) continue;
        if (fieldId === 'invoiceNumber' && ((h.indexOf('data') >= 0 && h.indexOf('nr') < 0 && h.indexOf('numeris') < 0) || h.indexOf('mokesčių mokėtojo') >= 0 || h.indexOf('identifikacinis') >= 0)) continue;
        if (fieldId === 'invoiceDate' && (h.indexOf(' nr') >= 0 || h.indexOf(' nr.') >= 0 || (h.indexOf('numeris') >= 0 && h.indexOf('data') < 0))) continue;
        if (words.some(function (w) { return h.indexOf(w) >= 0 || hNorm.indexOf(normForMatch(w)) >= 0; })) {
          mapping[fieldId] = keys[i];
          return;
        }
      }
      mapping[fieldId] = '—';
    });
    function contentMatch(fieldId, usedCols) {
      var bestKey = null, bestScore = 0.25;
      for (var k = 0; k < keys.length; k++) {
        if (usedCols.has(keys[k])) continue;
        var vals = sampleRows.map(function (r) { return (r[keys[k]] != null ? String(r[keys[k]]).trim() : ''); }).filter(function (v) { return v !== ''; });
        if (vals.length === 0) continue;
        var matchCount = 0;
        if (fieldId === 'documentType') {
          var docTypeTokens = ['israsyt', 'gauta', 'issued', 'received', 's', 'p', 'i', 'f'];
          matchCount = vals.filter(function (s) {
            var n = (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return docTypeTokens.some(function (t) { return n.indexOf(t) >= 0 || n === t; }) || /^[spif]$/.test(n);
          }).length;
        } else if (fieldId === 'counterpartyRegistrationNumber') {
          matchCount = vals.filter(function (s) { var t = String(s).replace(/\s/g, ''); return /^[0-9]{9}$/.test(t) || /^[A-Za-z0-9]{8,11}$/.test(t); }).length;
        } else if (fieldId === 'counterpartyVatNumber') {
          matchCount = vals.filter(function (s) { var t = String(s).replace(/\s/g, ''); return /^LT[0-9]{8,12}$/i.test(t) || String(s).trim().toLowerCase() === 'nd'; }).length;
        } else if (fieldId === 'vatRate') {
          matchCount = vals.filter(function (s) { return /^\d+([.,]\d+)?%?$/.test(String(s).replace(',', '.').replace('%', '')); }).length;
        } else if (fieldId === 'vatAmount') {
          matchCount = vals.filter(function (s) { return /^-?\d+([.,]\d+)?$/.test(String(s).replace(',', '.')); }).length;
        }
        var score = matchCount / vals.length;
        if (score > bestScore) { bestScore = score; bestKey = keys[k]; }
      }
      return bestKey;
    }
    if (sampleRows && sampleRows.length > 0 && keys.length > 0) {
      var usedCols = new Set(Object.values(mapping).filter(function (v) { return v && v !== '—'; }));
      ['documentType', 'counterpartyRegistrationNumber', 'counterpartyVatNumber', 'vatRate', 'vatAmount'].forEach(function (fieldId) {
        if (mapping[fieldId] !== '—') return;
        var bestKey = contentMatch(fieldId, usedCols);
        if (bestKey) { mapping[fieldId] = bestKey; usedCols.add(bestKey); }
      });
    }
    var CM = getConvyMapping();
    return (CM && CM.deduplicateMapping) ? CM.deduplicateMapping(mapping) : mapping;
  }

  function deduplicateMappingInline(mapping, columnKeys) {
    var fieldOrder = ['invoiceNumber','invoiceDate','documentType','counterpartyName','counterpartyRegistrationNumber','counterpartyVatNumber','counterpartyCountry','description','quantity','unitPrice','netAmount','vatRate','vatClassificationCode','vatAmount','grossAmount'];
    var keyToIndex = {};
    if (columnKeys && columnKeys.length) {
      for (var i = 0; i < columnKeys.length; i++) {
        keyToIndex[columnKeys[i]] = i;
        if (typeof XLSX !== 'undefined') keyToIndex[XLSX.utils.encode_col(i)] = i;
      }
    }
    var seen = new Set();
    var out = {};
    for (var k in mapping) out[k] = mapping[k];
    fieldOrder.forEach(function(fid) {
      var col = out[fid];
      if (!col || col === '—') return;
      var canon = (keyToIndex[col] !== undefined) ? keyToIndex[col] : col;
      if (seen.has(canon)) out[fid] = '—';
      else seen.add(canon);
    });
    return out;
  }

  function buildMappingUI(overrideMapping) {
    var ConvyMapping = (typeof window !== 'undefined' && window.ConvyMapping) ? window.ConvyMapping : null;
    var step3 = document.getElementById('step-3');
    var tbodyReq = step3 ? step3.querySelector('#mapping-tbody-required') : document.getElementById('mapping-tbody-required');
    var tbodyOpt = step3 ? step3.querySelector('#mapping-tbody-optional') : document.getElementById('mapping-tbody-optional');
    var dataTypeEl = document.getElementById('data-type');
    var dataType = (dataTypeEl && dataTypeEl.value) ? String(dataTypeEl.value).toUpperCase().slice(0, 1) : 'F';
    var hideDocumentType = (dataType === 'S' || dataType === 'P');
    var allFields = (ConvyMapping && ConvyMapping.excelMappableFields && ConvyMapping.excelMappableFields.length) ? ConvyMapping.excelMappableFields : [
      {id:'invoiceNumber',label:'Sąskaitos faktūros numeris',required:true},{id:'invoiceDate',label:'Sąskaitos data',required:true},{id:'documentType',label:'Tipas (Išrašyta / Gauta)',required:true},{id:'counterpartyName',label:'Pirkėjas / Tiekėjas (pavadinimas)',required:true},{id:'counterpartyRegistrationNumber',label:'Pirkėjo / Tiekėjo kodas',required:true},{id:'counterpartyVatNumber',label:'Pirkėjo / Tiekėjo PVM kodas',required:true},{id:'netAmount',label:'Suma be PVM',required:true},{id:'vatRate',label:'Mokesčio tarifas / PVM tarifas (%)',required:true},{id:'vatAmount',label:'PVM suma',required:true},
      {id:'vatClassificationCode',label:'PVM klasifikatoriaus kodas (gali būti skaičiuojamas)',required:false}
    ];
    var fields = allFields.filter(function(f){ return f.id !== 'grossAmount'; });
    if (hideDocumentType) fields = fields.filter(function(f){ return f.id !== 'documentType'; });
    if (!tbodyReq || !tbodyOpt) return;
    const headers = state.headers || [];
    const columnKeys = state.columnKeys || headers.slice();
    var getKey = function (i) { return (columnKeys[i] != null ? columnKeys[i] : (headers[i] || '—')); };
    if (overrideMapping) {
      var merged = { ...state.mapping, ...overrideMapping };
      merged = deduplicateMappingInline(merged, columnKeys);
      state.mapping = merged;
    } else if (!state.mapping || Object.keys(state.mapping).length === 0) {
      var suggested = {};
      if (ConvyMapping && ConvyMapping.suggestMappingFromHeaders) {
        suggested = ConvyMapping.suggestMappingFromHeaders(headers, getKey, (state.sheetObjects || []).slice(0, 15));
      } else {
        suggested = suggestMappingFromHeadersFallback(headers, getKey, (state.sheetObjects || []).slice(0, 15));
      }
      state.mapping = {};
      fields.forEach(function (f) {
        state.mapping[f.id] = (suggested[f.id] && suggested[f.id] !== '—') ? suggested[f.id] : '—';
      });
      if (hideDocumentType) state.mapping.documentType = '—';
      state.mapping = deduplicateMappingInline(state.mapping, columnKeys);
    }
    if (hideDocumentType) state.mapping.documentType = '—';
    state.mapping = deduplicateMappingInline(state.mapping, columnKeys);

    const tbodyRequired = tbodyReq;
    const tbodyOptional = tbodyOpt;

    var opts = [{ v: '—', d: '—' }];
    for (var i = 0; i < headers.length; i++) {
      var letter = typeof XLSX !== 'undefined' ? XLSX.utils.encode_col(i) : 'Col' + (i + 1);
      var key = columnKeys[i] != null ? columnKeys[i] : (headers[i] || letter);
      var label = (headers[i] != null && String(headers[i]).trim() !== '') ? String(headers[i]).trim() : '(be pavadinimo)';
      opts.push({ v: key, d: letter + ' – ' + label });
    }

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function rowHtml(f) {
      var cur = state.mapping[f.id] || '—';
      var optStr = opts.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (cur === o.v ? ' selected' : '') + '>' + esc(o.d) + '</option>';
      }).join('');
      if (cur && cur !== '—' && !opts.some(function (o) { return o.v === cur; })) {
        optStr += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
      }
      var lbl = (f.required ? '<strong>' + esc(f.label) + '</strong>' : esc(f.label));
      return '<tr><td>' + lbl + '</td><td><select data-field-id="' + esc(f.id) + '">' + optStr + '</select></td></tr>';
    }

    var reqHtml = '';
    var optHtml = '';
    fields.forEach(function (f) {
      var r = rowHtml(f);
      if (f.required) reqHtml += r; else optHtml += r;
    });

    tbodyRequired.innerHTML = reqHtml;
    tbodyOptional.innerHTML = optHtml;
    var hintWrap = document.getElementById('mapping-table-wrap');
    var autoTypeHint = hintWrap ? hintWrap.querySelector('.mapping-autotype-hint') : null;
    if (hintWrap) {
      if (hideDocumentType && !autoTypeHint) {
        var p = document.createElement('p');
        p.className = 'mapping-autotype-hint step-desc';
        p.textContent = 'Tipas (Išrašyta / Gauta) užpildomas automatiškai pagal duomenų tipą, kurį pasirinkote 2 žingsnyje.';
        hintWrap.insertBefore(p, hintWrap.firstChild);
      } else if (!hideDocumentType && autoTypeHint) {
        autoTypeHint.remove();
      }
    }
  }

  function renderSampleTable() {
    const wrap = document.getElementById('sample-table-wrap');
    if (!wrap) return;
    const rows = (state.sheetObjects || []).slice(0, 5);
    const headers = state.headers || [];
    const columnKeys = state.columnKeys || headers.slice();
    const mapping = state.mapping || {};
    const dateColKey = mapping.invoiceDate && mapping.invoiceDate !== '—' ? mapping.invoiceDate : null;
    var CM = getConvyMapping();
    var normalizeDate = (CM && CM.normalizeDateToYMD) ? function(v) { return CM.normalizeDateToYMD(v); } : null;
    let html = '<table><thead><tr>';
    headers.forEach((h, i) => {
      const letter = typeof XLSX !== 'undefined' ? XLSX.utils.encode_col(i) : String(i + 1);
      const label = (h != null && String(h).trim() !== '') ? String(h).trim() : (letter ? letter + ' (be pavadinimo)' : '');
      const headerText = label ? letter + ' – ' + label : (letter || '');
      html += '<th>' + ConvyISAF.escape(headerText) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      columnKeys.forEach(key => {
        let val = row[key];
        if (dateColKey === key && val != null && normalizeDate) {
          var ymd = normalizeDate(val);
          if (ymd) val = ymd;
        }
        html += '<td>' + (val != null ? ConvyISAF.escape(String(val)) : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  gotoConvertBtn.addEventListener('click', () => goToStep(4));

  var gotoStartBtn = document.getElementById('goto-start');
  if (gotoStartBtn) gotoStartBtn.addEventListener('click', () => goToStep(1));

  // —— Step 4: Missing data + Convert ——
  function getHeaderFromForm() {
    return ConvyMissingData.getHeaderFromForm({
      companyName: document.getElementById('company-name').value,
      registrationNumber: document.getElementById('company-code').value,
      companyCode: document.getElementById('company-code').value,
      vatNumber: document.getElementById('vat-number').value,
      dataType: document.getElementById('data-type').value,
      selectionStartDate: document.getElementById('period-start').value,
      selectionEndDate: document.getElementById('period-end').value,
      periodStart: document.getElementById('period-start').value,
      periodEnd: document.getElementById('period-end').value,
    });
  }

  function filterEmptyInvoiceRows(rows) {
    var isPlaceholder = function(v) { return /\([^)]+\)/.test(String(v || '').trim()); };
    return (rows || []).filter(function(row) {
      var inv = (row.invoiceNumber != null ? String(row.invoiceNumber) : '').trim();
      var date = (row.invoiceDate != null ? String(row.invoiceDate) : '').trim();
      if (!inv || !date) return false;
      if (isPlaceholder(inv) || isPlaceholder(date)) return false;
      return true;
    });
  }

  function applyDataTypeToRows(rows, dataType) {
    var dt = (dataType || 'F').toUpperCase().slice(0, 1);
    if (dt !== 'S' && dt !== 'P') return rows;
    var docType = dt === 'S' ? 'Išrašyta' : 'Gauta';
    return (rows || []).map(function(r){ var o = Object.assign({}, r); o.documentType = docType; return o; });
  }

  function showMissingOrConvert() {
    const header = getHeaderFromForm();
    var CM = getConvyMapping();
    var mappedRows = CM ? CM.applyMapping(state.mapping, state.sheetObjects) : applyMappingFallback(state.mapping, state.sheetObjects);
    mappedRows = applyDataTypeToRows(mappedRows, header.dataType);
    mappedRows = filterEmptyInvoiceRows(mappedRows);
    var CMD = (typeof window !== 'undefined' && window.ConvyMissingData) || (typeof globalThis !== 'undefined' && globalThis.ConvyMissingData) || null;
    const headerIssues = CMD ? CMD.checkHeader(header) : [];
    const rowIssues = CMD ? CMD.checkMappedRows(mappedRows, 5) : [];

    if (headerIssues.length > 0) {
      missingDataSection.classList.remove('hidden');
      convertSection.classList.add('hidden');
      missingQuestionsEl.innerHTML = '';
      headerIssues.forEach(({ fieldId, message, hint }) => {
        const div = document.createElement('div');
        div.className = 'missing-question field-missing';
        const label = document.createElement('label');
        label.textContent = message;
        div.appendChild(label);
        const input = document.createElement('input');
        input.type = fieldId.includes('Date') ? 'date' : 'text';
        input.placeholder = hint || '';
        input.dataset.fieldId = fieldId;
        const formKey = {
          companyName: 'company-name',
          registrationNumber: 'company-code',
          vatNumber: 'vat-number',
          dataType: 'data-type',
          selectionStartDate: 'period-start',
          selectionEndDate: 'period-end',
        }[fieldId];
        if (formKey) {
          const el = document.getElementById(formKey);
          if (el) input.value = el.value || '';
        }
        div.appendChild(input);
        if (hint) {
          const small = document.createElement('small');
          small.className = 'error-msg';
          small.textContent = hint;
          div.appendChild(small);
        }
        missingQuestionsEl.appendChild(div);
      });
      convertStatusEl.textContent = '';
      downloadSection.classList.add('hidden');
      return;
    }

    if (rowIssues.length > 0) {
      convertStatusEl.className = 'convert-status has-issues';
      convertStatusEl.innerHTML = 'Dėmesio: kai kuriose eilutėse trūksta duomenų arba yra klaidų. Galite konvertuoti bet kokiu atveju – neužpildyti laukai bus tušti.<ul class="issue-list">' +
        rowIssues.map(function(iss) { return '<li>' + iss.message + '</li>'; }).join('') + '</ul>';
    } else {
      convertStatusEl.className = 'convert-status';
      convertStatusEl.textContent = 'Visi reikalingi antraštės laukai užpildyti. Spauskite „Konvertuoti į i.SAF XML“.';
    }
    missingDataSection.classList.add('hidden');
    convertSection.classList.remove('hidden');
    downloadSection.classList.add('hidden');
  }

  applyMissingBtn.addEventListener('click', () => {
    missingQuestionsEl.querySelectorAll('input').forEach(input => {
      const id = input.dataset.fieldId;
      const formId = {
        companyName: 'company-name',
        registrationNumber: 'company-code',
        vatNumber: 'vat-number',
        dataType: 'data-type',
        selectionStartDate: 'period-start',
        selectionEndDate: 'period-end',
      }[id];
      if (formId) {
        const el = document.getElementById(formId);
        if (el) el.value = input.value || el.value;
      }
    });
    saveCompanyToStorage();
    showMissingOrConvert();
  });

  doConvertBtn.addEventListener('click', () => {
    const header = getHeaderFromForm();
    var CM = getConvyMapping();
    var mappedRows = CM ? CM.applyMapping(state.mapping, state.sheetObjects) : applyMappingFallback(state.mapping, state.sheetObjects);
    mappedRows = applyDataTypeToRows(mappedRows, header.dataType);
    mappedRows = filterEmptyInvoiceRows(mappedRows);
    var ISAF = getConvyISAF();
    if (!ISAF) throw new Error('ConvyISAF not loaded');
    state.generatedXml = ISAF.build(header, mappedRows);
    convertStatusEl.textContent = 'XML sukurtas sėkmingai.';
    downloadSection.classList.remove('hidden');
  });

  downloadXmlBtn.addEventListener('click', () => {
    if (!state.generatedXml) return;
    const blob = new Blob([state.generatedXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iSAF_' + (document.getElementById('period-start').value || 'export').replace(/-/g, '') + '.xml';
    a.click();
    URL.revokeObjectURL(url);
  });

  function checkAI() {
    if (!ollamaStatusEl) return;
    ollamaStatusEl.textContent = '';
  }

  var mappingTableWrap = document.getElementById('mapping-table-wrap');
  if (mappingTableWrap) {
    mappingTableWrap.addEventListener('change', function (e) {
      var sel = e.target;
      if (sel && sel.tagName === 'SELECT' && sel.getAttribute && sel.getAttribute('data-field-id')) {
        var fieldId = sel.getAttribute('data-field-id');
        var chosenCol = sel.value;
        state.mapping[fieldId] = chosenCol;
        if (chosenCol && chosenCol !== '—') {
          Object.keys(state.mapping).forEach(function (fid) {
            if (fid !== fieldId && state.mapping[fid] === chosenCol) {
              state.mapping[fid] = '—';
              var otherSel = mappingTableWrap.querySelector('select[data-field-id="' + fid + '"]');
              if (otherSel) otherSel.value = '—';
            }
          });
        }
        renderSampleTable();
      }
    });
  }

  // —— Init ——
  loadStoredCompany();
  setDefaultDates();
  goToStep(1);
  if (state.headers && state.headers.length) {
    buildMappingUI();
    renderSampleTable();
  }
  setTimeout(checkAI, 500);
})();
