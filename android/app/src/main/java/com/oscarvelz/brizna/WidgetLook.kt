package com.oscarvelz.brizna

import android.content.Context
import java.time.LocalTime

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
}
