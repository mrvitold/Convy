# Convy – i.SAF reikalavimai

## Oficialūs šaltiniai (VMI)

- **XSD i.SAF 1.2:** [isaf_1.2.xsd](https://www.vmi.lt/evmi/documents/20142/847717/isaf_1.2.xsd/3c630fb1-5bac-55fc-365a-2b7e0bf7d59e?t=1623064752936)
- **Aprašas (1.2.1):** [i.SAF duomenų rinkmenos XML struktūros aprašo aprašymas](https://www.vmi.lt/evmi/documents/20142/847717/i.SAF+duomen%C5%B3+rinkmenos+XML+strukturos+apraso+aprasymas+%281.2.1%29.pdf/51c26115-4709-a1f8-f4c8-61539b900242?t=1623064544672) (LT)
- **VMI i.SAF puslapis:** [vmi.lt/evmi/i.saf2](https://www.vmi.lt/evmi/i.saf2)

## Pateikimo terminas

Duomenys teikimi ne vėliau kaip per 20 dienų nuo atitinkamo mokestinio laikotarpio pabaigos (mėnesiui / ketvirčiui / pusmečiui).

## Failo struktūra (Part I–III)

- **Part I – FileDescription:** FileVersion, FileDateCreated, DataType (F/S/P), RegistrationNumber, SelectionCriteria (SelectionStartDate, SelectionEndDate), programinės įrangos duomenys.
- **Part II – MasterFiles:** Customer / Supplier su CustomerID/SupplierID, VATRegistrationNumber, RegistrationNumber, Country.
- **Part III – SourceDocuments:** IssuedInvoice / ReceivedInvoice su InvoiceNo, InvoiceDate, CustomerID, sumos, Line su Description, Quantity, UnitPrice, NetAmount, VATAmount.

Convy generuojamas XML gali būti tikrinamas prieš XSD (neprivaloma naršyklėje).
