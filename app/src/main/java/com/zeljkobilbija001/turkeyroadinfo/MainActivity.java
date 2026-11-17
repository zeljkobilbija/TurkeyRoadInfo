package com.zeljkobilbija001.turkeyroadinfo;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Početni ekran: izbor zemlje (kartice sa zastavom). */
public class MainActivity extends AppCompatActivity {

    /** Broj kartica zemalja u jednom redu. */
    private static final int KOLONA = 3;

    private ImageButton dugmePrivatnosti;
    private VoznjaKartica voznja;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Splash mora pre super.onCreate()
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        // Aplikacija za jednu zemlju (AustriaRoadInfo, MotorwayInfo…): odmah spisak autoputeva te zemlje
        if (Autoputevi.ZEMLJE.length == 1) {
            startActivity(ZemljaActivity.namera(this, Autoputevi.ZEMLJE[0]));
            overridePendingTransition(0, 0);
            finish();
            return;
        }
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        ViewGroup zemlje = findViewById(R.id.zemlje);
        LayoutInflater inflater = LayoutInflater.from(this);
        String autoputevi = getString(R.string.naslov);
        // mreža od KOLONA kolona: red po red (nepotpun poslednji red se dopunjava praznim mestima)
        LinearLayout red = null;
        // zemlje po abecedi na jeziku telefona (Collator pravilno ređa č, ö, ł…)
        String[] poRedu = Autoputevi.ZEMLJE.clone();
        java.text.Collator abc = java.text.Collator.getInstance(java.util.Locale.getDefault());
        java.util.Arrays.sort(poRedu, (a, b) -> abc.compare(getString(ZemljaActivity.ime(a)), getString(ZemljaActivity.ime(b))));
        for (int i = 0; i < poRedu.length; i++) {
            String z = poRedu[i];
            if (i % KOLONA == 0) {
                red = new LinearLayout(this);
                red.setOrientation(LinearLayout.HORIZONTAL);
                zemlje.addView(red);
            }
            View k = inflater.inflate(R.layout.item_zemlja, red, false);
            String ime = getString(ZemljaActivity.ime(z));
            int broj = Autoputevi.zaZemlju(z).size();
            ((ImageView) k.findViewById(R.id.zastava)).setImageResource(ZemljaActivity.zastava(z));
            ((TextView) k.findViewById(R.id.imeZemlje)).setText(ime);
            ((TextView) k.findViewById(R.id.brojAutoputeva)).setText(autoputevi + " · " + broj);
            k.setContentDescription(ime + ", " + autoputevi + " " + broj);
            k.setOnClickListener(v -> startActivity(ZemljaActivity.namera(this, z)));
            red.addView(k);
        }
        for (int i = Autoputevi.ZEMLJE.length % KOLONA; i > 0 && i < KOLONA; i++) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, 0, 1);
            int m = Izgled.dp(this, 5); // kao layout_margin kartice
            lp.setMargins(m, m, m, m);
            red.addView(new View(this), lp);
        }

        findViewById(R.id.dugmePodeli).setOnClickListener(v -> podeliAplikaciju(this));

        // Privatnost (GDPR) i baner: prozor za saglasnost se prikazuje samo kad je potreban
        dugmePrivatnosti = findViewById(R.id.dugmePrivatnosti);
        dugmePrivatnosti.setOnClickListener(v ->
                Reklame.prikaziPodesavanjaPrivatnosti(this, this::posleSaglasnosti));
        Reklame.prikupiSaglasnost(this, this::posleSaglasnosti);

        voznja = new VoznjaKartica(this);
        VoznjaKartica.bezReklama(this);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (voznja == null) return; // aplikacija za jednu zemlju: ovaj ekran se odmah zatvara
        VoznjaService.postaviSlusaoca(voznja::osvezi);
        voznja.osvezi();
    }

    @Override
    protected void onStop() {
        if (voznja != null) VoznjaService.postaviSlusaoca(null);
        super.onStop();
    }

    private void posleSaglasnosti() {
        Reklame.prikaziBaner(this, findViewById(R.id.reklamaKontejner));
        dugmePrivatnosti.setVisibility(Reklame.trebaDugmePrivatnosti(this) ? View.VISIBLE : View.GONE);
    }

    /** Standardni Android meni za deljenje: kratka poruka i link ka aplikaciji na Play prodavnici. */
    static void podeliAplikaciju(Activity a) {
        String link = "https://play.google.com/store/apps/details?id=" + a.getPackageName();
        Intent slanje = new Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, a.getString(R.string.app_name))
                .putExtra(Intent.EXTRA_TEXT, a.getString(R.string.podeli_poruka, link));
        a.startActivity(Intent.createChooser(slanje, a.getString(R.string.podeli_naslov)));
    }
}
