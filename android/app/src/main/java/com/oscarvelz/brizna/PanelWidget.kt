package com.oscarvelz.brizna

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime

/**
 * "Panel" home-screen widget for tablets (2026-11-07): the day with its client list on the left, the week and
 * Por cobrar on the right. It reads the SAME snapshot as the "Hoy" widget (BriznaNative.setWidget, kept in the
 * "brizna-widget" prefs; the page added the panel's fields in 1.5.09 — rows per day, top debtors, one alert
 * line) and is refreshed by the same machinery: HoyWidget.save fans out here, and Notify's midnight tick and the
 * boot/update receiver refresh both widgets, so the Panel turns the day at midnight on its own like "Hoy".
 * Taps open Brizna: the day goes to Hoy, the week to Agenda, Por cobrar to Cobros.
 */
class PanelWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) mgr.updateAppWidget(id, render(ctx))
        Notify.armWidgetTick(ctx)
    }

    override fun onEnabled(ctx: Context) { Notify.armWidgetTick(ctx) }

    companion object {
        private const val PREFS = "brizna-widget"

        fun refresh(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PanelWidget::class.java))
            if (ids.isEmpty()) return
            val v = render(ctx)
            for (id in ids) mgr.updateAppWidget(id, v)
        }

        fun hasWidgets(ctx: Context): Boolean =
            AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, PanelWidget::class.java)).isNotEmpty()

        private fun isNight(look: String, sysNight: Boolean): Boolean = when (look) {
            "night" -> true
            "day" -> false
            "auto" -> { val t = LocalTime.now(); t.isBefore(LocalTime.of(6, 30)) || !t.isBefore(LocalTime.of(18, 30)) }
            else -> sysNight
        }

        private val ROWS = arrayOf(
            intArrayOf(R.id.pr0, R.id.pr0n, R.id.pr0t), intArrayOf(R.id.pr1, R.id.pr1n, R.id.pr1t),
            intArrayOf(R.id.pr2, R.id.pr2n, R.id.pr2t), intArrayOf(R.id.pr3, R.id.pr3n, R.id.pr3t),
            intArrayOf(R.id.pr4, R.id.pr4n, R.id.pr4t), intArrayOf(R.id.pr5, R.id.pr5n, R.id.pr5t),
        )
        private val CELLS = arrayOf(
            intArrayOf(R.id.c0, R.id.c0dow, R.id.c0dom, R.id.c0cnt), intArrayOf(R.id.c1, R.id.c1dow, R.id.c1dom, R.id.c1cnt),
            intArrayOf(R.id.c2, R.id.c2dow, R.id.c2dom, R.id.c2cnt), intArrayOf(R.id.c3, R.id.c3dow, R.id.c3dom, R.id.c3cnt),
            intArrayOf(R.id.c4, R.id.c4dow, R.id.c4dom, R.id.c4cnt), intArrayOf(R.id.c5, R.id.c5dow, R.id.c5dom, R.id.c5cnt),
            intArrayOf(R.id.c6, R.id.c6dow, R.id.c6dom, R.id.c6cnt),
        )
        private val DEBTS = arrayOf(
            intArrayOf(R.id.pd0, R.id.pd0n, R.id.pd0a), intArrayOf(R.id.pd1, R.id.pd1n, R.id.pd1a),
            intArrayOf(R.id.pd2, R.id.pd2n, R.id.pd2a),
        )

        private fun open(ctx: Context, route: String, code: Int): PendingIntent {
            val i = Intent(ctx, MainActivity::class.java).setAction("brizna.OPEN").putExtra("route", route)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        fun render(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_panel)
            val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null)
            val data = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
            val sysNight = (ctx.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES
            val night = isNight(data?.optString("look") ?: "", sysNight)
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            val warn = if (night) Color.parseColor("#F2A65E") else Color.parseColor("#A34A28")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            for (id in intArrayOf(R.id.vline, R.id.hline, R.id.hline2)) v.setInt(id, "setBackgroundColor", hair)
            v.setTextColor(R.id.title, accent)
            v.setTextColor(R.id.owed, accent)
            for (id in intArrayOf(R.id.count, R.id.wk_k)) v.setTextColor(id, fg)
            for (id in intArrayOf(R.id.date, R.id.countLabel, R.id.pmore, R.id.owedLabel)) v.setTextColor(id, muted)
            v.setTextColor(R.id.alert, warn)

            val today = LocalDate.now().toString()
            val days = data?.optJSONArray("days")
            var todayIdx = -1
            var day: JSONObject? = null
            if (days != null) for (i in 0 until days.length()) {
                val d = days.optJSONObject(i) ?: continue
                if (d.optString("date") == today) { todayIdx = i; day = d; break }
            }
            v.setTextViewText(R.id.title, data?.optString("title")?.ifBlank { null } ?: "Hoy")
            v.setTextViewText(R.id.wk_k, data?.optString("weekLabel")?.ifBlank { null } ?: "Semana")
            v.setTextViewText(R.id.owedLabel, data?.optString("owedLabel")?.ifBlank { null } ?: "Por cobrar")
            v.setTextViewText(R.id.owed, data?.optString("owed")?.ifBlank { null } ?: "$0")
            v.setTextViewText(R.id.alert, data?.optString("alertLine") ?: "")
            v.setViewVisibility(R.id.alert, if (data?.optString("alertLine").isNullOrBlank()) View.GONE else View.VISIBLE)

            // Por cobrar: the top debtors the page sent (nothing when nobody owes).
            val debtors = data?.optJSONArray("debtors")
            for (i in DEBTS.indices) {
                val d = debtors?.optJSONObject(i)
                v.setViewVisibility(DEBTS[i][0], if (d == null) View.GONE else View.VISIBLE)
                if (d != null) {
                    v.setTextViewText(DEBTS[i][1], d.optString("name"))
                    v.setTextViewText(DEBTS[i][2], d.optString("amt"))
                    v.setTextColor(DEBTS[i][1], fg)
                    v.setTextColor(DEBTS[i][2], fg)
                }
            }

            // The week strip: today first, then the next six days the page sent.
            for (i in CELLS.indices) {
                val d = if (days != null && todayIdx >= 0) days.optJSONObject(todayIdx + i) else null
                if (d == null) {
                    v.setTextViewText(CELLS[i][1], "")
                    v.setTextViewText(CELLS[i][2], "")
                    v.setTextViewText(CELLS[i][3], "")
                    continue
                }
                v.setTextViewText(CELLS[i][1], d.optString("dow"))
                v.setTextViewText(CELLS[i][2], d.optString("dom"))
                val n = d.optInt("count")
                v.setTextViewText(CELLS[i][3], if (n > 0) n.toString() else "—")
                v.setTextColor(CELLS[i][1], muted)
                v.setTextColor(CELLS[i][2], if (i == 0) accent else fg)
                v.setTextColor(CELLS[i][3], if (i == 0) accent else muted)
                if (i == 0) v.setInt(CELLS[i][0], "setBackgroundResource", if (night) R.drawable.widget_cell_night else R.drawable.widget_cell_day)
            }

            // Hoy: the count and the day's client list (or the open-the-app line, like the "Hoy" widget).
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

            v.setOnClickPendingIntent(R.id.root, open(ctx, "/", 901))
            v.setOnClickPendingIntent(R.id.hoy_zone, open(ctx, "/", 901))
            v.setOnClickPendingIntent(R.id.week_zone, open(ctx, "/agenda", 902))
            v.setOnClickPendingIntent(R.id.owed_zone, open(ctx, "/cobros", 903))
            return v
        }
    }
}
