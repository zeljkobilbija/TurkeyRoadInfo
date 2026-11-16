/*
 * Turkey Road Info – preuzimanje podataka za jedan autoput u Holandiji, Belgiji, Luksemburgu, Austriji ili Švajcarskoj iz OpenStreetMap-a.
 * (DE, FR i IT dolaze iz AutobahnInfo, AutoroutesInfo i AutostradeInfo.)
 * (Prerađeno iz AutoroutesInfo: izlazi imaju brojeve – oba kolovoza se spajaju po broju,
 *  a smer kilometraže se određuje po rastu brojeva izlaza.)
 * Oznaka autoputa je ZEMLJA-REF: NL-A2, BE-A10, LU-A1, AT-A1, CH-A1 (OSM mreže NL:A, BE:A-road, LU:A-road, AT:A-road, CH:motorway).
 *
 * Iz terminala (Node 18+), fajlovi idu pravo u app/src/main/assets/autoputevi/:
 *   node alati/evropa_skripta.js NL-A2 BE-A10 LU-A1
 *   node alati/evropa_skripta.js --suvo NL-A2    → samo izveštaj, ništa ne snima
 *
 * U pregledaču (na stranici https://overpass-api.de/), kao ranije:
 *   1. Nalepi ceo ovaj fajl u konzolu.
 *   2. AB.pokreni("NL-A2")  → radi u pozadini, stanje je u AB.stanje
 *   3. Kad AB.stanje === "gotovo", AB.rezultat je gotov JSON,
 *      a AB.sacuvaj() ga snima kao a1.json (folder Preuzimanja).
 *
 * Izlaz ima isti oblik kao assets/autoputevi/a8.json:
 *   { id, naziv, sekcije:[{od,do,plus,minus}], stavke:[…], izvor, datum }
 * Stavka: t (A izlaz, K čvorište, R odmorište, H Autohof, P parking), si (deonica),
 *   km, s ('+' smer rastućih km, '-' suprotno), n (naziv), ref (kod čvorišta oznaka druge autostrade, npr. A22),
 *   f (gorivo), h (lanci hrane), re, wc, du, e (punjači), ho, sh, lkw, oh, la, lo.
 */
