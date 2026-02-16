# Convy

**Excel → i.SAF XML** konverteris PVM sąskaitų faktūrų duomenims teikti į VMI (i.SAF posistemė). Skirta lietuvių buhalteriams.

- Veikia **vietoje** (atidarykite `index.html` naršyklėje arba per vietinį serverį).
- Duomenys **nesiunčiami** į jokį serverį.
- Automatinis failo analizavimas ir stulpelių pasiūlymas (naudoja jūsų nustatytą paslaugą; naudotojai key nemato).

## Kaip atidaryti

- **Be serverio:** dukart spustelėkite `open-convy.bat` – atsidarys `index.html` naršyklėje. Veikia su vietiniu SheetJS (`js/xlsx.full.min.js`).
- **Su Python serveriu:** dukart spustelėkite `open-convy-with-server.bat` – paleidžia `python -m http.server 8765` ir atidaro http://127.0.0.1:8765
- **Node.js:** `npx serve -l 8080`, tada atidarykite http://localhost:8080

## Naudojimas

1. **Įkelti failą** – nutempkite arba pasirinkite XLSX failą su PVM sąskaitomis.
2. **Įmonės duomenys** – įveskite įmonės pavadinimą, kodą, PVM kodą, laikotarpį. Duomenys išsaugomi naršyklėje.
3. **Stulpelių susiejimas** – nurodykite, kuris Excel stulpelis atitinka kurį i.SAF lauką. Galite naudoti „Pasiūlyti“ automatiniam pasiūlymui.
4. **Konvertuoti** – jei ko nors trūksta, Convy paklaus; atsakius, spauskite „Konvertuoti į i.SAF XML“ ir atsisiųskite failą.

## Savininkui: automatinio pasiūlymo konfigūracija

Kad 1 žingsnio analizė ir „Pasiūlyti“ (stulpelių pasiūlymas) veiktų, **savininkas** įrašo savo API key faile **`js/config.js`**: atidarykite `js/config.js`, įrašykite key į `window.ConvyGeminiApiKey = 'JŪSŲ_KEY';`. Nemokamą key galite gauti [aistudio.google.com](https://aistudio.google.com) → Get API key. **Naudotojai šio lauko nemato** – key nėra rodomas puslapyje. Nekomituokite `config.js` su key į viešą repozitoriją (galite naudoti `config.example.js` kaip pavyzdį ir pridėti `config.js` į `.gitignore`).

## Failų struktūra

- `index.html` – vieno puslapio vedlys
- `css/style.css` – stiliai
- `js/config.js` – savininko konfigūracija (API key; nekomituojama). Naudokite `js/config.example.js` kaip pavyzdį.
- `js/xlsx.full.min.js` – SheetJS biblioteka (veikia su file://)
- `js/parser.js` – Excel skaitymas (SheetJS)
- `js/mapping.js` – stulpelių susiejimas ir i.SAF laukai
- `js/missing-data.js` – trūkstamų duomenų tikrinimas ir klausimai lietuviškai
- `js/isaf-builder.js` – i.SAF XML generavimas
- `js/gemini.js` – automatinio pasiūlymo paslauga
- `js/app.js` – vedlys ir valdymas
- `docs/requirements.md` – nuorodos į VMI XSD ir aprašus

## Reikalavimai

Žr. [docs/requirements.md](docs/requirements.md). Oficialus XSD: VMI i.SAF 1.2.
