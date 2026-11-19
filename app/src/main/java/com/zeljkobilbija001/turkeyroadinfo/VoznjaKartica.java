package com.zeljkobilbija001.turkeyroadinfo;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.snackbar.Snackbar;

import java.util.ArrayList;
import java.util.List;

/**
 * Kartica „Vožnja“ i dugme „Bez reklama“. Stoje na početnom ekranu, a u aplikaciji za jednu zemlju
 * (AustriaRoadInfo, MotorwayInfo…) na ekranu zemlje, jer se tamo početni ekran preskače.
 * Pravi se u onCreate (prijava za dozvole mora pre nego što ekran krene).
 */
final class VoznjaKartica {

    private final AppCompatActivity a;
    private final MaterialButton dugme;
    private final TextView opis;
    private final View trazi;
    /** Dozvole za režim vožnje: precizna lokacija (obavezno) i obaveštenja (Android 13+). */
    private final ActivityResultLauncher<String[]> dozvole;

    VoznjaKartica(AppCompatActivity a) {
        this.a = a;
        dugme = a.findViewById(R.id.voznjaDugme);
        opis = a.findViewById(R.id.voznjaOpis);
        trazi = a.findViewById(R.id.voznjaTrazi);
        dozvole = a.registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), r -> posleDozvola());
        // proba (samo debug verzija): dodir na karticu "Vožnja" otvara dnevnik
        if (Dnevnik.ukljucen(a)) {
            a.findViewById(R.id.voznja).setOnClickListener(v -> a.startActivity(new Intent(a, DnevnikActivity.class)));
        }
        dugme.setOnClickListener(v -> {
            if (VoznjaService.radi) VoznjaService.zaustavi(a);
            else pokreni();
        });
    }

    private boolean ima(String dozvola) {
        return ContextCompat.checkSelfPermission(a, dozvola) == PackageManager.PERMISSION_GRANTED;
    }

    private void pokreni() {
        List<String> traziti = new ArrayList<>();
        if (!ima(Manifest.permission.ACCESS_FINE_LOCATION)) {
            traziti.add(Manifest.permission.ACCESS_FINE_LOCATION);
            traziti.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33 && !ima(Manifest.permission.POST_NOTIFICATIONS)) {
            traziti.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (traziti.isEmpty()) {
            pokreniAkoLokacija();
        } else {
            dozvole.launch(traziti.toArray(new String[0]));
        }
    }

    private void posleDozvola() {
        if (ima(Manifest.permission.ACCESS_FINE_LOCATION)) {
            pokreniAkoLokacija();
        } else {
            // jasan prozor umesto sitne poruke na dnu: bez dozvole Vožnja ne može da radi
            prozorLokacije(R.string.voznja_bez_dozvole_poruka,
                    new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            android.net.Uri.fromParts("package", a.getPackageName(), null)));
        }
    }

    /** Dozvola postoji; Vožnja se pokreće samo ako je lokacija na telefonu uključena. */
    private void pokreniAkoLokacija() {
        android.location.LocationManager lm = a.getSystemService(android.location.LocationManager.class);
        if (lm != null && !androidx.core.location.LocationManagerCompat.isLocationEnabled(lm)) {
            prozorLokacije(R.string.voznja_gps_iskljucen_poruka,
                    new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS));
            return;
        }
        VoznjaService.pokreni(a);
        osvezi();
    }

    /** Prozor "Vožnja ne može da se pokrene" sa dugmetom koje otvara podešavanja. */
    private void prozorLokacije(int poruka, android.content.Intent podesavanja) {
        new com.google.android.material.dialog.MaterialAlertDialogBuilder(a)
                .setTitle(R.string.voznja_ne_moze_naslov)
                .setMessage(poruka)
                .setPositiveButton(R.string.stanje_podesavanja, (d, w) -> {
                    try {
                        a.startActivity(podesavanja);
                    } catch (Exception ignored) { }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    /** Da li je Vožnja već jednom sama otvorila ekran autoputa (od poslednjeg uključenja). */
    private static boolean voznjaOtvorila;

    /** Dugme i opis prema stanju režima (poziva se na glavnoj niti). */
    void osvezi() {
        boolean radi = VoznjaService.radi;
        dugme.setText(radi ? R.string.voznja_zaustavi : R.string.voznja_pokreni);
        String o = VoznjaService.opisStanja;
        String tekst = radi && !o.isEmpty() ? o : a.getString(R.string.voznja_opis);
        if (Dnevnik.ukljucen(a)) tekst += "\nDNEVNIK › (dodir na karticu)";
        opis.setText(tekst);
        // kružić dok Vožnja traži autoput ili smer; narandžasto kad je lokacija isključena ili nema interneta
        trazi.setVisibility(radi && VoznjaService.trazi ? View.VISIBLE : View.GONE);
        opis.setTextColor(radi && VoznjaService.upozorenje ? Izgled.boja(a, R.color.ovde)
                : Izgled.boja(a, R.color.plava_svetla));
        // Vožnja je našla autoput i mesto na njemu: jednom po uključenju sama otvara taj autoput
        // (ekran autoputa ide do reda "Vi ste ovde"); povratak nazad posle toga ne vraća ponovo
        if (!VoznjaService.radi) voznjaOtvorila = false;
        else if (VoznjaService.sadAutoput != null && !voznjaOtvorila && !a.isFinishing()) {
            voznjaOtvorila = true;
            a.startActivity(AutoputActivity.namera(a, VoznjaService.sadAutoput));
        }
    }

    /**
     * Dugme „Bez reklama“ u zaglavlju: vidi se dok nije kupljeno; promena stanja (kupovina,
     * vraćanje na novom telefonu) ponovo iscrta ekran, pa baner nestane ili se pojavi.
     */
    static void bezReklama(AppCompatActivity a) {
        View d = a.findViewById(R.id.dugmeBezReklama);
        d.setVisibility(Kupovina.bezReklama(a) ? View.GONE : View.VISIBLE);
        d.setOnClickListener(v -> Kupovina.kupi(a, () -> a.runOnUiThread(() -> {
            Toast.makeText(a, R.string.kupovina_hvala, Toast.LENGTH_LONG).show();
            a.recreate();
        })));
        Kupovina.proveri(a, () -> a.runOnUiThread(a::recreate));
    }
}