globalThis.AB = (() => {
  const NODE = typeof window === 'undefined';
  // glavni server ponekad tiho vrati samo deo podataka (izlazi bez odmorišta) → prelazi se na sledeći
  const SERVERI = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  let server = 0;
  const api = () => SERVERI[server % SERVERI.length];
  const sledeciServer = () => { server++; zapisi('prelazim na ' + api()); };
  const R = 6371000, RAD = Math.PI / 180;
  let cosLat = Math.cos(50 * RAD);
  const xy = (lat, lon) => [lon * RAD * R * cosLat, lat * RAD * R];
  const nazad = q => [+(q[1] / (RAD * R)).toFixed(5), +(q[0] / (RAD * R * cosLat)).toFixed(5)];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pauza = ms => new Promise(r => setTimeout(r, ms));
  /** Kontakt iz OSM tagova: tel, mail, web (prvi, ako ih je više odvojenih sa ';'). */
  const kontakt = t => {
    const prvi = (...k) => { for (const x of k) if (t[x]) return String(t[x]).split(';')[0].trim(); return ''; };
    const o = {}, tel = prvi('phone', 'contact:phone'), mail = prvi('email', 'contact:email').replace(/^mailto:/i, ''),
      web = prvi('website', 'contact:website');
    if (tel) o.tel = tel;
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mail)) o.mail = mail;
    if (/\.[a-z]{2,}/i.test(web)) o.web = /^https?:\/\//i.test(web) ? web : 'https://' + web;
    return Object.keys(o).length ? o : null;
  };

  const LANCI = ["McDonald's", 'Burger King', 'KFC', 'Starbucks', 'Quick', 'Lunch Garden', 'La Place', 'Marché',
    'Wild Bean Cafe', 'Exki', 'Panos', 'Paul', 'Febo', 'Subway', 'Le Pain Quotidien', 'Carrefour Express',
    'AH to go', 'Delhaize', 'Kiosk', 'Autogrill', 'Brioche Dorée',
    'Rosenberger', 'Landzeit', 'Spar', 'Billa', 'Coop', 'Coop Pronto', 'Migros', 'Avec', 'Mövenpick'];
  const GORIVO = { 'Total': 'TotalEnergies', 'Total Access': 'TotalEnergies', 'TotalEnergies Access': 'TotalEnergies',
    'TinQ': 'Tinq', 'Q8 Easy': 'Q8', 'Texaco Express': 'Texaco',
    'Esso Express': 'Esso', 'Agip': 'Eni', 'Eni Station': 'Eni', 'Shell Express': 'Shell', 'BP Express': 'BP' };
  // Ulaz na odmorište ucrtan kao "izlaz" – nije pravi izlaz, odmorište već dolazi iz highway=services
  const NIJE_IZLAZ = /^(aire\b|parking\b|verzorgingsplaats\b|parkeerplaats\b|rustplaats\b|rastplatz\b|raststation\b|raststätte\b|parkplatz\b|area di servizio\b|počivališče\b|odmorište\b|odpočívka\b|odpočívadlo\b|mop\b|área de (servicio|descanso)\b|area de servicio\b|pihenőhely\b|pihenő\b|área de serviço\b|area de serviço\b|odmorište\b|одмориште\b|rasteplads\b|rastplats\b|rasteplass\b|levähdysalue\b|pysäköintialue\b|dinlenme tesis\w*|mola yeri\b)|\baire de (repos|services?)\b/i;
  // Čvorište: veza sa drugom autostradom, obilaznicom ili raskrsnica autostrada
  const CVOR = /(^|[\s(\/-])[AES]\s?\d{1,3}\b|knooppunt|verkeerswisselaar|klaverblad|échangeur|echangeur|\bring\b|autosnelweg|autoroute|knoten|verzweigung|dreieck|autobahnkreuz|jonction|svincolo|raccordo|razcep|čvor|čvorište|křižovatka|węzeł|enlace con|csomópont|križovatka|nó |petlja|петља|motorvejskryds|motorvägskorsning/i;

  /**
   * Ručne ispravke gde OSM ne daje dobar naziv deonice: d = [[od, do], …] redom po deonicama
   * (posle orijentacije), k = "izlazi" koji su zapravo čvorišta.
   */
  const ISPRAVKE = {};
  function ispravi(rez) {
    const isp = ISPRAVKE[rez.id];
    if (!isp) return rez;
    for (const x of rez.stavke) if (x.t === 'A' && (isp.k || []).includes(x.n)) x.t = 'K';
    if (isp.d && isp.d.length === rez.sekcije.length)
      rez.sekcije = isp.d.map(([od, dok]) => ({ od, do: dok, plus: dok, minus: od }));
    else if (isp.d) zapisi('ispravke: ' + rez.sekcije.length + ' deonica, a u tabeli ' + isp.d.length + ' – nazivi nisu promenjeni');
    return rez;
  }

  const ab = { stanje: 'spreman', rezultat: null, log: [] };
  /** Polazni grad kad relacija nema from= (ili je pogrešan). */
  const OD = {};
  const zapisi = t => { ab.log.push(t); ab.stanje = t; if (NODE) console.error('  ' + t); };

  async function upit(q, pokusaja = 7) {
    let cekaj = 10000;
    for (let i = 0; i < pokusaja; i++) {
      try {
        const r = await fetch(api(), { method: 'POST', body: 'data=' + encodeURIComponent(q),
          headers: NODE ? { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TurkeyRoadInfo-alati/1.0' } : {} });
        if (r.ok) {
          const j = await r.json();
          // preopterećen server vraća 200 sa delimičnim podacima i napomenom (A4/A6 bez odmorišta)
          if (!/error|timed out|out of memory/i.test(j.remark || '')) return j;
          zapisi('delimičan odgovor (' + j.remark.slice(0, 60) + '), ponavljam…');
        } else { zapisi('server ' + r.status + ', ponavljam…'); if (i % 2) sledeciServer(); }
      } catch (e) { zapisi('mreža: ' + e.message + ', ponavljam…'); }
      await pauza(cekaj); cekaj *= 1.6;
    }
    throw new Error('Overpass ne odgovara');
  }

  // ---------- 1. Linija autoputa (jedan smer), podeljena na deonice ----------
  function napraviLiniju(elementi) {
    const putevi = [];
    // samo route relacije (TMC relacije ponavljaju iste puteve po smerovima, npr. A9);
    // ako route relacija nema puteve (A96 ima samo TMC), uzimaju se i TMC
    for (const samoRoute of [true, false]) {
      for (const el of elementi) {
        if (el.type !== 'relation' || (samoRoute && (el.tags || {}).type !== 'route')) continue;
        for (const m of el.members) if (m.type === 'way' && m.geometry && m.geometry.length > 1
            && !/^(planned|construction|proposed)$/.test(m.role)) // deonice u izgradnji (npr. A44)
          putevi.push({ i: putevi.length, g: m.geometry.map(p => xy(p.lat, p.lon)) });
      }
      if (putevi.length) break;
    }
    if (!putevi.length) return { deonice: [], putevi };
    const svi = [].concat(...putevi.map(w => w.g));
    const centar = [svi.reduce((s, p) => s + p[0], 0) / svi.length, svi.reduce((s, p) => s + p[1], 0) / svi.length];
    const kljuc = p => Math.round(p[0]) + '_' + Math.round(p[1]);
    const poPocetku = {}, poKraju = {}, imaUlaz = new Set();
    putevi.forEach(w => {
      (poPocetku[kljuc(w.g[0])] = poPocetku[kljuc(w.g[0])] || []).push(w);
      (poKraju[kljuc(w.g[w.g.length - 1])] = poKraju[kljuc(w.g[w.g.length - 1])] || []).push(w);
      imaUlaz.add(kljuc(w.g[w.g.length - 1]));
    });
    const duz = g => g.reduce((s, p, i) => i ? s + d(p, g[i - 1]) : 0, 0);
    // pravac na kraju (ili početku) puta, preko ~100 m – ne preko celog puta, koji može da skreće (A93)
    const pravac = (g, naKraju) => {
      const t = naKraju ? [...g].reverse() : g;
      let i = 1; while (i < t.length - 1 && d(t[i], t[0]) < 100) i++;
      return naKraju ? [t[0][0] - t[i][0], t[0][1] - t[i][1]] : [t[i][0] - t[0][0], t[i][1] - t[0][1]];
    };
    const ukupno = putevi.reduce((s, w) => s + duz(w.g), 0);

    // Početak: kraj puta bez ulaza koji je najdalje od centra (jedan kraj autoputa)
    let kandidati = putevi.filter(w => !imaUlaz.has(kljuc(w.g[0])));
    if (!kandidati.length) kandidati = putevi;
    let w = kandidati.reduce((a, b) => d(b.g[0], centar) > d(a.g[0], centar) ? b : a);

    const korisceni = new Set(), deonice = [];
    let tacke = [], predjeno = 0;
    while (w) {
      korisceni.add(w.i); tacke.push(...w.g);
      const kraj = w.g[w.g.length - 1];
      const smer = [kraj[0] - w.g[0][0], kraj[1] - w.g[0][1]];
      const dalje = (poPocetku[kljuc(kraj)] || []).filter(v => !korisceni.has(v.i));
      if (dalje.length) { // najravniji nastavak
        const a = pravac(w.g, true);
        const ocena = v => { const b = pravac(v.g, false);
          return (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-9); };
        dalje.sort((a, b) => ocena(b) - ocena(a));
        // okret na suprotni kolovoz (npr. A1 kod prekida u Eifelu) → kraj neprekinutog dela
        if (ocena(dalje[0]) > -0.3) { w = dalje[0]; continue; }
      }
      // kraj neprekinutog dela
      if (ab.prekidi) ab.prekidi.push({ kraj: nazad(kraj), dalje: dalje.length, km: Math.round(duz(tacke) / 1000) });
      if (duz(tacke) > 3000) { deonice.push(tacke); predjeno += duz(tacke); }
      tacke = [];
      if (predjeno >= 0.47 * ukupno) break; // jedan smer je pokriven
      const vidjene = [].concat(...deonice);
      const blizu = s => { for (let k = 0; k < vidjene.length; k += 3) if (d(vidjene[k], s) < 400) return true; return false; };
      // najbliži nekorišćeni put u istom smeru, najviše 200 km dalje (A5 ima i zalutale puteve u inostranstvu)
      let naj = null, nd = ab.skok || 200000; // ES: AP-7 ima rupe duže od 200 km (A-7 između)
      for (const v of putevi) {
        if (korisceni.has(v.i)) continue;
        const s = v.g[0], e = v.g[v.g.length - 1];
        if ((e[0] - s[0]) * smer[0] + (e[1] - s[1]) * smer[1] <= 0) continue;
        const dd = d(s, kraj); if (dd >= nd || blizu(s)) continue;
        nd = dd; naj = v;
      }
      // od njega unazad do početka tog dela – inače se ide unazad komad po komad (A93)
      const pre = new Set();
      while (naj && !pre.has(naj.i)) {
        pre.add(naj.i);
        const b = pravac(naj.g, false);
        const ocena = u => { const a = pravac(u.g, true);
          return (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-9); };
        const pret = (poKraju[kljuc(naj.g[0])] || [])
          .filter(u => !korisceni.has(u.i) && !pre.has(u.i) && ocena(u) > -0.3 && !blizu(u.g[0]))
          .sort((x, y) => ocena(y) - ocena(x))[0];
        if (!pret) break;
        naj = pret;
      }
      w = naj;
    }
    if (tacke.length && duz(tacke) > 3000) deonice.push(tacke);
    return { deonice: deonice.map(p => { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + d(p[i], p[i - 1])); return { p, c }; }),
      putevi };
  }

  function projekcija(linija, q) {
    let b = { d: 1e18 };
    linija.deonice.forEach((s, si) => {
      const p = s.p;
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], c = p[i], vx = c[0] - a[0], vy = c[1] - a[1], L2 = vx * vx + vy * vy || 1e-9;
        const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L2));
        const dd = Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vy);
        if (dd < b.d) b = { d: dd, si, km: (s.c[i - 1] + t * Math.sqrt(L2)) / 1000, tx: vx, ty: vy };
      }
    });
    return b;
  }

  /** '+' ako je najbliža kolovozna traka usmerena kao rast kilometara. */
  function strana(linija, q, pr) {
    let bd = 1e18, v = null;
    for (const w of linija.putevi) {
      const g = w.g;
      for (let i = 1; i < g.length; i++) {
        const a = g[i - 1], c = g[i], vx = c[0] - a[0], vy = c[1] - a[1], L2 = vx * vx + vy * vy || 1e-9;
        const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L2));
        const dd = Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vy);
        if (dd < bd) { bd = dd; v = [vx, vy]; }
      }
    }
    return v && v[0] * pr.tx + v[1] * pr.ty < 0 ? '-' : '+';
  }

  const tacka = e => e.lat != null ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null;
  /** Naziv izlaza: prvi deo pre ';', bez suvišnih razmaka. */
  const imeIzlaza = t => (t.name || t['name:it'] || t.exit_to || t.destination || '').split(';')[0].replace(/\s+/g, ' ').trim();
  const punjac = e => {
    e = e.replace(/\b(GmbH|AG|SE|und Co\.KG|mobility\+|Drive Infrastructure|Energie Baden-Württemberg|Recharge Solutions)\b/g, '')
      .replace(/\s+/g, ' ').trim().replace(/^[ -]+|[ -]+$/g, '');
    return { 'IONITY': 'Ionity', 'Nio Power': 'NIO Power', 'E': '' }[e] ?? e;
  };


  /**
   * Okreće autoput tako da brojevi izlaza rastu sa kilometrima
   * (kao zvanično: npr. A8 od Luksemburga ka Salcburgu).
   */
  function orijentisi(rez, duzine, prsten, deonice, odQ) {
    if (odQ) return orijentisiPoGradu(rez, duzine, prsten, deonice, odQ);
    const broj = x => 'AK'.includes(x.t) ? parseInt(x.ref, 10) : NaN;
    // svaka deonica posebno (delovi istog autoputa mogu biti ucrtani u suprotnim smerovima, npr. A93)
    rez.sekcije.forEach((sek, si) => {
      const L = duzine[si];
      if (prsten[si]) { // prsten (A10): km 0 kod izlaza sa najmanjim brojem
        const iz = rez.stavke.filter(x => x.si === si && !isNaN(broj(x)));
        if (iz.length) {
          const k0 = iz.reduce((a, b) => broj(b) < broj(a) ? b : a).km;
          rez.stavke.forEach(x => { if (x.si === si) x.km = +((x.km - k0 + L) % L).toFixed(1); });
        }
      }
      const iz = rez.stavke.filter(x => x.si === si && !isNaN(broj(x))).map(x => [x.km, broj(x)]);
      if (iz.length < 2) return;
      const ms = iz.reduce((s, v) => s + v[0], 0) / iz.length, mb = iz.reduce((s, v) => s + v[1], 0) / iz.length;
      if (iz.reduce((s, v) => s + (v[0] - ms) * (v[1] - mb), 0) >= 0) return;
      rez.stavke.forEach(x => {
        if (x.si !== si) return;
        x.km = +(prsten[si] ? (L - x.km) % L : Math.max(0, L - x.km)).toFixed(1);
        if (x.s) x.s = x.s === '+' ? '-' : '+';
      });
      rez.sekcije[si] = { od: sek.do, do: sek.od, plus: sek.minus, minus: sek.plus };
    });
    // prsten: nazivi deonice po novom početku
    rez.sekcije.forEach((_, si) => {
      if (!prsten[si]) return;
      const iz = rez.stavke.filter(x => x.si === si && 'AK'.includes(x.t) && x.n).sort((a, b) => a.km - b.km);
      if (iz.length) rez.sekcije[si] = { od: iz[0].n, do: iz[iz.length - 1].n, plus: iz[iz.length - 1].n, minus: iz[0].n };
    });
    // deonice redom po brojevima izlaza (medijana, da strani brojevi na zajedničkim delovima ne smetaju)
    const sredina = si => { const b = rez.stavke.filter(x => x.si === si).map(broj).filter(v => !isNaN(v)).sort((a, c) => a - c);
      return b.length ? b[b.length >> 1] : Infinity; };
    const red = rez.sekcije.map((_, si) => si).sort((a, c) => sredina(a) - sredina(c) || a - c);
    rez.sekcije = red.map(si => rez.sekcije[si]);
    rez.stavke.forEach(x => { x.si = red.indexOf(x.si); });
    rez.stavke.sort((a, b) => a.si - b.si || a.km - b.km || ('AK'.includes(a.t) ? 0 : 1) - ('AK'.includes(b.t) ? 0 : 1));
    return rez;
  }

  /**
   * Polazni grad (ako je upisan u OD): km 0 na kraju svake deonice koji je bliži polaznom gradu (A1: Milano),
   * a deonice redom po udaljenosti od njega.
   */
  function orijentisiPoGradu(rez, duzine, prsten, deonice, odQ) {
    rez.sekcije.forEach((sek, si) => {
      const g = deonice[si].p, L = duzine[si];
      if (prsten[si] || d(g[g.length - 1], odQ) >= d(g[0], odQ)) return;
      rez.stavke.forEach(x => {
        if (x.si !== si) return;
        x.km = +Math.max(0, L - x.km).toFixed(1);
        if (x.s) x.s = x.s === '+' ? '-' : '+';
      });
      rez.sekcije[si] = { od: sek.do, do: sek.od, plus: sek.minus, minus: sek.plus };
    });
    const blizina = si => { const g = deonice[si].p; return Math.min(d(g[0], odQ), d(g[g.length - 1], odQ)); };
    const red = rez.sekcije.map((_, si) => si).sort((a, c) => blizina(a) - blizina(c));
    rez.sekcije = red.map(si => rez.sekcije[si]);
    rez.stavke.forEach(x => { x.si = red.indexOf(x.si); });
    rez.stavke.sort((a, b) => a.si - b.si || a.km - b.km || ('AK'.includes(a.t) ? 0 : 1) - ('AK'.includes(b.t) ? 0 : 1));
    return rez;
  }

  /** Izbacuje izlaze susednog autoputa (čvor blizu trase čiji broj ne staje između suseda). */
  function izbaciStrane(rez) {
    const br = x => 'AK'.includes(x.t) ? parseInt(x.ref, 10) : NaN;
    // cela deonica tuđa: svi njeni brojevi već postoje u većoj deonici (A44 kod Kassela, izlazi 78/79 sa A7)
    const brojevi = rez.sekcije.map((_, si) => rez.stavke.filter(x => x.si === si).map(br).filter(v => !isNaN(v)));
    const tudje = new Set(brojevi.map((b, si) => b.length && brojevi.some((c, sj) => sj !== si && c.length > b.length
      && b.every(v => c.includes(v))) ? si : -1).filter(si => si >= 0));
    rez.stavke = rez.stavke.filter(x => !tudje.has(x.si));
    const iz = rez.stavke.filter(x => !isNaN(br(x))), losi = new Set();
    for (let i = 1; i < iz.length - 1; i++) {
      const p = iz[i - 1], x = iz[i], n = iz[i + 1];
      if (p.si === x.si && n.si === x.si && br(p) <= br(n) && (br(x) < br(p) || br(x) > br(n))) losi.add(x);
    }
    // krajevi deonica: prvi veći od sledeća dva, poslednji manji od prethodna dva (npr. 88 Hattenbacher Dreieck na A5)
    for (let i = 0; i < iz.length; i++) {
      const x = iz[i], a = iz[i + 1], b = iz[i + 2], c = iz[i - 1], e = iz[i - 2];
      const prvi = !c || c.si !== x.si, poslednji = !a || a.si !== x.si;
      if (prvi && a && b && a.si === x.si && b.si === x.si && br(a) <= br(b) && br(x) > br(a)) losi.add(x);
      if (poslednji && c && e && c.si === x.si && e.si === x.si && br(e) <= br(c) && br(x) < br(c)) losi.add(x);
    }
    rez.stavke = rez.stavke.filter(x => !losi.has(x));
    return rez;
  }

  /** Uklanja deonice bez ijedne stavke (kratki odvojeni komadi, npr. na A7) i prenumeriše si. */
  function ukloniPrazne(rez) {
    const nova = [];
    rez.sekcije.forEach((_, si) => { if (rez.stavke.some(x => x.si === si)) nova[si] = nova.filter(v => v != null).length; });
    rez.sekcije = rez.sekcije.filter((_, si) => nova[si] != null);
    rez.stavke.forEach(x => { x.si = nova[x.si]; });
    return rez;
  }

  /** Naziv bezimene pumpe i odmorišta na jeziku zemlje (NL i BE: holandski). */
  const IME_MESTA = {'TR':['Akaryakıt istasyonu', 'Dinlenme tesisi'], 'NI':['Petrol station', 'Services'], 'NO':['Bensinstasjon', 'Rasteplass'], 'FI':['Huoltoasema', 'Levähdysalue'], 'GB':['Petrol station', 'Services'], 'IE':['Petrol station', 'Services'], 'DK':['Tankstation', 'Rasteplads'], 'SE':['Bensinstation', 'Rastplats'], 'GR':['Pratirio kafsimon', 'Choros stathmefsis'], 'BG':['Benzinostantsiya', 'Pochivka'], 'RO':['Benzinărie', 'Parcare'],
    'AT':['Tankstelle', 'Rastplatz'],
     'CH':['Tankstelle', 'Rastplatz'],
     'SI':['Bencinski servis', 'Počivališče'],
     'HR':['Benzinska postaja', 'Odmorište'],
     'CZ':['Čerpací stanice', 'Odpočívka'],
     'PL':['Stacja paliw', 'MOP'],
     'ES':['Gasolinera', 'Área de descanso'],
     'PT':['Posto de combustível', 'Área de repouso'],
     'HU':['Benzinkút', 'Pihenőhely'],
     'SK':['Čerpacia stanica', 'Odpočívadlo'],
     'RS':['Benzinska stanica', 'Odmorište'],
     'LU':['Station-service', 'Aire']};

  // ---------- 2. Glavni tok ----------
  async function preuzmi(ref) {
    const MREZA = { GR: 'GR:motorway', BG: 'bg:motorway', RO: 'RO:A', NL: 'NL:A', BE: 'BE:A-road', LU: 'LU:A-road', AT: 'AT:A-road', CH: 'CH:motorway',
      SI: 'SI:AC', HR: 'HR:Autoceste', CZ: 'CZ:national', PL: 'PL:motorway', ES: 'ES:A-road', HU: 'HU:motorway', SK: 'sk:national', PT: 'PT:national', RS: 'RS:motorway',
      DK: 'e-road', SE: 'e-road', GB: 'UK:motorway', IE: 'IE:motorway',
      NO: 'e-road', FI: 'fi:national', NI: 'GB:NIR:motorway', TR: 'TR:motorway' };
    const delovi = ref.toUpperCase().replace(/\s+/g, '').split('-');
    const zemlja = delovi.length > 1 ? delovi[0] : 'NL';
    if (!MREZA[zemlja]) throw new Error('nepoznata zemlja ' + zemlja + ' (' + Object.keys(MREZA).join(', ') + ')');
    // Španija: ref sa crticom (ES-AP-7 → AP-7); Poljska: S-putevi u mreži brzih puteva
    const id = zemlja === 'ES' || zemlja === 'TR' ? delovi.slice(1).join('-') : delovi[delovi.length - 1]; ref = id;
    if (zemlja === 'ES' && id.startsWith('AP-')) MREZA.ES = 'ES:AP-highway';
    if (zemlja === 'PT' || zemlja === 'BG') ref = id.replace(/^([A-Z]+)(\d)/, '$1 $2'); // OSM u Portugalu i Bugarskoj: "A 1"
    if (zemlja === 'GR') ref = id.replace(/^A/, 'Α'); // Grčka: grčko alfa, "Α1"
    // Skandinavija: autoputevi su uglavnom E-putevi ("E 45"); ostali u domaćoj mreži (DK-15, SE-40, FI-1)
    if (['DK', 'SE', 'NO', 'FI'].includes(zemlja)) {
      ref = id.replace(/^E(\d)/, 'E $1');
      const domaca = { DK: 'DK:national', SE: 'SE:RV', NO: 'NO:riksvei',
        FI: ['4', '5', '6', '8', '13', '21', '29'].includes(id) ? 'FI:national' : 'fi:national' };
      MREZA[zemlja] = id.startsWith('E') ? 'e-road' : domaca[zemlja];
    }
    // Britanija: "A1(M)" → fajl gb-a1m; autoputevi uglavnom bez relacija (samo M23, M25 u UK:motorway)
    if (zemlja === 'GB') ref = id.replace(/^(A\d+)M$/, '$1(M)');
    // oznaka druge autoceste na rampi (destination:ref): u Britaniji M1 ili A1(M), drugde A1
    const AUTOPUT = zemlja === 'GB' || zemlja === 'NI' ? /^(M\d{1,3}|A\d{1,3}\(M\))$/ : /^A\d{1,3}$/;
    ab.skok = zemlja === 'ES' ? 500000 : ['SE', 'NO', 'FI'].includes(zemlja) ? 700000 : 200000;
    if (zemlja === 'PL' && id.startsWith('S')) MREZA.PL = 'PL:expressway';
    if (zemlja === 'AT' && id.startsWith('S')) MREZA.AT = 'AT:S-road'; // OSM u Beneluksu: "A2", bez razmaka
    const oblast = `area["ISO3166-1"="${zemlja}"][admin_level=2]->.z;`;
    const rel = `rel[route=road][network="${MREZA[zemlja]}"][ref="${ref}"]`;
    // lokalni Geofabrik izvod (alati/osm_lokalno.js) umesto Overpass-a: relacija + putevi po oznaci (ref "A2")
    const L = ab.lokalno ? ab.lokalno(zemlja) : null;
    const sjedini = (a, b) => { const ids = new Set(a.map(w => w.id)); return a.concat(b.filter(w => !ids.has(w.id))); };
    const kaoRelacija = w => [{ type: 'relation', tags: { type: 'route' }, members: w.map(x => ({ type: 'way', role: '', geometry: x.geometry })) }];
    let wL = [];

    zapisi('1/3 linija autoputa…');
    // Izuzeci: BE A15 je u OSM-u samo kao E42 (zbirna relacija A7/A8/A15/A16) → putevi E42 između Monsa i Liègea
    const POSEBNO = { 'BE-A15': { ref: 'E42', lon: [3.85, 5.52] } };
    const pos = L && POSEBNO[zemlja + '-' + ref];
    // izvod zemlje sadrži i pogranične strane autoputeve iste oznake (švajcarski A1 kod St. Margrethena u izvodu Austrije):
    // putevi po oznaci samo ako nisu u stranoj mreži i ako su do ~30 km od puteva domaće relacije (kao u AutoroutesInfo)
    const domaci = ws => {
      // GB: domaće su GB: i UK:, ali ne GB:NIR (Severna Irska ima svoj M1, M2…)
      const strani = L.uMrezama(zemlja === 'GB' ? /^(?!GB:(?!NIR)|UK:)(BAB|[a-z]{2}:)/i
        : zemlja === 'NI' ? /^(?!GB:NIR)(BAB|[a-z]{2}:)/i // Severna Irska (izvod ostrva Irske): irski M1 je stran
        : new RegExp('^(?!' + zemlja + ':)(BAB|[a-z]{2}:)', 'i'));
      ws = ws.filter(w => !strani.has(w.id));
      const rel = L.putevi(MREZA[zemlja], ref); if (!rel.length || ['ES', 'SE', 'NO', 'FI'].includes(zemlja)) return ws;
      // ES: oznake sa crticom su samo španske; SE, NO, FI: relacije su nepotpune (E6 u Norveškoj, 4 u Finskoj)
      const c = p => Math.round(p.lat * 4) + '_' + Math.round(p.lon * 3), mreza = new Set();
      for (const w of rel) for (const p of w.geometry) { const [a, b] = c(p).split('_').map(Number);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) mreza.add((a + i) + '_' + (b + j)); }
      return ws.filter(w => w.geometry.some(p => mreza.has(c(p))));
    };
    const geo = L ? { elements: kaoRelacija(wL = pos
        ? L.poOznaci(pos.ref).filter(w => w.geometry.every(p => p.lon >= pos.lon[0] && p.lon <= pos.lon[1]))
        // Srbija: deo puteva ima ćirilično „А2“
        : sjedini(L.putevi(MREZA[zemlja], ref), domaci(L.poOznaci(ref)
          .concat(zemlja === 'RS' ? L.poOznaci(ref.replace(/^A/, 'А')) : zemlja === 'BG' ? L.poOznaci(id) : [])))) }
      : await upit(`[out:json][timeout:240];${rel}->.r;(.r;rel(r.r););out geom;`);
    const postaviCos = elementi => { let s = 0, n = 0; for (const el of elementi) for (const m of el.members || [])
      if (m.geometry) for (const p of m.geometry) { s += p.lat; n++; } cosLat = Math.cos((n ? s / n : 50) * RAD); };
    postaviCos(geo.elements);
    let linija = napraviLiniju(geo.elements);
    // relacija bez puteva (A96: samo ugnežđene TMC relacije) → putevi autoputa sa tom oznakom
    let putevi = `${rel}->.r;(.r;rel(r.r););way(r)[highway=motorway]->.w;`;
    if (!linija.deonice.length) {
      zapisi('1/3 relacija bez puteva, uzimam puteve po oznaci…');
      putevi = `${oblast}way[highway=motorway][ref~"(^|;)${ref}(;|$)"](area.z)->.w;`;
      const poOznaci = L ? { elements: wL = L.poOznaci(ref) } : await upit(`[out:json][timeout:240];${putevi}.w out geom;`);
      const kao = [{ type: 'relation', tags: { type: 'route' },
        members: poOznaci.elements.map(w => ({ type: 'way', role: '', geometry: w.geometry })) }];
      postaviCos(kao);
      linija = napraviLiniju(kao);
    }
    if (!linija.deonice.length) throw new Error('nema geometrije za ' + ref);

    // km 0 = kraj bliži polaznom gradu (from= na relaciji, npr. A1: Milano)
    let odQ = null;
    const glavna = geo.elements.filter(e => e.type === 'relation' && (e.tags || {}).from)
      .sort((a, b) => b.members.length - a.members.length)[0];
    // Smer po brojevima izlaza; polazni grad samo ako je ručno upisan u OD
    const od = glavna && OD[id];
    if (od) {
      const mesto = L ? { elements: L.mesto(od) } : await upit(`[out:json][timeout:60];area["ISO3166-1"="${zemlja}"][admin_level=2]->.it;
        node[place~"^(city|town|village)$"][name="${od}"](area.it);out 1;`);
      const m = mesto.elements[0];
      if (m) odQ = xy(m.lat, m.lon); else zapisi('polazni grad "' + od + '" nije nađen, km po brojevima');
    }

    // Pravougaonik oko autoputa: "around" oko hiljadu puteva preopterećen server tiho vrati prazno
    // (NL A2: 0 odmorišta), pa se odmorišta traže u pravougaoniku, a udaljenost proverava ovde.
    let ju = 90, za = 180, se = -90, is = -180;
    for (const dd of linija.deonice) for (const q of dd.p) {
      const [la, lo] = nazad(q);
      ju = Math.min(ju, la); se = Math.max(se, la); za = Math.min(za, lo); is = Math.max(is, lo);
    }
    const okvir = `(${(ju - 0.01).toFixed(4)},${(za - 0.015).toFixed(4)},${(se + 0.01).toFixed(4)},${(is + 0.015).toFixed(4)})`;

    zapisi('2/3 izlazi i odmorišta…');
    // preopterećen server ponekad vrati prazan odgovor bez napomene (A1 bez ijednog odmorišta) → ponovi
    let osnova;
    if (L) osnova = { elements: [...L.izlazi(wL), ...L.odmorista(ju - 0.01, za - 0.015, se + 0.01, is + 0.015)] };
    else for (let i = 0; ; i++) {
      osnova = await upit(`[out:json][timeout:240];${putevi}
      node(w.w)[highway=motorway_junction];out qt;
      nwr[highway~"^(services|rest_area)$"]${okvir};out center qt;`);
      const ima = tip => osnova.elements.some(e => (e.tags || {}).highway === tip);
      if (ima('motorway_junction') && ima('services')) break;
      if (i >= 4) throw new Error('server vraća prazne odgovore (nema izlaza ili odmorišta), probaj kasnije');
      zapisi('prazan odgovor (bez izlaza ili odmorišta), ponavljam…');
      sledeciServer();
      await pauza(30000 * (i + 1));
    }

    zapisi('2/3 rampe izlaza (odredišta)…');
    // poseban upit: zajedno sa odmorištima server često pada (502)
    const rampe = L ? { elements: L.rampe(osnova.elements.filter(e => (e.tags || {}).highway === 'motorway_junction')) } : await upit(`[out:json][timeout:180];${putevi}
      node(w.w)[highway=motorway_junction]->.j;way(bn.j)[highway=motorway_link];out body qt;`);

    zapisi('obrada…');
    // Odmorišta
    const sv = [];
    for (const e of osnova.elements) {
      const t = e.tags || {}, p = tacka(e);
      if (!p || !/^(services|rest_area)$/.test(t.highway || '')) continue;
      const q = xy(p[0], p[1]), pr = projekcija(linija, q);
      if (pr.d > 600) continue; // pravougaonik hvata i odmorišta drugih puteva
      sv.push({ el: e, q, p, pr, tag: t, kon: kontakt(t), t: t.highway === 'services' ? 'R' : 'P', s: strana(linija, q, pr),
        f: new Set(), h: new Set(), e: new Set(), re: /yes/.test(t.restaurant || ''), wc: /yes|designated/.test(t.toilets || ''),
        du: /yes/.test(t.shower || ''), ho: false, sh: /yes/.test(t.shop || ''), lkw: t['capacity:truck'] || t['capacity:hgv'] || '' });
    }
    zapisi('3/3 pumpe, hrana, punjači…');
    // samo odmorišta uz ovaj autoput, po ID-u (krug oko svih iz pravougaonika server tiho vrati prazno)
    const skup = [['node', 'node'], ['way', 'way'], ['relation', 'rel']].map(([tip, q]) => {
      const l = sv.filter(x => x.el.type === tip).map(x => x.el.id);
      return l.length ? `${q}(id:${l.join(',')});` : '';
    }).join('');
    // površine idu zajedno sa svojim tačkama, inače "around" za njih ne nalazi ništa
    const upitUsluga = `[out:json][timeout:240];(${skup})->.o;(.o;.o >;)->.s;
      (nwr(around.s:350)[amenity~"^(fuel|fast_food|restaurant|cafe|toilets|charging_station|shower|parking)$"];
       nwr(around.s:350)[tourism~"^(hotel|motel)$"];
       nwr(around.s:350)[shop~"^(convenience|kiosk)$"];);out center qt;`;
    let usluge = { elements: [] };
    // preopterećen server ume da vrati prazan odgovor bez greške → ponovi
    if (L) usluge = { elements: L.usluge(sv.map(x => x.el)) };
    else for (let i = 0; sv.length && i < 4; i++) {
      usluge = await upit(upitUsluga);
      if (usluge.elements.length) break;
      zapisi('sadržaji: prazan odgovor, ponavljam…');
      sledeciServer();
      await pauza(20000 * (i + 1));
    }
    zapisi('sadržaji: ' + usluge.elements.length + ' (odmorišta: ' + sv.length + ')');

    // Sadržaji → najbliže odmorište (po mogućstvu na istoj strani)
    for (const e of usluge.elements) {
      const t = e.tags || {}, p = tacka(e);
      if (!p) continue;
      const q = xy(p[0], p[1]);
      const blizu = sv.filter(s => d(q, s.q) < 450).sort((a, b) => d(q, a.q) - d(q, b.q));
      if (!blizu.length) continue;
      const st = strana(linija, q, projekcija(linija, q));
      const s = blizu.find(x => x.s === st && Math.abs(x.pr.km - blizu[0].pr.km) < 1.5) || blizu[0];
      const ime = (t.brand || t.name || '').trim();
      const kk = kontakt(t), kg = t.amenity === 'fuel' ? 'konF' : 'konX'; // pumpa ima prednost
      if (kk && !s[kg]) s[kg] = kk;
      if (t.amenity === 'fuel') s.f.add(/^total/i.test(ime) ? 'TotalEnergies' : GORIVO[ime] || ime || (IME_MESTA[zemlja] || ['Tankstation'])[0]);
      else if (/^(fast_food|restaurant|cafe)$/.test(t.amenity)) {
        const lanac = /serways/i.test(ime) ? 'Serways' : /^axxe/i.test(ime) ? 'Axxe' : ime;
        if (LANCI.includes(lanac)) s.h.add(lanac); else s.re = true;
        if (t.amenity === 'restaurant') s.re = true;
      }
      else if (t.amenity === 'toilets') s.wc = true;
      else if (t.amenity === 'shower') s.du = true;
      else if (t.amenity === 'charging_station') s.e.add((t.operator || t.brand || t.name || '').trim());
      else if (t.tourism) s.ho = true;
      else if (t.shop) s.sh = true;
      else if (t.amenity === 'parking' && !s.lkw) s.lkw = t['capacity:hgv'] || t['capacity:truck'] || '';
    }

    const stavke = [];
    // Izlazi: oba kolovoza se spajaju po broju izlaza (ref), a bez broja po nazivu
    // (isti ključ na istoj deonici, do 4 km razmaka = jedan izlaz).
    const izlazi = [];
    let bezImena = 0, odmorista = 0;
    // Odredište je obično na izlaznoj rampi, ne na čvoru → rampa po svom prvom čvoru
    const rampa = {};
    for (const e of rampe.elements) if (e.type === 'way' && e.nodes && e.tags) {
      const t = e.tags, r = rampa[e.nodes[0]] = rampa[e.nodes[0]] || { dest: [], dref: [] };
      for (const v of (t.destination || '').split(';')) if (v.trim() && !r.dest.includes(v.trim())) r.dest.push(v.trim());
      for (const v of (t['destination:ref'] || '').split(';')) { const x = v.replace(/\s+/g, '');
        if (AUTOPUT.test(x) && x !== id && x !== ref && !r.dref.includes(x)) r.dref.push(x); }
    }
    for (const e of osnova.elements) {
      const t = e.tags || {};
      if (t.highway !== 'motorway_junction' || e.lat == null) continue;
      const broj = (t.ref || '').split(';')[0].trim();
      const L = rampa[e.id] || { dest: [], dref: [] };
      const n = imeIzlaza(t) || L.dest.slice(0, 2).join(', ') || (broj ? ({ LU: 'Sortie', AT: 'Ausfahrt', CH: 'Ausfahrt', SI: 'Izvoz', HR: 'Izlaz', CZ: 'Exit', PL: 'Węzeł', ES: 'Salida', HU: 'Kijárat', SK: 'Výjazd', PT: 'Saída', RS: 'Izlaz', GR: 'Exodos', BG: 'Izhod', RO: 'Ieșire', DK: 'Frakørsel', SE: 'Trafikplats', GB: 'Junction', IE: 'Junction', NI: 'Junction', NO: 'Avkjøring', FI: 'Liittymä', TR: 'Kavşak' }[zemlja] || 'Afrit') + ' ' + broj : '');
      if (!n) { bezImena++; continue; }
      if (NIJE_IZLAZ.test(n) || /area\s+(di\s+)?servizio/i.test(n)) { odmorista++; continue; }
      const q = xy(e.lat, e.lon), pr = projekcija(linija, q);
      if (pr.d > 800) continue;
      const k = broj ? '#' + broj.toLowerCase() : n.toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, ' ').trim();
      const g = izlazi.find(x => x.k === k && x.si === pr.si && Math.abs(x.a[0].pr.km - pr.km) < 4);
      // pravi naziv, a ne samo natpis sa putokaza (A11 "Genova", A27 "Trieste - Udine - Tarvisio - Pordenone")
      const pravo = !!(t.name || t['name:it']) && n !== imeIzlaza({ destination: t.destination })
        && n !== imeIzlaza({ destination: t.exit_to }) && n.split(/\s+-\s+/).length < 3;
      if (g) { g.a.push({ pr, e, n }); g.pravo = g.pravo || pravo; L.dref.forEach(x => g.dref.includes(x) || g.dref.push(x)); }
      else izlazi.push({ k, si: pr.si, pravo, broj, dref: [...L.dref], a: [{ pr, e, n }] });
    }
    for (const { a, pravo, broj, dref } of izlazi) {
      const km = a.reduce((s, x) => s + x.pr.km, 0) / a.length;
      const la = a.reduce((s, x) => s + x.e.lat, 0) / a.length, lo = a.reduce((s, x) => s + x.e.lon, 0) / a.length;
      const n = a.map(x => x.n).sort((p, q) => q.length - p.length)[0];
      // oznaka druge autostrade u nazivu (A22, A1dir…) ide na znak čvorišta; sopstvena se ne računa
      const nA = n.replace(/\bA\s+(\d)/g, 'A$1'); // "A 10" → "A10"
      // druga autoroute: iz naziva ili sa rampe (destination:ref "A 77")
      const druge = [...dref, ...(nA.match(zemlja === 'GB' ? /\bM\d{1,3}\b/g : /\bA\d{1,3}\b/g) || [])].filter((r, i, v) => r !== id && v.indexOf(r) === i);
      // Britanija: A-putevi nisu autoputevi; čvor je samo prema M-putu ili A(M)
      const cvor = dref.length > 0 || (zemlja === 'GB'
        ? /(^|[\s(\/-])M\s?\d{1,3}\b|\bA\d{1,3}\(M\)/.test(nA.replace(new RegExp('\\b' + id + '\\b', 'g'), ''))
        : CVOR.test(nA.replace(new RegExp('\\b' + id + '\\b', 'g'), '')));
      const o = { t: cvor ? 'K' : 'A', si: a[0].pr.si, km: +km.toFixed(1), n, la: +la.toFixed(5), lo: +lo.toFixed(5) };
      if (cvor && druge.length) o.ref = druge[0];
      else if (broj && !cvor) o.ref = broj; // broj izlaza na znaku (Sortie 12)
      if (!pravo) o._putokaz = 1; // "Trieste - Udine - Tarvisio - Pordenone" – ne za naziv deonice
      stavke.push(o);
    }
    if (bezImena || odmorista) zapisi(`preskočeno čvorova: ${bezImena} bez naziva, ${odmorista} ulaza na odmorišta`);
    // Odmorišta, Autohof-i i parkinzi
    const prefiks = /^(Aire de [Ss]ervices? de |Aire de [Rr]epos de |Aire de [Ss]ervices? |Aire de [Rr]epos |Aire de )/;
    for (const s of sv) {
      let n = (s.tag.name || '').trim(), t = s.t;
      if (!n) { const ii = IME_MESTA[zemlja] || ['Tankstation', 'Verzorgingsplaats']; n = s.f.size ? ii[0] : ii[1]; }
      for (let i = 0; i < 2; i++) n = n.replace(prefiks, '') || n;
      const o = { t, si: s.pr.si, km: +s.pr.km.toFixed(1), s: s.s, n };
      if (s.f.size > 1) s.f.delete('Station-service'); // opšti naziv samo kad nema marke
      if (s.f.size) o.f = [...s.f];
      if (s.h.size) o.h = [...s.h];
      if (s.re) o.re = 1; if (s.wc) o.wc = 1; if (s.du) o.du = 1;
      const e = [...new Set([...s.e].map(punjac))].filter(Boolean);
      if (s.e.size) o.e = e.length ? e : ['E-Laden'];
      if (s.ho) o.ho = 1; if (s.sh) o.sh = 1; if (s.lkw) o.lkw = String(s.lkw);
      if (s.tag.opening_hours) o.oh = s.tag.opening_hours;
      Object.assign(o, s.kon || s.konF || s.konX || {}); // ceo kontakt iz istog izvora
      const ll = nazad(s.q); o.la = ll[0]; o.lo = ll[1];
      // isto mesto ucrtano dvaput → spoji
      const dup = stavke.find(x => x.t === t && x.si === o.si && x.n === n && x.s === o.s && Math.abs(x.km - o.km) < 0.6);
      if (dup) {
        for (const k of ['f', 'h', 'e']) if (o[k]) dup[k] = [...new Set([...(dup[k] || []), ...o[k]])];
        for (const k in o) if (!(k in dup)) dup[k] = o[k];
      } else stavke.push(o);
    }
    // "Izlaz" istog naziva kao odmorište/parking na manje od 1 km je samo ulaz na njega (A5: Prolex, Champagne, Les Crêtes)
    const isto = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    // i "Calstorta Nord" pored odmorišta "Calstorta Sud" (drugi kolovoz nije ucrtan): isti naziv, drugi nastavak strane
    const strana4 = /\s(nord|sud|est|ouest)$/;
    const osnova4 = n => isto(n).replace(strana4, '');
    const ulazi = new Set(stavke.filter(x => x.t === 'A' && stavke.some(y => 'RP'.includes(y.t) && y.si === x.si
      && Math.abs(y.km - x.km) < 1 && (isto(y.n) === isto(x.n)
        || strana4.test(isto(x.n)) && strana4.test(isto(y.n)) && osnova4(y.n) === osnova4(x.n)))));
    if (ulazi.size) zapisi('izbačeno ' + ulazi.size + ' ulaza na parking/odmorište: ' + [...ulazi].map(x => x.n).join(', '));
    stavke.splice(0, stavke.length, ...stavke.filter(x => !ulazi.has(x)));
    stavke.sort((a, b) => a.si - b.si || a.km - b.km || ('AK'.includes(a.t) ? 0 : 1) - ('AK'.includes(b.t) ? 0 : 1));

    // Lažne kratke deonice (drugi kolovoz ili rampa ucrtani zasebno: "Masone – Masone") → izbaci
    const duzine = linija.deonice.map(s => s.c[s.c.length - 1] / 1000);
    if (Math.max(...duzine) >= 30) stavke.splice(0, stavke.length, ...stavke.filter(x => duzine[x.si] >= 10));
    // Deonice: nazivi po prvom i poslednjem izlazu (po mogućstvu sa pravim nazivom, ne sa putokaza)
    const sekcije = linija.deonice.map((_, si) => {
      let iz = stavke.filter(x => x.si === si && x.t === 'A' && x.n && !x._putokaz);
      if (!iz.length) iz = stavke.filter(x => x.si === si && x.t === 'A' && x.n);
      if (!iz.length) iz = stavke.filter(x => x.si === si && 'AK'.includes(x.t) && x.n);
      let od = iz.length ? iz[0].n : '?', dok = iz.length ? iz[iz.length - 1].n : '?';
      if (od === dok) { // "Masone – Masone": drugi kraj po krajnjem izlazu ili čvorištu
        const sve = stavke.filter(x => x.si === si && 'AK'.includes(x.t) && x.n && x.n !== od);
        if (sve.length) { const z = sve[sve.length - 1], p = sve[0];
          if (z.km > iz[0].km) dok = z.n; else od = p.n; }
      }
      return { od, do: dok, plus: dok, minus: od };
    });

    const prsten = linija.deonice.map((s, i) => duzine[i] > 50 && d(s.p[0], s.p[s.p.length - 1]) < 1000);
    ab.rezultat = ispravi(ukloniPrazne(izbaciStrane(orijentisi({ id: zemlja + '-' + id, naziv: ref, sekcije, stavke, izvor: '© OpenStreetMap contributors (ODbL)',
      datum: new Date().toISOString().slice(0, 10) }, duzine, prsten, linija.deonice, odQ))));
    ab.rezultat.stavke.forEach(x => delete x._putokaz);
    const broj = {}; ab.rezultat.stavke.forEach(x => broj[x.t] = (broj[x.t] || 0) + 1);
    ab.sazetak = `${zemlja}-${ref}: ${ab.rezultat.stavke.length} tačaka ${JSON.stringify(broj)}, deonice: ` +
      ab.rezultat.sekcije.map((s, i) => `${s.od} – ${s.do} (${Math.round(Math.max(...ab.rezultat.stavke.filter(x => x.si === i).map(x => x.km), 0))} km)`).join('; ');
    zapisi('gotovo');
    return ab.rezultat;
  }

  ab.pokreni = ref => { ab.rezultat = null; ab.log = []; ab.stanje = 'radi';
    preuzmi(ref).catch(e => zapisi('greška: ' + e.message)); return 'pokrenuto'; };
  ab.sacuvaj = () => {
    if (!ab.rezultat) return 'nema rezultata';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ab.rezultat)], { type: 'application/json' }));
    a.download = ab.rezultat.id.toLowerCase() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    return 'sačuvano: ' + a.download;
  };

  /** Ponovo primenjuje filtere na već preuzet rezultat (posle izmene skripte, bez novog preuzimanja). */
  ab.popravi = rez => ispravi(ukloniPrazne(izbaciStrane(rez)));
  /** Broj izlaza čiji broj opada duž trase (0 = dobro). */
  ab.provera = () => {
    const a = ab.rezultat.stavke.filter(x => 'AK'.includes(x.t) && !isNaN(parseInt(x.ref, 10)));
    let los = 0; for (let i = 1; i < a.length; i++) if (a[i].si === a[i - 1].si && parseInt(a[i].ref, 10) < parseInt(a[i - 1].ref, 10)) los++;
    return los;
  };
  /**
   * AB.serija(["A 2", "A 3"]) – više autoputeva zaredom; AB.sacuvajSve() snima jedan
   * serija.txt sa redovima "a2.json<TAB>{json}" (razdvajanje: alati/razdvoji.sh).
   */
  ab.serija = async refs => {
    ab.gotovi = []; ab.izvestaj = [];
    for (const r of refs) {
      ab.pokreni(r);
      while (!/^(gotovo|greška)/.test(ab.stanje)) await pauza(3000);
      if (ab.stanje === 'gotovo') { ab.gotovi.push(ab.rezultat); ab.izvestaj.push(ab.sazetak + ' | van reda: ' + ab.provera()); }
      else ab.izvestaj.push(r + ': ' + ab.stanje);
      await pauza(5000);
    }
    ab.stanje = 'serija gotova';
  };
  ab.sacuvajSve = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ab.gotovi.map(x => x.id.toLowerCase() + '.json\t' + JSON.stringify(x)).join('\n') + '\n'], { type: 'text/plain' }));
    a.download = 'serija.txt';
    document.body.appendChild(a); a.click(); a.remove();
    return 'sačuvano: serija.txt (' + ab.gotovi.length + ')';
  };
  return ab;
})();

