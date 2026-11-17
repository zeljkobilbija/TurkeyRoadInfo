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
    /** Dozvole za režim vožnje: precizna lokacija (obavezno) i obaveštenja (Android 13+). */
    private final ActivityResultLauncher<String[]> dozvole;

    VoznjaKartica(AppCompatActivity a) {
        this.a = a;
        dugme = a.findViewById(R.id.voznjaDugme);
        opis = a.findViewById(R.id.voznjaOpis);
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
            VoznjaService.pokreni(a);
            osvezi();
        } else {
            dozvole.launch(traziti.toArray(new String[0]));
        }
    }

    private void posleDozvola() {
        if (ima(Manifest.permission.ACCESS_FINE_LOCATION)) {
            VoznjaService.pokreni(a);
            osvezi();
        } else {
            Snackbar.make(a.findViewById(R.id.main), R.string.voznja_dozvola, Snackbar.LENGTH_LONG).show();
        }
    }

    /** Dugme i opis prema stanju režima (poziva se na glavnoj niti). */
    void osvezi() {
        boolean radi = VoznjaService.radi;
        dugme.setText(radi ? R.string.voznja_zaustavi : R.string.voznja_pokreni);
        String o = VoznjaService.opisStanja;
        String tekst = radi && !o.isEmpty() ? o : a.getString(R.string.voznja_opis);
        if (Dnevnik.ukljucen(a)) tekst += "\nDNEVNIK › (dodir na karticu)";
        opis.setText(tekst);
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
