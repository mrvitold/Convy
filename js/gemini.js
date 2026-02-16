/**
 * Google Gemini integration for step 1 analysis and "Pasiūlyti" mapping.
 * Get a free API key at https://aistudio.google.com
 */
const ConvyGemini = {
  model: 'gemini-1.5-flash',
  timeout: 30000,
  apiBase: 'https://generativelanguage.googleapis.com/v1beta',

  getApiKey() {
    return (typeof window !== 'undefined' && window.ConvyGeminiApiKey) ? (window.ConvyGeminiApiKey || '').trim() : '';
  },

  /** Consider available if API key is set */
  available(callback) {
    var key = this.getApiKey();
    if (!key) return callback(false);
    fetch(this.apiBase + '/models/' + this.model + '?key=' + encodeURIComponent(key), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        callback(!data.error);
      })
      .catch(function () { callback(false); });
  },

  analyzeUpload(sheetNames, previewText, callback) {
    var prompt = 'An Excel file has been uploaded for Lithuanian VAT invoice (i.SAF) conversion.\nSheet names: ' + (sheetNames || []).join(', ') + '\n\nPreview of the first rows (each line is one row, values separated by tabs). The first rows may be empty; the header row has column titles (e.g. Date, Invoice number, Buyer, Amount, PVM).\n---\n' + (previewText || '').slice(0, 2500) + '\n---\n\nDetermine which row number (1-based) is the header row. If the first rows are empty, the header might be row 3, 4, etc. Which sheet index (0-based) contains the invoice data? Reply with ONLY a valid JSON object. Example: {"headerRow": 3, "sheetIndex": 0}';
    this.chat(prompt, function (err, response) {
      if (err) return callback(err);
      var json = ConvyGemini.extractJSON(response);
      if (json && typeof json === 'object') {
        var headerRow = Math.max(1, Math.min(20, parseInt(json.headerRow, 10) || 1));
        var sheetIndex = Math.max(0, Math.min((sheetNames || []).length - 1, parseInt(json.sheetIndex, 10) || 0));
        return callback(null, { headerRow: headerRow, sheetIndex: sheetIndex });
      }
      callback(new Error('Could not parse analysis'));
    });
  },

  suggestMapping(headers, sampleRows, callback) {
    var sampleText = (sampleRows || []).slice(0, 3).map(function (row, i) {
      var parts = (headers || []).map(function (h) { return h + ': ' + (row[h] != null ? row[h] : ''); });
      return 'Row ' + (i + 1) + ': ' + parts.join(', ');
    }).join('\n');
    var fieldList = ConvyMapping.excelMappableFields.map(function (f) { return f.id + ' - ' + f.label; }).join('\n');
    var prompt = 'You are helping map Excel columns to i.SAF (Lithuanian VAT invoice) fields.\nExcel column headers: ' + (headers || []).join(', ') + '\n\nSample data (first rows):\n' + sampleText + '\n\ni.SAF fields (return mapping as JSON only, no other text):\n' + fieldList + '\n\nReturn a single JSON object: keys = i.SAF field ids, values = exact Excel column name from the headers list. Match by header name first; if unclear, infer from sample content (e.g. documentType = column with values like Issued/Received/Išrašyta/Gauta/S/P; counterpartyRegistrationNumber = column with 9-digit codes; counterpartyVatNumber = LT123456789 or ND). Use "—" only when no column fits. Example: {"invoiceNumber":"Invoice_ID","invoiceDate":"Date","documentType":"Invoice_Type","counterpartyRegistrationNumber":"Tax_Code"}';
    this.chat(prompt, function (err, response) {
      if (err) return callback(err);
      var json = ConvyGemini.extractJSON(response);
      if (json && typeof json === 'object') {
        var mapping = {};
        ConvyMapping.excelMappableFields.forEach(function (f) {
          mapping[f.id] = (json[f.id] != null && headers.indexOf(json[f.id]) >= 0) ? json[f.id] : '—';
        });
        return callback(null, mapping);
      }
      callback(new Error('Could not parse mapping from response'));
    });
  },

  parseCompanyAnswer(userText, callback) {
    var prompt = 'From this Lithuanian text about a company, extract only these fields and return valid JSON and nothing else:\n- companyName (įmonės pavadinimas)\n- registrationNumber (9 digits, įmonės kodas)\n- vatNumber (PVM code like LT123456789, or "ND" if no VAT)\n\nUser text: "' + (userText || '').slice(0, 500) + '"\n\nReturn only a JSON object with keys companyName, registrationNumber, vatNumber. Use empty string for missing. Example: {"companyName":"UAB Example","registrationNumber":"123456789","vatNumber":"LT123456789"}';
    this.chat(prompt, function (err, response) {
      if (err) return callback(err);
      var json = ConvyGemini.extractJSON(response);
      if (json && typeof json === 'object') {
        return callback(null, {
          companyName: (json.companyName != null ? String(json.companyName) : '').trim(),
          registrationNumber: (json.registrationNumber != null ? String(json.registrationNumber) : '').replace(/\s/g, ''),
          vatNumber: (json.vatNumber != null ? String(json.vatNumber) : '').trim(),
        });
      }
      callback(new Error('Could not parse company data'));
    });
  },

  chat(prompt, callback) {
    var key = this.getApiKey();
    if (!key) return callback(new Error('Service not configured'));
    var url = this.apiBase + '/models/' + this.model + ':generateContent?key=' + encodeURIComponent(key);
    var controller = new AbortController();
    var to = setTimeout(function () { controller.abort(); }, this.timeout);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: controller.signal,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(to);
        if (data.error) return callback(new Error(data.error.message || 'Service temporarily unavailable'));
        var text = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          text = data.candidates[0].content.parts[0].text || '';
        }
        callback(null, text);
      })
      .catch(function (err) {
        clearTimeout(to);
        callback(err);
      });
  },

  extractJSON: function (text) {
    if (!text) return null;
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  },
};
