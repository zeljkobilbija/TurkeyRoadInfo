package com.zeljkobilbija001.turkeyroadinfo;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.DrawableRes;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

/** Autoputevi jedne zemlje (Holandija, Belgija ili Luksemburg). */
public class ZemljaActivity extends AppCompatActivity {

    private static final String EXTRA_ZEMLJA = "zemlja";

    /** Kartica koja se okrenula pri otvaranju; pri povratku se vraća nazad. */
    private View okrenutaKartica;
    private boolean otvaranjeUToku;
    private ImageButton dugmePrivatnosti;
    private AutoputAdapter adapterAutoputeva;
    /** Autoput čiji je štit narandžast (Vožnja: vozač je na njemu). */
    private String obojeniAutoput;
    /** Samo u aplikaciji za jednu zemlju (tamo je ovo početni ekran). */
    private VoznjaKartica voznja;

    public static Intent namera(Context c, String zemlja) {
        return new Intent(c, ZemljaActivity.class).putExtra(EXTRA_ZEMLJA, zemlja);
    }

    @StringRes
    public static int ime(String zemlja) {
        switch (zemlja) {
            case "DE": return R.string.zemlja_de;
            case "FR": return R.string.zemlja_fr;
            case "IT": return R.string.zemlja_it;
            case "AT": return R.string.zemlja_at;
            case "CH": return R.string.zemlja_ch;
            case "SI": return R.string.zemlja_si;
            case "HR": return R.string.zemlja_hr;
            case "CZ": return R.string.zemlja_cz;
            case "PL": return R.string.zemlja_pl;
            case "ES": return R.string.zemlja_es;
            case "HU": return R.string.zemlja_hu;
            case "SK": return R.string.zemlja_sk;
            case "RS": return R.string.zemlja_rs;
            case "GR": return R.string.zemlja_gr;
            case "BG": return R.string.zemlja_bg;
            case "RO": return R.string.zemlja_ro;
            case "DK": return R.string.zemlja_dk;
            case "SE": return R.string.zemlja_se;
            case "GB": return R.string.zemlja_gb;
            case "IE": return R.string.zemlja_ie;
            case "NO": return R.string.zemlja_no;
            case "FI": return R.string.zemlja_fi;
            case "TR": return R.string.zemlja_tr;
            case "PT": return R.string.zemlja_pt;
            case "BE": return R.string.zemlja_be;
            case "LU": return R.string.zemlja_lu;
            default: return R.string.zemlja_nl;
        }
    }

    @DrawableRes
    public static int zastava(String zemlja) {
        switch (zemlja) {
            case "DE": return R.drawable.zastava_de;
            case "FR": return R.drawable.zastava_fr;
            case "IT": return R.drawable.zastava_it;
            case "AT": return R.drawable.zastava_at;
            case "CH": return R.drawable.zastava_ch;
            case "SI": return R.drawable.zastava_si;
            case "HR": return R.drawable.zastava_hr;
            case "CZ": return R.drawable.zastava_cz;
            case "PL": return R.drawable.zastava_pl;
            case "ES": return R.drawable.zastava_es;
            case "HU": return R.drawable.zastava_hu;
            case "SK": return R.drawable.zastava_sk;
            case "RS": return R.drawable.zastava_rs;
            case "GR": return R.drawable.zastava_gr;
            case "BG": return R.drawable.zastava_bg;
            case "RO": return R.drawable.zastava_ro;
            case "DK": return R.drawable.zastava_dk;
            case "SE": return R.drawable.zastava_se;
            case "GB": return R.drawable.zastava_gb;
            case "IE": return R.drawable.zastava_ie;
            case "NO": return R.drawable.zastava_no;
            case "FI": return R.drawable.zastava_fi;
            case "TR": return R.drawable.zastava_tr;
            case "PT": return R.drawable.zastava_pt;
            case "BE": return R.drawable.zastava_be;
            case "LU": return R.drawable.zastava_lu;
            default: return R.drawable.zastava_nl;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_zemlja);

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        String zemlja = getIntent().getStringExtra(EXTRA_ZEMLJA);
        if (zemlja == null) zemlja = "NL";
        ((TextView) findViewById(R.id.imeZemlje)).setText(ime(zemlja));
        ((ImageView) findViewById(R.id.zastava)).setImageResource(zastava(zemlja));
        findViewById(R.id.nazad).setOnClickListener(v -> finish());
        // jedna zemlja: ovo je početni ekran, nema nazad
        if (Autoputevi.ZEMLJE.length == 1) findViewById(R.id.nazad).setVisibility(android.view.View.GONE);

        RecyclerView lista = findViewById(R.id.listaAutoputeva);
        lista.setLayoutManager(new GridLayoutManager(this, 2));
        adapterAutoputeva = new AutoputAdapter(Autoputevi.zaZemlju(zemlja), this::otvori);
        lista.setAdapter(adapterAutoputeva);

        findViewById(R.id.dugmePodeli).setOnClickListener(v -> MainActivity.podeliAplikaciju(this));

        // Saglasnost se prikuplja na početnom ekranu; u aplikaciji za jednu zemlju ovo je početni ekran,
        // pa se prikuplja ovde (GDPR prozor kad treba, posle toga baner i dugme Privatnost)
        dugmePrivatnosti = findViewById(R.id.dugmePrivatnosti);
        dugmePrivatnosti.setOnClickListener(v ->
                Reklame.prikaziPodesavanjaPrivatnosti(this, this::posleSaglasnosti));
        if (Autoputevi.ZEMLJE.length == 1) Reklame.prikupiSaglasnost(this, this::posleSaglasnosti);
        else posleSaglasnosti();

        // jedna zemlja: kartica Vožnja i dugme Bez reklama su ovde; inače su na početnom ekranu
        if (Autoputevi.ZEMLJE.length == 1) {
            voznja = new VoznjaKartica(this);
            VoznjaKartica.bezReklama(this);
        } else {
            findViewById(R.id.voznja).setVisibility(android.view.View.GONE);
        }
    }

