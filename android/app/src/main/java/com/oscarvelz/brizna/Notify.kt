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
    // android-17 (Prejuicio R5, R6E-1): el libro de avisos (items/fired)
    // se lee-modifica-escribe desde DOS hilos — store() llega por el
    // hilo JavaBridge de la WebView y fireDue()/retime() por el hilo
    // principal del receptor — y sin candado el escritor tardío
    // resucitaba marcas viejas o revertía la agenda nueva. Los tres
    // ciclos enteros se serializan en este candado (synchronized es
    // reentrante: arm() llamado desde dentro no se bloquea).
    private val LOCK = Any()
    private const val PREFS = "brizna-notify"
    const val ACTION_FIRE = "com.oscarvelz.brizna.NOTIFY"
    const val ACTION_WIDGET = "com.oscarvelz.brizna.WIDGET_TICK"
    const val ACTION_TEST = "com.oscarvelz.brizna.TEST"
    private const val LATE_LIMIT = 6 * 60 * 60 * 1000L // a reminder missed while the phone was off still shows within 6 h
    private const val BLOCKED_RETRY_MS = 30 * 60 * 1000L // android-13 (R2E-1): respiro cuando un aviso no pudo mostrarse

    /* Ola 5: `wall` es la hora de pared elegida ("2026-11-17 19:00") — ante un
     * cambio de zona, el instante se recalcula desde ella (BZ-45); `hash` es la
     * huella del contenido que manda la página — si cambia con el mismo id, la
     * marca «ya sonó» de ese id se limpia (BZ-46). */
    data class Item(val id: String, val at: Long, val kind: String, val title: String, val body: String, val route: String, val wall: String = "", val hash: String = "")

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
                Item(o.optString("id"), o.optLong("at"), o.optString("kind"), o.optString("title"), o.optString("body"), o.optString("route", "/"), o.optString("wall"), o.optString("hash"))
            }.filter { it.id.isNotBlank() && it.at > 0 }
        }.getOrDefault(emptyList())
    }

    private fun fired(ctx: Context): MutableSet<String> = (prefs(ctx).getStringSet("fired", emptySet()) ?: emptySet()).toMutableSet()

    /** Replaces the whole list (from the page). Already shown reminders keep their mark, so nothing repeats —
     *  except one whose CONTENT changed under the same id (Ola 5, BZ-46): its mark is cleared, because the
     *  reminder that rang is not the reminder now stored (a yard added to tomorrow at 19:30 must be able
     *  to ring in the corrected notice). */
    fun store(ctx: Context, json: String): Int {
        synchronized(LOCK) {
        val a = runCatching { JSONArray(json) }.getOrNull() ?: return -1
        val oldHash = read(ctx).associate { it.id to it.hash }
        val clean = JSONArray()
        val ids = HashSet<String>()
        for (i in 0 until minOf(a.length(), 200)) {
            val o = a.optJSONObject(i) ?: continue
            val id = o.optString("id"); val at = o.optLong("at")
            if (id.isBlank() || at <= 0) continue
            ids.add(id)
            clean.put(JSONObject().put("id", id).put("at", at).put("kind", o.optString("kind"))
                .put("title", o.optString("title").take(120)).put("body", o.optString("body").take(600)).put("route", o.optString("route", "/"))
                .put("wall", o.optString("wall")).put("hash", o.optString("hash")))
        }
        // android-14 (Prejuicio R3, R3E-2): la página solo manda su ventana
        // de 6 h, así que un store() al abrir la app borraba de la cáscara
        // los avisos perdidos que aún no se habían podido resumir — el
        // resumen quedaba abolido, no pospuesto. Los perdidos sin marcar y
        // de menos de un día se acarrean a la lista nueva: el resumen sigue
        // pudiendo decirse hasta que suene o cumpla el día.
        val nowS = System.currentTimeMillis()
        val firedNow = fired(ctx)
        for (o in read(ctx)) {
            if (o.id in ids || o.id in firedNow) continue
            if (o.at <= nowS - LATE_LIMIT && o.at > nowS - LATE_LIMIT - 24 * 60 * 60 * 1000L) {
                ids.add(o.id)
                clean.put(JSONObject().put("id", o.id).put("at", o.at).put("kind", o.kind)
                    .put("title", o.title).put("body", o.body).put("route", o.route)
                    .put("wall", o.wall).put("hash", o.hash))
            }
        }
        val keep = fired(ctx).filter { id -> id in ids && oldHash[id] == readHash(clean, id) }.toSet()
        prefs(ctx).edit().putString("items", clean.toString()).putStringSet("fired", keep).putLong("storedAt", System.currentTimeMillis()).apply()
        arm(ctx)
        return clean.length()
        }
    }

    private fun readHash(items: JSONArray, id: String): String {
        for (i in 0 until items.length()) {
            val o = items.optJSONObject(i) ?: continue
            if (o.optString("id") == id) return o.optString("hash")
        }
        return ""
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

    /** Arms the one alarm for the next reminder (or clears it when nothing is left).
     *  android-13 (Prejuicio R2, R2E-1): `floorMs` es el respiro mínimo antes
     *  de reintentar — cuando un aviso no pudo mostrarse (notificaciones
     *  apagadas), fireDue pide el respiro largo: con el piso de 3 s la cura
     *  de BZ-63 se volvía un bucle de alarmas de ~7 200 despertares en 6 h.
     *  android-15 (Prejuicio R3, R4E-1): arm() también conoce la DEUDA del
     *  resumen perdido — antes armaba solo desde nextAt(), que excluye lo
     *  perdido por construcción, y cualquier llamada (store al abrir,
     *  onCreate, el propio permiso concedido) cancelaba el reintento de
     *  fireDue o lo posponía más allá del retiro del resumen. La alarma es
     *  la más temprana de las dos candidatas: el próximo aviso y la deuda. */
    fun arm(ctx: Context, floorMs: Long = 3000) {
        val next = nextAt(ctx)
        val owed = summaryRetryAt(ctx)
        val target = listOf(next, owed).filter { it > 0 }.minOrNull() ?: 0L
        if (target <= 0) { armAt(ctx, 0); return }
        armAt(ctx, maxOf(target, System.currentTimeMillis() + floorMs))
    }

    /** El instante en que el resumen de avisos perdidos debe intentarse, o 0
     *  si no se debe ninguno. La deuda existe mientras un aviso perdido sin
     *  marcar siga dentro de su día de gracia (la ventana de acarreo de
     *  store). Con las notificaciones ENCENDIDAS la deuda vence ya — el
     *  resumen se intenta en cuanto algo arma (así, conceder el permiso lo
     *  entrega, no lo pospone); apagadas, manda el instante persistido por
     *  fireDue (la cadencia de 30 min de R2E-1), y si no hay ninguno — la
     *  deuda nació en silencio, con el teléfono apagado — también vence ya. */
    private fun summaryRetryAt(ctx: Context): Long {
        val now = System.currentTimeMillis()
        val done = fired(ctx)
        val owed = read(ctx).any { it.id !in done && it.at <= now - LATE_LIMIT && it.at > now - LATE_LIMIT - 24 * 60 * 60 * 1000L }
        if (!owed) {
            if (prefs(ctx).contains("retryAt")) prefs(ctx).edit().remove("retryAt").apply()
            return 0L
        }
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm != null && nm.areNotificationsEnabled()) return now
        val at = prefs(ctx).getLong("retryAt", 0L)
        return if (at > now) at else now
    }

    /** Arms the one alarm for an explicit instant (or clears it when atMs <= 0).
     *  android-14 (Prejuicio R3, R3E-1/R3E-2): fireDue termina armando por
     *  poblaciones separadas — el próximo aviso futuro conserva SU hora (el
     *  respiro de un aviso bloqueado ya no se le cobra a él a través de la
     *  única alarma compartida) y el reintento de lo bloqueado entra como
     *  candidato propio, así el conjunto perdido — que nextAt excluye por
     *  construcción — sí recibe su reintento en vez de ver la alarma
     *  cancelada. */
    private fun armAt(ctx: Context, atMs: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = firePending(ctx)
        if (atMs <= 0) { am.cancel(pi); return }
        val at = maxOf(atMs, System.currentTimeMillis() + 3000)
        try {
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    /** Shows every reminder that is due now, then arms the next one.
     *  Ola 5 (BZ-63): a reminder is marked as shown ONLY when show() actually
     *  published it — before, a reminder due while notifications were off was
     *  marked as seen without ever existing, and never came back.
     *  Ola 5 (BZ-22): reminders that expired beyond the tolerance while the
     *  phone was off are no longer dropped in silence: they collapse into ONE
     *  summary notification («Mientras el teléfono estaba apagado: …»). */
    fun fireDue(ctx: Context) {
        synchronized(LOCK) {
        val now = System.currentTimeMillis()
        val done = fired(ctx)
        val items = read(ctx)
        // android-13 (R2E-1): si algo no pudo mostrarse, el reintento respira
        // 30 min — la marca «ya sonó» sigue intacta (BZ-63 manda), pero la
        // cáscara ya no gira en vacío cada 3 segundos hasta que el aviso
        // envejece fuera de la ventana de 6 h.
        var blocked = false
        val due = items.filter { it.id !in done && it.at <= now + 60_000 && it.at > now - LATE_LIMIT }
        for (it in due) { if (show(ctx, it)) done.add(it.id) else blocked = true }
        // android-14 (R3E-2): lo perdido se intenta como resumen durante un
        // día entero de reintentos; pasado ese día se retira en silencio —
        // la cadena de reintentos no puede ser eterna con las notificaciones
        // apagadas para siempre.
        val missedAll = items.filter { it.id !in done && it.at <= now - LATE_LIMIT }
        val missed = missedAll.filter { it.at > now - LATE_LIMIT - 24 * 60 * 60 * 1000L }
        (missedAll - missed.toSet()).forEach { done.add(it.id) }
        if (missed.isNotEmpty()) {
            val titles = missed.joinToString(" · ") { it.title }.take(600)
            val summary = Item(
                "resumen-" + now, now, missed.first().kind,
                if (missed.size == 1) "Mientras el teléfono estaba apagado: 1 aviso" else "Mientras el teléfono estaba apagado: ${missed.size} avisos",
                titles, "/",
            )
            if (show(ctx, summary)) missed.forEach { done.add(it.id) } else {
                blocked = true
                // android-15 (R4E-1): la deuda queda PERSISTIDA con su
                // instante — cualquier arm() posterior la respeta en vez de
                // cancelarla o posponerla (ver summaryRetryAt).
                prefs(ctx).edit().putLong("retryAt", now + BLOCKED_RETRY_MS).apply()
            }
        }
        prefs(ctx).edit().putStringSet("fired", done).apply()
        // android-14 (R3E-1/R3E-2): la alarma final es la más temprana de dos
        // candidatas honestas — la hora PROPIA del próximo aviso futuro (el
        // respiro de lo bloqueado no se le cobra) y, solo si algo no pudo
        // mostrarse, el reintento a 30 min (que así alcanza también al
        // resumen perdido, al que nextAt no puede nombrar).
        val nextFuture = items.filter { it.id !in done && it.at > now }.minOfOrNull { it.at } ?: 0L
        val retry = if (blocked) now + BLOCKED_RETRY_MS else 0L
        armAt(ctx, listOf(nextFuture, retry).filter { it > 0 }.minOrNull() ?: 0L)
        }
    }

    /** True only when the notification was actually published. */
    fun show(ctx: Context, it: Item): Boolean {
        channels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
        if (!nm.areNotificationsEnabled()) return false
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
        return true
    }

    /* Ola 5 (BZ-45): un solo reloj — la zona del aparato manda también en la
     * cáscara. Ante un cambio de zona, cada instante guardado se recalcula
     * desde su hora de pared (`wall`): las 19:00 elegidas vuelven a ser las
     * 19:00 del lugar nuevo, en vez de sonar desplazadas hasta que la app se
     * abra y reconstruya la lista. Los ítems sin `wall` (paquetes viejos)
     * conservan su instante. */
    fun retime(ctx: Context) {
        synchronized(LOCK) {
        val items = read(ctx)
        if (items.none { it.wall.isNotBlank() }) return
        val arr = JSONArray()
        var changed = false
        for (it in items) {
            var at = it.at
            if (it.wall.length >= 16) {
                val p = { a: Int, b: Int -> it.wall.substring(a, b).toIntOrNull() }
                val y = p(0, 4); val mo = p(5, 7); val d = p(8, 10); val h = p(11, 13); val mi = p(14, 16)
                if (y != null && mo != null && d != null && h != null && mi != null) {
                    val cal = Calendar.getInstance().apply {
                        set(y, mo - 1, d, h, mi, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                    if (cal.timeInMillis != it.at) { at = cal.timeInMillis; changed = true }
                }
            }
            arr.put(JSONObject().put("id", it.id).put("at", at).put("kind", it.kind)
                .put("title", it.title).put("body", it.body).put("route", it.route)
                .put("wall", it.wall).put("hash", it.hash))
        }
        if (changed) {
            prefs(ctx).edit().putString("items", arr.toString()).apply()
            arm(ctx)
        }
        }
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
                Notify.retime(ctx) // Ola 5 (BZ-45): tras un cambio de zona, los instantes se recalculan desde su hora de pared
                Notify.fireDue(ctx)
                HoyWidget.refresh(ctx)
                PanelWidget.refresh(ctx)
                SemanaWidget.refresh(ctx)
                Notify.armWidgetTick(ctx)
            }
        }
    }
}
