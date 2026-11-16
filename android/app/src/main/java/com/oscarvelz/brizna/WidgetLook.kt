package com.oscarvelz.brizna

import android.content.Context
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Per-widget options (android-6), chosen in WidgetConfigActivity when a widget is placed: an appearance
 * override ("day" / "night"; absent = follow the app's own look) and whether the Por cobrar block shows.
 * Kept in their own prefs, keyed by appWidgetId, and forgotten when the widget is removed.
 */
object WidgetLook {
    private const val PREFS = "brizna-widget-opts"

    fun lookOverride(ctx: Context, id: Int): String? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("look_$id", null)

    fun setLook(ctx: Context, id: Int, mode: String?) {
        val e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        if (mode == null) e.remove("look_$id") else e.putString("look_$id", mode)
        e.apply()
    }

    fun showOwed(ctx: Context, id: Int): Boolean =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("owed_$id", true)

    fun setShowOwed(ctx: Context, id: Int, show: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("owed_$id", show).apply()
    }

    fun forget(ctx: Context, id: Int) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("look_$id").remove("owed_$id").apply()
    }

    /** The one night test every widget uses: the per-widget override wins; otherwise the app's look decides. */
    fun night(ctx: Context, id: Int, snapshotLook: String, sysNight: Boolean): Boolean =
        when (lookOverride(ctx, id) ?: snapshotLook) {
            "night" -> true
            "day" -> false
            "auto" -> { val t = LocalTime.now(); t.isBefore(LocalTime.of(6, 30)) || !t.isBefore(LocalTime.of(18, 30)) }
            else -> sysNight
        }

    /* Ola 5 (BZ-34): el sello `at` del paquete — el día en que la página lo
     * fabricó, en la zona del aparato. Un saldo de un paquete viejo ya no se
     * pinta como si fuera de hoy: lleva su edad en la etiqueta. */
    fun packDay(data: JSONObject?): LocalDate? {
        val at = data?.optLong("at", 0L) ?: 0L
        if (at <= 0L) return null
        return Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate()
    }

    fun packStale(data: JSONObject?): Boolean {
        val day = packDay(data) ?: return false
        return day != LocalDate.now()
    }

    /** «Por cobrar» limpio si el paquete es de hoy; «Por cobrar · ayer» o con
     *  su fecha si es de otro día (en el idioma de la propia etiqueta). */
    fun owedLabel(data: JSONObject?, base: String): String {
        val day = packDay(data) ?: return base
        val today = LocalDate.now()
        if (day == today) return base
        val english = base.startsWith("To collect")
        return if (day == today.minusDays(1)) {
            base + if (english) " · yesterday" else " · ayer"
        } else {
            val fmt = DateTimeFormatter.ofPattern(if (english) "MMM d" else "d MMM", if (english) Locale.ENGLISH else Locale("es"))
            base + " · " + day.format(fmt)
        }
    }
}
