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

/**
 * "Semana" home-screen widget (android-6): the next seven days at a glance — today first and highlighted, each
 * day with its cut count — and today's next client underneath. It reads the same snapshot as "Hoy" and "Panel"
 * (the page's 8 pre-rendered days) and is refreshed by the same machinery: HoyWidget.save fans out here, and
 * Notify's midnight tick and the boot/update receiver refresh it too, so the strip turns the day on its own.
 * Taps: the strip opens Agenda, the rest opens Hoy.
 */
class SemanaWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) mgr.updateAppWidget(id, render(ctx, id))
        Notify.armWidgetTick(ctx)
    }

    override fun onEnabled(ctx: Context) { Notify.armWidgetTick(ctx) }

    override fun onDeleted(ctx: Context, ids: IntArray) { for (id in ids) WidgetLook.forget(ctx, id) }

    companion object {
        private const val PREFS = "brizna-widget"

        fun refresh(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, SemanaWidget::class.java))
            for (id in ids) mgr.updateAppWidget(id, render(ctx, id))
        }

        fun hasWidgets(ctx: Context): Boolean =
            AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, SemanaWidget::class.java)).isNotEmpty()

        private val CELLS = arrayOf(
            intArrayOf(R.id.w0, R.id.w0dow, R.id.w0dom, R.id.w0cnt), intArrayOf(R.id.w1, R.id.w1dow, R.id.w1dom, R.id.w1cnt),
            intArrayOf(R.id.w2, R.id.w2dow, R.id.w2dom, R.id.w2cnt), intArrayOf(R.id.w3, R.id.w3dow, R.id.w3dom, R.id.w3cnt),
            intArrayOf(R.id.w4, R.id.w4dow, R.id.w4dom, R.id.w4cnt), intArrayOf(R.id.w5, R.id.w5dow, R.id.w5dom, R.id.w5cnt),
            intArrayOf(R.id.w6, R.id.w6dow, R.id.w6dom, R.id.w6cnt),
        )

        private fun open(ctx: Context, route: String, code: Int): PendingIntent {
            val i = Intent(ctx, MainActivity::class.java).setAction("brizna.OPEN").putExtra("route", route)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        fun render(ctx: Context, id: Int): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_semana)
            val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null)
            val data = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
            val sysNight = (ctx.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES
            val night = WidgetLook.night(ctx, id, data?.optString("look") ?: "", sysNight)
            val fg = if (night) Color.parseColor("#F5F5F5") else Color.parseColor("#1A261C")
            val muted = if (night) Color.parseColor("#B4B4B9") else Color.parseColor("#536056")
            val accent = if (night) Color.parseColor("#4ADE80") else Color.parseColor("#1F6A3A")
            val hair = if (night) Color.parseColor("#232325") else Color.parseColor("#E2DCCB")
            v.setInt(R.id.root, "setBackgroundResource", if (night) R.drawable.widget_bg_night else R.drawable.widget_bg_day)
            v.setInt(R.id.hline, "setBackgroundColor", hair)
            v.setTextColor(R.id.stitle, accent)
            v.setTextColor(R.id.sdate, muted)
            v.setTextColor(R.id.snextLabel, muted)
            v.setTextColor(R.id.snext1, fg)
            v.setTextViewText(R.id.stitle, data?.optString("weekLabel")?.ifBlank { null } ?: "Semana")

            val today = LocalDate.now().toString()
            val days = data?.optJSONArray("days")
            var todayIdx = -1
            var day: JSONObject? = null
            if (days != null) for (i in 0 until days.length()) {
                val d = days.optJSONObject(i) ?: continue
                if (d.optString("date") == today) { todayIdx = i; day = d; break }
            }
            v.setTextViewText(R.id.sdate, day?.optString("label") ?: "")
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
            if (day == null) {
                v.setTextViewText(R.id.snextLabel, "")
                v.setTextViewText(R.id.snext1, if (data == null) "Abre Brizna para ver la semana" else "Abre Brizna para ver hoy")
            } else {
                v.setTextViewText(R.id.snextLabel, day.optString("nextLabel"))
                v.setTextViewText(R.id.snext1, day.optString("next1"))
            }
            v.setOnClickPendingIntent(R.id.root, open(ctx, "/", 905))
            v.setOnClickPendingIntent(R.id.strip, open(ctx, "/agenda", 906))
            return v
        }
    }
}