// ---------- Latinica za Srbiju, Bugarsku i Grčku (strani vozači ne čitaju ćirilicu i grčki) ----------
const PISMA = {
  RS: [['Lj', 'Љ'], ['Nj', 'Њ'], ['Dž', 'Џ'], ['lj', 'љ'], ['nj', 'њ'], ['dž', 'џ'], ...'AАBБVВGГDДĐЂEЕŽЖZЗIИJЈKКLЛMМNНOОPПRРSСTТĆЋUУFФHХCЦČЧŠШaаbбvвgгdдđђeеžжzзiиjјkкlлmмnнoоpпrрsсtтćћuуfфhхcцčчšш'.match(/../g).map(p => [p[0], p[1]])],
  BG: [['Zh', 'Ж'], ['Ts', 'Ц'], ['Ch', 'Ч'], ['Sht', 'Щ'], ['Sh', 'Ш'], ['Yu', 'Ю'], ['Ya', 'Я'], ['zh', 'ж'], ['ts', 'ц'], ['ch', 'ч'], ['sht', 'щ'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'],
    ...'AАBБVВGГDДEЕZЗIИYЙKКLЛMМNНOОPПRРSСTТUУFФHХAЪYЬaаbбvвgгdдeеzзiиyйkкlлmмnнoоpпrрsсtтuуfфhхaъyь'.match(/../g).map(p => [p[0], p[1]])],
  GR: [['Ou', 'Ου'], ['ou', 'ου'], ['ou', 'ού'], ['Th', 'Θ'], ['Ch', 'Χ'], ['Ps', 'Ψ'], ['th', 'θ'], ['ch', 'χ'], ['ps', 'ψ'],
    ...'AΑAΆBΒGΓDΔEΕEΈZΖIΗIΉIΙIΊKΚLΛMΜNΝXΞOΟOΌPΠRΡSΣTΤYΥYΎFΦOΩOΏaαaάvβgγdδeεeέzζiηiήiιiίiϊiΐkκlλmμnνxξoοoόpπrρsσsςtτyυyύyϋfφoωoώ'.match(/../g).map(p => [p[0], p[1]]).map(([l, c]) => [l === 'B' ? 'V' : l, c])]
};
function latinica(rez) {
  const tab = PISMA[String(rez.id).split('-')[0]];
  if (!tab) return rez;
  const t = x => { for (const [l, c] of tab) x = x.split(c).join(l); return x; };
  const obidji = o => typeof o === 'string' ? t(o) : Array.isArray(o) ? o.map(obidji)
    : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, obidji(v)])) : o;
  return obidji(rez);
}

