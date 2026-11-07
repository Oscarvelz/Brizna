package com.oscarvelz.brizna

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate

/**
 * "Hoy" home-screen widget: today's cuts, the next client(s) and the Por cobrar total.
 * The page pushes its numbers through BriznaNative.setWidget (one entry per day for the next week, so the widget
 * turns the page at midnight on its own); tapping opens Brizna on Hoy, tapping Por cobrar opens Cobros.
 * Three sizes (android-6): the classic 4x2; a 4x3 middle size with the day's first three clients, their times
 * and the alert line (added at Oscar's word — the richness should not live only in the tallest size); and,
 * grown tall, the day with its full client list. Each placed widget follows its own options (WidgetLook:
 * appearance override, Por cobrar on/off).
 */
class HoyWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) mgr.updateAppWidget(id, views(ctx, mgr, id))
        Notify.armWidgetTick(ctx)
    }

    override fun onEnabled(ctx: Context) { Notify.armWidgetTick(ctx) }

    override fun onDeleted(ctx: Context, ids: IntArray) { for (id in ids) WidgetLook.forget(ctx, id) }

    companion object {
        private const val PREFS = "brizna-widget"

        fun save(ctx: Context, json: String) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply()
            refresh(ctx)
            PanelWidget.refresh(ctx)
            SemanaWidget.refresh(ctx)
        }

        fun refresh(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, HoyWidget::class.java))
            for (id in ids) mgr.updateAppWidget(id, views(ctx, mgr, id))
        }

        fun hasWidgets(ctx: Context): Boolean =
            AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, HoyWidget::class.java)).isNotEmpty()

        private fun loadData(ctx: Context): JSONObject? {
            val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null)
            return raw?.let { runCatching { JSONObject(it) }.getOrNull() }
        }

        private fun sysNight(ctx: Context): Boolean =
            (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

        private fun open(ctx: Context, route: String, code: Int): PendingIntent {
            val i = Intent(ctx, MainActivity::class.java).setAction("brizna.OPEN").putExtra("route", route)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        fun views(ctx: Context, mgr: AppWidgetManager, id: Int): RemoteViews {
            val data = loadData(ctx)
            if (Build.VERSION.SDK_INT >= 31) {
                return RemoteViews(mapOf(
                    SizeF(250f, 110f) to renderStd(ctx, id, data),
                    SizeF(250f, 175f) to renderMid(ctx, id, data),
                    SizeF(250f, 235f) to renderBig(ctx, id, data),
                ))
            }
            val o = mgr.getAppWidgetOptions(id)
            val land = ctx.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
            val h = o.getInt(if (land) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
            return if (h >= 200) renderBig(ctx, id, data) else if (h >= 145) renderMid(ctx, id, data) else renderStd(ctx, id, data)
        }

        private fun todayEntry(data: JSONObject?): JSONObject? {
            val days = data?.optJSONArray("days") ?: return null
            val today = LocalDate.now().toString()
            for (i in 0 until days.length()) {
                val d = days.optJSONObject(i) ?: continue
                if (d.optString("date") == today) return d
            }
            return null
        }

        fun renderStd(ctx: Context, id: Int, data: JSONObject?): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_hoy)
            val night = WidgetLook.night(ctx, id, data?.optString("look") ?: "", sysNight(ctx))
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            v.setInt(R.id.vline, "setBackgroundColor", hair)
            v.setInt(R.id.hline, "setBackgroundColor", hair)
            v.setTextColor(R.id.title, accent)
            v.setTextColor(R.id.owed, accent)
            for (x in intArrayOf(R.id.count, R.id.next1)) v.setTextColor(x, fg)
            for (x in intArrayOf(R.id.date, R.id.countLabel, R.id.nextLabel, R.id.next2, R.id.owedLabel)) v.setTextColor(x, muted)

            val day = todayEntry(data)
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
            val owedVis = if (WidgetLook.showOwed(ctx, id)) View.VISIBLE else View.GONE
            v.setViewVisibility(R.id.owed_box, owedVis)
            v.setViewVisibility(R.id.hline, owedVis)
            v.setOnClickPendingIntent(R.id.root, open(ctx, "/", 900))
            v.setOnClickPendingIntent(R.id.owed_box, open(ctx, "/cobros", 904))
            return v
        }

        private val ROWS = arrayOf(
            intArrayOf(R.id.pr0, R.id.pr0n, R.id.pr0t), intArrayOf(R.id.pr1, R.id.pr1n, R.id.pr1t),
            intArrayOf(R.id.pr2, R.id.pr2n, R.id.pr2t), intArrayOf(R.id.pr3, R.id.pr3n, R.id.pr3t),
            intArrayOf(R.id.pr4, R.id.pr4n, R.id.pr4t), intArrayOf(R.id.pr5, R.id.pr5n, R.id.pr5t),
        )

        /** The 4x4 "Hoy": the count, the day's client list and Por cobrar (the Panel's left column, on the phone). */
        fun renderBig(ctx: Context, id: Int, data: JSONObject?): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_hoy_big)
            val night = WidgetLook.night(ctx, id, data?.optString("look") ?: "", sysNight(ctx))
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            for (x in intArrayOf(R.id.hline, R.id.hline2)) v.setInt(x, "setBackgroundColor", hair)
            v.setTextColor(R.id.title, accent)
            v.setTextColor(R.id.owed, accent)
            v.setTextColor(R.id.count, fg)
            for (x in intArrayOf(R.id.date, R.id.countLabel, R.id.pmore, R.id.owedLabel)) v.setTextColor(x, muted)
            v.setTextViewText(R.id.title, data?.optString("title")?.ifBlank { null } ?: "Hoy")
            v.setTextViewText(R.id.owedLabel, data?.optString("owedLabel")?.ifBlank { null } ?: "Por cobrar")
            v.setTextViewText(R.id.owed, data?.optString("owed")?.ifBlank { null } ?: "$0")

            val day = todayEntry(data)
            if (day == null) {
                v.setTextViewText(R.id.date, "")
                v.setTextViewText(R.id.count, "0")
                v.setTextViewText(R.id.countLabel, "cortes hoy")
                v.setTextViewText(ROWS[0][1], if (data == null) "Abre Brizna para ver el día" else "Abre Brizna para ver hoy")
                v.setTextColor(ROWS[0][1], fg)
                v.setTextViewText(ROWS[0][2], "")
                for (i in 1 until ROWS.size) v.setViewVisibility(ROWS[i][0], View.GONE)
                v.setViewVisibility(R.id.pmore, View.GONE)
            } else {
                v.setTextViewText(R.id.date, day.optString("label"))
                v.setTextViewText(R.id.count, day.optInt("count").toString())
                v.setTextViewText(R.id.countLabel, day.optString("countLabel"))
                val rows = day.optJSONArray("rows")
                for (i in ROWS.indices) {
                    val r = rows?.optJSONObject(i)
                    v.setViewVisibility(ROWS[i][0], if (r == null) View.GONE else View.VISIBLE)
                    if (r != null) {
                        v.setTextViewText(ROWS[i][1], r.optString("n"))
                        v.setTextViewText(ROWS[i][2], r.optString("t"))
                        v.setTextColor(ROWS[i][1], fg)
                        v.setTextColor(ROWS[i][2], muted)
                    }
                }
                val more = day.optString("more")
                v.setViewVisibility(R.id.pmore, if (more.isBlank()) View.GONE else View.VISIBLE)
                if (more.isNotBlank()) v.setTextViewText(R.id.pmore, more)
            }
            val owedVis = if (WidgetLook.showOwed(ctx, id)) View.VISIBLE else View.GONE
            v.setViewVisibility(R.id.owed_box, owedVis)
            v.setViewVisibility(R.id.hline2, owedVis)
            v.setOnClickPendingIntent(R.id.root, open(ctx, "/", 900))
            v.setOnClickPendingIntent(R.id.owed_box, open(ctx, "/cobros", 904))
            return v
        }

        /** The 4x3 "Hoy": the count, the day's first three clients with their times, the alert line when
         *  there is one, and Por cobrar. Same fields as the 4x4, fewer rows; no "more" line — the count
         *  already states the day's total and the page's "more" is counted from six rows. */
        fun renderMid(ctx: Context, id: Int, data: JSONObject?): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_hoy_mid)
            val night = WidgetLook.night(ctx, id, data?.optString("look") ?: "", sysNight(ctx))
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            val warn = if (night) Color.parseColor("#F2A65E") else Color.parseColor("#A34A28")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            for (x in intArrayOf(R.id.hline, R.id.hline2)) v.setInt(x, "setBackgroundColor", hair)
            v.setTextColor(R.id.title, accent)
            v.setTextColor(R.id.owed, accent)
            v.setTextColor(R.id.count, fg)
            v.setTextColor(R.id.alert, warn)
            for (x in intArrayOf(R.id.date, R.id.countLabel, R.id.owedLabel)) v.setTextColor(x, muted)
            v.setTextViewText(R.id.title, data?.optString("title")?.ifBlank { null } ?: "Hoy")
            v.setTextViewText(R.id.owedLabel, data?.optString("owedLabel")?.ifBlank { null } ?: "Por cobrar")
            v.setTextViewText(R.id.owed, data?.optString("owed")?.ifBlank { null } ?: "$0")
            val alert = data?.optString("alertLine") ?: ""
            v.setTextViewText(R.id.alert, alert)
            v.setViewVisibility(R.id.alert, if (alert.isBlank()) View.GONE else View.VISIBLE)

            val day = todayEntry(data)
            if (day == null) {
                v.setTextViewText(R.id.date, "")
                v.setTextViewText(R.id.count, "0")
                v.setTextViewText(R.id.countLabel, "cortes hoy")
                v.setTextViewText(ROWS[0][1], if (data == null) "Abre Brizna para ver el día" else "Abre Brizna para ver hoy")
                v.setTextColor(ROWS[0][1], fg)
                v.setTextViewText(ROWS[0][2], "")
                for (i in 1 until 3) v.setViewVisibility(ROWS[i][0], View.GONE)
            } else {
                v.setTextViewText(R.id.date, day.optString("label"))
                v.setTextViewText(R.id.count, day.optInt("count").toString())
                v.setTextViewText(R.id.countLabel, day.optString("countLabel"))
                val rows = day.optJSONArray("rows")
                for (i in 0 until 3) {
                    val r = rows?.optJSONObject(i)
                    v.setViewVisibility(ROWS[i][0], if (r == null) View.GONE else View.VISIBLE)
                    if (r != null) {
                        v.setTextViewText(ROWS[i][1], r.optString("n"))
                        v.setTextViewText(ROWS[i][2], r.optString("t"))
                        v.setTextColor(ROWS[i][1], fg)
                        v.setTextColor(ROWS[i][2], muted)
                    }
                }
            }
            val owedVis = if (WidgetLook.showOwed(ctx, id)) View.VISIBLE else View.GONE
            v.setViewVisibility(R.id.owed_box, owedVis)
            v.setViewVisibility(R.id.hline2, owedVis)
            v.setOnClickPendingIntent(R.id.root, open(ctx, "/", 900))
            v.setOnClickPendingIntent(R.id.owed_box, open(ctx, "/cobros", 904))
            return v
        }
    }
}
