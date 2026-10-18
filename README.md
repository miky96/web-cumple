# web-cumple · Totem of Happiness 🗿

Web per gestionar el cap de setmana **Totem of Happiness**. Té dues parts:

- **Pública (mòbil):** cada persona entra amb el seu enllaç personal i passa un qüestionari amb minijocs. En acabar veu una animació psicodèlica i descobreix el seu equip (que en realitat has decidit tu).
- **Admin (`/admin`, ordinador):** participants, grups, qüestionari, respostes i tema de l'any.

Stack: Vite + React + TypeScript · Firebase (Hosting, Firestore, Auth amb Google) · Vitest. **Cost: 0 €** (pla Spark, sense Cloud Functions ni Storage).

---

## 1. Posar-ho en marxa en local

```bash
npm install
npm run dev:demo      # dades de prova en memòria, sense Firebase
```

Obre http://localhost:5173:

- `/p/DemoTotemDemoTotem2027` → fas el qüestionari com un participant.
- `/admin` → l'admin (en mode demo entres sense Google).

Les dades del mode demo es guarden a la pestanya del navegador. Si tanques la pestanya, tornes a començar.

## 2. Connectar Firebase (només la primera vegada)

Ho fas a la [consola de Firebase](https://console.firebase.google.com/project/totem-of-happiness):

1. **Firestore Database** → *Crear base de dades*. Tria el **mode producció** i una ubicació europea (p. ex. `eur3`).
2. **Authentication** → *Començar* → *Mètode d'inici de sessió* → activa **Google**.
3. **Configuració del projecte** → *Les teves apps* → afegeix una **app web**. Copia els valors de configuració:
   ```bash
   cp .env.example .env.local   # i omple VITE_FIREBASE_API_KEY i VITE_FIREBASE_APP_ID
   ```
4. Obre `firestore.rules` i substitueix `EL_TEU_EMAIL@gmail.com` pel compte de Google amb què entraràs a l'admin.
5. Publica les regles:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
6. Executa `npm run dev`, obre `/admin` i entra amb Google. La primera vegada es crea l'edició 2027 amb 6 grups i un qüestionari d'exemple.

## 3. Desplegar

Desplegament manual, des del teu ordinador:

```bash
npm run deploy        # build + firebase deploy (hosting + rules)
```

URL: https://totem-of-happiness.web.app

Desplegament automàtic amb GitHub Actions: cada push a `main` passa els tests i, si van bé, desplega el hosting. Per configurar-ho:

1. Mou `setup/github-ci.yml` a `.github/workflows/ci.yml`.
2. Executa `npx firebase-tools init hosting:github`. Crea el secret `FIREBASE_SERVICE_ACCOUNT_TOTEM_OF_HAPPINESS` al repo. Quan et pregunti si vol sobreescriure el workflow, digues **no**.
3. A GitHub → *Settings → Secrets → Actions*, afegeix `VITE_FIREBASE_API_KEY` i `VITE_FIREBASE_APP_ID`.

> Les regles de Firestore no es despleguen soles. Quan canviïs `firestore.rules`, executa `npx firebase-tools deploy --only firestore:rules`.

> `firebase-tools` no és una dependència del projecte (arrossega ~700 paquets i és d'on venien els avisos de `npm audit`). S'executa sota demanda amb `npx firebase-tools`.

## 4. Tests

```bash
npm test              # lògica de domini (Vitest)
npm run test:rules    # regles de seguretat amb l'emulador (cal Java 11+)
npm run typecheck
```

Hi ha tests automàtics només per a la lògica i la seguretat. La part visual es valida a mà (vegeu la checklist del final).

## 5. Flux de l'any

1. **Tema i edició:** color de l'any, subtítol i nits.
2. **Participants:** enganxa la llista de noms (es pot copiar de l'Excel) i marca les nits i les etiquetes.
3. **Grups:** arrossega les persones entre grups, o fes servir 🎲 per repartir les que falten. Després clica **Publicar revelacions**.
4. **Qüestionari:** edita els passos i prova'ls amb ▶ *Provar al mòbil*.
5. **Participants → 💬:** copia el missatge de WhatsApp de cada persona i envia-l'hi.
6. **Respostes:** veus què ha contestat cadascú i els rànquings dels minijocs.

Si canvies grups després de publicar, l'admin t'avisa que cal **tornar a publicar**.

## 6. Arquitectura

```
src/
  domain/        ← TypeScript pur, sense Firebase ni React. Aquí hi ha els tests.
    quiz/        catàleg de passos, validació, progrés
    minigames/   lògica dels minijocs (rellotge, reflexos, tocs, memòria)
    groups/      revelacions, hash de publicació, repartiment equilibrat
    theme/       paleta a partir del color base, contrast
    people/      importació de llistes
    insights/    rànquings i textos de les respostes
  data/          ← ports + adaptadors (Firestore i memòria/demo)
  features/
    public/      flux del participant, passos, animació, resultat
    admin/       pantalles d'admin
  ui/            logo, tema, components compartits
public/brand/    logo i tòtem en SVG (recolorables), patró de fons
```

**Afegir un tipus de pas nou:**

1. Afegeix-ne la config i la resposta a `domain/types.ts`.
2. Afegeix-lo al catàleg (`domain/quiz/catalog.ts`).
3. Afegeix-ne la validació a `domain/quiz/validate.ts`.
4. Crea'n el component a `features/public/steps/` i registra'l a `registry.ts`.
5. Crea'n l'editor a `features/admin/stepEditors.tsx`.

**Imatges:**

- Per als grups i les opcions de pregunta, deixa els fitxers a `public/editions/2027/...` (millor en `.webp`) i escriu la ruta a l'admin. No fem servir Firebase Storage perquè requereix el pla de pagament.
- Els SVG de `public/brand/` fan servir `currentColor`, de manera que agafen el color del tema.

### Seguretat (resum)

- Tot és privat per defecte. L'admin s'identifica pel seu email de Google, que està escrit a les regles.
- Cada participant té un token aleatori de 22 caràcters, que és el seu enllaç. Un participant només pot fer `get` dels seus documents: mai pot llistar els d'altres persones.
- L'assignació real de grups (`editions/*/participants`) no és accessible des de la part pública. En publicar es generen documents `reveals/{token}`, i les regles només en permeten la lectura si ja existeix la resposta `responses/{token}`.
- Limitació acceptada: algú amb coneixements tècnics podria crear la seva resposta sense jugar i veure el grup abans d'hora. Només veuria el seu.

## 7. Checklist manual abans d'enviar els enllaços

- [ ] Obrir un enllaç des de WhatsApp en un iPhone i en un Android, fent servir el navegador intern de WhatsApp.
- [ ] Jugar tots els minijocs amb el polze. Comprovar que no fan zoom ni seleccionen text.
- [ ] Tancar l'app a mig qüestionari i tornar-hi: ha de continuar des del mateix pas.
- [ ] L'animació es veu fluida i el resultat mostra els companys correctes.
- [ ] La previsualització de l'enllaç al WhatsApp mostra el logo.
- [ ] A l'admin hi diu "Grups publicats ✓", i ningú no queda sense grup.
