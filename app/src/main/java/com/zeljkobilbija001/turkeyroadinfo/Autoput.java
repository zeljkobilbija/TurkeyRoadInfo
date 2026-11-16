package com.zeljkobilbija001.turkeyroadinfo;

/** Jedan autoput na početnom ekranu (NL A2, BE A10, LU A1…). */
public final class Autoput {
    public final String zemlja;   // "DE", "FR", "IT", "NL", "BE" ili "LU"
    public final String ref;      // "A2"
    public final String id;       // "NL-A2" (jedinstven, jer A1 postoji u sve tri zemlje)
    public final String ruta;     // "Amsterdam – Utrecht – Eindhoven – Maastricht"
    public final String datoteka; // "autoputevi/nl-a2.json" ili null ako podaci još ne postoje

    public Autoput(String zemlja, String ref, String ruta, String datoteka) {
        this.zemlja = zemlja;
        this.ref = ref;
        this.id = zemlja + "-" + ref;
        this.ruta = ruta;
        this.datoteka = datoteka;
    }

    /** Oznaka kao na tabli: "A2", u Nemačkoj "A 2". */
    public String oznaka() {
        return "DE".equals(zemlja) ? ref.replaceFirst("^A", "A ") : ref;
    }

    /**
     * Štit kao na tablama: crven u Holandiji, Francuskoj, Švajcarskoj, Češkoj, Slovačkoj i Poljskoj,
     * zelen u Italiji, Sloveniji, Hrvatskoj, Srbiji, Grčkoj, Bugarskoj, Rumuniji, Danskoj, Švedskoj, Norveškoj i Finskoj (E-putevi), plav u Nemačkoj, Austriji, Španiji, Belgiji i Luksemburgu.
     */
    public int stit() {
        switch (zemlja) {
            case "NL": case "FR": case "CH": case "CZ": case "SK": case "PL": return R.drawable.bg_stit;
            case "IT": case "SI": case "HR": case "RS": case "GR": case "BG": case "RO": case "DK": case "SE": case "NO": case "FI": case "TR": return R.drawable.bg_stit_zeleni;
            default: return R.drawable.bg_stit_plavi;
        }
    }

    public boolean dostupan() {
        return datoteka != null;
    }
}
