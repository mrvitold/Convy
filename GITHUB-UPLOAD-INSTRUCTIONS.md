# Kaip įkelti Convy į GitHub (be Git)

Kadangi Git nėra įdiegtas, galite įkelti failus per GitHub svetainę.

## 1. Atidarykite repozitoriją
Eikite į: https://github.com/mrvitold/Convy

## 2. Pridėkite failus
1. Spauskite **"uploading an existing file"** (arba **"Add file"** → **"Upload files"**)
2. Nutempkite visus failus ir aplankus iš `c:\Users\User\Website test\` į naršyklės langą

**Įkelkite šiuos failus ir aplankus:**
- `index.html`
- `README.md`
- `open-convy.bat`
- `open-convy-with-server.bat`
- `PUSH-TO-GITHUB.bat`
- `.gitignore`
- `css/` aplankas (su `style.css` viduje)
- `js/` aplankas (su visais .js failais **išskyrus** `config.js` – jame yra jūsų API key)

**Nekelkite:** `js/config.js` (jame yra slaptas API raktas)

## 3. Commit
Apatyje spauskite **"Commit changes"**

---

## Alternatyva: įdiekite Git (rekomenduojama)

1. Atsisiųskite Git: https://git-scm.com/download/win
2. Įdiekite (palikite numatytuosius nustatymus)
3. **Perkraukite kompiuterį** arba atidarykite naują terminalą
4. Dukart spustelėkite `PUSH-TO-GITHUB.bat`
