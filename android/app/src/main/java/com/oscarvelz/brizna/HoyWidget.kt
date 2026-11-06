package com.oscarvelz.brizna

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime

/**
 * "Hoy" home-screen widget: today's cuts, the next client(s) and the Por cobrar total.
 * The page pushes its numbers through BriznaNative.setWidget (one entry per day for the next week, so the widget
 * turns the page at midnight on its own); tapping opens Brizna on Hoy.
 */
class HoyWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) mgr.updateAppWidget(id, render(ctx))
        Notify.armWidgetTick(ctx)
    }

    override fun onEnabled(ctx: Context) { Notify.armWidgetTick(ctx) }

    companion object {
        private const val PREFS = "brizna-widget"

        fun save(ctx: Context, json: String) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply()
            refresh(ctx)
        }

        fun refresh(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, HoyWidget::class.java))
            if (ids.isEmpty()) return
            val v = render(ctx)
            for (id in ids) mgr.updateAppWidget(id, v)
        }

        fun hasWidgets(ctx: Context): Boolean =
            AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, HoyWidget::class.java)).isNotEmpty()

        private fun isNight(look: String, sysNight: Boolean): Boolean = when (look) {
            "night" -> true
            "day" -> false
            "auto" -> { val t = LocalTime.now(); t.isBefore(LocalTime.of(6, 30)) || !t.isBefore(LocalTime.of(18, 30)) }
            else -> sysNight
        }

        fun render(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_hoy)
            val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null)
            val data = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
            val sysNight = (ctx.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES
            val night = isNight(data?.optString("look") ?: "", sysNight)
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            v.setInt(R.id.vline, "setBackgroundColor", hair)
            v.setInt(R.id.hline, "setBackgroundColor", hair)
            v.setTextColor(R.id.title, accent)
            v.setTextColor(R.id.owed, accent)
            for (id in intArrayOf(R.id.count, R.id.next1)) v.setTextColor(id, fg)
            for (id in intArrayOf(R.id.date, R.id.countLabel, R.id.nextLabel, R.id.next2, R.id.owedLabel)) v.setTextColor(id, muted)

            val today = LocalDate.now().toString()
            val days = data?.optJSONArray("days")
            var day: JSONObject? = null
            if (days != null) for (i in 0 until days.length()) {
                val d = days.optJSONObject(i) ?: continue
                if (d.optString("date") == today) { day = d; break }
            }
            v.setTextViewText(R.id.title, data?.optString("title")?.ifBlank { null } ?: "Hoy")
            v.setTextViewText(R.id.owedLabel, data?.optString("owedLabel")?.ifBlank { null } ?: "Por cobrar")
            v.setTextViewText(R.id.owed, data?.optString("owed")?.ifBlank { null } ?: "$0")
            if (day == null) {
                v.setTextViewText(R.id.date, "")
                v.setTextViewText(R.id.count, "0")
                v.setTextViewText(R.id.countLabel, "cortes hoy")
                v.setTextViewText(R.id.nextLabel, "")
                v.setTextViewText(R.id.next1, if (data == null) "Abre Brizna para ver el día" else "Abre Brizna para ver hoy")
                v.setTextViewText(R.id.next2, "")
            } else {
                v.setTextViewText(R.id.date, day.optString("label"))
                v.setTextViewText(R.id.count, day.optInt("count").toString())
                v.setTextViewText(R.id.countLabel, day.optString("countLabel"))
                v.setTextViewText(R.id.nextLabel, day.optString("nextLabel"))
                v.setTextViewText(R.id.next1, day.optString("next1"))
                v.setTextViewText(R.id.next2, day.optString("next2"))
            }
            val open = Intent(ctx, MainActivity::class.java).setAction("brizna.OPEN").putExtra("route", "/")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(ctx, 900, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            return v
        }
    }
}
