# Plan van Aanpak: CRT API-koppeling

## API-overzicht

**Base URL:** `https://platform.acceptatie.centraalregistertechniek.nl/api/rest/crt`  
**Authenticatie:** OAuth2 client credentials flow  
**Documentatie:** [Swagger UI](https://platform.acceptatie.centraalregistertechniek.nl/APIDOC/APIDOC?module=api&api=crt#/)

---

## Wat we al weten (getest op 2 juni 2026)

### Authenticatie werkt
- `POST /v1/oauth2/access_token` met client credentials -> access_token (geldig 3600s)
- Token mee te sturen als `Authorization: Bearer <token>`

### Beschikbare data via het endpoint
Het endpoint `GET /v1/organizationQualification` levert per record:

**Organisatie:**
- `name`, `chamberOfCommerceId`, `chamberOfCommerceLocationId`
- `street`, `houseNumber`, `houseNumberPostfix`, `postalCode`, `city`
- `telephone`, `region`, `target` (B/C doelgroep)
- `gpsLatitude`, `gpsLongitude` (GPS-coordinaten zitten er al in!)
- `LastValidatedDate`

**Kwalificatie:**
- `qualificationType`, `qualificationTypeId`
- `qualificationKind` (Certificaat/Erkenning)
- `status` (Actief/Inactief), `issuedBy`
- `startDate`, `endDate`

### Beschikbare kwalificatietypes (acceptatie-omgeving, 23 records)

| qualificationType     | qualificationTypeId | qualificationKind |
|-----------------------|--------------------|--------------------|
| BRL K25000            | BRL K25000         | Certificaat        |
| BRL6000-01            | BRL6000-01         | Certificaat        |
| BRL6000-02            | BRL6000-02         | Certificaat        |
| BRL6000-03            | BRL6000-03         | Certificaat        |
| BRL6000-05            | BRL6000-05         | Certificaat        |
| BRL6000-06            | BRL6000-06         | Certificaat        |
| BRL6000-AB            | BRL6000-AB         | Certificaat        |
| CO-vrij organisaties  | CO-vrij-org        | Erkenning          |

**Let op:** Het `/v1/qualifications` endpoint is NIET beschikbaar met deze credentials (error E-9903). De productieomgeving zal waarschijnlijk meer kwalificatietypes bevatten.

### Mapping gewenste categorieën -> API IDs

| Gewenste categorie | Gevonden in API? | qualificationTypeId |
|---|---|---|
| CO-vrij organisaties | Ja | `CO-vrij-org` |
| BRL6000-01 | Ja | `BRL6000-01` |
| BRL6000-02 | Ja | `BRL6000-02` |
| BRL6000-03 | Ja | `BRL6000-03` |
| BRL6000-AB | Ja | `BRL6000-AB` |
| BRL6000-05 | Ja | `BRL6000-05` |
| BRL6000-06 | Ja | `BRL6000-06` |
| BRL K25000 | Ja | `BRL K25000` |
| EVI-MD | Nee (niet in acceptatie) | - |
| InstallQ Metalen dakbedekking | Nee (niet in acceptatie) | - |
| Elektrotech. inspectiebedrijven | Nee (niet in acceptatie) | - |
| EVI-L / EVI-LZTW | Nee (niet in acceptatie) | - |
| IBER (Elektra) | Nee (niet in acceptatie) | - |
| InstallQ Binnenverlichting | Nee (niet in acceptatie) | - |
| BRL6000-00 | Nee (niet in acceptatie) | - |
| BRL6000-04 / -16 | Nee (niet in acceptatie) | - |

De ontbrekende categorieën zijn waarschijnlijk pas beschikbaar in de productie-API.

---

## Fase 1: API-koppeling (GEREED voor bouw)

### Stap 1.1 — Authenticatie
- `POST /v1/oauth2/access_token` met `client_id`, `client_secret`, `grant_type=client_credentials`
- Token automatisch vernieuwen bij expiry (3600s)
- Credentials in `.env`, nooit in code

### Stap 1.2 — Bedrijven ophalen per categorie
- `GET /v1/organizationQualification?limit=50&offset=0`
- Paginering: max 50 per request, loop tot `offset >= total`
- Client-side filteren op `qualification.qualificationTypeId`

**Bouwen:**
- TypeScript API-client class met auto-auth en paginering
- Cache-laag (bijv. 15 min) om de CRT-API niet te overbelasten

---

## Fase 2: Frontend — bedrijven per categorie

### Stap 2.1 — Next.js project opzetten
- Next.js App Router + TypeScript + Tailwind CSS
- API route `GET /api/organizations?category=BRL6000-01` als tussenlaag
- API route `GET /api/categories` retourneert beschikbare kwalificatietypes

### Stap 2.2 — Interface bouwen
- Dropdown/tabs om categorie te kiezen
- Tabel met kolommen: Bedrijfsnaam | Plaats | KVK | Status | Telefoon
- Filter op actief/inactief
- Zoekbalk op bedrijfsnaam
- Laad-indicator + lege-staat-melding

---

## Fase 3: Zoeken in de regio

### Stap 3.1 — Locatie-invoer
- Gebruiker voert postcode of plaatsnaam in
- Geocoding via PDOK Locatieserver (gratis, NL-specifiek)
- Omzetten naar lat/lng

### Stap 3.2 — Afstandsberekening
- GPS-coordinaten zitten al in de API-response (groot voordeel!)
- Haversine-formule voor afstandsberekening
- Sorteren op afstand, filteren op radius (5/10/25/50 km)
- Tonen van afstand in de resultatentabel

---

## Fase 4: Kaartweergave

### Stap 4.1 — Kaartintegratie
- Leaflet + React-Leaflet + OpenStreetMap tiles (gratis)
- Markers per bedrijf (GPS-data is al beschikbaar!)
- Popup met: naam, adres, telefoon, status
- Kleurcodering per categorie of per status

### Stap 4.2 — Interactie
- Klik op marker -> detail-popup
- Filter op categorie op de kaart
- Radius-cirkel rond ingevoerde locatie
- Cluster-weergave bij veel markers

---

## Technische keuzes

| Onderdeel | Keuze | Reden |
|-----------|-------|-------|
| **Framework** | Next.js (App Router) | Frontend + API routes in 1 project |
| **Taal** | TypeScript | Type safety voor API-responses |
| **Styling** | Tailwind CSS | Snel en consistent |
| **Kaart** | Leaflet + React-Leaflet | Gratis, geen API-key nodig |
| **Geocoding** | PDOK Locatieserver | Gratis, Nederlands, nauwkeurig |
| **Hosting** | Vercel of eigen server | Past bij Next.js |

---

## Volgorde van uitvoering

```
Fase 1  API-client + auth         ████░░░░░░  ~2 uur    <- NU STARTEN
Fase 2  Frontend per categorie    ██████░░░░  ~4 uur
Fase 3  Zoeken op locatie          ████░░░░░░  ~3 uur
Fase 4  Kaartweergave              █████░░░░░  ~4 uur
```

**Totaal geschat: ~13 uur ontwikkeltijd**

---

## Grote meevallers

1. **GPS-coordinaten** zitten al in de API-response -> geen aparte geocoding van bedrijfsadressen nodig voor de kaart
2. **Adresgegevens** zijn compleet (straat, huisnr, postcode, stad) -> direct toonbaar
3. **Paginering** is standaard en overzichtelijk (offset/limit/total)
4. De data-structuur is helder en consistent
