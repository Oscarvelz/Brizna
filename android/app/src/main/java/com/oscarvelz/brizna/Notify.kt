package com.oscarvelz.brizna

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Local reminders with no server. The page works out the schedule from its own data (tomorrow's cuts, pay days,
 * late / Alto riesgo, cuts moved by rain) and hands the whole list over with BriznaNative.setSchedule() each time
 * something changes and on every open. The list is kept here, so alarms come back after a reboot or an update.
 * Only the next reminder is armed at any time; when it fires, it shows every reminder that is due and arms the next.
 */
object Notify {
    private const val PREFS = "brizna-notify"
    const val ACTION_FIRE = "com.oscarvelz.brizna.NOTIFY"
    const val ACTION_WIDGET = "com.oscarvelz.brizna.WIDGET_TICK"
    const val ACTION_TEST = "com.oscarvelz.brizna.TEST"
    private const val LATE_LIMIT = 6 * 60 * 60 * 1000L // a reminder missed while the phone was off still shows within 6 h

    data class Item(val id: String, val at: Long, val kind: String, val title: String, val body: String, val route: String)

    private val CHANNELS = listOf(
        Triple("cortes", "Cortes de mañana", "El aviso de la noche con los patios del día siguiente."),
        Triple("pagos", "Días de pago", "Clientes que pagan ese día del mes."),
        Triple("riesgo", "Atrasados y Alto riesgo", "Cortes atrasados y clientes en Alto riesgo."),
        Triple("lluvia", "Parada por lluvia", "Los patios que pasaron a otro día por la lluvia."),
        Triple("prueba", "Prueba", "El aviso de prueba de Ajustes."),
    )

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        for ((id, name, desc) in CHANNELS) {
            val imp = if (id == "prueba") NotificationManager.IMPORTANCE_DEFAULT else NotificationManager.IMPORTANCE_HIGH
            nm.createNotificationChannel(NotificationChannel(id, name, imp).apply { description = desc; enableLights(true); lightColor = Color.parseColor("#4ADE80") })
        }
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun read(ctx: Context): List<Item> {
        val raw = prefs(ctx).getString("items", null) ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            (0 until a.length()).mapNotNull { i ->
                val o = a.optJSONObject(i) ?: return@mapNotNull null
                Item(o.optString("id"), o.optLong("at"), o.optString("kind"), o.optString("title"), o.optString("body"), o.optString("route", "/"))
            }.filter { it.id.isNotBlank() && it.at > 0 }
        }.getOrDefault(emptyList())
    }

    private fun fired(ctx: Context): MutableSet<String> = (prefs(ctx).getStringSet("fired", emptySet()) ?: emptySet()).toMutableSet()

    /** Replaces the whole list (from the page). Already shown reminders keep their mark, so nothing repeats. */
    fun store(ctx: Context, json: String): Int {
        val a = runCatching { JSONArray(json) }.getOrNull() ?: return -1
        val clean = JSONArray()
        val ids = HashSet<String>()
        for (i in 0 until minOf(a.length(), 200)) {
            val o = a.optJSONObject(i) ?: continue
            val id = o.optString("id"); val at = o.optLong("at")
            if (id.isBlank() || at <= 0) continue
            ids.add(id)
            clean.put(JSONObject().put("id", id).put("at", at).put("kind", o.optString("kind"))
                .put("title", o.optString("title").take(120)).put("body", o.optString("body").take(600)).put("route", o.optString("route", "/")))
        }
        val keep = fired(ctx).filter { it in ids }.toSet()
        prefs(ctx).edit().putString("items", clean.toString()).putStringSet("fired", keep).putLong("storedAt", System.currentTimeMillis()).apply()
        arm(ctx)
        return clean.length()
    }

    fun nextAt(ctx: Context): Long {
        val done = fired(ctx)
        val now = System.currentTimeMillis()
        return read(ctx).filter { it.id !in done && it.at > now - LATE_LIMIT }.minOfOrNull { it.at } ?: 0L
    }

    fun canExact(ctx: Context): Boolean {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
    }

    private fun firePending(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(ctx, 100, Intent(ctx, AlarmReceiver::class.java).setAction(ACTION_FIRE),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /** Arms the one alarm for the next reminder (or clears it when nothing is left). */
    fun arm(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = firePending(ctx)
        val next = nextAt(ctx)
        if (next <= 0) { am.cancel(pi); return }
        val at = maxOf(next, System.currentTimeMillis() + 3000)
        try {
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    /** Shows every reminder that is due now, then arms the next one. */
    fun fireDue(ctx: Context) {
        val now = System.currentTimeMillis()
        val done = fired(ctx)
        val due = read(ctx).filter { it.id !in done && it.at <= now + 60_000 && it.at > now - LATE_LIMIT }
        for (it in due) { show(ctx, it); done.add(it.id) }
        prefs(ctx).edit().putStringSet("fired", done).apply()
        arm(ctx)
    }

    fun show(ctx: Context, it: Item) {
        channels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (!nm.areNotificationsEnabled()) return
        val open = Intent(ctx, MainActivity::class.java).setAction("brizna.OPEN").putExtra("route", it.route.ifBlank { "/" })
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, it.id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val channel = if (CHANNELS.any { c -> c.first == it.kind }) it.kind else "cortes"
        val n = Notification.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(Color.parseColor("#1F6A3A"))
            .setContentTitle(it.title)
            .setContentText(it.body)
            .setStyle(Notification.BigTextStyle().bigText(it.body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setWhen(minOf(it.at, System.currentTimeMillis()))
            .setCategory(Notification.CATEGORY_REMINDER)
            .build()
        nm.notify(it.id.hashCode(), n)
    }

    /** A one-off test reminder through the same alarm path (Ajustes, Notificaciones, Probar). */
    fun test(ctx: Context, delayMs: Long, title: String, body: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val i = Intent(ctx, AlarmReceiver::class.java).setAction(ACTION_TEST).putExtra("title", title).putExtra("body", body)
        val pi = PendingIntent.getBroadcast(ctx, 101, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val at = System.currentTimeMillis() + delayMs.coerceIn(1000, 120_000)
        try {
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (_: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
    }

    /** The widget turns to the next day at midnight and follows the day/night look at 6:30 and 18:30. */
    fun armWidgetTick(ctx: Context) {
        if (!HoyWidget.hasWidgets(ctx) && !PanelWidget.hasWidgets(ctx) && !SemanaWidget.hasWidgets(ctx)) return
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(ctx, 200, Intent(ctx, AlarmReceiver::class.java).setAction(ACTION_WIDGET),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val now = Calendar.getInstance()
        val marks = listOf(0 to 1, 6 to 31, 18 to 31).map { (h, m) ->
            Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                if (!after(now)) add(Calendar.DAY_OF_MONTH, 1) }.timeInMillis
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC, marks.min(), pi)
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            Notify.ACTION_FIRE -> Notify.fireDue(ctx)
            Notify.ACTION_TEST -> Notify.show(ctx, Notify.Item("prueba-" + System.currentTimeMillis(), System.currentTimeMillis(), "prueba",
                intent.getStringExtra("title") ?: "Brizna", intent.getStringExtra("body") ?: "", "/ajustes"))
            Notify.ACTION_WIDGET -> { HoyWidget.refresh(ctx); PanelWidget.refresh(ctx); SemanaWidget.refresh(ctx); Notify.armWidgetTick(ctx) }
            else -> { // boot, app update, clock or time zone change, exact-alarm permission change
                Notify.channels(ctx)
                Notify.fireDue(ctx)
                HoyWidget.refresh(ctx)
                PanelWidget.refresh(ctx)
                SemanaWidget.refresh(ctx)
                Notify.armWidgetTick(ctx)
            }
        }
    }
}
