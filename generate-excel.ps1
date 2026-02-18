# Generate GENERATED_1.xlsx for ConvY testing
# Saves to: C:\Users\User\Desktop\convy files testing to upload

$outDir = "C:\Users\User\Desktop\convy files testing to upload"
$outPath = Join-Path $outDir "GENERATED_1.xlsx"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Add()
    $ws = $wb.Sheets.Item(1)
    $ws.Name = "PVM SF"

    $headers = @(
        "PVM sąskaitos faktūros numeris", "PVM sąskaitos faktūros data", "PVM sąskaitos faktūros tipas",
        "Pirkėjo / Tiekėjo pavadinimas", "Pirkėjo / Tiekėjo kodas", "Pirkėjo / Tiekėjo PVM mokėtojo kodas",
        "Šalies kodas", "Prekės ir paslaugos aprašymas", "Kiekis", "Kaina vnt." ,
        "Suma be PVM", "Mokesčio tarifas (%)", "PVM klasifikatoriaus kodas", "PVM suma", "Suma su PVM"
    )
    for ($c = 1; $c -le $headers.Count; $c++) {
        $ws.Cells.Item(1, $c) = $headers[$c-1]
    }
    $ws.Rows.Item(1).Font.Bold = $true

    $companies = @(
        @{name="UAB Prekybos centras"; code="123456789"; vat="LT123456789"},
        @{name="UAB Technologijos sprendimai"; code="234567890"; vat="LT234567890"},
        @{name="UAB Statyba ir ko"; code="345678901"; vat="LT345678901"},
        @{name="IĮ Mažoji įmonė"; code="456789012"; vat="ND"},
        @{name="UAB Logistika LT"; code="567890123"; vat="LT567890123"},
        @{name="UAB Maisto gamyba"; code="678901234"; vat="LT678901234"},
        @{name="UAB IT paslaugos"; code="789012345"; vat="LT789012345"},
        @{name="UAB Transportas"; code="890123456"; vat="LT890123456"},
        @{name="UAB Baldai"; code="901234567"; vat="LT901234567"},
        @{name="UAB Elektronika"; code="112233445"; vat="LT112233445"}
    )
    $descriptions = @("Prekės ir paslaugos pagal sutartį", "IT konsultacijos", "Statybinės medžiagos", "Transporto paslaugos", "Buhalterinės paslaugos", "Kanceliarinės prekės", "Kompiuterinė įranga", "Programinė įranga", "Nuoma", "Konsultacijos")
    $docTypes = @("Išrašyta", "Gauta", "Išrašyta", "Gauta", "Išrašyta", "Gauta", "Išrašyta", "Gauta", "Išrašyta", "Gauta")
    $vatRates = @(21, 21, 9, 21, 5, 0, 21, 9, 21, 21)

    $rnd = [System.Random]::new()
    for ($i = 1; $i -le 30; $i++) {
        $row = $i + 1
        $c = $companies[$rnd.Next($companies.Count)]
        $net = [math]::Round(($rnd.NextDouble() * 500 + 50), 2)
        $rate = $vatRates[$rnd.Next($vatRates.Count)]
        $vat = [math]::Round($net * ($rate / 100), 2)
        $gross = [math]::Round($net + $vat, 2)
        $qty = [math]::Round($rnd.NextDouble() * 10 + 0.5, 2)
        $price = if ($qty -gt 0) { [math]::Round($net / $qty, 2) } else { 0 }

        $invNum = "SF-2027-" + $i.ToString("0000")
        $day = $rnd.Next(1, 31)
        $invDate = "2027-01-" + $day.ToString("00")
        $docType = $docTypes[$rnd.Next($docTypes.Count)]
        $regCode = $c.code
        $vatNum = $c.vat
        $country = "LT"
        $desc = $descriptions[$rnd.Next($descriptions.Count)]
        $vatCode = if ($rate -ge 20) { "PVM1" } elseif ($rate -ge 8) { "PVM2" } elseif ($rate -ge 4) { "PVM3" } else { "PVM4" }

        # Common mistakes
        if ($i -eq 3) { $regCode = "12345" }
        if ($i -eq 5) { $vatNum = "123456789" }
        if ($i -eq 7) { $invDate = "31.02.2027" }
        if ($i -eq 9) { $invDate = "2027-13-01" }
        if ($i -eq 11) { $rate = 17 }
        if ($i -eq 13) { $net = "abc"; $vat = "" }
        if ($i -eq 15) { $invNum = "" }
        if ($i -eq 17) { $country = "Lietuva" }
        if ($i -eq 19) { $docType = "Pardavimas" }
        if ($i -eq 21) { $regCode = "12345678901" }
        if ($i -eq 23) { $invDate = "" }
        if ($i -eq 25) { $vatNum = "LT123" }
        if ($i -eq 27) { $invDate = "01.01.2027" }
        if ($i -eq 29) { $net = 100; $vat = 25 }

        $ws.Cells.Item($row, 1) = $invNum
        $ws.Cells.Item($row, 2) = $invDate
        $ws.Cells.Item($row, 3) = $docType
        $ws.Cells.Item($row, 4) = $c.name
        $ws.Cells.Item($row, 5) = $regCode
        $ws.Cells.Item($row, 6) = $vatNum
        $ws.Cells.Item($row, 7) = $country
        $ws.Cells.Item($row, 8) = $desc
        $ws.Cells.Item($row, 9) = $qty
        $ws.Cells.Item($row, 10) = $price
        $ws.Cells.Item($row, 11) = $net
        $ws.Cells.Item($row, 12) = $rate
        $ws.Cells.Item($row, 13) = $vatCode
        $ws.Cells.Item($row, 14) = $vat
        $ws.Cells.Item($row, 15) = $gross
    }

    $wb.SaveAs($outPath, 51)
    $wb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Host "Created: $outPath"
} catch {
    Write-Host "Excel COM failed: $_"
    Write-Host "Try opening generate-test-excel.html in browser and save the downloaded file to the folder."
}