    /** Vožnja: štit autoputa na kom je vozač je narandžast; menja se sam pri prelasku na drugi. */
    private void osveziStit() {
        String sad = VoznjaService.sadAutoput;
        if (!java.util.Objects.equals(sad, obojeniAutoput)) {
            obojeniAutoput = sad;
            adapterAutoputeva.notifyDataSetChanged();
        }
    }

    private void osveziVoznju() {
        if (voznja != null) voznja.osvezi();
        osveziStit();
    }

    @Override
    protected void onStart() {
        super.onStart();
        VoznjaService.postaviSlusaoca(this, this::osveziVoznju);
        osveziVoznju();
    }

    @Override
    protected void onStop() {
        VoznjaService.skiniSlusaoca(this);
        super.onStop();
    }

    private void posleSaglasnosti() {
        Reklame.prikaziBaner(this, findViewById(R.id.reklamaKontejner));
        dugmePrivatnosti.setVisibility(Reklame.trebaDugmePrivatnosti(this) ? View.VISIBLE : View.GONE);
    }

    /** Kartica se okrene oko vertikalne ose, pa se otvara ekran autoputa koji se "dookrene". */
    private void otvori(Autoput a, View kartica) {
        if (!a.dostupan()) {
            Toast.makeText(this, getString(R.string.uskoro_poruka, a.oznaka()), Toast.LENGTH_SHORT).show();
            return;
        }
        if (otvaranjeUToku) return;
        otvaranjeUToku = true;
        okrenutaKartica = kartica;
        kartica.setCameraDistance(9000 * getResources().getDisplayMetrics().density);
        kartica.animate()
                .rotationY(90f)
                .scaleX(1.08f)
                .scaleY(1.08f)
                .setDuration(280)
                .setInterpolator(new AccelerateInterpolator())
                .withEndAction(() -> Reklame.posleOglasa(this, () -> {
                    // svako treće otvaranje (najviše jednom u 3 min, ne u Vožnji) prvo interstitial, pa autoput
                    Intent i = AutoputActivity.namera(this, a.id)
                            .addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
                    startActivity(i);
                    otvaranjeUToku = false;
                }))
                .start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Povratak sa ekrana autoputa: kartica se okrene nazad na svoje mesto
        View k = okrenutaKartica;
        okrenutaKartica = null;
        if (k != null) {
            k.setRotationY(-90f);
            k.animate()
                    .rotationY(0f)
                    .scaleX(1f)
                    .scaleY(1f)
                    .setDuration(380)
                    .setInterpolator(new DecelerateInterpolator())
                    .start();
        }
    }
}
