# Google Search Console – DNS TXT Record Verification

Add this TXT record at your domain registrar (wolet.lt) so Google can verify ownership of **convy.lt**.

---

## Steps in wolet.lt

1. Log in to [wolet.lt](https://wolet.lt)
2. Go to **Domenai** → select **convy.lt**
3. Click **VALDYTI DNS ĮRAŠUS** (Manage DNS records)
4. Add a new **TXT** record with:

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Name / Host** | `@` (or leave blank for root domain) |
| **Value / Content** | `google-site-verification=TzE3S46sKA5X3WwXtgix49_Kjdrc4xXRNk6V82fIdfI` |
| **TTL** | 3600 (or default) |

5. Save the record
6. Wait 5–30 minutes (up to 24 hours for propagation)
7. In Google Search Console, click **Verify** again

---

## Exact value to paste

```
google-site-verification=TzE3S46sKA5X3WwXtgix49_Kjdrc4xXRNk6V82fIdfI
```

---

## Note

- Do **not** remove the existing SPF record (`v=spf1 include:spf.wolet.lt -all`)
- You can have multiple TXT records; add this one in addition to the existing ones