// ---------- Pokretanje iz terminala ----------
if (typeof window === 'undefined' && typeof require !== 'undefined' && require.main === module) (async () => {
  const fs = require('fs'), path = require('path');
  const arg = process.argv.slice(2), suvo = arg.includes('--suvo');
  const lokalno = !arg.includes('--overpass'), osvezi = arg.includes('--osvezi');
  const refs = arg.filter(a => !a.startsWith('--')).map(a => a.toUpperCase().replace(/\s+/g, ''));
  if (!refs.length) { console.error('Upotreba: node alati/evropa_skripta.js [--suvo] NL-A2 BE-A10 LU-A1 …'); process.exit(1); }
  const cilj = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'autoputevi');
  let greske = 0;
  if (lokalno) { // Geofabrik izvod zemlje, jednom preuzet i obrađen (alati/osm/)
    const L = require('./osm_lokalno');
    for (const z of new Set(refs.map(r => r.includes('-') ? r.split('-')[0] : 'NL'))) await L.pripremi(z, { osvezi });
    AB.lokalno = L.ucitaj;
  }
  for (const [i, r] of refs.entries()) {
    console.error(r + ':');
    AB.pokreni(r);
    while (!/^(gotovo|greška)/.test(AB.stanje)) await new Promise(ok => setTimeout(ok, 1000));
    if (AB.stanje === 'gotovo') {
      const ime = AB.rezultat.id.toLowerCase() + '.json';
      if (!suvo) fs.writeFileSync(path.join(cilj, ime), JSON.stringify(latinica(AB.rezultat)));
      console.log((suvo ? '' : ime + ' ← ') + AB.sazetak + ' | van reda: ' + AB.provera());
    } else { console.log(r + ': ' + AB.stanje); greske++; }
    if (!lokalno && i < refs.length - 1) await new Promise(ok => setTimeout(ok, 5000));
  }
  process.exit(greske ? 1 : 0);
})();
