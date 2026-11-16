package com.zeljkobilbija001.turkeyroadinfo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Spisak autoputeva po zemljama (DE, FR, IT – JSON-i iz AutobahnInfo, AutoroutesInfo i AutostradeInfo; NL, BE, LU). Novi autoput: dodaj JSON u assets/autoputevi
 * (node alati/benelux_skripta.js NL-A2) i upiši ime datoteke umesto null ("autoputevi/nl-a2.json").
 * Za Belgiju se u nazivu rute navodi i evropska oznaka (E40), jer je na tablama češća od A-broja.
 */
public final class Autoputevi {

    private Autoputevi() { }

    public static final List<Autoput> SVE = Arrays.asList(
            new Autoput("TR", "O-2", "İstanbul (2. çevre yolu)", "autoputevi/tr-o-2.json"),
            new Autoput("TR", "O-3", "Edirne – Kınalı – İstanbul", "autoputevi/tr-o-3.json"),
            new Autoput("TR", "O-4", "İstanbul – İzmit – Bolu – Ankara", "autoputevi/tr-o-4.json"),
            new Autoput("TR", "O-5", "İstanbul – Bursa – İzmir", "autoputevi/tr-o-5.json"),
            new Autoput("TR", "O-6", "Malkara – Çanakkale", "autoputevi/tr-o-6.json"),
            new Autoput("TR", "O-7", "Kınalı – Kuzey Marmara – Akyazı", "autoputevi/tr-o-7.json"),
            new Autoput("TR", "O-20", "Ankara Çevre Yolu", "autoputevi/tr-o-20.json"),
            new Autoput("TR", "O-21", "Ankara – Niğde – Tarsus", "autoputevi/tr-o-21.json"),
            new Autoput("TR", "O-22", "Bursa çevre yolu", "autoputevi/tr-o-22.json"),
            new Autoput("TR", "O-30", "İzmir Çevre Yolu", "autoputevi/tr-o-30.json"),
            new Autoput("TR", "O-31", "İzmir – Aydın", "autoputevi/tr-o-31.json"),
            new Autoput("TR", "O-32", "İzmir – Çeşme", "autoputevi/tr-o-32.json"),
            new Autoput("TR", "O-33", "İzmir – Menemen", "autoputevi/tr-o-33.json"),
            new Autoput("TR", "O-51", "Mersin – Tarsus – Adana", "autoputevi/tr-o-51.json"),
            new Autoput("TR", "O-52", "Adana – Osmaniye – Gaziantep – Şanlıurfa", "autoputevi/tr-o-52.json"),
            new Autoput("TR", "O-53", "Toprakkale – İskenderun – Hatay", "autoputevi/tr-o-53.json"),
            new Autoput("TR", "O-54", "Gaziantep çevre yolu", "autoputevi/tr-o-54.json")
    );

    /** Redosled zemalja na početnom ekranu. */
    public static final String[] ZEMLJE = {"TR"};

    /** Autoputevi jedne zemlje ("NL", "BE" ili "LU"), redom kao u spisku. */
    public static List<Autoput> zaZemlju(String zemlja) {
        List<Autoput> l = new ArrayList<>();
        for (Autoput a : SVE) if (a.zemlja.equals(zemlja)) l.add(a);
        return l;
    }

    public static Autoput poId(String id) {
        for (Autoput a : SVE) if (a.id.equals(id)) return a;
        return null;
    }
}
